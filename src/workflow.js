import { load as loadBase, seed as seedBase, nextId } from './data.js';

export const roles = ['Employee','Maintenance Engineer','Maintenance Responsible','HSE','Purchasing Department','Viewer'];
const maintenance = ['Maintenance Engineer','Maintenance Responsible'];
export const rights = {
  Employee: ['request'],
  'Maintenance Engineer': ['request','assess','work','equipment','pm','parts','accept','report'],
  'Maintenance Responsible': ['request','assess','approve','work','equipment','pm','parts','accept','report'],
  HSE: ['hse'], 'Purchasing Department': ['purchase'], Viewer: ['view']
};
export const can = (role, action) => rights[role]?.includes(action) || false;
export const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const now = () => new Date().toISOString();
export function requestIdAt(createdAt, requests=[]) {
  const d=new Date(createdAt);
  requireValue(Number.isFinite(d.getTime()),'Invalid request creation time.');
  const base=`IR-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`;
  const used=new Set(requests.map(r=>r.id));
  if(!used.has(base)) return base;
  let suffix=2;
  while(used.has(`${base}-${String(suffix).padStart(2,'0')}`)) suffix++;
  return `${base}-${String(suffix).padStart(2,'0')}`;
}
export const localDay = value => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
};
const requireValue = (ok, message) => { if (!ok) throw new Error(message); };
const required = (v, key) => { const text=String(v[key] || '').trim(); requireValue(text, `Required: ${key}`); return text; };
const optional = (v,key) => String(v[key] || '').trim();
const number = (v, minimum=0) => { const n=Number(v); requireValue(Number.isFinite(n) && n>=minimum,'Invalid quantity or duration.'); return n; };
export function elapsedMinutes(start,finish) {
  const startMs=new Date(start).getTime(), finishMs=new Date(finish).getTime();
  requireValue(Number.isFinite(startMs) && Number.isFinite(finishMs),'Enter valid start and completion times.');
  requireValue(finishMs>=startMs,'Completion cannot be before work started.');
  return Math.round((finishMs-startMs)/60_000);
}
const record = (db, collection, id) => { const item=db[collection].find(x=>x.id===id); requireValue(item,'Record not found.'); return item; };
const asset = (db,id) => requireValue(db.equipment.some(x=>x.id===id),'Select valid equipment.');
const allow = (db,action) => requireValue(can(db.role,action),'This role cannot perform this action.');
const stage = (item,...states) => requireValue(states.includes(item.status),'This action is unavailable at this stage.');
export function audit(db,item,action,note='') {
  const event={at:now(),role:db.role,actor:db.actor || db.role,action,note};
  (item.history ||= []).push(event); return event;
}
export function migrate(db) {
  db.inventory ||= [];
  if(db.role==='Developer Admin') db.role='Viewer';
  if (db.schemaVersion >= 8) return db;
  if (db.schemaVersion >= 7) return migrateApprovedWork(db);
  if (db.schemaVersion >= 6) return migrateParts(db);
  if (db.schemaVersion >= 5) return migratePaperClosure(db);
  if (db.schemaVersion >= 4) return migrateSiteAssessment(db);
  if (db.schemaVersion >= 3) return migrateApprovals(db);
  db.role=roles.includes(db.role) ? db.role : 'Maintenance Engineer';
  db.partRequests ||= [];
  for (const r of db.requests) {
    r.legacyStatus=r.status; r.status=r.status==='Closed' ? 'Closed' : 'Submitted';
    r.photos ||= []; r.history ||= []; r.impact ||= ''; r.risks ||= [];
  }
  for (const w of db.workOrders) {
    w.legacyStatus=w.status;
    w.status=w.status==='Completed' ? 'Legacy completed' : 'Awaiting approval';
    w.participants ||= ['Maintenance Engineer']; w.history ||= [];
    if (!w.requestId) {
      const r={id:nextId(db.requests,'IR'),title:w.title,equipmentId:w.equipmentId,description:w.notes || '',status:'Submitted',priority:w.priority || 'P3',reportedBy:w.assignee || 'Unknown',createdAt:today(),photos:[],risks:[],history:[],legacyWorkId:w.id};
      db.requests.push(r); w.requestId=r.id;
    }
    // Older prototype approvals were role previews, not recorded HSE approvals.
    const r=db.requests.find(r=>r.id===w.requestId);
    if (r && w.status==='Awaiting approval') r.status='Submitted';
  }
  for (const r of db.reports) { r.status ||= 'Draft'; r.history ||= []; }
  db.schemaVersion=3;
  return migrateApprovals(db);
}

const reviewStages=['Approval review','Responsible review','HSE review'];
function approvalStatus(r) {
  return r.approval && r.hseApproval ? 'Approved' : r.approval ? 'HSE review' : r.hseApproval ? 'Responsible review' : 'Approval review';
}
function migrateApprovals(db) {
  for(const r of db.requests) if(reviewStages.includes(r.status)) r.status=approvalStatus(r);
  db.schemaVersion=4; return migrateSiteAssessment(db);
}
function migrateSiteAssessment(db) {
  if(db.role==='Service Achats') db.role='Purchasing Department';
  for(const w of db.workOrders) {
    const r=db.requests.find(r=>r.id===w.requestId);
    if(r?.issuedByResponsible && !r.hseApproval && w.status==='Awaiting approval') {
      r.status='Site risk assessment';
      w.status='Awaiting risk assessment';
      if(!w.participants?.includes('Maintenance Engineer')) w.participants=['Maintenance Engineer',...(w.participants || [])];
    }
  }
  db.schemaVersion=5; return migratePaperClosure(db);
}
function migratePaperClosure(db) {
  for(const w of db.workOrders.filter(w=>['HSE closure','Validation'].includes(w.status))) {
    w.status='Closed';
    const r=db.requests.find(r=>r.id===w.requestId); if(r) r.status='Closed';
  }
  db.schemaVersion=6; return migrateParts(db);
}
function migrateParts(db) {
  db.partRequests ||= [];
  for (const p of db.partRequests) {
    p.deliveries ||= [];
    p.photos ||= [];
    p.history ||= [];
    p.receivedQuantity ??= 0;
    p.acceptedQuantity ??= 0;
    p.rejectedQuantity ??= 0;
  }
  db.schemaVersion=7; return migrateApprovedWork(db);
}
function migrateApprovedWork(db) {
  for(const r of db.requests) if(r.status==='Approved' && !db.workOrders.some(w=>w.requestId===r.id)) addApprovedWork(db,r);
  db.schemaVersion=8; return db;
}
export function canReviewRequest(role,r) {
  return reviewStages.includes(r.status) && ((role==='Maintenance Responsible' && !r.approval) || (role==='HSE' && !r.hseApproval));
}

export const seed = (options) => migrate(seedBase(options));
export const load = storage => migrate(loadBase(storage));
export function addRequest(db,v) {
  allow(db,'request'); asset(db,v.equipmentId);
  const createdAt=now();
  const r={id:requestIdAt(createdAt,db.requests),title:required(v,'title'),equipmentId:v.equipmentId,description:optional(v,'description'),impact:v.impact || '',reportedBy:db.actor || required(v,'reportedBy'),reportedRole:db.role,createdBy:db.actor || db.role,createdAt,status:'Submitted',priority:null,photos:v.photos || [],risks:[],history:[]};
  audit(db,r,'Submitted'); db.requests.unshift(r); return r;
}
export function canRemoveIntervention(db,r) {
  if(!r || !can(db.role,'request')) return false;
  const actor=String(db.actor || '').trim();
  const requester=actor && actor===(r.createdBy || r.reportedBy);
  if(!requester && !maintenance.includes(db.role)) return false;
  const linked=db.workOrders.filter(w=>w.requestId===r.id);
  if(r.status==='Closed' || linked.some(w=>w.startedAt || ['In progress','Waiting for parts','Closed'].includes(w.status))) return false;
  if(db.partRequests.some(p=>linked.some(w=>w.id===p.workOrderId))) return false;
  if(db.reports.some(report=>report.linkedWorkOrderId && linked.some(w=>w.id===report.linkedWorkOrderId) || report.activities?.some(a=>a.requestId===r.id || linked.some(w=>w.id===a.workOrderId || w.id===a.id)))) return false;
  return true;
}
export function removeIntervention(db,id) {
  const r=record(db,'requests',id);
  requireValue(canRemoveIntervention(db,r),'This intervention cannot be removed by this user or after linked work, parts, or reports. / Cette intervention ne peut pas être supprimée par cet utilisateur ou après des travaux, pièces ou rapports liés.');
  db.workOrders=db.workOrders.filter(w=>w.requestId!==id);
  db.requests=db.requests.filter(item=>item.id!==id);
}
export function assess(db,id,v) {
  allow(db,'assess'); const r=record(db,'requests',id); stage(r,'Submitted','Returned');
  requireValue(['P1','P2','P3','P4'].includes(v.priority),'Select priority.');
  Object.assign(r,{priority:v.priority,diagnosis:optional(v,'diagnosis'),risks:v.risks || [],status:'Approval review'});
  delete r.approval; delete r.hseApproval; delete r.precautions; audit(db,r,'Assessed',r.diagnosis);
  if(db.role==='Maintenance Responsible') {
    r.workParticipants=maintenanceParticipants(v.participants);
    r.workDueDate=optional(v,'dueDate') || today();
    r.approval=audit(db,r,'Responsible approval');
  }
  r.status=approvalStatus(r);
}
export function reviewRequest(db,id,decision,v={}) {
  const r=record(db,'requests',id);
  requireValue(canReviewRequest(db.role,r),'This role cannot review this request at this stage.');
  requireValue(['approve','return','reject'].includes(decision),'Invalid decision.');
  const note=optional(v,'note');
  if(decision!=='approve') {
    r.status=decision==='return'?'Returned':'Rejected';
    delete r.approval; delete r.hseApproval; delete r.precautions;
    delete r.workParticipants; delete r.workDueDate;
    audit(db,r,r.status,note); return;
  }
  if(db.role==='Maintenance Responsible') {
    r.workParticipants=maintenanceParticipants(v.participants);
    r.workDueDate=optional(v,'dueDate') || today();
    r.approval=audit(db,r,'Responsible approval',note);
  }
  else { r.precautions=note; r.hseApproval=audit(db,r,'HSE approval',note); }
  r.status=approvalStatus(r);
  if(r.status==='Approved') {
    const linked=db.workOrders.filter(w=>w.requestId===id);
    if(!linked.length) addApprovedWork(db,r);
    for(const w of linked) if(w.status==='Awaiting approval') w.status='Planned';
  }
}
function maintenanceParticipants(values) {
  const participants=values == null?['Maintenance Engineer']:values;
  requireValue(Array.isArray(participants) && participants.length && participants.every(role=>maintenance.includes(role)),'Select maintenance participants.');
  return [...new Set(participants)];
}
function addApprovedWork(db,r) {
  const w={id:nextId(db.workOrders,'WO'),title:r.title,equipmentId:r.equipmentId,requestId:r.id,pmId:r.pmId || null,type:r.pmId?'Preventive':'Corrective',priority:r.priority || 'P3',status:'Planned',dueDate:r.workDueDate || today(),participants:maintenanceParticipants(r.workParticipants),external:'',notes:'',history:[]};
  db.workOrders.unshift(w);
  w.history.push({at:now(),role:'Maintenance Responsible',actor:r.approval?.actor || 'Maintenance Responsible',action:'Work planned',note:''});
  return w;
}
export function createWork(db,id,v) {
  allow(db,'work'); const r=record(db,'requests',id); stage(r,...(db.role==='Maintenance Responsible'?[...reviewStages,'Approved']:['Approved']));
  requireValue(!db.workOrders.some(w=>w.requestId===id),'A work order already exists for this request.');
  const participants=v.participants || [db.role];
  requireValue(participants.length && participants.every(x=>maintenance.includes(x)),'Select maintenance participants.');
  const dueDate=required(v,'dueDate');
  if(db.role==='Maintenance Responsible' && !r.approval) { r.approval=audit(db,r,'Responsible approval'); r.status=approvalStatus(r); }
  const w={id:nextId(db.workOrders,'WO'),title:r.title,equipmentId:r.equipmentId,requestId:id,pmId:r.pmId || null,type:r.pmId?'Preventive':'Corrective',priority:r.priority,status:r.status==='Approved'?'Planned':'Awaiting approval',dueDate,participants,external:v.external || '',notes:v.notes || '',history:[]};
  db.workOrders.unshift(w); audit(db,w,'Work planned'); return w;
}

export function issueWork(db,v) {
  requireValue(db.role==='Maintenance Responsible','Only the Maintenance Responsible can issue a direct work order.');
  asset(db,v.equipmentId); required(v,'title'); required(v,'dueDate');
  requireValue(['P1','P2','P3','P4'].includes(v.priority),'Select priority.');
  const participants=v.participants || ['Maintenance Engineer'];
  requireValue(participants.length && participants.every(x=>maintenance.includes(x)),'Select maintenance participants.');
  requireValue(participants.includes('Maintenance Engineer'),'Assign the Maintenance Engineer for the site risk assessment.');
  const r=addRequest(db,{...v,reportedBy:db.actor || db.role});
  r.issuedByResponsible=true;
  Object.assign(r,{priority:v.priority,diagnosis:'',risks:[],status:'Site risk assessment'});
  r.approval=audit(db,r,'Responsible approval');
  const w={id:nextId(db.workOrders,'WO'),title:r.title,equipmentId:r.equipmentId,requestId:r.id,pmId:null,type:'Corrective',priority:r.priority,status:'Awaiting risk assessment',dueDate:v.dueDate,participants,external:v.external || '',notes:v.notes || '',history:[]};
  db.workOrders.unshift(w); audit(db,w,'Work issued'); return w;
}
export function submitSiteRiskAssessment(db,id,v={}) {
  requireValue(db.role==='Maintenance Engineer','Only the Maintenance Engineer can submit the site risk assessment.');
  const w=record(db,'workOrders',id); stage(w,'Awaiting risk assessment');
  requireValue(w.participants.includes('Maintenance Engineer'),'The Maintenance Engineer must be assigned to this work order.');
  const r=record(db,'requests',w.requestId); stage(r,'Site risk assessment');
  r.risks=v.risks || []; r.diagnosis=optional(v,'note'); r.siteAssessedBy=db.actor || db.role; r.siteAssessedAt=now(); r.status='HSE review';
  audit(db,r,'Site risk assessment submitted',r.diagnosis); w.status='Awaiting approval'; audit(db,w,'Submitted to HSE',r.id); return r;
}

export const partsPending = (db,w) => db.partRequests.some(p=>p.workOrderId===w.id && !['Closed','Rejected','Cancelled'].includes(p.status) && p.acceptedQuantity<p.quantity);
export function updateWork(db,id,action,v={}) {
  allow(db,'work'); const w=record(db,'workOrders',id);
  const r=record(db,'requests',w.requestId);
  requireValue(r.hseApproval && r.status==='Approved','Recorded HSE approval is required.');
  if(action==='start') {
    stage(w,'Planned','Waiting for parts');
    requireValue(w.participants.includes(db.role),'Only an assigned maintenance participant can start work.');
    requireValue(!partsPending(db,w),'Required spare parts are still awaiting acceptance.');
    w.status='In progress'; w.startedAt ||= now(); audit(db,w,'Work started');
  } else if(action==='complete') {
    stage(w,'In progress'); requireValue(w.participants.includes(db.role),'Only an assigned participant can complete work.');
    requireValue(!partsPending(db,w),'Required spare parts are still awaiting acceptance.');
    const completion={diagnosis:optional(v,'diagnosis'),cause:optional(v,'cause'),actions:optional(v,'actions'),condition:optional(v,'condition'),repair:optional(v,'repair')};
    const finish=v.completedAt ? new Date(v.completedAt) : new Date();
    requireValue(!Number.isNaN(finish.getTime()),'Enter a valid completion time.');
    const start=w.startedAt || v.startedAt;
    requireValue(start,'Enter the start time for this older work order.');
    const downtimeMinutes=elapsedMinutes(start,finish);
    Object.assign(w,completion,{status:'Closed',startedAt:new Date(start).toISOString(),completedAt:finish.toISOString(),downtimeMinutes}); audit(db,w,'Work completed',w.actions);
    const request=record(db,'requests',w.requestId); request.status='Closed'; audit(db,request,'Closed with work order',w.id);
    advancePreventive(db,w);
  }
}
function advancePreventive(db,w) {
  if(!w.pmId) return;
  const p=record(db,'preventive',w.pmId); const d=new Date(`${today()}T12:00:00`); d.setDate(d.getDate()+Number(p.intervalDays));
  p.nextDue=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; p.lastCompleted=today();
}
export function addPartRequest(db,v) {
  allow(db,'parts'); asset(db,v.equipmentId);
  if(v.workOrderId) { const w=record(db,'workOrders',v.workOrderId); requireValue(w.equipmentId===v.equipmentId,'Part and work order must refer to the same equipment.'); stage(w,'Awaiting risk assessment','Awaiting approval','Planned','In progress','Waiting for parts'); }
  const quantity=number(v.quantity,1); requireValue(Number.isInteger(quantity),'Quantity must be a whole number.');
  const p={id:nextId(db.partRequests,'SPR'),title:required(v,'title'),reference:required(v,'reference'),equipmentId:v.equipmentId,workOrderId:v.workOrderId || null,quantity,unit:v.unit || 'pcs',description:optional(v,'description'),neededBy:required(v,'neededBy'),urgency:v.urgency || 'P3',equivalent:v.equivalent==='yes',photos:v.photos || [],status:db.role==='Maintenance Responsible'?'Purchasing':'Responsible review',createdAt:today(),requestedBy:db.actor || db.role,requestedRole:db.role,receivedQuantity:0,acceptedQuantity:0,rejectedQuantity:0,history:[],deliveries:[]};
  db.partRequests.unshift(p); audit(db,p,'Purchase requested');
  if(db.role==='Maintenance Responsible') audit(db,p,'Responsible approval');
  if(p.workOrderId) { const w=record(db,'workOrders',p.workOrderId); if(['Planned','In progress'].includes(w.status)) { w.status='Waiting for parts'; audit(db,w,'Waiting for parts',p.id); } }
  return p;
}
export function updatePart(db,id,action,v) {
  const p=record(db,'partRequests',id);
  if(action==='approve' || action==='reject') {
    allow(db,'approve'); stage(p,'Responsible review','Order approval'); const note=optional(v,'note');
    const orderReview=p.status==='Order approval';
    p.status=orderReview?(action==='approve'?'Ordered':'Purchasing'):(action==='approve'?'Purchasing':'Rejected');
    if(orderReview) p.orderApproval=action==='approve'?{actor:db.actor || db.role,role:db.role,at:now()}:null;
    audit(db,p,orderReview?(action==='approve'?'Purchase authorized':'Order returned for revision'):p.status,note);
  } else if(action==='order') {
    allow(db,'purchase'); stage(p,'Purchasing');
    if(v.proforma && (!/^data:(application\/pdf|image\/(jpeg|png|webp));base64,/.test(v.proforma.data) || v.proforma.data.length>11_200_000)) throw new Error('Invalid proforma attachment. / Pièce jointe proforma invalide.');
    Object.assign(p,{supplier:required(v,'supplier'),orderReference:required(v,'orderReference'),expectedDate:required(v,'expectedDate'),quote:optional(v,'quote'),proforma:v.proforma || null,orderApproval:null,status:'Order approval'}); audit(db,p,'Order submitted for approval',p.orderReference);
  } else if(action==='receive') {
    allow(db,'purchase'); stage(p,'Ordered','Partial acceptance');
    const quantity=number(v.quantity,1); requireValue(Number.isInteger(quantity) && quantity<=p.quantity-p.acceptedQuantity,'Receipt exceeds outstanding quantity.');
    const delivery={quantity,reference:required(v,'deliveryReference'),receivedAt:now()};
    p.deliveries.push(delivery); p.receivedQuantity+=quantity; p.status='Technical acceptance'; audit(db,p,'Delivery received',`${quantity} / ${delivery.reference}`);
  } else if(action==='accept') {
    allow(db,'accept'); stage(p,'Technical acceptance'); const d=p.deliveries.at(-1);
    const accepted=number(v.acceptedQuantity); requireValue(Number.isInteger(accepted) && accepted<=d.quantity,'Accepted quantity exceeds delivered quantity.');
    const note=optional(v,'note'); Object.assign(d,{accepted,rejected:d.quantity-accepted,note,checkedAt:now()});
    p.acceptedQuantity+=accepted; p.rejectedQuantity+=d.rejected;
    p.status=p.acceptedQuantity===p.quantity?'Accepted':'Partial acceptance'; audit(db,p,p.status,note);
  } else if(action==='close') {
    allow(db,'accept'); stage(p,'Accepted'); p.status='Closed'; audit(db,p,'Closed',optional(v,'note'));
  }
}
export function addEquipment(db,v) {
  allow(db,'equipment'); if(v.parentId) asset(db,v.parentId);
  const e={id:nextId(db.equipment,'EQ'),name:required(v,'name'),reference:optional(v,'reference'),parentId:v.parentId || null,kind:v.kind || 'Machine',status:'Unknown',criticality:'Unassessed',description:v.description || '',source:'User entry — unverified'};
  db.equipment.push(e); return e;
}
export function editEquipment(db,id,v) {
  allow(db,'equipment'); const e=record(db,'equipment',id);
  const parentId=v.parentId || null;
  if(parentId) asset(db,parentId);
  let parent=db.equipment.find(x=>x.id===parentId); const seen=new Set([id]);
  while(parent) { requireValue(!seen.has(parent.id),'Equipment cannot be its own ancestor. / Un équipement ne peut pas être son propre parent.'); seen.add(parent.id); parent=db.equipment.find(x=>x.id===parent.parentId); }
  requireValue(['Area','Line','System','Machine','Component'].includes(v.kind),'Invalid equipment type.');
  const name=required(v,'name');
  Object.assign(e,{name,reference:optional(v,'reference'),parentId,kind:v.kind,description:optional(v,'description')});
  audit(db,e,'Equipment modified'); return e;
}
export function addStock(db,v) {
  allow(db,can(db.role,'equipment')?'equipment':'purchase');
  const reference=required(v,'reference');
  requireValue(!db.inventory.some(x=>x.reference.toLowerCase()===reference.toLowerCase()),'This stock reference already exists. / Cette référence existe déjà en stock.');
  const item={id:nextId(db.inventory,'STK'),name:required(v,'name'),reference,unit:required(v,'unit'),location:optional(v,'location'),minimum:number(v.minimum),movements:[],history:[]};
  audit(db,item,'Stock item created'); db.inventory.push(item); return item;
}
export const stockBalance=item=>(item.movements || []).reduce((sum,m)=>sum+(m.type==='in'?m.quantity:-m.quantity),0);
export function moveStock(db,id,v) {
  allow(db,can(db.role,'equipment')?'equipment':'purchase');
  const item=record(db,'inventory',id), quantity=number(v.quantity);
  requireValue(quantity>0 && ['in','out'].includes(v.type),'Enter a positive stock quantity and direction. / Saisissez une quantité positive et un sens de mouvement.');
  if(v.type==='out') { allow(db,'equipment'); requireValue(quantity<=stockBalance(item),'Insufficient stock. / Stock insuffisant.'); }
  const movement={type:v.type,quantity,at:now(),actor:db.actor || db.role,role:db.role,note:optional(v,'note')};
  item.movements.push(movement); audit(db,item,v.type==='in'?'Stock received':'Stock issued',movement.note); return item;
}
export function notificationFeed(db) {
  const feed=[], maintenanceRole=maintenance.includes(db.role);
  for(const collection of ['requests','workOrders','partRequests','reports']) for(const r of db[collection] || []) {
    const own=[r.reportedBy,r.requestedBy,r.author].includes(db.actor || db.role);
    const relevant=db.role==='Viewer' || maintenanceRole || (db.role==='Employee'?own:db.role==='Purchasing Department'?collection==='partRequests':db.role==='HSE' && ['requests','workOrders'].includes(collection));
    if(!relevant) continue;
    for(const h of r.history || []) feed.push({...h,id:r.id,title:r.title || r.summary || r.id,equipmentId:r.equipmentId,collection,status:'History'});
    let action='';
    if(collection==='requests') {
      if(canReviewRequest(db.role,r)) action='Approval requested';
      else if(db.role==='Maintenance Engineer' && ['Submitted','Returned','Site risk assessment'].includes(r.status)) action='Assessment requested';
    }
    if(collection==='workOrders' && maintenanceRole && r.status==='Planned' && (r.participants || []).includes(db.role)) action='Approved intervention reminder';
    if(collection==='partRequests' && db.role==='Maintenance Responsible' && ['Responsible review','Order approval'].includes(r.status)) action=r.status==='Order approval'?'Purchase approval requested':'Approval requested';
    if(collection==='partRequests' && db.role==='Purchasing Department' && ['Purchasing','Ordered','Partial acceptance'].includes(r.status)) action='Purchasing action required';
    if(action) feed.push({id:r.id,title:r.title || r.id,equipmentId:r.equipmentId,collection,status:'Pending',action,at:r.createdAt || '',actor:'',role:''});
  }
  return feed.sort((a,b)=>Number(b.status==='Pending')-Number(a.status==='Pending') || String(b.at).localeCompare(String(a.at)));
}
export function addPM(db,v) {
  allow(db,'pm'); asset(db,v.equipmentId); const intervalDays=number(v.intervalDays,1); requireValue(Number.isInteger(intervalDays),'Interval must be whole days.');
  const p={id:nextId(db.preventive,'PM'),title:required(v,'title'),equipmentId:v.equipmentId,intervalDays,nextDue:required(v,'nextDue'),owner:db.role,instructions:optional(v,'instructions')};
  db.preventive.push(p); return p;
}
export function recordReliability(db,v) {
  allow(db,'equipment');
  const equipment=record(db,'equipment',v.equipmentId);
  requireValue(['Machine','Component'].includes(equipment.kind),'Select a machine or component. / Sélectionnez une machine ou un composant.');
  const startDate=required(v,'startDate'), endDate=required(v,'endDate');
  const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
  requireValue(validDate(startDate) && validDate(endDate) && startDate<=endDate && endDate<=today(),'Enter a valid past measurement period. / Saisissez une période de mesure valide, non future.');
  const measuredNumber=key=>{const value=String(v[key] ?? '').trim(); requireValue(value!=='','Enter all measurement values. / Renseignez toutes les valeurs de mesure.'); return number(value);};
  const operatingHours=measuredNumber('operatingHours');
  const failureCount=measuredNumber('failureCount'), maintenanceCount=measuredNumber('maintenanceCount');
  const failedUnitHours=number(v.failedUnitHours || 0), failedUnitCount=number(v.failedUnitCount || 0);
  requireValue([failureCount,maintenanceCount,failedUnitCount].every(Number.isInteger),'Counts must be whole numbers. / Les nombres d’événements doivent être entiers.');
  const periodHours=(Date.parse(endDate)-Date.parse(startDate))/3_600_000+24;
  requireValue(operatingHours<=periodHours && (!(failureCount || maintenanceCount) || operatingHours>0),'Check operating hours against the period and counts. / Vérifiez les heures de fonctionnement par rapport à la période et aux événements.');
  requireValue((failedUnitCount===0 && failedUnitHours===0) || (failedUnitCount>0 && failedUnitHours>0),'Enter both failed-unit count and total lifetimes. / Renseignez le nombre d’unités défaillantes et leur durée de vie totale.');
  const logs=equipment.reliabilityLog || [];
  const same=log=>log.startDate===startDate && log.endDate===endDate;
  requireValue(!logs.some(log=>!same(log) && log.startDate<=endDate && log.endDate>=startDate),'Measurement periods cannot overlap. Edit the existing period instead. / Les périodes ne peuvent pas se chevaucher. Modifiez la période existante.');
  const entry={startDate,endDate,operatingHours,failureCount,maintenanceCount,failedUnitHours,failedUnitCount,updatedAt:now(),actor:db.actor || db.role,role:db.role};
  equipment.reliabilityLog=[...logs.filter(log=>!same(log)),entry].sort((a,b)=>b.startDate.localeCompare(a.startDate));
  audit(db,equipment,'Reliability measurements recorded');
  return entry;
}
export function generatePM(db,id) {
  allow(db,'pm'); const p=record(db,'preventive',id);
  requireValue(!db.requests.some(r=>r.pmId===id && !['Closed','Rejected'].includes(r.status)),'This plan already has an open intervention.');
  const r=addRequest(db,{title:p.title,equipmentId:p.equipmentId,description:p.instructions,reportedBy:db.actor || db.role,impact:'Preventive inspection'}); r.pmId=id; return r;
}
export function addReport(db,v) {
  allow(db,'report'); const date=required(v,'date');
  const equipmentId=v.equipmentId || null; if(equipmentId) asset(db,equipmentId);
  const activities=interventionReports(db).filter(item=>item.date===date && inEquipmentScope(db,item.equipmentId,equipmentId));
  const r={id:nextId(db.reports,'SR'),date,shift:v.shift || 'Day',equipmentId,author:db.actor || db.role,authorRole:db.role,summary:optional(v,'summary'),handover:optional(v,'handover'),diagnosis:optional(v,'diagnosis'),risks:optional(v,'risks'),rootCause:optional(v,'rootCause'),result:optional(v,'result'),activities,status:'Draft',history:[]};
  db.reports.unshift(r); audit(db,r,'Report created'); return r;
}
export function inEquipmentScope(db,equipmentId,scopeId) {
  if(!scopeId) return true;
  const seen=new Set();
  let current=equipmentId;
  while(current && !seen.has(current)) {
    if(current===scopeId) return true;
    seen.add(current);
    current=db.equipment.find(item=>item.id===current)?.parentId;
  }
  return false;
}
export function reportActivities(db,date='') {
  const requests=db.requests.filter(r=>!date || localDay(r.createdAt)===date).map(r=>({kind:'request',id:r.id,requestId:r.id,equipmentId:r.equipmentId,title:r.title,status:r.status,at:r.createdAt,description:r.description || '',diagnosis:r.diagnosis || '',risks:r.risks || [],result:r.status,actions:'',cause:'',downtimeMinutes:0}));
  const work=db.workOrders.filter(w=>{
    const dates=[w.history?.find(e=>['Work planned','Work issued'].includes(e.action))?.at,w.startedAt,w.completedAt];
    return !date || dates.some(value=>localDay(value)===date);
  }).map(w=>{
    const request=db.requests.find(r=>r.id===w.requestId);
    return {kind:'work',id:w.id,requestId:w.requestId,equipmentId:w.equipmentId,title:w.title,status:w.status,at:w.completedAt || w.startedAt || w.history?.[0]?.at || '',description:request?.description || '',diagnosis:w.diagnosis || request?.diagnosis || '',risks:request?.risks || [],cause:w.cause || '',actions:w.actions || '',result:[w.condition,w.repair].filter(Boolean).join(' · '),downtimeMinutes:w.downtimeMinutes || 0,startedAt:w.startedAt,completedAt:w.completedAt};
  });
  return [...requests,...work].sort((a,b)=>String(b.at).localeCompare(String(a.at)));
}
export function interventionReports(db) {
  return db.requests.map(request=>{
    const work=db.workOrders.find(item=>item.requestId===request.id);
    const at=work?.completedAt || work?.startedAt || work?.history?.[0]?.at || request.createdAt;
    return {id:work?.id || request.id,requestId:request.id,workOrderId:work?.id || null,title:request.title,equipmentId:request.equipmentId,priority:work?.priority || request.priority,status:work?.status || request.status,at,date:localDay(at),description:request.description || '',diagnosis:work?.diagnosis || request.diagnosis || '',risks:request.risks || [],cause:work?.cause || '',actions:work?.actions || '',result:[work?.condition,work?.repair].filter(Boolean).join(' · '),downtimeMinutes:work?.downtimeMinutes || 0,startedAt:work?.startedAt,completedAt:work?.completedAt};
  }).sort((a,b)=>String(b.at).localeCompare(String(a.at)) || b.id.localeCompare(a.id));
}
export function approveReport(db,id,v) { allow(db,'approve'); const r=record(db,'reports',id); stage(r,'Draft'); r.approval=audit(db,r,'Report approved',optional(v,'note')); r.status='Approved'; }
export function interventionProgressStep(request,work) {
  if(request.status==='Closed' || work?.status==='Closed') return 5;
  if(work && ['Planned','In progress','Waiting for parts'].includes(work.status)) return 3;
  if(work || request.status==='Approved') return 3;
  if(['Approval review','Responsible review','HSE review'].includes(request.status)) return 2;
  return 1;
}
export function statusMatches(item,filter) {
  if(filter==='All') return true;
  if(filter==='New') return item.status==='Submitted' || item.status==='New';
  if(filter==='Pending reviews') return ['Site risk assessment','Approval review','Responsible review','HSE review','Awaiting risk assessment','Awaiting approval'].includes(item.status);
  if(filter==='Approved') return ['Approved','Planned'].includes(item.status);
  if(filter==='Closed') return ['Closed','Legacy completed'].includes(item.status);
  return item.status===filter;
}
