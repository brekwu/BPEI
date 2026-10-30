/**
 * Return a TEST payment that has actually been recorded in BPEI's private
 * provider-verified ledger. Never infer payment from the immutable invoice
 * record, Checkout redirect, or a pending/failed attempt.
 *
 * The backend (signed Stripe webhook + RLS) is authoritative. This helper
 * only governs how those server records are shown to an authorized admin.
 */
export type TestPaymentEvidence={
 invoice_id:string;
 state:string;
 paid_at:string|null;
 amount_cents:number;
};

export function findConfirmedTestPayment<T extends TestPaymentEvidence>(
 invoiceId:string|null|undefined,
 expectedGrossCents:number,
 attempts:readonly T[],
):T|undefined{
 if(!invoiceId||!Number.isSafeInteger(expectedGrossCents)||expectedGrossCents<=0)
  return undefined;
 return attempts.find(p=>
  p.invoice_id===invoiceId&&p.state==="paid"
  &&typeof p.paid_at==="string"&&p.paid_at.length>0
  &&p.amount_cents===expectedGrossCents
 );
}
