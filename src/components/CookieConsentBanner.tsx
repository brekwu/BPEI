import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { recordCookieConsent } from "@/lib/legal.functions";

const STORAGE_KEY = "bpei_cookie_consent_v1";
const POLICY_VERSION = "1.0";

type Consent = { preferences: boolean; analytics: boolean; external_features: boolean; advertising: boolean; ts: string; pid: string };

function newPseudonym() {
  return `pid_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [prefs, setPrefs] = useState({ preferences: false, analytics: false, external_features: false, advertising: false });
  const record = useServerFn(recordCookieConsent);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { setVisible(true); return; }
      const parsed: Consent = JSON.parse(raw);
      const age = Date.now() - new Date(parsed.ts).getTime();
      if (age > 13 * 30 * 24 * 3600 * 1000) setVisible(true);
    } catch { setVisible(true); }
  }, []);

  async function save(all: boolean) {
    const p = all
      ? { preferences: true, analytics: true, external_features: true, advertising: true }
      : prefs;
    const pid = newPseudonym();
    const payload: Consent = { ...p, ts: new Date().toISOString(), pid };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch {}
    setVisible(false);
    try {
      await record({ data: { pseudonym_id: pid, policy_version: POLICY_VERSION, ...p } });
    } catch {}
  }

  function refuseAll() { setPrefs({ preferences: false, analytics: false, external_features: false, advertising: false }); void save(false); }

  if (!visible) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 p-4 shadow-lg backdrop-blur">
      <div className="mx-auto max-w-6xl">
        {!showDetails ? (
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-foreground/90">
              Nous utilisons des cookies strictement nécessaires au fonctionnement du site.
              D'autres cookies (préférences, mesure d'audience) requièrent votre accord.{" "}
              <Link to="/cookies" className="underline underline-offset-2">En savoir plus</Link>.
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={refuseAll} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary">Tout refuser</button>
              <button onClick={() => setShowDetails(true)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary">Personnaliser</button>
              <button onClick={() => save(true)} className="rounded-md bg-electric px-3 py-1.5 text-sm font-medium text-electric-foreground hover:bg-electric/90">Tout accepter</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Row label="Cookies nécessaires (toujours actifs)" checked disabled />
              <Row label="Préférences" checked={prefs.preferences} onChange={(v) => setPrefs((p) => ({ ...p, preferences: v }))} />
              <Row label="Mesure d'audience" checked={prefs.analytics} onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))} />
              <Row label="Fonctionnalités externes" checked={prefs.external_features} onChange={(v) => setPrefs((p) => ({ ...p, external_features: v }))} />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={() => setShowDetails(false)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary">Retour</button>
              <button onClick={() => save(false)} className="rounded-md bg-electric px-3 py-1.5 text-sm font-medium text-electric-foreground hover:bg-electric/90">Enregistrer mes choix</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}