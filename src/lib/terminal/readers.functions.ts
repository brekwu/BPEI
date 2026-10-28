import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

export const listTerminalReaders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("terminal_readers")
      .select("*, location:terminal_locations(name)")
      .eq("shop_id", data.shopId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const registerTerminalReader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; locationId: string; registrationCode: string; label: string; setDefault?: boolean }) =>
    z.object({
      shopId: uuid,
      locationId: uuid,
      registrationCode: z.string().min(3).max(120),
      label: z.string().min(1).max(80),
      setDefault: z.boolean().optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { assertShopManager, getStripe, stripeOptsFor, resolveShopStripeAccount, stripeEnvironment, readTerminalFlag, assertFlagAllows } = await import("./terminal.server");
    await assertShopManager(context.supabase, context.userId, data.shopId);
    const flag = await readTerminalFlag();
    const env = stripeEnvironment();
    assertFlagAllows(flag, env === "live");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: loc } = await supabaseAdmin.from("terminal_locations")
      .select("stripe_location_id, shop_id").eq("id", data.locationId).maybeSingle();
    if (!loc || loc.shop_id !== data.shopId) throw new Error("Emplacement introuvable");

    const acct = await resolveShopStripeAccount(data.shopId);
    const stripe = getStripe();
    const reader = await stripe.terminal.readers.create({
      registration_code: data.registrationCode,
      label: data.label,
      location: loc.stripe_location_id,
    }, stripeOptsFor(acct.accountId));

    if (data.setDefault) {
      await supabaseAdmin.from("terminal_readers")
        .update({ is_default: false })
        .eq("shop_id", data.shopId).eq("livemode", env === "live");
    }
    const { data: row, error } = await supabaseAdmin.from("terminal_readers").insert({
      shop_id: data.shopId,
      location_id: data.locationId,
      stripe_account_id: acct.accountId,
      stripe_reader_id: reader.id,
      stripe_location_id: loc.stripe_location_id,
      label: data.label,
      serial_number: reader.serial_number ?? null,
      device_type: reader.device_type ?? null,
      status: reader.status ?? null,
      livemode: env === "live",
      is_default: !!data.setDefault,
      is_simulated: false,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Create a simulated Wisepos reader (TEST mode only). */
export const createSimulatedReader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; locationId: string; label?: string; setDefault?: boolean }) =>
    z.object({ shopId: uuid, locationId: uuid, label: z.string().max(80).optional(), setDefault: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { assertShopManager, getStripe, stripeOptsFor, resolveShopStripeAccount, stripeEnvironment } = await import("./terminal.server");
    await assertShopManager(context.supabase, context.userId, data.shopId);
    if (stripeEnvironment() === "live") throw new Error("Lecteur simulé indisponible en LIVE");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: loc } = await supabaseAdmin.from("terminal_locations")
      .select("stripe_location_id, shop_id").eq("id", data.locationId).maybeSingle();
    if (!loc || loc.shop_id !== data.shopId) throw new Error("Emplacement introuvable");
    const acct = await resolveShopStripeAccount(data.shopId);
    const stripe = getStripe();
    // Simulated reader registration code is fixed by Stripe.
    const reader = await stripe.terminal.readers.create({
      registration_code: "simulated-wpe",
      label: data.label ?? "Lecteur simulé",
      location: loc.stripe_location_id,
    }, stripeOptsFor(acct.accountId));

    if (data.setDefault) {
      await supabaseAdmin.from("terminal_readers")
        .update({ is_default: false })
        .eq("shop_id", data.shopId).eq("livemode", false);
    }
    const { data: row, error } = await supabaseAdmin.from("terminal_readers").insert({
      shop_id: data.shopId,
      location_id: data.locationId,
      stripe_account_id: acct.accountId,
      stripe_reader_id: reader.id,
      stripe_location_id: loc.stripe_location_id,
      label: data.label ?? "Lecteur simulé",
      device_type: reader.device_type ?? "simulated_wisepos_e",
      status: reader.status ?? "online",
      livemode: false,
      is_default: !!data.setDefault,
      is_simulated: true,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const setDefaultReader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; readerId: string }) =>
    z.object({ shopId: uuid, readerId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { assertShopManager } = await import("./terminal.server");
    await assertShopManager(context.supabase, context.userId, data.shopId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r } = await supabaseAdmin.from("terminal_readers")
      .select("id, shop_id, livemode").eq("id", data.readerId).maybeSingle();
    if (!r || r.shop_id !== data.shopId) throw new Error("Lecteur introuvable");
    await supabaseAdmin.from("terminal_readers").update({ is_default: false })
      .eq("shop_id", data.shopId).eq("livemode", r.livemode);
    await supabaseAdmin.from("terminal_readers").update({ is_default: true }).eq("id", data.readerId);
    return { ok: true };
  });

export const deleteTerminalReader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; readerId: string }) =>
    z.object({ shopId: uuid, readerId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { assertShopManager, getStripe, stripeOptsFor, resolveShopStripeAccount } = await import("./terminal.server");
    await assertShopManager(context.supabase, context.userId, data.shopId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r } = await supabaseAdmin.from("terminal_readers")
      .select("shop_id, stripe_reader_id, stripe_account_id").eq("id", data.readerId).maybeSingle();
    if (!r || r.shop_id !== data.shopId) throw new Error("Lecteur introuvable");
    const acct = await resolveShopStripeAccount(data.shopId);
    const stripe = getStripe();
    try { await stripe.terminal.readers.del(r.stripe_reader_id, stripeOptsFor(acct.accountId)); } catch {}
    await supabaseAdmin.from("terminal_readers").delete().eq("id", data.readerId);
    return { ok: true };
  });