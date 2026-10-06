import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {seed} from './workflow.js';import {workspaceForRole,canSeePage} from './access.js';

test('employee projection removes private records and retains aggregate KPIs without changing source',()=>{
 const db=seed({examples:true});const own=db.requests[0];own.reportedBy='Alice';own.approval={actor:'SECRET_COLLEAGUE',note:'SECRET_APPROVAL'};own.history=[{action:'Responsible approval',actor:'SECRET_COLLEAGUE',note:'SECRET_APPROVAL'},{action:'Closed with work order',actor:'SECRET_COLLEAGUE'}];
 db.partRequests.push({id:'PRIVATE',title:'SECRET_PART',supplier:'SECRET_SUPPLIER',quote:'SECRET_PRICE',proforma:{data:'SECRET_PDF'}});
 const original=JSON.stringify(db), view=workspaceForRole(db,{name:'Alice',role:'Employee'});
 assert.equal(JSON.stringify(db),original);assert.equal(view.requests.length,1);assert.equal(view.requests[0].id,own.id);
 assert.doesNotMatch(JSON.stringify(view),/SECRET_/);assert.ok('completedCount' in view.publicKpis[30]);assert.equal(view.inventory.length,0);
 assert.equal(canSeePage('Employee','KPI'),true);assert.equal(canSeePage('Employee','Parts'),false);assert.equal(canSeePage('Employee','Reports'),false);
 db.requests.forEach(r=>{r.reportedBy='Alice';r.reportedEmail='other@example.test';});own.reportedEmail='alice@example.test';
 const accountView=workspaceForRole(db,{name:'Alice',email:'alice@example.test',role:'Employee'});
 assert.equal(accountView.requests.length,1);assert.equal(accountView.requests[0].id,own.id);
});
test('HSE and purchasing projections match their responsibilities',()=>{
 const db=seed({examples:true});
 const hse=workspaceForRole(db,{name:'Safety',role:'HSE'});assert.equal(hse.partRequests.length,0);assert.ok(!('downtimeHours' in hse.publicKpis[30]));assert.equal(canSeePage('HSE','Inventory'),false);
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
