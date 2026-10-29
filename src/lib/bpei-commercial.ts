/** Euro values are parsed as integer cents, never as floating point amounts. */
export function euroToCents(input:string):number|null{
 const value=input.trim();
 if(!/^[0-9]{1,7}(?:[.,][0-9]{1,2})?$/.test(value))return null;
 const [euros,decimals=""]=value.replace(",",".").split(".");
 const cents=Number(euros)*100+Number(decimals.padEnd(2,"0"));
 return Number.isSafeInteger(cents)&&cents>=100&&cents<=20000000?cents:null;
}
export function formatCents(cents:number):string{
 if(!Number.isSafeInteger(cents))return "Montant indisponible";
 return (cents/100).toLocaleString("fr-FR",{style:"currency",currency:"EUR"});
}
export const vatChoices=[
 {basisPoints:0,label:"0 % — exemption à justifier"},
 {basisPoints:210,label:"2,1 %"},
 {basisPoints:550,label:"5,5 %"},
 {basisPoints:1000,label:"10 %"},
 {basisPoints:2000,label:"20 %"}
] as const;
