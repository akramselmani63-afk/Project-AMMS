import test from 'node:test';
import assert from 'node:assert/strict';
import * as f from './workflow.js';
import { validatePhotos } from './photos.js';

const request = db => { db.role='Employee'; return f.addRequest(db,{title:'TEST motor',description:'Illustrative vibration',reportedBy:'Demo operator',equipmentId:'EQ-140',photos:[{name:'demo.jpg',data:'data:image/jpeg;base64,AA=='}]}); };
function approved(db,participants=['Maintenance Engineer']) {
  const r=request(db); db.role='Maintenance Engineer'; f.assess(db,r.id,{severity:'S3',priority:'P2',diagnosis:'Check bearings',risks:['Electrical / LOTO']});
  db.role='Maintenance Responsible'; f.reviewRequest(db,r.id,'approve',{note:'Planned intervention'});
  db.role='HSE'; f.reviewRequest(db,r.id,'approve',{note:'Isolate and verify absence of energy'});
  db.role='Maintenance Engineer'; return f.createWork(db,r.id,{dueDate:f.today(),participants});
}
const completion={diagnosis:'Bearing worn',cause:'Wear',actions:'Replaced bearing',condition:'Operational',confirmation:'Run tested with operator',downtimeMinutes:20,repair:'Permanent'};
test('employee reports photos but cannot assess, approve, execute or purchase',()=>{
  const db=f.seed(),r=request(db); assert.equal(r.photos[0].name,'demo.jpg'); assert.equal(r.priority,null);
  assert.throws(()=>f.assess(db,r.id,{severity:'S3',priority:'P1'}),/role/);
  assert.throws(()=>f.addPartRequest(db,{}),/role/);
  for(const role of ['Employee','Developer Admin','Service Achats','HSE']) assert.equal(f.can(role,'work'),false);
});
test('responsible approval cannot bypass HSE; returned requests must be reassessed',()=>{
  const db=f.seed(),r=request(db); db.role='Maintenance Engineer'; f.assess(db,r.id,{severity:'S2',priority:'P3',diagnosis:'Inspect'});
  assert.throws(()=>f.reviewRequest(db,r.id,'approve',{note:'yes'}),/role/);
  db.role='Maintenance Responsible'; f.reviewRequest(db,r.id,'approve',{note:'yes'});
  assert.throws(()=>f.createWork(db,r.id,{}),/stage/);
  db.role='HSE'; f.reviewRequest(db,r.id,'return',{note:'Need isolation details'}); assert.equal(r.status,'Returned');
  db.role='Maintenance Engineer'; f.assess(db,r.id,{severity:'S2',priority:'P3',diagnosis:'Updated isolation'}); assert.equal(r.hseApproval,undefined);
});
for(const executor of ['Maintenance Engineer','Maintenance Responsible']) test(`${executor} can execute alone, requires other maintenance reviewer`,()=>{
  const db=f.seed(),w=approved(db,[executor]); db.role=executor;
  f.updateWork(db,w.id,'start'); f.updateWork(db,w.id,'complete',completion);
  assert.throws(()=>f.closeWork(db,w.id,{note:'done'}),/role/);
  db.role='HSE'; f.closeWork(db,w.id,{note:'Safety restored'});
  db.role=executor; assert.throws(()=>f.closeWork(db,w.id,{note:'Self close',exception:'Just me'}),/independent/);
  db.role=executor==='Maintenance Engineer'?'Maintenance Responsible':'Maintenance Engineer';
  f.closeWork(db,w.id,{note:'Verified independently'}); assert.equal(w.status,'Closed');
  assert.equal(db.requests.find(r=>r.id===w.requestId).status,'Closed');
  assert.throws(()=>f.updateWork(db,w.id,'start'),/approval/);
});
test('joint intervention requires explicit validation exception and keeps an audit record',()=>{
  const db=f.seed(),w=approved(db,['Maintenance Engineer','Maintenance Responsible']);
  f.updateWork(db,w.id,'start'); db.role='Maintenance Responsible'; f.updateWork(db,w.id,'complete',completion);
  db.role='HSE'; f.closeWork(db,w.id,{note:'Safe'}); db.role='Maintenance Responsible';
  assert.throws(()=>f.closeWork(db,w.id,{note:'Checked'}),/exception/);
  f.closeWork(db,w.id,{note:'Checked',exception:'Both maintenance staff performed the intervention; joint review documented.'});
  assert.match(w.validation.exception,/Both/); assert.equal(w.status,'Closed');
});
test('part purchase supports partial receipt, rejection/replacement and gates work',()=>{
  const db=f.seed(),w=approved(db); f.updateWork(db,w.id,'start');
  const p=f.addPartRequest(db,{title:'Bearing',reference:'6204',quantity:3,description:'Demo specification',neededBy:f.today(),equipmentId:w.equipmentId,workOrderId:w.id,photos:[{name:'reference.jpg',data:'demo'}]});
  assert.equal(w.status,'Waiting for parts'); assert.throws(()=>f.updateWork(db,w.id,'start'),/awaiting acceptance/);
  assert.throws(()=>f.updatePart(db,p.id,'order',{}),/role/);
  db.role='Maintenance Responsible'; f.updatePart(db,p.id,'approve',{note:'Required'});
  db.role='Service Achats'; f.updatePart(db,p.id,'order',{supplier:'Demo supplier',orderReference:'PO-DEMO',expectedDate:f.today(),quote:'Demo quote 30 DZD'});
  assert.throws(()=>f.updatePart(db,p.id,'receive',{quantity:4,deliveryReference:'BL0'}),/exceeds/);
  f.updatePart(db,p.id,'receive',{quantity:2,deliveryReference:'BL1'});
  db.role='Maintenance Engineer'; f.updatePart(db,p.id,'accept',{acceptedQuantity:1,note:'One damaged; replace'});
  assert.equal(p.status,'Partial acceptance'); assert.equal(p.rejectedQuantity,1);
  assert.throws(()=>f.updateWork(db,w.id,'start'),/awaiting acceptance/);
  db.role='Service Achats'; f.updatePart(db,p.id,'receive',{quantity:2,deliveryReference:'BL2'});
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
test('PM generates one open intervention and moves date only after full closure',()=>{
  const db=f.seed(),p=db.preventive[0],due=p.nextDue; const r=f.generatePM(db,p.id);
  assert.throws(()=>f.generatePM(db,p.id),/already/); assert.equal(p.nextDue,due);
  f.assess(db,r.id,{severity:'S1',priority:'P3',diagnosis:'Planned inspection'});
  db.role='Maintenance Responsible'; f.reviewRequest(db,r.id,'approve',{note:'Approved'});
  db.role='HSE'; f.reviewRequest(db,r.id,'approve',{note:'Precautions checked'});
  db.role='Maintenance Engineer'; const w=f.createWork(db,r.id,{dueDate:f.today(),participants:['Maintenance Engineer']});
  f.updateWork(db,w.id,'start'); f.updateWork(db,w.id,'complete',completion); assert.equal(p.nextDue,due);
  db.role='HSE'; f.closeWork(db,w.id,{note:'Safe'}); db.role='Maintenance Responsible'; f.closeWork(db,w.id,{note:'Verified'});
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
