import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getTurnstileConfig } from "@/lib/security/turnstile-config.functions";

interface Props {
  onVerify: (token: string | null) => void;
  action?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

let scriptLoading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise<void>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
    if (existing) {
      const check = () => window.turnstile ? resolve() : setTimeout(check, 50);
      check();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.setAttribute("data-turnstile", "1");
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
  return scriptLoading;
}

export function TurnstileWidget({ onVerify, action }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const getConfig = useServerFn(getTurnstileConfig);
  const [siteKey, setSiteKey] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    getConfig().then((cfg) => { if (mounted) setSiteKey(cfg.siteKey); }).catch(() => { if (mounted) setSiteKey(null); });
    return () => { mounted = false; };
  }, [getConfig]);

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !window.turnstile || !ref.current) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        action: action ?? "submit",
        callback: (token: string) => onVerify(token),
        "error-callback": () => onVerify(null),
        "expired-callback": () => onVerify(null),
        theme: "light",
      });
    });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch { /* ignore */ }
        widgetId.current = null;
      }
    };
  }, [siteKey, action, onVerify]);

  useEffect(() => {
    if (siteKey === null) onVerify("dev-bypass");
  }, [siteKey, onVerify]);

  if (siteKey === undefined) {
    return <div className="text-xs text-muted-foreground">Chargement de la vérification anti-robot…</div>;
  }
  if (siteKey === null) {
    return null;
  }
  return <div ref={ref} className="my-3" />;
}