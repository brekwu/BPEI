// Client-side cart store keyed by shop, persisted in localStorage.
import { useSyncExternalStore } from "react";

export type CartLine = {
  kind: "service" | "product";
  refId: string;         // service_catalog.id or stock_items.id
  name: string;
  unit_price_cents: number;
  tax_rate: number;
  quantity: number;
};

const KEY = (shopId: string) => `bpei.cart.v1.${shopId}`;
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

function read(shopId: string): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY(shopId));
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}
function write(shopId: string, lines: CartLine[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY(shopId), JSON.stringify(lines));
  emit();
}

export const cart = {
  get(shopId: string): CartLine[] { return read(shopId); },
  add(shopId: string, item: Omit<CartLine, "quantity">, qty = 1) {
    const cur = read(shopId);
    const idx = cur.findIndex((c) => c.kind === item.kind && c.refId === item.refId);
    if (idx >= 0) cur[idx] = { ...cur[idx], quantity: cur[idx].quantity + qty };
    else cur.push({ ...item, quantity: qty });
    write(shopId, cur);
  },
  setQty(shopId: string, kind: string, refId: string, qty: number) {
    const cur = read(shopId).map((c) => (c.kind === kind && c.refId === refId ? { ...c, quantity: qty } : c));
    write(shopId, qty <= 0 ? cur.filter((c) => !(c.kind === kind && c.refId === refId)) : cur);
  },
  remove(shopId: string, kind: string, refId: string) {
    write(shopId, read(shopId).filter((c) => !(c.kind === kind && c.refId === refId)));
  },
  clear(shopId: string) { write(shopId, []); },
  subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); },
};

export function useCart(shopId: string) {
  const subscribe = (cb: () => void) => cart.subscribe(cb);
  const getSnapshot = () => {
    if (typeof window === "undefined") return "[]";
    return localStorage.getItem(KEY(shopId)) ?? "[]";
  };
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => "[]");
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as CartLine[]) : [];
  } catch { return [] as CartLine[]; }
}

export function cartTotals(lines: CartLine[]) {
  let sub = 0, tax = 0, tot = 0;
  for (const l of lines) {
    const s = Math.round(l.unit_price_cents * l.quantity);
    const t = Math.round(s * (l.tax_rate / 100));
    sub += s; tax += t; tot += s + t;
  }
  return { subtotal_cents: sub, tax_cents: tax, total_cents: tot };
}