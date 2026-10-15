import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";
import ts from "typescript";
import {renderToStaticMarkup} from "react-dom/server";
import {createElement} from "react";
const require = createRequire(import.meta.url);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
function setup(role="DOCTOR") {
  const calls=[];const cache=new Map();
  function load(file) {
    let filename=path.resolve(root,file);
    if(!path.extname(filename)) filename += fs.existsSync(filename+".ts") ? ".ts" : ".tsx";
    if(filename.endsWith(".css")) return new Proxy({}, {get:(_,key)=>String(key)});
    if(cache.has(filename)) return cache.get(filename).exports;
    const mod={exports:{}};cache.set(filename,mod);
    const code=ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
    new Function("require","module","exports",code)((id)=> {
      if(id==="@/features/auth/components/auth-provider") return {useAuth:()=>({user:{id:7,role}})};
      if(id==="@/lib/api-client") return {apiRequest:async (endpoint, options)=>{calls.push({endpoint,options});return endpoint.includes("page=2") ? {count:2,next:null,results:[{id:2}]} : {count:2,next:"?page=2",results:[{id:1}]};},apiBlobRequest:async(endpoint,options)=>{calls.push({endpoint,options});return {blob:new Blob(["%PDF-test"]),headers:new Headers()};},ApiError:class extends Error {}};
      if(id.startsWith("@/")) return load(id.slice(2));
      if(id.startsWith(".")) return load(path.resolve(path.dirname(filename),id));
      return require(id);
    },mod,mod.exports);
    return mod.exports;
  }
  return {load,calls};
}
const {durationDays,followingDay,leaveActions}=setup().load("features/work-leaves/services/work-leave-form.ts");
test("inclusive calendar duration includes both dates, leap day and DST boundaries",()=>{
  assert.equal(durationDays("2026-10-14","2026-10-20"),7);
  assert.equal(durationDays("2026-10-14","2026-10-14"),1);
  assert.equal(durationDays("2024-02-28","2024-03-01"),3);
  assert.equal(durationDays("2026-03-28","2026-03-30"),3);
  assert.equal(durationDays("2026-12-31","2027-01-01"),2);
});
test("invalid or reversed dates cannot be submitted as a positive duration",()=>{
  for(const [start,end] of [["2026-10-20","2026-10-14"],["","2026-10-14"],["2026-02-30","2026-03-01"]]) assert.equal(durationDays(start,end),0);
});
test("extension starts after its predecessor including month/year transitions",()=>{
  assert.equal(followingDay("2026-12-31"),"2027-01-01");
  assert.equal(followingDay("2024-02-28"),"2024-02-29");
});
test("issued or cancelled certificates offer no silent edit/delete and only issued can print",()=>{
  assert.ok(leaveActions("DRAFT").edit && leaveActions("DRAFT").issue);
  assert.equal(leaveActions("DRAFT").print,false);
  assert.equal(leaveActions("ISSUED").edit,false);
  assert.equal(leaveActions("ISSUED").remove,false);
  assert.ok(leaveActions("ISSUED").print && leaveActions("ISSUED").extend && leaveActions("ISSUED").cancel);
  for(const allowed of Object.values(leaveActions("CANCELLED"))) assert.equal(allowed,false);
});
test("API actions use existing authenticated client and explicit workflow endpoints",async()=>{
  const {load,calls}=setup();const api=load("features/work-leaves/services/work-leave-api.ts");
  await api.issueLeave(12);await api.cancelLeave(12,"TEST correction");await api.leavePdf(12);await api.leavePdf(12,true);
  assert.deepEqual(calls.map(c=>c.endpoint),["work-leaves/12/issue/","work-leaves/12/cancel/","work-leaves/12/pdf/","work-leaves/12/print/"]);
  assert.deepEqual(calls[0].options.body,{});
  assert.deepEqual(calls[1].options.body,{cancellation_reason:"TEST correction"});
  assert.equal(calls[2].options.cache,"no-store");
});
test("predecessor pagination retains patient and issued filters",async()=>{
  const {load,calls}=setup();const api=load("features/work-leaves/services/work-leave-api.ts");
  const rows=await api.allLeaves({patient:4,status:"ISSUED"});
  assert.deepEqual(rows.map(r=>r.id),[1,2]);
  assert.ok(calls.every(c=>c.endpoint.includes("patient=4") && c.endpoint.includes("status=ISSUED")));
});
test("doctor has module navigation while other roles cannot see or render it",()=>{
  for(const role of ["DOCTOR","ADMIN","NURSE","SECRETARY"]) {
    const {load}=setup(role);const {navigationForRole}=load("lib/navigation.ts");
    assert.equal(navigationForRole(role).some(item=>item.href==="/work-leaves"),role==="DOCTOR");
    const {WorkLeavesWorkspace}=load("features/work-leaves/components/work-leaves-workspace.tsx");
    const html=renderToStaticMarkup(createElement(WorkLeavesWorkspace));
    assert.equal(html.includes("Arrêts de travail"),role==="DOCTOR");
  }
});
test("consultation creation keeps patient and consultation preselected",()=>{
  const {load}=setup();const {WorkLeaveEditor}=load("features/work-leaves/components/work-leave-editor.tsx");
  const patient={apiId:31,name:"TEST Patient",dateOfBirth:"1990-02-03"};
  const html=renderToStaticMarkup(createElement(WorkLeaveEditor,{patients:[patient],patient,consultation:12,onSave:async()=>{}}));
  assert.ok(html.includes('value="31"') && html.includes("TEST Patient") && html.includes("1990-02-03"));
  assert.ok(html.includes("Enregistrer le brouillon") && html.includes("Durée"));
  const {CreateWorkLeaveButton}=load("features/work-leaves/components/create-work-leave-button.tsx");
  const button=renderToStaticMarkup(createElement(CreateWorkLeaveButton,{patient,consultation:12}));
  assert.ok(button.includes("consultation=12") && button.includes("patient=31"));
});
