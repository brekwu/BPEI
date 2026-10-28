// Stripe Connect webhook for Terminal + connected-account events.
// Path: /api/public/stripe/terminal-webhook (bypasses auth on published sites).
// Verifies signature with STRIPE_CONNECT_WEBHOOK_SECRET; idempotent via
// UNIQUE(stripe_event_id) on public.stripe_events.
import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";

export const Route = createFileRoute("/api/public/stripe/terminal-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sig = request.headers.get("stripe-signature");
        if (!sig) return new Response("Missing signature", { status: 400 });

        const secrets = [
          process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
          process.env.STRIPE_CONNECT_WEBHOOK_SECRET_TEST,
        ].filter((s): s is string => !!s && s.startsWith("whsec_"));
        const key = process.env.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY_TEST;
        if (secrets.length === 0 || !key) return new Response("Server not configured", { status: 500 });

        const stripe = new Stripe(key, { apiVersion: "2024-06-20" as Stripe.LatestApiVersion });
        const raw = await request.text();
        let event: Stripe.Event | null = null;
        let lastErr = "";
        for (const s of secrets) {
          try {
            event = await stripe.webhooks.constructEventAsync(raw, sig, s);
            break;
          } catch (e: any) {
            lastErr = e?.message ?? String(e);
          }
        }
        if (!event) return new Response(`Signature error: ${lastErr}`, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotent record. UNIQUE(stripe_event_id) → ignore duplicates.
        const { error: insErr } = await supabaseAdmin.from("stripe_events").insert({
          stripe_event_id: event.id,
          event_type: event.type,
          account_id: (event as any).account ?? null,
          livemode: event.livemode,
          payload: event as any,
        } as any);
        if (insErr && /duplicate|unique/i.test(insErr.message)) {
          return new Response("ok (duplicate)", { status: 200 });
        }
        if (insErr) {
          console.error("[terminal-webhook] insert error", insErr);
          return new Response("db error", { status: 500 });
        }

        try {
          const acct = (event as any).account as string | undefined;
          switch (event.type) {
            case "payment_intent.succeeded": {
              const pi = event.data.object as Stripe.PaymentIntent;
              const charge = pi.latest_charge && typeof pi.latest_charge === "object"
                ? (pi.latest_charge as Stripe.Charge) : null;
              const pmDetails = charge?.payment_method_details?.card_present as any;
              const { finalizeTerminalPayment } = await import("@/lib/terminal/finalize.server");
              await finalizeTerminalPayment({
                paymentIntentId: pi.id,
                accountId: acct ?? "",
                livemode: event.livemode,
                chargeId: (typeof pi.latest_charge === "string" ? pi.latest_charge : charge?.id) ?? null,
                cardBrand: pmDetails?.brand ?? null,
                cardLast4: pmDetails?.last4 ?? null,
              });
              break;
            }
            case "payment_intent.payment_failed":
            case "payment_intent.canceled": {
              const pi = event.data.object as Stripe.PaymentIntent;
              await supabaseAdmin.from("payments").update({
                status: event.type === "payment_intent.canceled" ? "cancelled" : "failed",
                local_state: event.type === "payment_intent.canceled" ? "canceled" : "failed",
                terminal_last_error: pi.last_payment_error?.message ?? null,
                terminal_completed_at: new Date().toISOString(),
              }).eq("stripe_payment_intent_id", pi.id);
              break;
            }
            case "terminal.reader.action_failed": {
              const reader = event.data.object as Stripe.Terminal.Reader;
              const piId = (reader.action as any)?.process_payment_intent?.payment_intent;
              if (piId) {
                await supabaseAdmin.from("payments").update({
                  local_state: "failed",
                  terminal_last_error: (reader.action as any)?.failure_message ?? "Lecteur : action échouée",
                }).eq("stripe_payment_intent_id", piId);
              }
              break;
            }
            case "account.updated": {
              const a = event.data.object as Stripe.Account;
              await supabaseAdmin.from("shops").update({
                stripe_charges_enabled: !!a.charges_enabled,
                stripe_payouts_enabled: !!a.payouts_enabled,
                stripe_details_submitted: !!a.details_submitted,
                stripe_synced_at: new Date().toISOString(),
              }).eq("stripe_account_id", a.id);
              break;
            }
            default:
              break;
          }

          await supabaseAdmin.from("stripe_events").update({
            processed_at: new Date().toISOString(),
          }).eq("stripe_event_id", event.id);
        } catch (e: any) {
          console.error("[terminal-webhook] processing error", e);
          await supabaseAdmin.from("stripe_events").update({
            processing_error: e?.message ?? String(e),
          }).eq("stripe_event_id", event.id);
          return new Response("processing error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});