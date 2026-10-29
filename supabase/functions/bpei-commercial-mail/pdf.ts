// BPEI commercial PDF attachment, generated on server from persisted quote/invoice data.
import {PDFDocument,StandardFonts,rgb} from "npm:pdf-lib@1.17.1";
type Money=number|string;
export type CommercialDocument={
 kind:"quote"|"invoice";documentId:string;
 invoiceNumber?:string;issuedAt:string;serviceDate?:string;dueDate?:string;
 issuerLegalName:string;issuerSiret:string;issuerAddress:string;issuerEmail:string;
 customerName:string;customerEmail:string;customerAddress:string;customerKind:string;customerSiret:string|null;
 description:string;quantity:number;unitPriceCents:Money;netCents:Money;vatCents:Money;grossCents:Money;
 vatBasisPoints:number;taxMention:string;
};
const euros=(v:Money)=>((Number(v)/100).toFixed(2)+" EUR");
const date=(s:string)=>new Date(s).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"});
function asLatin(v:unknown):string{
 const s=String(v??"").replace(/[\r\n\t]+/g," ").trim();
 if(s.length>700)throw new Error("Overlong PDF field");
 // Helvetica only supports WinAnsi; fail closed instead of silently mangling legal identities.
 if(/[\u0100-\uFFFF]/u.test(s.replace(/[\u2013\u2014\u2018\u2019\u201c\u201d\u20ac]/g,"")))throw new Error("Font needs professional Unicode support");
 return s.replace(/[\u2013\u2014]/g,"-").replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/\u20ac/g,"EUR");
}
export async function renderCommercialPdf(data:CommercialDocument,legalFooter:string):Promise<string>{
 if(!legalFooter||legalFooter.trim().length<40)throw new Error("Validated legal footer required");
 if(!/^[0-9]{14}$/.test(data.issuerSiret)||!Number.isInteger(data.quantity)
  ||data.quantity<1||!Number.isInteger(Number(data.grossCents))
  ||Number(data.grossCents)<100)throw new Error("Invalid legal invoice data");
 const pdf=await PDFDocument.create();
 const regular=await pdf.embedFont(StandardFonts.Helvetica);
 const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 let page=pdf.addPage([595,842]);let y=800;
 const add=(text:string,highlight=false)=>{
  const font=highlight?bold:regular;
  // Fit exact legal text onto the page, preserving full content by wrapping by words.
  const lines:string[]=[];
  for(const paragraph of asLatin(text).split(/\n/)){
   let line="";
   for(const word of paragraph.split(/\s+/)){
    const test=line?line+" "+word:word;
    if(font.widthOfTextAtSize(test,11)>500&&line){lines.push(line);line=word;}else{line=test;}
   }
   lines.push(line);
  }
  for(const l of lines){
   if(y<58){page=pdf.addPage([595,842]);y=795;}
   page.drawText(l,{x:44,y,size:11,font,color:rgb(0.08,0.12,0.2)});
   y-=18;
  }
  y-=8;
 };
 const title=data.kind==="invoice"?"FACTURE ":"DEVIS ";
 add("BPEI | DOCUMENT PRÉPRODUCTION - VALIDATION LÉGALE OBLIGATOIRE",true);
 add(title+(data.invoiceNumber??data.documentId),true);
 add("Date : "+date(data.issuedAt));
 if(data.serviceDate)add("Date de prestation : "+date(data.serviceDate));
 if(data.dueDate)add("Date limite de paiement : "+date(data.dueDate));
 add("Prestataire émetteur",true);
 add(data.issuerLegalName);
 add(data.issuerAddress);
 add("SIRET : "+data.issuerSiret);
 add(data.issuerEmail);
 add("Client facturé",true);
 add(data.customerName);
 add(data.customerAddress);
 if(data.customerKind==="business"&&data.customerSiret)add("SIRET client : "+data.customerSiret);
 add(data.customerEmail);
 add("Prestation",true);
 add(data.description);
 add("Quantité : "+data.quantity+" | Prix unitaire HT : "+euros(data.unitPriceCents));
 add("Total HT : "+euros(data.netCents));
 add("TVA ("+(data.vatBasisPoints/100).toLocaleString("fr-FR")+" %) : "+euros(data.vatCents));
 add("TOTAL TTC : "+euros(data.grossCents),true);
 if(data.taxMention)add("Mention TVA : "+data.taxMention);
 add("Mentions réglementaires",true);
 add(legalFooter);
 add("Ce document est produit en préproduction. Vérifier l'identité, la TVA, les mentions obligatoires et la facturation électronique applicable.",false);
 const bytes=await pdf.save();
 let encoded="";
 for(let i=0;i<bytes.length;i+=8192)encoded+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(encoded);
}
