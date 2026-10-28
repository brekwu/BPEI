import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import { createQuoteDraft } from "@/lib/quotes.functions";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/quotes/new")({
  head: () => ({ meta: [{ title: "Nouveau devis — BPEI" }] }),
  component: NewQuote,
});

function NewQuote() {
  const ctx = useShop();
  const nav = useNavigate();
  const createFn = useServerFn(createQuoteDraft);
  const m = useMutation({
    mutationFn: () => createFn({ data: { shopId: ctx.shopId } }),
    onSuccess: (row: any) => nav({ to: "/app/shop/$shopId/quotes/$quoteId", params: { shopId: ctx.shopId, quoteId: row.id } }),
  });
  useEffect(() => { m.mutate(); }, []); // eslint-disable-line
  return <div className="p-8 text-sm text-muted-foreground">Création du brouillon…</div>;
}