import * as flow from './workflow.js';

// The same workflow rules run in the browser demo and on the company server.
export function applyCommand(db, command) {
  const {type, id, values = {}} = command;
  switch (type) {
    case 'remove-intervention': return flow.removeIntervention(db,id);
    case 'start-work': return flow.updateWork(db,id,'start');
    case 'generate-pm': return flow.generatePM(db,id);
    case 'new-work': return flow.issueWork(db,values);
    case 'site-risk': return flow.submitSiteRiskAssessment(db,id,values);
    case 'new-request': return flow.addRequest(db,values);
    case 'assess': return flow.assess(db,id,values);
    case 'review': return flow.reviewRequest(db,id,values.decision,values);
    case 'complete-work': return flow.updateWork(db,id,'complete',values);
    case 'new-part': return flow.addPartRequest(db,values);
    case 'part-review': return flow.updatePart(db,id,values.decision,values);
    case 'order': case 'receive': case 'accept': case 'close-part':
      return flow.updatePart(db,id,type==='close-part'?'close':type,values);
    case 'new-equipment': return flow.addEquipment(db,values);
    case 'edit-equipment': return flow.editEquipment(db,id,values);
    case 'new-stock': return flow.addStock(db,values);
    case 'stock-move': return flow.moveStock(db,id,values);
    case 'record-counter': return flow.recordCounter(db,id,values);
    case 'record-reliability': return flow.recordReliability(db,values);
    case 'new-pm': return flow.addPM(db,values);
    case 'new-report': return flow.addReport(db,values);
    case 'approve-report': return flow.approveReport(db,id,values);
    default: throw new Error('Unknown action');
  }
}

const collections=['equipment','requests','workOrders','preventive','partRequests','reports','inventory'];
const links={equipment:[['equipment','parentId'],['requests','equipmentId'],['workOrders','equipmentId'],['preventive','equipmentId'],['partRequests','equipmentId'],['reports','equipmentId']],requests:[['workOrders','requestId'],['reports','requestId']],workOrders:[['partRequests','workOrderId'],['reports','linkedWorkOrderId']],preventive:[['requests','pmId'],['workOrders','pmId']],partRequests:[],reports:[]};
export function recordIds(db) { return Object.fromEntries(collections.map(key=>[key,new Set((db[key] || []).map(item=>item.id))])); }
export function assignCreated(db,before,created) {
  for(const key of collections) {
    const added=(db[key] || []).filter(item=>!before[key].has(item.id));
    const ids=created[key] || [];
    if(added.length!==ids.length) throw new Error('Created record count changed. Review pending submission.');
    for(let i=0;i<added.length;i++) {
      const old=added[i].id, replacement=ids[i];
      const legacyRequestId=key==='requests' && /^IR-[a-f0-9]{32}$/.test(replacement || '');
      const valid=typeof replacement==='string' && (key==='requests'?legacyRequestId || /^IR-\d{8}-\d{6}(?:-\d{2,})?$/.test(replacement):/^(EQ|WO|PM|SPR|SR|STK)-[a-f0-9]{32}$/.test(replacement));
      if(!valid) throw new Error('Invalid record ID.');
      let id=legacyRequestId?flow.requestIdAt(added[i].createdAt,db.requests.filter(item=>item!==added[i])):replacement;
      if(db[key].some(item=>item!==added[i] && item.id===replacement)) {
        if(key!=='requests') throw new Error('Duplicate record ID.');
        const base=replacement.replace(/-\d{2,}$/,'');
        let suffix=2;
        while(db.requests.some(item=>item!==added[i] && item.id===`${base}-${String(suffix).padStart(2,'0')}`)) suffix++;
        id=`${base}-${String(suffix).padStart(2,'0')}`;
      }
      added[i].id=id;
      for(const [collection,field] of links[key] || []) for(const item of db[collection] || []) if(item[field]===old) item[field]=id;
    }
  }
}
export function newRecordIds(db,before) { return Object.fromEntries(collections.map(key=>[key,(db[key] || []).filter(item=>!before[key].has(item.id)).map(item=>key==='requests'?item.id:`${{equipment:'EQ',workOrders:'WO',preventive:'PM',partRequests:'SPR',reports:'SR',inventory:'STK'}[key]}-${crypto.randomUUID().replaceAll('-','')}`)])); }
