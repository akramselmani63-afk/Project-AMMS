import test from 'node:test';
import assert from 'node:assert/strict';
import * as f from './workflow.js';
import { validatePhotos } from './photos.js';

const request = db => { db.role='Employee'; return f.addRequest(db,{title:'TEST motor',description:'Illustrative vibration',reportedBy:'Demo operator',equipmentId:'EQ-140',photos:[{name:'demo.jpg',data:'data:image/jpeg;base64,AA=='}]}); };
function approved(db,participants=['Maintenance Engineer']) {
  const r=request(db); db.role='Maintenance Engineer'; f.assess(db,r.id,{priority:'P2',diagnosis:'Check bearings',risks:['Electrical / LOTO']});
  db.role='Maintenance Responsible'; f.reviewRequest(db,r.id,'approve',{note:'Planned intervention'});
  db.role='HSE'; f.reviewRequest(db,r.id,'approve',{note:'Isolate and verify absence of energy'});
  db.role='Maintenance Engineer'; return f.createWork(db,r.id,{dueDate:f.today(),participants});
}
const completion={diagnosis:'Bearing worn',cause:'Wear',actions:'Replaced bearing',condition:'Operational',downtimeMinutes:20,repair:'Permanent'};
test('employee reports photos but cannot assess, approve, execute or purchase',()=>{
  const db=f.seed(),r=request(db); assert.equal(r.photos[0].name,'demo.jpg'); assert.equal(r.priority,null);
  assert.throws(()=>f.assess(db,r.id,{priority:'P1'}),/role/);
  assert.throws(()=>f.addPartRequest(db,{}),/role/);
  for(const role of ['Employee','Developer Admin','Purchasing Department','HSE']) assert.equal(f.can(role,'work'),false);
});

for(const order of [['HSE','Maintenance Responsible'],['Maintenance Responsible','HSE']]) test('independent approval order: '+order.join(' then '),()=>{
  const db=f.seed(),r=request(db); db.role='Maintenance Engineer';
  f.assess(db,r.id,{priority:'P3'});
  assert.equal(r.status,'Approval review');
  assert.throws(()=>f.reviewRequest(db,r.id,'approve',{}),/role/);
  for(const [index,role] of order.entries()) {
    db.role=role; assert.equal(f.canReviewRequest(role,r),true); f.reviewRequest(db,r.id,'approve',{});
    assert.equal(f.canReviewRequest(role,r),false);
    assert.throws(()=>f.reviewRequest(db,r.id,'approve',{}),/role/);
    if(index===0) { assert.notEqual(r.status,'Approved'); db.role='Maintenance Engineer'; assert.throws(()=>f.createWork(db,r.id,{dueDate:f.today()}),/stage/); }
  }
  assert.equal(r.status,'Approved'); assert.ok(r.approval && r.hseApproval);
});
test('return resets both approvals and requires reassessment without a mandatory reason',()=>{
  const db=f.seed(),r=request(db); db.role='Maintenance Engineer'; f.assess(db,r.id,{priority:'P1'});
  db.role='HSE'; f.reviewRequest(db,r.id,'approve',{});
  db.role='Maintenance Responsible'; f.reviewRequest(db,r.id,'return',{});
  assert.equal(r.hseApproval,undefined); assert.equal(r.status,'Returned');
  db.role='Maintenance Engineer'; f.assess(db,r.id,{priority:'P3'}); assert.equal(r.status,'Approval review');
  db.role='HSE'; f.reviewRequest(db,r.id,'reject',{}); assert.equal(r.status,'Rejected');
  assert.throws(()=>f.reviewRequest(db,r.id,'approve',{}),/stage/);
});
test('Responsible direct order requires Engineer site assessment before HSE review',()=>{
  const db=f.seed(); const v={title:'Direct work',equipmentId:'EQ-140',dueDate:f.today(),priority:'P3',participants:['Maintenance Engineer','Maintenance Responsible']};
  assert.throws(()=>f.issueWork(db,v),/Only/);
  db.role='Maintenance Responsible'; const w=f.issueWork(db,v),r=db.requests.find(r=>r.id===w.requestId);
  assert.equal(w.status,'Awaiting risk assessment'); assert.equal(r.status,'Site risk assessment'); assert.ok(r.approval); assert.equal(r.hseApproval,undefined);
  db.role='HSE'; assert.throws(()=>f.reviewRequest(db,r.id,'approve',{}),/stage/);
  db.role='Maintenance Responsible';
  assert.throws(()=>f.updateWork(db,w.id,'start'),/HSE/);
  db.role='Maintenance Engineer'; f.submitSiteRiskAssessment(db,w.id,{risks:['Electrical / LOTO'],note:'Isolation point verified'});
  assert.equal(w.status,'Awaiting approval'); assert.equal(r.status,'HSE review'); assert.deepEqual(r.risks,['Electrical / LOTO']); assert.equal(r.siteAssessedBy,'Maintenance Engineer');
  db.role='HSE'; f.reviewRequest(db,r.id,'approve',{}); assert.equal(w.status,'Planned');
  db.role='Maintenance Responsible'; f.updateWork(db,w.id,'start'); f.updateWork(db,w.id,'complete',{repair:'Permanent'});
  assert.equal(w.confirmation,undefined); assert.equal(w.actions,''); assert.equal(w.status,'Closed');
});
test('v4 migration renames purchasing role and routes pending direct orders through site assessment',()=>{
  const db=f.seed(); db.schemaVersion=4; db.role='Service Achats';
  const r={id:'IR-900',title:'Legacy direct',equipmentId:'EQ-140',status:'HSE review',priority:'P3',issuedByResponsible:true,approval:{actor:'Responsible'},risks:[],history:[]};
  const w={id:'WO-900',title:r.title,equipmentId:r.equipmentId,requestId:r.id,status:'Awaiting approval',participants:['Maintenance Responsible'],history:[]};
  db.requests.unshift(r); db.workOrders.unshift(w); f.migrate(db);
  assert.equal(db.schemaVersion,6); assert.equal(db.role,'Purchasing Department'); assert.equal(r.status,'Site risk assessment'); assert.equal(w.status,'Awaiting risk assessment'); assert.ok(w.participants.includes('Maintenance Engineer'));
});
for(const participants of [['Maintenance Engineer'],['Maintenance Responsible'],['Maintenance Engineer','Maintenance Responsible']]) test('completion closes work for '+participants.join(' + ')+' with paper signatures',()=>{
  const db=f.seed(),w=approved(db,participants); db.role=participants[0];
  f.updateWork(db,w.id,'start'); f.updateWork(db,w.id,'complete',completion);
  assert.equal(w.status,'Closed');
  assert.equal(db.requests.find(r=>r.id===w.requestId).status,'Closed');
  assert.throws(()=>f.updateWork(db,w.id,'start'),/approval/);
});
test('Responsible part requests go directly to purchasing; all narrative fields can be empty',()=>{
  const db=f.seed(); db.role='Maintenance Responsible';
  const p=f.addPartRequest(db,{title:'Bearing',reference:'TEST-01',equipmentId:'EQ-140',quantity:1,neededBy:f.today()});
  assert.equal(p.status,'Purchasing'); assert.equal(p.description,'');
  db.role='Purchasing Department'; f.updatePart(db,p.id,'order',{supplier:'Demo',orderReference:'DEMO-01',expectedDate:f.today()});
  assert.equal(p.quote,'');
  f.updatePart(db,p.id,'receive',{quantity:1,deliveryReference:'DEMO-BL'});
  db.role='Maintenance Engineer'; f.updatePart(db,p.id,'accept',{acceptedQuantity:1}); f.updatePart(db,p.id,'close',{});
  const plan=f.addPM(db,{title:'Inspect',equipmentId:'EQ-140',intervalDays:30,nextDue:f.today()}); assert.equal(plan.instructions,'');
  const report=f.addReport(db,{date:f.today(),shift:'Day'}); assert.equal(report.summary,'');
  db.role='Maintenance Responsible'; f.approveReport(db,report.id,{}); assert.equal(report.status,'Approved');
});
test('v3 migration preserves approvals and data while exposing both reviewers',()=>{
  const db=f.seed(); db.schemaVersion=3;
  const a=db.requests[0],b=db.requests[1]; a.status='Responsible review'; a.photos=[{name:'keep.jpg'}];
  b.status='HSE review'; b.approval={actor:'Existing Responsible',at:'2026-09-21'};
  f.migrate(db); assert.equal(db.schemaVersion,6); assert.equal(a.status,'Approval review'); assert.equal(a.photos[0].name,'keep.jpg');
  assert.equal(b.status,'HSE review'); assert.equal(b.approval.actor,'Existing Responsible');
  assert.equal(f.canReviewRequest('HSE',a),true); assert.equal(f.canReviewRequest('Maintenance Responsible',a),true);
});
test('part purchase supports partial receipt, rejection/replacement and gates work',()=>{
  const db=f.seed(),w=approved(db); f.updateWork(db,w.id,'start');
  const p=f.addPartRequest(db,{title:'Bearing',reference:'6204',quantity:3,description:'Demo specification',neededBy:f.today(),equipmentId:w.equipmentId,workOrderId:w.id,photos:[{name:'reference.jpg',data:'demo'}]});
  assert.equal(w.status,'Waiting for parts'); assert.throws(()=>f.updateWork(db,w.id,'start'),/awaiting acceptance/);
  assert.throws(()=>f.updatePart(db,p.id,'order',{}),/role/);
  db.role='Maintenance Responsible'; f.updatePart(db,p.id,'approve',{note:'Required'});
  db.role='Purchasing Department'; f.updatePart(db,p.id,'order',{supplier:'Demo supplier',orderReference:'PO-DEMO',expectedDate:f.today(),quote:'Demo quote 30 DZD'});
  assert.throws(()=>f.updatePart(db,p.id,'receive',{quantity:4,deliveryReference:'BL0'}),/exceeds/);
  f.updatePart(db,p.id,'receive',{quantity:2,deliveryReference:'BL1'});
  db.role='Maintenance Engineer'; f.updatePart(db,p.id,'accept',{acceptedQuantity:1,note:'One damaged; replace'});
  assert.equal(p.status,'Partial acceptance'); assert.equal(p.rejectedQuantity,1);
  assert.throws(()=>f.updateWork(db,w.id,'start'),/awaiting acceptance/);
  db.role='Purchasing Department'; f.updatePart(db,p.id,'receive',{quantity:2,deliveryReference:'BL2'});
  db.role='Maintenance Responsible'; f.updatePart(db,p.id,'accept',{acceptedQuantity:2,note:'Conforming'});
  assert.equal(p.acceptedQuantity,3); assert.equal(p.receivedQuantity,4);
  db.role='Maintenance Engineer'; f.updateWork(db,w.id,'start'); assert.equal(w.status,'In progress');
  f.updatePart(db,p.id,'close',{note:'Installed on equipment'}); assert.equal(p.status,'Closed');
});
test('invalid part quantities and mismatched work/equipment are rejected',()=>{
  const db=f.seed(),w=approved(db);
  const v={title:'Bearing',reference:'6204',quantity:1,description:'Demo',neededBy:f.today(),equipmentId:w.equipmentId,workOrderId:w.id};
  for(const quantity of [-1,0,1.5,Infinity,'bad']) assert.throws(()=>f.addPartRequest(db,{...v,quantity}));
  assert.throws(()=>f.addPartRequest(db,{...v,equipmentId:'EQ-151'}),/same equipment/);
});
test('one central asset can be referenced by request, PM, WO and spare part',()=>{
  const db=f.seed(); const e=f.addEquipment(db,{name:'Custom machine',parentId:'EQ-101'});
  const r=f.addRequest(db,{title:'Inspect',equipmentId:e.id,reportedBy:'Engineer',description:'Test'});
  const p=f.addPM(db,{title:'Test PM',equipmentId:e.id,intervalDays:14,nextDue:f.today(),instructions:'Inspect'});
  const s=f.addPartRequest(db,{title:'Part',reference:'TEST',equipmentId:e.id,quantity:1,description:'Test',neededBy:f.today()});
  assert.equal(r.equipmentId,p.equipmentId); assert.equal(s.equipmentId,e.id);
});
test('PM generates one open intervention and moves date when work is completed',()=>{
  const db=f.seed(),p=db.preventive[0],due=p.nextDue; const r=f.generatePM(db,p.id);
  assert.throws(()=>f.generatePM(db,p.id),/already/); assert.equal(p.nextDue,due);
  f.assess(db,r.id,{priority:'P3',diagnosis:'Planned inspection'});
  db.role='Maintenance Responsible'; f.reviewRequest(db,r.id,'approve',{note:'Approved'});
  db.role='HSE'; f.reviewRequest(db,r.id,'approve',{note:'Precautions checked'});
  db.role='Maintenance Engineer'; const w=f.createWork(db,r.id,{dueDate:f.today(),participants:['Maintenance Engineer']});
  f.updateWork(db,w.id,'start'); f.updateWork(db,w.id,'complete',completion);
  assert.equal(p.lastCompleted,f.today()); assert.notEqual(p.nextDue,due); assert.doesNotThrow(()=>f.generatePM(db,p.id));
});
test('shift report snapshots daily work; approval makes it final',()=>{
  const db=f.seed(),w=approved(db); f.updateWork(db,w.id,'start'); f.updateWork(db,w.id,'complete',completion);
  const r=f.addReport(db,{date:f.today(),shift:'Day',summary:'Demo day',handover:'Follow up'});
  assert.equal(r.activities[0].id,w.id); w.actions='Changed later'; assert.equal(r.activities[0].actions,'Replaced bearing');
  db.role='Maintenance Responsible'; f.approveReport(db,r.id,{note:'Reviewed'}); assert.equal(r.status,'Approved');
  assert.throws(()=>f.approveReport(db,r.id,{note:'Again'}),/stage/);
});
test('migration preserves custom records, legacy status, parts and documents',()=>{
  const db=f.seed(); db.schemaVersion=2; db.requests.push({id:'IR-999',title:'User text',status:'New',photos:[{name:'keep.jpg'}]});
  const parts=JSON.stringify(db.parts),docs=JSON.stringify(db.documents); f.migrate(db);
  assert.equal(db.requests.at(-1).title,'User text'); assert.equal(db.requests.at(-1).photos[0].name,'keep.jpg');
  assert.equal(JSON.stringify(db.parts),parts); assert.equal(JSON.stringify(db.documents),docs);
  const before=JSON.stringify(db); f.migrate(db); assert.equal(JSON.stringify(db),before);
});
test('photo validation rejects unsafe types, excessive counts and large files',()=>{
  assert.doesNotThrow(()=>validatePhotos([{type:'image/jpeg',size:123}]));
  assert.throws(()=>validatePhotos([{type:'image/svg+xml',size:50}]),/JPG/);
  assert.throws(()=>validatePhotos(Array.from({length:5},()=>({type:'image/png',size:10}))),/4 photos/);
  assert.throws(()=>validatePhotos([{type:'image/png',size:9*1024*1024}]),/8 MB/);
});
test('priority alone is validated and new requests do not acquire severity',()=>{
 const db=f.seed(),r=request(db); db.role='Maintenance Engineer';
 for(const priority of ['',null,'P0','P5']) assert.throws(()=>f.assess(db,r.id,{priority}),/priority/);
 f.assess(db,r.id,{priority:'P1'}); assert.equal(r.priority,'P1'); assert.equal(Object.hasOwn(r,'severity'),false);
});
test('status tabs include existing new, approval-pending and historical closed records',()=>{
 const rows=[{status:'Submitted'},{status:'Approval review'},{status:'HSE review'},{status:'Responsible review'},{status:'Approved'},{status:'Closed'},{status:'Legacy completed'},{status:'Returned'},{status:'Rejected'}];
 assert.equal(rows.filter(r=>f.statusMatches(r,'All')).length,9);
 assert.equal(rows.filter(r=>f.statusMatches(r,'New')).length,1);
 assert.equal(rows.filter(r=>f.statusMatches(r,'Pending reviews')).length,3);
 assert.equal(rows.filter(r=>f.statusMatches(r,'Closed')).length,2);
 assert.equal(rows.filter(r=>f.statusMatches(r,'Approved')).length,1);
});
