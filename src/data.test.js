import test from 'node:test';
import assert from 'node:assert/strict';
import { seed, can, addRequest, createWorkOrder, completePreventive, equipmentPath, load, save } from './data.js';
test('request to work order flow preserves equipment and triage state',()=>{
  const data=seed();
  const request=addRequest(data,{title:'Motor vibration',equipmentId:'EQ-140',severity:'S2',priority:'P2'});
  assert.equal(request.status,'New');
  const work=createWorkOrder(data,{title:'Inspect motor',equipmentId:request.equipmentId,requestId:request.id,priority:request.priority});
  assert.equal(work.requestId,request.id);
  assert.equal(request.status,'Approved');
  assert.equal(equipmentPath(data.equipment,work.equipmentId),'Conditionnement / Ligne de Conditionnement (CONCETTI BGL2) / Couseuse (Union Special)');
});
test('preventive completion moves due date and records activity',()=>{
  const data=seed(); const oldCount=data.reports.length;
  completePreventive(data,'PM-001');
  assert.equal(data.reports.length,oldCount+1);
  assert.match(data.reports[0].summary,/Completed preventive task/);
});
test('roles and browser persistence are explicit demo boundaries',()=>{
  const data=seed(); assert.equal(can('Requester','work:create'),false); assert.equal(can('Planner','work:create'),true);
  const memory={value:null,getItem(){return this.value},setItem(_key,value){this.value=value}};
  save(data,memory); assert.equal(load(memory).equipment.length,data.equipment.length);
});
test('equipment names retain source provenance and unverified operating state',()=>{
  const data=seed();
  const machine=data.equipment.find(x=>x.id==='EQ-140');
  assert.match(machine.source,/Rapport de Permanence AGRIDIAM/);
  assert.equal(machine.sourceCell,'3-Liste des machines!N17');
  assert.equal(machine.status,'Unknown');
  assert.equal(machine.criticality,'Unassessed');
  assert.equal(data.language,'fr');
});
test('older browser data gains sourced assets without dropping user requests',()=>{
  const data=seed();
  data.schemaVersion=undefined;
  data.equipment=[{id:'EQ-001',name:'Custom asset',kind:'Machine',parentId:null}];
  data.requests.push({id:'IR-999',title:'My request',equipmentId:'EQ-001'});
  const memory={getItem(){return JSON.stringify(data)}};
  const migrated=load(memory);
  assert.equal(migrated.equipment[0].id,'EQ-101');
  assert.equal(migrated.equipment.find(x=>x.id==='EQ-001').name,'Custom asset');
  assert.equal(migrated.requests.find(x=>x.id==='IR-999').title,'My request');
});
