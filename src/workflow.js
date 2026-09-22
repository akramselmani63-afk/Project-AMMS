import { load as loadBase, seed as seedBase, nextId } from './data.js';

export const roles = ['Employee','Maintenance Engineer','Maintenance Responsible','HSE','Service Achats','Developer Admin'];
const maintenance = ['Maintenance Engineer','Maintenance Responsible'];
export const rights = {
  Employee: ['request'],
  'Maintenance Engineer': ['request','assess','work','equipment','pm','parts','accept','report','close'],
  'Maintenance Responsible': ['request','assess','approve','work','equipment','pm','parts','accept','report','close'],
  HSE: ['hse'], 'Service Achats': ['purchase'], 'Developer Admin': ['backup']
};
export const can = (role, action) => rights[role]?.includes(action) || false;
export const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const now = () => new Date().toISOString();
const requireValue = (ok, message) => { if (!ok) throw new Error(message); };
const required = (v, key) => { const text=String(v[key] || '').trim(); requireValue(text, `Required: ${key}`); return text; };
const optional = (v,key) => String(v[key] || '').trim();
const number = (v, minimum=0) => { const n=Number(v); requireValue(Number.isFinite(n) && n>=minimum,'Invalid quantity or duration.'); return n; };
const record = (db, collection, id) => { const item=db[collection].find(x=>x.id===id); requireValue(item,'Record not found.'); return item; };
const asset = (db,id) => requireValue(db.equipment.some(x=>x.id===id),'Select valid equipment.');
const allow = (db,action) => requireValue(can(db.role,action),'This role cannot perform this action.');
const stage = (item,...states) => requireValue(states.includes(item.status),'This action is unavailable at this stage.');
export function audit(db,item,action,note='') {
  const event={at:now(),role:db.role,actor:db.actor || db.role,action,note};
  (item.history ||= []).push(event); return event;
}
export function migrate(db) {
  if (db.schemaVersion >= 4) return db;
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
      const r={id:nextId(db.requests,'IR'),title:w.title,equipmentId:w.equipmentId,description:w.notes || '',status:'Submitted',priority:w.priority || 'P3',reportedBy:w.assignee || 'Legacy demo',createdAt:today(),photos:[],risks:[],history:[],legacyWorkId:w.id};
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
  db.schemaVersion=4; return db;
}
export function canReviewRequest(role,r) {
  return reviewStages.includes(r.status) && ((role==='Maintenance Responsible' && !r.approval) || (role==='HSE' && !r.hseApproval));
}

export const seed = () => migrate(seedBase());
export const load = storage => migrate(loadBase(storage));
export function addRequest(db,v) {
  allow(db,'request'); asset(db,v.equipmentId);
  const r={id:nextId(db.requests,'IR'),title:required(v,'title'),equipmentId:v.equipmentId,description:optional(v,'description'),impact:v.impact || '',reportedBy:required(v,'reportedBy'),createdAt:today(),status:'Submitted',priority:null,photos:v.photos || [],risks:[],history:[]};
  audit(db,r,'Submitted'); db.requests.unshift(r); return r;
}
export function assess(db,id,v) {
  allow(db,'assess'); const r=record(db,'requests',id); stage(r,'Submitted','Returned');
  requireValue(['P1','P2','P3','P4'].includes(v.priority),'Select priority.');
  Object.assign(r,{priority:v.priority,diagnosis:optional(v,'diagnosis'),risks:v.risks || [],status:'Approval review'});
  delete r.approval; delete r.hseApproval; delete r.precautions; audit(db,r,'Assessed',r.diagnosis);
  if(db.role==='Maintenance Responsible') r.approval=audit(db,r,'Responsible approval');
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
    audit(db,r,r.status,note); return;
  }
  if(db.role==='Maintenance Responsible') r.approval=audit(db,r,'Responsible approval',note);
  else { r.precautions=note; r.hseApproval=audit(db,r,'HSE approval',note); }
  r.status=approvalStatus(r);
  if(r.status==='Approved') for(const w of db.workOrders.filter(w=>w.requestId===id && w.status==='Awaiting approval')) w.status='Planned';
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
  const participants=v.participants || ['Maintenance Responsible'];
  requireValue(participants.length && participants.every(x=>maintenance.includes(x)),'Select maintenance participants.');
  const r=addRequest(db,{...v,reportedBy:db.actor || db.role});
  r.issuedByResponsible=true;
  assess(db,r.id,{...v,diagnosis:v.notes || '',risks:v.risks || []});
  return createWork(db,r.id,{...v,participants});
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
    const completion={diagnosis:optional(v,'diagnosis'),cause:optional(v,'cause'),actions:optional(v,'actions'),condition:optional(v,'condition'),downtimeMinutes:number(v.downtimeMinutes || 0),repair:required(v,'repair')};
    Object.assign(w,completion,{status:'HSE closure',completedAt:now()}); audit(db,w,'Work completed',w.actions);
  }
}
export function closeWork(db,id,v) {
  const w=record(db,'workOrders',id);
  if(w.status==='HSE closure') { allow(db,'hse'); w.safetyClosure=audit(db,w,'HSE closure',optional(v,'note')); w.status='Validation'; return; }
  stage(w,'Validation'); allow(db,'close');
  const note=optional(v,'note');
  requireValue(db.role==='Maintenance Responsible' || !w.participants.includes(db.role),'The Maintenance Responsible must validate engineer work.');
  w.validation=audit(db,w,'Closed',note); w.status='Closed';
  const r=record(db,'requests',w.requestId); r.status='Closed'; audit(db,r,'Closed with work order',w.id);
  if(w.pmId) {
    const p=record(db,'preventive',w.pmId); const d=new Date(`${today()}T12:00:00`); d.setDate(d.getDate()+Number(p.intervalDays));
    p.nextDue=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    p.lastCompleted=today();
  }
}
export function addPartRequest(db,v) {
  allow(db,'parts'); asset(db,v.equipmentId);
  if(v.workOrderId) { const w=record(db,'workOrders',v.workOrderId); requireValue(w.equipmentId===v.equipmentId,'Part and work order must refer to the same equipment.'); stage(w,'Awaiting approval','Planned','In progress','Waiting for parts'); }
  const quantity=number(v.quantity,1); requireValue(Number.isInteger(quantity),'Quantity must be a whole number.');
  const p={id:nextId(db.partRequests,'SPR'),title:required(v,'title'),reference:required(v,'reference'),equipmentId:v.equipmentId,workOrderId:v.workOrderId || null,quantity,unit:v.unit || 'pcs',description:optional(v,'description'),neededBy:required(v,'neededBy'),urgency:v.urgency || 'P3',equivalent:v.equivalent==='yes',photos:v.photos || [],status:db.role==='Maintenance Responsible'?'Purchasing':'Responsible review',createdAt:today(),requestedBy:db.actor || db.role,receivedQuantity:0,acceptedQuantity:0,rejectedQuantity:0,history:[],deliveries:[]};
  db.partRequests.unshift(p); audit(db,p,'Purchase requested');
  if(db.role==='Maintenance Responsible') audit(db,p,'Responsible approval');
  if(p.workOrderId) { const w=record(db,'workOrders',p.workOrderId); if(['Planned','In progress'].includes(w.status)) { w.status='Waiting for parts'; audit(db,w,'Waiting for parts',p.id); } }
  return p;
}
export function updatePart(db,id,action,v) {
  const p=record(db,'partRequests',id);
  if(action==='approve' || action==='reject') {
    allow(db,'approve'); stage(p,'Responsible review'); const note=optional(v,'note');
    p.status=action==='approve'?'Purchasing':'Rejected'; audit(db,p,p.status,note);
  } else if(action==='order') {
    allow(db,'purchase'); stage(p,'Purchasing');
    Object.assign(p,{supplier:required(v,'supplier'),orderReference:required(v,'orderReference'),expectedDate:required(v,'expectedDate'),quote:optional(v,'quote'),status:'Ordered'}); audit(db,p,'Ordered',p.orderReference);
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
  const e={id:nextId(db.equipment,'EQ'),name:required(v,'name'),parentId:v.parentId || null,kind:v.kind || 'Machine',status:'Unknown',criticality:'Unassessed',description:v.description || '',source:'User entry — unverified'};
  db.equipment.push(e); return e;
}
export function addPM(db,v) {
  allow(db,'pm'); asset(db,v.equipmentId); const intervalDays=number(v.intervalDays,1); requireValue(Number.isInteger(intervalDays),'Interval must be whole days.');
  const p={id:nextId(db.preventive,'PM'),title:required(v,'title'),equipmentId:v.equipmentId,intervalDays,nextDue:required(v,'nextDue'),owner:db.role,instructions:optional(v,'instructions')};
  db.preventive.push(p); return p;
}
export function generatePM(db,id) {
  allow(db,'pm'); const p=record(db,'preventive',id);
  requireValue(!db.requests.some(r=>r.pmId===id && !['Closed','Rejected'].includes(r.status)),'This plan already has an open intervention.');
  const r=addRequest(db,{title:p.title,equipmentId:p.equipmentId,description:p.instructions,reportedBy:db.actor || db.role,impact:'Preventive inspection'}); r.pmId=id; return r;
}
export function addReport(db,v) {
  allow(db,'report'); const date=required(v,'date');
  const activities=db.workOrders.filter(w=>[w.startedAt,w.completedAt].some(d=>d?.slice(0,10)===date)).map(w=>({id:w.id,equipmentId:w.equipmentId,title:w.title,status:w.status,actions:w.actions || '',downtimeMinutes:w.downtimeMinutes || 0}));
  const r={id:nextId(db.reports,'SR'),date,shift:v.shift || 'Day',author:db.actor || db.role,summary:optional(v,'summary'),handover:v.handover || '',activities,status:'Draft',history:[]};
  db.reports.unshift(r); audit(db,r,'Report created'); return r;
}
export function approveReport(db,id,v) { allow(db,'approve'); const r=record(db,'reports',id); stage(r,'Draft'); r.approval=audit(db,r,'Report approved',optional(v,'note')); r.status='Approved'; }
export function statusMatches(item,filter) {
  if(filter==='All') return true;
  if(filter==='New') return item.status==='Submitted' || item.status==='New';
  if(filter==='Pending reviews') return ['Approval review','Responsible review','HSE review'].includes(item.status);
  if(filter==='Closed') return ['Closed','Legacy completed'].includes(item.status);
  return item.status===filter;
}
