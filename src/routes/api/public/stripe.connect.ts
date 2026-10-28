import { createFileRoute } from "@tanstack/react-router";

/**
 * Stripe Connect webhook — handles account.updated (and related) events for
 * shops' Express accounts. Endpoint is under /api/public/ so it bypasses the
 * published site auth gate; we authenticate via Stripe's signature.
 *
 * Configure the webhook in Stripe Dashboard with the "Connect" filter,
 * targeting this URL. Store the signing secret as STRIPE_CONNECT_WEBHOOK_SECRET.
 */
export const Route = createFileRoute("/api/public/stripe/connect")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("Missing signature", { status: 401 });

        const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
        if (!secret) return new Response("Webhook secret not configured", { status: 500 });

        const rawBody = await request.text();
        const { getStripe, classifyAccount } = await import("@/lib/stripe.server");
        const stripe = getStripe();

        let event;
        try {
          event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
        } catch (err) {
          console.error("Stripe webhook signature verification failed", err);
          return new Response("Invalid signature", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotency guard
        const { data: existing } = await supabaseAdmin
          .from("stripe_events")
          .select("id, processed_at")
          .eq("stripe_event_id", event.id)
          .maybeSingle();
        if (existing?.processed_at) {
          return new Response("Already processed", { status: 200 });
        }

        const accountId = (event.account as string | undefined)
          ?? (event.data.object && (event.data.object as { id?: string }).id?.startsWith("acct_") ? (event.data.object as { id?: string }).id : undefined);

        // Find shop by account id (may be null for platform-level events)
        let shopId: string | null = null;
        if (accountId) {
          const { data: shop } = await supabaseAdmin
            .from("shops").select("id").eq("stripe_account_id", accountId).maybeSingle();
          shopId = shop?.id ?? null;
        }

        await supabaseAdmin.from("stripe_events").upsert({
          stripe_event_id: event.id,
          event_type: event.type,
          account_id: accountId ?? null,
          shop_id: shopId,
          livemode: event.livemode,
          payload: event as any,
        }, { onConflict: "stripe_event_id" });

        let processingError: string | null = null;
        try {
          switch (event.type) {
            case "account.updated":
            case "account.application.authorized":
            case "capability.updated": {
              if (accountId) {
                const acc = await stripe.accounts.retrieve(accountId);
                const st = classifyAccount(acc);
                await supabaseAdmin
                  .from("shops")
                  .update({
                    stripe_charges_enabled: st.chargesEnabled,
                    stripe_payouts_enabled: st.payoutsEnabled,
                    stripe_details_submitted: st.detailsSubmitted,
                    stripe_onboarding_status: st.onboarding,
                    stripe_requirements: st.requirements as any,
                    stripe_synced_at: new Date().toISOString(),
                  })
                  .eq("stripe_account_id", accountId);
              }
              break;
            }
            case "account.application.deauthorized": {
              if (accountId) {
                await supabaseAdmin
                  .from("shops")
                  .update({
                    stripe_charges_enabled: false,
                    stripe_payouts_enabled: false,
                    stripe_onboarding_status: "disabled",
                    stripe_synced_at: new Date().toISOString(),
                  } as any)
                  .eq("stripe_account_id", accountId);
              }
              break;
            }
            case "checkout.session.completed": {
              const session = event.data.object as any;
              if (session.payment_status === "paid" && session.payment_intent) {
                await recordStripePaymentFromIntent(supabaseAdmin, stripe, accountId!, session.payment_intent as string, session.metadata ?? {});
              }
              break;
            }
            case "payment_intent.succeeded": {
              const pi = event.data.object as any;
              if (accountId) {
                await recordStripePaymentFromIntent(supabaseAdmin, stripe, accountId, pi.id as string, pi.metadata ?? {}, pi);
              }
              break;
            }
            case "charge.refunded": {
              const charge = event.data.object as any;
              const pi = charge.payment_intent as string | null;
              if (pi) {
                await syncStripeRefund(supabaseAdmin, pi, charge);
              }
              break;
            }
            default:
              // Other events are logged but not acted upon in this session.
              break;
          }
        } catch (err) {
          processingError = err instanceof Error ? err.message : String(err);
          console.error("Stripe webhook processing error", event.type, err);
        }

        await supabaseAdmin
          .from("stripe_events")
          .update({
            processed_at: new Date().toISOString(),
            processing_error: processingError,
          })
          .eq("stripe_event_id", event.id);

        return new Response("ok", { status: 200 });
      },
    },
  },
});

/**
 * Insert (idempotently) a payment row for a succeeded Stripe payment intent,
 * mark the associated invoice as paid, and close the payment link if any.
 *
 * The unique index (shop_id, provider_reference) WHERE provider='stripe'
 * makes duplicate inserts a no-op, so retries and both webhook events
 * (checkout.session.completed AND payment_intent.succeeded) converge safely.
 */
async function recordStripePaymentFromIntent(
  supabaseAdmin: any,
  stripe: any,
  accountId: string,
  paymentIntentId: string,
  metadata: Record<string, string>,
  intentPreloaded?: any,
) {
  const intent = intentPreloaded
    ?? await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] }, { stripeAccount: accountId });
  const meta = { ...(intent.metadata ?? {}), ...metadata };
  const shopId: string | undefined = meta.bpei_shop_id;
  if (!shopId) return;

  // Idempotency: bail if a row already exists.
  const { data: existing } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("shop_id", shopId)
    .eq("provider", "stripe")
    .eq("provider_reference", intent.id)
    .maybeSingle();
  if (existing) return;

  const invoiceId: string | null = meta.bpei_invoice_id && meta.bpei_invoice_id !== "" ? meta.bpei_invoice_id : null;
  const linkId: string | null = meta.bpei_payment_link_id ?? null;
  const amount = intent.amount_received ?? intent.amount ?? 0;
  const currency = ((intent.currency ?? "eur") as string).toUpperCase();
  const fee = intent.application_fee_amount ?? null;
  const paidAt = intent.created ? new Date(intent.created * 1000).toISOString() : new Date().toISOString();

  // Resolve customer_id from invoice or payment link if we have one
  let customerId: string | null = null;
  if (linkId) {
    const { data: l } = await supabaseAdmin
      .from("payment_links").select("customer_id, invoice_id").eq("id", linkId).maybeSingle();
    customerId = l?.customer_id ?? null;
  }
  if (!customerId && invoiceId) {
    const { data: inv } = await supabaseAdmin
      .from("invoices").select("customer_id").eq("id", invoiceId).maybeSingle();
    customerId = inv?.customer_id ?? null;
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("payments")
    .insert({
      shop_id: shopId,
      customer_id: customerId,
      invoice_id: invoiceId,
      amount_cents: amount,
      currency,
      method: "online",
      status: "confirmed",
      provider: "stripe",
      provider_reference: intent.id,
      reference: intent.id,
      paid_at: paidAt,
      platform_fee_cents: fee,
      notes: `Paiement carte Stripe (${intent.id})`,
    } as any)
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);
  const paymentId = inserted.id;

  // Update invoice totals
  if (invoiceId) {
    const { data: inv } = await supabaseAdmin
      .from("invoices")
      .select("total_including_tax_cents, amount_paid_cents, status")
      .eq("id", invoiceId).maybeSingle();
    if (inv) {
      const paid = (inv.amount_paid_cents ?? 0) + amount;
      const due = Math.max((inv.total_including_tax_cents ?? 0) - paid, 0);
      const status = due === 0 ? "paid" : (paid > 0 ? "partially_paid" : inv.status);
      await supabaseAdmin.from("invoices").update({
        amount_paid_cents: paid,
        amount_due_cents: due,
        status,
        paid_at: due === 0 ? paidAt : undefined,
      } as any).eq("id", invoiceId);
    }
  }

  // Close the payment link
  if (linkId) {
    await supabaseAdmin.from("payment_links").update({
      status: "paid",
      paid_payment_id: paymentId,
      paid_at: paidAt,
    } as any).eq("id", linkId).eq("status", "pending");
  }
}

/**
 * Sync a Stripe refund back onto the local payments row and, if the
 * associated invoice was marked paid, walk it back to partially_paid / issued.
 */
async function syncStripeRefund(supabaseAdmin: any, paymentIntentId: string, charge: any) {
  const { data: pay } = await supabaseAdmin
    .from("payments")
    .select("id, shop_id, invoice_id, amount_cents, refunded_amount_cents")
    .eq("provider", "stripe")
    .eq("provider_reference", paymentIntentId)
    .maybeSingle();
  if (!pay) return;

  const refunded = charge.amount_refunded ?? 0;
  if (refunded === (pay.refunded_amount_cents ?? 0)) return;
  const fullyRefunded = refunded >= (pay.amount_cents ?? 0);

  await supabaseAdmin.from("payments").update({
    refunded_amount_cents: refunded,
    status: fullyRefunded ? "refunded" : "confirmed",
  } as any).eq("id", pay.id);

  if (pay.invoice_id) {
    const delta = refunded - (pay.refunded_amount_cents ?? 0);
    const { data: inv } = await supabaseAdmin
      .from("invoices")
      .select("total_including_tax_cents, amount_paid_cents")
      .eq("id", pay.invoice_id).maybeSingle();
    if (inv) {
      const paid = Math.max((inv.amount_paid_cents ?? 0) - delta, 0);
      const due = Math.max((inv.total_including_tax_cents ?? 0) - paid, 0);
      const status = due === 0 ? "paid" : (paid > 0 ? "partially_paid" : "issued");
      await supabaseAdmin.from("invoices").update({
        amount_paid_cents: paid,
        amount_due_cents: due,
        status,
        paid_at: due === 0 ? undefined : null,
      } as any).eq("id", pay.invoice_id);
    }
  }
}