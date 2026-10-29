import { supabase } from "@/integrations/supabase/client";

export async function logActivity(params: {
  shopId: string;
  entityType: string;
  entityId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  await supabase.from("activity_logs").insert({
    shop_id: params.shopId,
    actor_user_id: userData.user.id,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    action: params.action,
    metadata: (params.metadata ?? {}) as never,
  });
}