import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as flow from '../src/workflow.js';
import { maintenanceStats } from '../src/statistics.js';

// A separate, local-only sample file. Never seed the operational workspace.
const db=flow.seed();
const day=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Algiers'});
const date=offset=>new Date(Date.parse(`${day}T12:00:00Z`)+offset*86_400_000).toISOString().slice(0,10);
const at=(offset,time)=>`${date(offset)}T${time}:00+01:00`;
const actor=role=>{db.role=role; db.actor=`[TEST KPI] ${role}`;};
actor('Maintenance Engineer');
const zone=flow.addEquipment(db,{name:'[TEST KPI] Zone de simulation',kind:'Area'});
const machine=flow.addEquipment(db,{name:'[TEST KPI] Convoyeur de test',kind:'Machine',parentId:zone.id,description:'Données synthétiques pour tester les indicateurs. Aucun incident AGRIDIAM réel.'});
function request(title,offset,preventive=false) {
  actor('Maintenance Engineer');
  let r;
  if(preventive) {
    const plan=flow.addPM(db,{title:`[TEST KPI] ${title}`,equipmentId:machine.id,intervalDays:30,nextDue:date(offset),instructions:'Simulation uniquement : visite, consignation puis contrôle.'});
    r=flow.generatePM(db,plan.id);
  } else {
    actor('Employee');
    r=flow.addRequest(db,{title:`[TEST KPI] ${title}`,equipmentId:machine.id,description:'Incident fictif destiné au test des statistiques.',impact:'Equipment stopped'});
  }
  r.createdAt=at(offset,'07:00');
  return r;
}
function approve(r,priority) {
  actor('Maintenance Engineer'); flow.assess(db,r.id,{priority,diagnosis:r.pmId?'Inspection préventive simulée.':'Usure constatée sur la pièce simulée.',risks:['Electrical / LOTO']});
  actor('Maintenance Responsible'); flow.reviewRequest(db,r.id,'approve',{dueDate:flow.localDay(r.createdAt),participants:['Maintenance Engineer'],note:'Approbation simulée — test KPI uniquement.'});
  actor('HSE'); flow.reviewRequest(db,r.id,'approve',{note:'Consignation et protections vérifiées dans cette simulation.'});
  return db.workOrders.find(w=>w.requestId===r.id);
}
for(const [title,offset,start,finish,preventive,priority,actions] of [
  ['Remplacement du roulement',-6,'08:00','10:00',false,'P1','Roulement remplacé et convoyeur remis en service (simulation).'],
  ['Réparation du moteur',-4,'09:00','13:00',false,'P2','Moteur réparé et fonctionnement contrôlé (simulation).'],
  ['Graissage préventif',-3,'11:00','11:30',true,'P3','Points de graissage contrôlés et lubrifiés (simulation).'],
  ['Inspection des voyants',-2,'08:00','09:00',true,'P4','Trois voyants non réparables remplacés : durées de vie de 300, 400 et 500 heures (simulation).']
]) {
  const r=request(title,offset,preventive),w=approve(r,priority);
  actor('Maintenance Engineer'); flow.updateWork(db,w.id,'start');
  w.startedAt=new Date(at(offset,start)).toISOString();
  flow.updateWork(db,w.id,'complete',{completedAt:at(offset,finish),actions});
  for(const event of r.history) event.at=r.createdAt;
  for(const event of w.history) event.at=event.action==='Work completed'?w.completedAt:w.startedAt;
  if(w.pmId) db.preventive.find(p=>p.id===w.pmId).lastCompleted=date(offset);
}
const pending=request('Vibration à examiner avec HSE',-10);
actor('Maintenance Engineer'); flow.assess(db,pending.id,{priority:'P2',diagnosis:'Contrôle à planifier (simulation).',risks:['Electrical / LOTO']});
actor('Maintenance Responsible'); flow.reviewRequest(db,pending.id,'approve',{note:'Simulation : en attente de validation HSE.'});
request('Bruit intermittent signalé',-1);
actor('Maintenance Engineer');
flow.addPM(db,{title:'[TEST KPI] Contrôle préventif en retard',equipmentId:machine.id,intervalDays:14,nextDue:date(-1),instructions:'Échéance fictive pour tester le compteur de retard.'});
actor('Maintenance Responsible');
flow.addPartRequest(db,{title:'[TEST KPI] Roulement de remplacement',reference:'TEST-6204',equipmentId:machine.id,quantity:2,unit:'pcs',neededBy:date(2),urgency:'P2',description:'Demande fictive pour tester le compteur achats.'});
actor('Maintenance Engineer');
flow.addReport(db,{date:date(-2),shift:'Day',equipmentId:machine.id,summary:'[TEST KPI] Rapport de poste simulé : inspection et remplacement de voyants.',handover:'Données de test uniquement.'});
flow.recordReliability(db,{equipmentId:machine.id,startDate:date(-6),endDate:day,operatingHours:120,failureCount:2,maintenanceCount:4,failedUnitHours:1200,failedUnitCount:3});
db.language='fr';
const stats=maintenanceStats(db,{days:30,equipmentId:machine.id,now:new Date(`${day}T12:00:00+01:00`)});
assert.equal(stats.mttr,3); assert.equal(stats.mtbf,60); assert.equal(stats.mtbm,30); assert.equal(stats.mttf,400);
assert.equal(stats.downtimeHours,7.5); assert.equal(stats.completedCount,4); assert.equal(stats.openCount,2);
assert.equal(stats.approvals,1); assert.equal(stats.overduePM,1); assert.equal(stats.outstandingParts,1);
assert.equal(db.requests.length,6);

let html=await readFile('AMMS-Prototype.html','utf8');
function replace(old,value) {
  assert.ok(html.includes(old),`Portable template changed: ${old.slice(0,70)}`);
  html=html.replaceAll(old,value);
}
const testStorage=`amms-kpi-test-${day.replaceAll('-','')}`;
replace("indexedDB.open('amms-workspace',1)",`indexedDB.open('${testStorage}',1)`);
replace("'amms-portable-workspace-v1'",`'${testStorage}-fallback'`);
replace("'amms-demo-v1'",`'${testStorage}-legacy'`);
replace("'amms-demo-session'",`'${testStorage}-session'`);
replace('const seed = (options) => migrate(seedBase(options));',`const seed = () => structuredClone(${JSON.stringify(db)});`);
replace('const migrated=load(); await writeWorkspace(migrated); return migrated;','const migrated=workflow.seed(); await writeWorkspace(migrated); return migrated;');
replace("try { signedIn=sessionStorage.getItem('"+testStorage+"-session')==='1'; } catch {}",'signedIn=true;');
replace("let db, page='Overview'","let db, page='KPI'");
replace("let kpiDays=30, kpiEquipment='';",`let kpiDays=30, kpiEquipment='${machine.id}';`);
replace("if(globalThis.location && location.protocol!=='file:')",'if(false)');
replace("const modeSwitchButton=(compact=false)=>globalThis.location?.protocol==='file:'?'':", "const modeSwitchButton=(compact=false)=>true?'':");
replace('<div class="content">${detail?recordView():view()}</div>',`<div class="content"><div class="demo-banner" role="note"><strong>TEST KPI</strong> · \${t('Synthetic sample data in a separate test workspace.','Données fictives dans un espace de test séparé.')} · MTTR 3 h · MTBF 60 h · MTBM 30 h · MTTF 400 h</div>\${detail?recordView():view()}</div>`);
replace('AMMS · AGRIDIAM Maintenance Management System</title>','AMMS · KPI TEST</title>');
assert.ok(!html.includes("indexedDB.open('amms-workspace',1)"));
assert.ok(!html.includes("'amms-portable-workspace-v1'"));
// Verify the embedded app without opening a browser or touching its saved data.
const embedded=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const rendered={innerHTML:'',removeAttribute(){}};
const storageReads=[];
vm.runInNewContext(embedded,{
  document:{documentElement:{},body:{classList:{toggle(){}}},querySelector:selector=>selector==='#app'?rendered:null,addEventListener(){}},
  performance:{now:()=>0},setTimeout(){},structuredClone,
  indexedDB:{open(name){assert.equal(name,testStorage); throw new Error('Check local-storage fallback');}},
  localStorage:{getItem(key){storageReads.push(key); return null;}},sessionStorage:{getItem(){return null;}},console:{warn(){}}
});
await new Promise(resolve=>setImmediate(resolve));
assert.match(rendered.innerHTML,/TEST KPI/);
for(const [name,hours] of [['MTTR',3],['MTBF',60],['MTBM',30],['MTTF',400]]) {
  assert.match(rendered.innerHTML,new RegExp(`<strong>${name}</strong>[\\s\\S]*?class="kpi-value">${hours} h</dd>`));
}
assert.ok(storageReads.every(key=>key.startsWith(testStorage)),'Only the test storage namespace is read');
await writeFile('AMMS-KPI-Test.html',html);
console.log(JSON.stringify({file:'AMMS-KPI-Test.html',date:day,interventions:6,completed:4,mttr:stats.mttr,mtbf:stats.mtbf,mtbm:stats.mtbm,mttf:stats.mttf,downtimeHours:stats.downtimeHours,storage:testStorage}));
