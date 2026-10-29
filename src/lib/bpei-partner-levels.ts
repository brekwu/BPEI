export const technicianLevelNames:Readonly<Record<number,string>>={
 1:"Junior",2:"Confirmé",3:"Expert",4:"Master"
};
export function tierName(n:number):string{
 return technicianLevelNames[n]??"Non attribué";
}
export function indicativeLevelForMissions(count:number):number{
 if(!Number.isInteger(count)||count<0)throw new Error("Invalid completed mission count");
 return count>=300?4:count>=150?3:count>=50?2:1;
}
export function canAttemptNewMission(input:{level:number|null;authorization_state:string}):boolean{
 return !!input.level&&input.level>=1&&input.level<=4&&input.authorization_state==="active";
}
