import test from 'node:test';
import assert from 'node:assert/strict';
import { seed, load, equipmentPath, sortedEquipment } from './data.js';
test('source-backed names keep provenance and unverified operating state',()=>{
  const db=seed(),machine=db.equipment.find(e=>e.id==='EQ-140');
  assert.match(machine.source,/Rapport de Permanence AGRIDIAM/);
  assert.equal(machine.sourceCell,'3-Liste des machines!N17');
  assert.equal(machine.status,'Unknown'); assert.equal(machine.criticality,'Unassessed');
  assert.equal(equipmentPath(db.equipment,machine.id),'Conditionnement / Ligne de Conditionnement (CONCETTI BGL2) / Couseuse (Union Special)');
});
test('old data gains sourced assets without losing custom assets or requests',()=>{
  const db=seed(); db.schemaVersion=1; db.equipment=[{id:'EQ-001',name:'Custom asset',parentId:null}];
  db.requests.push({id:'IR-999',title:'My request',equipmentId:'EQ-001'});
  const migrated=load({getItem:()=>JSON.stringify(db)});
  assert.equal(migrated.equipment.find(e=>e.id==='EQ-001').name,'Custom asset');
  assert.equal(migrated.requests.find(r=>r.id==='IR-999').title,'My request');
  assert.equal(migrated.role,'Maintenance Engineer');
});
test('corrupted saved data is reported instead of silently replaced by a demo',()=>{
  assert.throws(()=>load({getItem:()=>'{broken'}),/not been overwritten/);
});
test('new equipment sorts beside its siblings in hierarchy order',()=>{
  const db=seed();
  db.equipment.push({id:'EQ-999',name:'Micro B203',parentId:'EQ-105'});
  const ordered=sortedEquipment(db.equipment).map(item=>item.id);
  assert.deepEqual(ordered.slice(ordered.indexOf('EQ-106'),ordered.indexOf('EQ-999')+1),['EQ-106','EQ-107','EQ-999']);
  assert.ok(ordered.indexOf('EQ-105')<ordered.indexOf('EQ-106'));
});

