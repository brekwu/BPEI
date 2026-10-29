import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface PlatformRoleFlags {
  isAdminBpei: boolean;
  isClient: boolean;
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState<PlatformRoleFlags>({
    isAdminBpei: false,
    isClient: false,
  });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setFlags({ isAdminBpei: false, isClient: false });
      return;
    }
    supabase
      .from("user_platform_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .then(({ data }) => {
        const roles = new Set((data ?? []).map((r) => r.role));
        setFlags({
          isAdminBpei: roles.has("admin_bpei"),
          isClient: roles.has("client"),
        });
      });
  }, [session?.user?.id]);

  return { session, loading, flags };
}