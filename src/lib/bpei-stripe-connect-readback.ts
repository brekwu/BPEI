/** A mutation response is never enough to claim a Stripe TEST merchant is approved. */
export type VerifiedConnectMerchant={
 id:string;
 connected:boolean;
 providerChecked:boolean;
 approved:boolean;
};
export function isConfirmedTestMerchantApproval(
 merchants:readonly VerifiedConnectMerchant[],issuerId:string
):boolean{
 return merchants.some(m=>m.id===issuerId && m.connected===true
  && m.providerChecked===true && m.approved===true);
}
