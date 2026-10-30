import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BpeiAdminAccess = "loading" | "allowed" | "denied";

/**
 * Fail-closed admin UI gate. RLS is still the authoritative enforcement layer.
 * A cross-tab logout or account switch must immediately unmount private views.
 * In-flight permission checks are invalidated on every auth transition.
 */
export function useBpeiAdminAccess(retryKey = 0): BpeiAdminAccess {
  const [access, setAccess] = useState<BpeiAdminAccess>("loading");

  useEffect(() => {
    let active = true;
    let generation = 0;

    const check = async () => {
      const current = ++generation;
      setAccess("loading");
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!active || current !== generation) return;
        if (error || !data.user) {
          setAccess("denied");
          return;
        }
        const { data: admin, error: roleError } = await (supabase as any)
          .from("independent_admins")
          .select("user_id")
          .eq("user_id", data.user.id)
          .maybeSingle();
        if (!active || current !== generation) return;
        setAccess(!roleError && admin?.user_id === data.user.id ? "allowed" : "denied");
      } catch {
        if (active && current === generation) setAccess("denied");
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === "SIGNED_OUT") {
        ++generation;
        setAccess("denied");
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        const requested = ++generation;
        setAccess("loading");
        // Schedule outside Supabase's auth callback to avoid auth-client deadlocks.
        setTimeout(() => {
          if (active && requested === generation) void check();
        }, 0);
      }
    });

    void check();
    return () => {
      active = false;
      ++generation;
      subscription.unsubscribe();
    };
  }, [retryKey]);

  return access;
}
