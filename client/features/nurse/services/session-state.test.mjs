import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const __dirname=path.dirname(fileURLToPath(import.meta.url));
import ts from "typescript";
function loadTs(relative){const filename=path.resolve(__dirname,relative);const source=ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const mod={exports:{}};new Function("require","module","exports",source)(id=>id.startsWith(".")?loadTs(path.resolve(path.dirname(filename),id.endsWith(".ts")?id:id+".ts")):require(id),mod,mod.exports);return mod.exports;}
const {applySessionAction,programProgress,validateRecord}=loadTs("./session-state.ts");
const {mockNurse}=loadTs("../data/mock-nurse.ts");
const fixture=()=>structuredClone(mockNurse);
const at="2026-09-21T10:00:00Z";
const record={performedTreatment:"Laser test",zone:"Jambes",device:"Appareil test",wavelength:"755",fluence:"16.5",spotSize:"18",frequency:"2",tolerance:"Bonne",reaction:"Aucune",observations:"Observation de démonstration",incidents:"",notes:""};
test("start, draft and completion preserve prescriptions and update counts once",()=>{let data=fixture();const program=data.programs.find(p=>p.id==="NP-02");const before=programProgress(data,program);const original=structuredClone(data.programs);data=applySessionAction(data,{type:"start",id:"NS-02",at});data=applySessionAction(data,{type:"draft",id:"NS-02",at,record});assert.equal(programProgress(data,program).completed,before.completed);data=applySessionAction(data,{type:"complete",id:"NS-02",at,record});assert.equal(programProgress(data,program).completed,before.completed+1);assert.equal(programProgress(data,program).remaining,before.remaining-1);assert.deepEqual(data.programs,original);assert.equal(applySessionAction(data,{type:"complete",id:"NS-02",at,record}),data);assert.throws(()=>applySessionAction(data,{type:"draft",id:"NS-02",at,record}),/lecture seule/);});
test("unstarted care and invalid laser parameters cannot be validated",()=>{assert.throws(()=>applySessionAction(fixture(),{type:"complete",id:"NS-02",at,record}),/Démarrez/);assert.ok(validateRecord({...record,fluence:"0"},true));assert.ok(validateRecord({...record,observations:" "},true));assert.ok(validateRecord({...record,tolerance:"Difficile"},true));assert.equal(validateRecord({...record,tolerance:"Difficile",incidents:"Transmission requise"},true),null);});
test("assignment is checked and report preserves draft without completing",()=>{let data=fixture();data.sessions.find(s=>s.id==="NS-02").nurseId="other";assert.throws(()=>applySessionAction(data,{type:"start",id:"NS-02",at}),/assignée/);data=applySessionAction(fixture(),{type:"start",id:"NS-02",at});data=applySessionAction(data,{type:"draft",id:"NS-02",at,record});const next=applySessionAction(data,{type:"report",id:"NS-02",at,message:"À examiner"});assert.equal(next.sessions.find(s=>s.id==="NS-02").status,"À revoir");assert.equal(next.sessions.find(s=>s.id==="NS-02").record.observations,record.observations);assert.equal(next.sessions.find(s=>s.id==="NS-02").validatedAt,undefined);});


const {agendaGroups}=loadTs('./agenda-layout.ts');
test('overlapping appointments have separate slots and touching intervals remain separate',()=>{const data=fixture();const group=agendaGroups(data.sessions.filter(s=>s.date==='2026-09-25'));assert.equal(group.length,1);assert.equal(group[0].length,2);const seed=data.sessions[0];assert.equal(agendaGroups([{...seed,start:'09:00',end:'10:00'},{...seed,id:'next',start:'10:00',end:'11:00'}]).length,2);assert.equal(agendaGroups([]).length,0);});