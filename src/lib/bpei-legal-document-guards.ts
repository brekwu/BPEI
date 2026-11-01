/** Block obviously unfinished legal drafts, not a substitute for legal review. */
const unresolvedLegalMarker=/\[[^\]]{0,200}(?:à|a)\s+(?:compléter|completer|valider|désigner|designer|confirmer|vérifier|verifier)[^\]]{0,200}\]|\[[^\]]{0,200}(?:todo|tbd|placeholder|to\s+complete|to\s+verify)[^\]]{0,200}\]|brouillon\s+non\s+publiable|ne\s+pas\s+publier|texte\s+provisoire/iu;
export function hasUnresolvedLegalMarkers(value:string):boolean{
 return unresolvedLegalMarker.test(value);
}
