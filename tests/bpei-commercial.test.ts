import test from "node:test";
import assert from "node:assert/strict";
import {euroToCents,formatCents,vatChoices} from "../src/lib/bpei-commercial.ts";

test("montants en euros convertis en centimes entiers sans erreur binaire",()=>{
 for(const [value,cents] of [["1",100],["1,2",120],["1.02",102],["199999,99",19999999],["200000,00",20000000]] as const)
  assert.equal(euroToCents(value),cents);
});
test("rejet des montants ambigus, négatifs ou trop élevés",()=>{
 for(const value of ["","0","0,99","-2","1,001","1e4","1 000","1,2,3","200000,01","Infinity","2.333"])
  assert.equal(euroToCents(value),null,value);
});
test("formatage monétaire et choix de TVA explicites",()=>{
 assert.ok(formatCents(12345).includes("123"));
 assert.deepEqual(vatChoices.map(x=>x.basisPoints),[0,210,550,1000,2000]);
});
