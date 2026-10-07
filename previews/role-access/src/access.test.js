import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {seed} from './workflow.js';import {workspaceForRole,canSeePage} from './access.js';

test('employee projection removes private records and hides global KPIs without changing source',()=>{
 const db=seed({examples:true});const own=db.requests[0];own.reportedBy='Alice';own.approval={actor:'SECRET_COLLEAGUE',note:'SECRET_APPROVAL'};own.history=[{action:'Responsible approval',actor:'SECRET_COLLEAGUE',note:'SECRET_APPROVAL'},{action:'Closed with work order',actor:'SECRET_COLLEAGUE'}];
 db.partRequests.push({id:'PRIVATE',title:'SECRET_PART',supplier:'SECRET_SUPPLIER',quote:'SECRET_PRICE',proforma:{data:'SECRET_PDF'}});
 const original=JSON.stringify(db), view=workspaceForRole(db,{name:'Alice',role:'Employee'});
 assert.equal(JSON.stringify(db),original);assert.equal(view.requests.length,1);assert.equal(view.requests[0].id,own.id);
 assert.doesNotMatch(JSON.stringify(view),/SECRET_/);assert.deepEqual(view.publicKpis,{});assert.equal(view.preventive.length,0);assert.equal(view.inventory.length,0);
 assert.equal(canSeePage('Employee','KPI'),false);assert.equal(canSeePage('Employee','Parts'),false);assert.equal(canSeePage('Employee','Reports'),false);
 db.requests.forEach(r=>{r.reportedBy='Alice';r.reportedEmail='other@example.test';});own.reportedEmail='alice@example.test';
 const accountView=workspaceForRole(db,{name:'Alice',email:'alice@example.test',role:'Employee'});
 assert.equal(accountView.requests.length,1);assert.equal(accountView.requests[0].id,own.id);
});
test('HSE and purchasing projections match their responsibilities',()=>{
 const db=seed({examples:true});
 const hse=workspaceForRole(db,{name:'Safety',role:'HSE'});assert.equal(hse.partRequests.length,0);assert.deepEqual(hse.publicKpis,{});assert.equal(canSeePage('HSE','Inventory'),false);
 const purchase=workspaceForRole(db,{name:'Buyer',role:'Purchasing Department'});assert.equal(purchase.requests.length,0);assert.equal(purchase.workOrders.length,0);assert.equal(purchase.equipment.some(e=>e.reliabilityLog),false);assert.equal(canSeePage('Purchasing Department','Requests'),false);
 const full=workspaceForRole(db,{name:'Viewer',role:'Viewer'});assert.equal(full.requests.length,db.requests.length);
});
test('preview uses isolated storage, ports and server data settings',()=>{
 assert.match(readFileSync('src/storage.js','utf8'),/amms-access-preview-workspace/);
 assert.match(readFileSync('server.js','utf8'),/AMMS_ACCESS_PORT \|\| 4273/);
 assert.match(readFileSync('api.js','utf8'),/AMMS_ACCESS_DATA_DIR/);assert.match(readFileSync('api.js','utf8'),/AMMS-Access-Server/);
 assert.match(readFileSync('api.js','utf8'),/amms_access_session=/);
 assert.match(readFileSync('scripts/AMMSLauncher.cs','utf8'),/"AMMS-Access-Preview"/);
});

 test('production responsible sees own and employee requests plus required safety reviews',()=>{
 const db=seed();db.requests=[
 {id:'OWN',equipmentId:'EQ-140',reportedEmail:'boss@example.test',reportedRole:'Production Responsible'},
 {id:'EMPLOYEE',equipmentId:'EQ-150',reportedEmail:'worker@example.test',reportedRole:'Employee'},
 {id:'OTHER',equipmentId:'EQ-150',reportedEmail:'engineer@example.test',reportedRole:'Maintenance Engineer'},
 {id:'REVIEW',equipmentId:'EQ-140',reportedRole:'Maintenance Responsible',status:'HSE review'},
 ];
 const view=workspaceForRole(db,{name:'Boss',email:'boss@example.test',role:'Production Responsible'});
 assert.deepEqual(view.requests.map(r=>r.id),['OWN','REVIEW']);assert.equal(view.partRequests.length,0);assert.equal(canSeePage('Production Responsible','KPI'),true);
 const employee=workspaceForRole(db,{name:'Worker',email:'worker@example.test',role:'Employee'});
 assert.deepEqual(employee.requests.map(r=>r.id),['EMPLOYEE']);assert.equal(canSeePage('Employee','Equipment'),true);
 const hse=workspaceForRole(db,{role:'HSE',name:'Safety'});assert.deepEqual(hse.requests.map(r=>r.id),['EMPLOYEE','OTHER']);
 });

test('department zones scope equipment, prevention, work and KPIs without changing broad roles',async()=>{
 const {maintenanceStats}=await import('./statistics.js');const {applyCommand}=await import('./commands.js');const db=seed();
 db.requests=[{id:'PROD',equipmentId:'EQ-140',status:'Closed',createdAt:new Date().toISOString()},{id:'UTIL',equipmentId:'EQ-150',status:'Closed',createdAt:new Date().toISOString()}];
 db.workOrders=[{id:'W1',requestId:'PROD',equipmentId:'EQ-140',status:'Closed',startedAt:new Date(Date.now()-3600000).toISOString(),completedAt:new Date().toISOString(),downtimeMinutes:60},{id:'W2',requestId:'UTIL',equipmentId:'EQ-150',status:'Closed',startedAt:new Date(Date.now()-10800000).toISOString(),completedAt:new Date().toISOString(),downtimeMinutes:180}];
 db.preventive=[{id:'P1',equipmentId:'EQ-140'},{id:'P2',equipmentId:'EQ-150'}];
 const prod=workspaceForRole(db,{role:'Production Responsible'}),hse=workspaceForRole(db,{role:'HSE'});
 assert.deepEqual(prod.preventive.map(x=>x.id),['P1']);assert.deepEqual(hse.preventive.map(x=>x.id),['P2']);
 assert.ok(Math.abs(maintenanceStats(prod).downtimeHours-1)<0.001);assert.ok(Math.abs(maintenanceStats(hse).downtimeHours-3)<0.001);
 assert.ok(!prod.equipment.some(e=>e.id==='EQ-150'));assert.ok(!hse.equipment.some(e=>e.id==='EQ-140'));
 for(const role of ['Maintenance Engineer','Maintenance Responsible','Viewer'])assert.equal(workspaceForRole(db,{role}).requests.length,2);
 db.role='Production Responsible';assert.throws(()=>applyCommand(db,{type:'new-request',values:{equipmentId:'EQ-150'}}),/permitted zones/);
 assert.equal(canSeePage('Purchasing Department','Inventory'),false);assert.equal(canSeePage('Employee','Overview'),false);
});
