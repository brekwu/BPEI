// Public server functions for the marketing site forms.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/security/rate-limit.server";

async function serverPublicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function shortRef(prefix: string) {
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  const time = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${time}${random}`;
}

const uuid = z.string().uuid();

const ContactSchema = z.object({
  subject_kind: z.enum(["particulier","boutique","rejoindre","support","commercial","reclamation","autre"]),
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional().nullable(),
  shop_name: z.string().trim().max(160).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  shop_id: uuid.optional().nullable(),
  origin_path: z.string().trim().max(200).optional().nullable(),
  message: z.string().trim().min(10).max(4000),
  consent: z.literal(true),
});

export const submitContact = createServerFn({ method: "POST" })
  .validator((i: z.input<typeof ContactSchema>) => ContactSchema.parse(i))
  .handler(async ({ data }) => {
    await enforceRateLimit({ endpoint: "contact" });
    const supabase = await serverPublicClient();
    let verifiedShopId: string | null = null;
    let verifiedShopName: string | null = null;
    if (data.shop_id) {
      // Verify shop exists and is validated — never accept an arbitrary shop_id from the client
      const { data: shop } = await supabase
        .from("shops_public")
        .select("id, name")
        .eq("id", data.shop_id)
        .maybeSingle();
      if (shop) {
        verifiedShopId = shop.id;
        verifiedShopName = shop.name;
      }
    }
    const reference = shortRef("CONTACT");
    const { error } = await supabase.from("contact_submissions").insert({
      reference,
      subject_kind: data.subject_kind,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone ?? null,
      shop_name: verifiedShopName ?? data.shop_name ?? null,
      shop_id: verifiedShopId,
      city: data.city ?? null,
      origin_path: data.origin_path ?? null,
      message: data.message,
      consent: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true, reference };
  });

const DemoSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  shop_name: z.string().trim().min(1).max(160),
  city: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(6).max(30),
  establishments_count: z.number().int().min(1).max(999).optional().nullable(),
  preferred_slot: z.string().trim().max(200).optional().nullable(),
  message: z.string().trim().max(2000).optional().nullable(),
  consent: z.literal(true),
});

export const submitDemoRequest = createServerFn({ method: "POST" })
  .validator((i: z.input<typeof DemoSchema>) => DemoSchema.parse(i))
  .handler(async ({ data }) => {
    await enforceRateLimit({ endpoint: "contact" });
    const supabase = await serverPublicClient();
    const reference = shortRef("DEMO");
    const { error } = await supabase.from("demo_requests").insert({
      reference,
      first_name: data.first_name,
      last_name: data.last_name,
      shop_name: data.shop_name,
      city: data.city ?? null,
      email: data.email,
      phone: data.phone,
      establishments_count: data.establishments_count ?? null,
      preferred_slot: data.preferred_slot ?? null,
      message: data.message ?? null,
      consent: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true, reference };
  });