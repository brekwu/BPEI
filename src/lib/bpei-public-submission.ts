/** Distinguish a definite policy/validation refusal from a potentially committed insert. */
export type PublicInquiryFailure="rejected"|"uncertain";

export function classifyPublicInquiryFailure(error:unknown):PublicInquiryFailure{
  if(!error||typeof error!=="object")return "uncertain";
  const value=error as {code?:unknown;message?:unknown};
  const code=typeof value.code==="string"?value.code:"";
  const message=typeof value.message==="string"?value.message:"";
  // The database spam guard runs BEFORE the uniqueness check and returns 22023
  // when the same inquiry has already been committed. Never treat it as retryable.
  if(code==="22023"&&/duplicate inquiry/i.test(message))return "uncertain";
  if(code==="42501"||code==="23514"||code==="22023")return "rejected";
  // Network errors, timeouts, PostgREST 5xx and unknown responses are ambiguous.
  return "uncertain";
}
