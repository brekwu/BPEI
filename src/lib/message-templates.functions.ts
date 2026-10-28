import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const channel = z.enum(["note", "email", "sms"]);

export const listMessageTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("message_templates")
      .select("*")
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertMessageTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    id?: string | null;
    shopId: string;
    name: string;
    channel: "note" | "email" | "sms";
    subject?: string | null;
    body: string;
    category?: string | null;
    active?: boolean;
  }) => z.object({
    id: uuid.nullable().optional(),
    shopId: uuid,
    name: z.string().min(1).max(200),
    channel,
    subject: z.string().max(300).nullable().optional(),
    body: z.string().min(1).max(10000),
    category: z.string().max(80).nullable().optional(),
    active: z.boolean().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const payload = {
      shop_id: data.shopId,
      name: data.name,
      channel: data.channel,
      subject: data.subject ?? null,
      body: data.body,
      category: data.category ?? null,
      active: data.active ?? true,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await context.supabase.from("message_templates").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase.from("message_templates").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteMessageTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("message_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });