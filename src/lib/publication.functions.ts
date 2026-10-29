// Sous-lot B — publication de la page publique, dossier juridique, horaires multi-plages,
// et personnalisation (couleurs, description, réseaux).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const optStr = (n: number) => z.string().max(n).nullable().optional();

// ---- Éditeur : sauvegarde des champs publics + thème + réseaux
const socialSchema = z.object({
  facebook: optStr(300),
  instagram: optStr(300),
  linkedin: optStr(300),
  x: optStr(300),
  youtube: optStr(300),
  tiktok: optStr(300),
}).partial();

export const savePublicPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    shopId: string;
    public_name?: string | null;
    public_description?: string | null;
    public_email?: string | null;
    website?: string | null;
    theme_primary_color?: string | null;
    theme_accent_color?: string | null;
    social_links?: z.infer<typeof socialSchema>;
  }) => z.object({
    shopId: uuid,
    public_name: optStr(200),
    public_description: optStr(2000),
    public_email: z.string().max(255).email().nullable().optional().or(z.literal("")),
    website: optStr(300),
    theme_primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
    theme_accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
    social_links: socialSchema.optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const patch: {
      public_name?: string | null; public_description?: string | null;
      public_email?: string | null; website?: string | null;
      theme_primary_color?: string | null; theme_accent_color?: string | null;
      social_links?: Record<string, string | null | undefined>;
    } = {};
    if (data.public_name !== undefined) patch.public_name = data.public_name || null;
    if (data.public_description !== undefined) patch.public_description = data.public_description || null;
    if (data.public_email !== undefined) patch.public_email = data.public_email || null;
    if (data.website !== undefined) patch.website = data.website || null;
    if (data.theme_primary_color !== undefined) patch.theme_primary_color = data.theme_primary_color ?? null;
    if (data.theme_accent_color !== undefined) patch.theme_accent_color = data.theme_accent_color ?? null;
    if (data.social_links !== undefined) patch.social_links = data.social_links;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase.from("shops").update(patch).eq("id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Horaires multi-plages
const slotSchema = z.object({
  day_of_week: z.number().min(0).max(6),
  slot_index: z.number().min(0).max(3),
  opens_at: z.string().nullable(),
  closes_at: z.string().nullable(),
  is_closed: z.boolean(),
});

export const replaceBusinessHoursMulti = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; slots: z.infer<typeof slotSchema>[] }) =>
    z.object({ shopId: uuid, slots: z.array(slotSchema).max(28) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("shop_replace_business_hours", {
      _shop_id: data.shopId,
      _slots: data.slots as unknown as string,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Publication (gérant)
export const requestPublication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; notes?: string | null }) =>
    z.object({ shopId: uuid, notes: optStr(2000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("shop_request_publication", {
      _shop_id: data.shopId, _notes: (data.notes ?? undefined) as unknown as string,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unpublishShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("shop_unpublish", { _shop_id: data.shopId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Publication (patron BPEI)
export const approvePublication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; notes?: string | null }) =>
    z.object({ shopId: uuid, notes: optStr(2000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("owner_approve_publication", {
      _shop_id: data.shopId, _notes: (data.notes ?? undefined) as unknown as string,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectPublication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; notes: string }) =>
    z.object({ shopId: uuid, notes: z.string().min(5).max(2000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("owner_reject_publication", {
      _shop_id: data.shopId, _notes: data.notes,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Dossier juridique
export const submitLegalDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("shop_submit_legal", { _shop_id: data.shopId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const approveLegal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; notes?: string | null }) =>
    z.object({ shopId: uuid, notes: optStr(2000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("owner_approve_legal", {
      _shop_id: data.shopId, _notes: (data.notes ?? undefined) as unknown as string,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectLegal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; notes: string }) =>
    z.object({ shopId: uuid, notes: z.string().min(5).max(2000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("owner_reject_legal", {
      _shop_id: data.shopId, _notes: data.notes,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });