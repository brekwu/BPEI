import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

export const listTerminalLocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("terminal_locations")
      .select("*")
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createTerminalLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    shopId: string; name: string;
    line1: string; city: string; postal_code: string; country?: string;
    setDefault?: boolean;
  }) => z.object({
    shopId: uuid,
    name: z.string().min(1).max(120),
    line1: z.string().min(1).max(200),
    city: z.string().min(1).max(80),
    postal_code: z.string().min(1).max(20),
    country: z.string().length(2).optional(),
    setDefault: z.boolean().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { assertShopManager, getStripe, stripeEnvironment, resolveShopStripeAccount, stripeOptsFor, readTerminalFlag, assertFlagAllows } = await import("./terminal.server");
    await assertShopManager(context.supabase, context.userId, data.shopId);
    const flag = await readTerminalFlag();
    const env = stripeEnvironment();
    assertFlagAllows(flag, env === "live");
    const acct = await resolveShopStripeAccount(data.shopId);

    const stripe = getStripe();
    const loc = await stripe.terminal.locations.create({
      display_name: data.name,
      address: {
        line1: data.line1,
        city: data.city,
        postal_code: data.postal_code,
        country: (data.country ?? "FR").toUpperCase(),
      },
    }, stripeOptsFor(acct.accountId));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.setDefault) {
      await supabaseAdmin.from("terminal_locations")
        .update({ is_default: false })
        .eq("shop_id", data.shopId).eq("livemode", env === "live");
    }
    const { data: row, error } = await supabaseAdmin.from("terminal_locations").insert({
      shop_id: data.shopId,
      stripe_location_id: loc.id,
      stripe_account_id: acct.accountId,
      name: data.name,
      address: loc.address as any,
      livemode: env === "live",
      is_default: !!data.setDefault,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTerminalLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; locationId: string }) =>
    z.object({ shopId: uuid, locationId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { assertShopManager, getStripe, stripeOptsFor, resolveShopStripeAccount } = await import("./terminal.server");
    await assertShopManager(context.supabase, context.userId, data.shopId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: loc } = await supabaseAdmin.from("terminal_locations")
      .select("stripe_location_id, shop_id, stripe_account_id")
      .eq("id", data.locationId).maybeSingle();
    if (!loc || loc.shop_id !== data.shopId) throw new Error("Emplacement introuvable");
    const acct = await resolveShopStripeAccount(data.shopId);
    const stripe = getStripe();
    try { await stripe.terminal.locations.del(loc.stripe_location_id, stripeOptsFor(acct.accountId)); } catch {}
    await supabaseAdmin.from("terminal_locations").delete().eq("id", data.locationId);
    return { ok: true };
  });