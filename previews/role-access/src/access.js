
export const rolePages={
  Employee:['Equipment','Requests','Notifications','Profile'],
  'Production Responsible':['Overview','KPI','Equipment','Requests','Preventive','Notifications','Profile'],
  'Maintenance Engineer':['Overview','KPI','Equipment','Requests','Preventive','Parts','Reports','Inventory','Notifications','Profile'],
  'Maintenance Responsible':['Overview','KPI','Equipment','Requests','Preventive','Parts','Reports','Inventory','Notifications','Profile'],
  HSE:['Overview','KPI','Equipment','Requests','Preventive','Notifications','Profile'],
  'Purchasing Department':['Parts','Notifications','Profile'],
  Viewer:['Overview','KPI','Equipment','Requests','Preventive','Parts','Reports','Inventory','Notifications','Profile']
};
export const canSeePage=(role,page)=>(rolePages[role] || []).includes(page);
const pick=(item,fields)=>Object.fromEntries(fields.filter(key=>key in item).map(key=>[key,item[key]]));
const equipmentFields=['id','name','parentId','kind','reference','status','criticality','description','source','sourceCell'];
const requestFields=['id','title','equipmentId','description','status','priority','reportedBy','reportedRole','reportedJob','reportedEmail','createdAt','createdBy','photos'];
const workFields=['id','requestId','title','equipmentId','priority','status','dueDate','startedAt','completedAt','downtimeMinutes','type','pmId'];
export function workspaceForRole(workspace,user) {
  if(workspace.accessProjection) return workspace;
  const {appliedCommands,...result}=workspace;
  result.role=user.role;result.actor=user.name;result.actorEmail=user.email;result.accessProjection=true;
  if(['Maintenance Engineer','Maintenance Responsible','Viewer'].includes(user.role)) return result;
  result.publicKpis={};
  result.equipment=workspace.equipment.map(e=>pick(e,equipmentFields));
  result.documents=[];result.parts=[];result.reports=[];
  if(user.role==='Employee') {
    result.requests=workspace.requests.filter(r=>user.email?r.reportedEmail===user.email:r.reportedBy===user.name).map(r=>({...pick(r,requestFields),risks:[],history:(r.history || []).filter(h=>['Submitted','Returned','Rejected','Closed','Closed with work order'].includes(h.action)).map(h=>pick(h,['at','action']))}));
    const ids=new Set(result.requests.map(r=>r.id));
    result.workOrders=workspace.workOrders.filter(w=>ids.has(w.requestId)).map(w=>({...pick(w,workFields),participants:[],history:[]}));
    result.preventive=[];result.publicKpis={};
    result.partRequests=[];result.inventory=[];
  } else if(['Production Responsible','HSE'].includes(user.role)) {
    const roots=new Set(workspace.equipment.filter(e=>!e.parentId && (user.role==='Production Responsible'?/^(Production|Conditionnement)$/i.test(e.name):/MCR|Utilités|Utilities/i.test(e.name))).map(e=>e.id));
    const inScope=id=>{const seen=new Set();while(id && !seen.has(id)){if(roots.has(id))return true;seen.add(id);id=workspace.equipment.find(e=>e.id===id)?.parentId;}return false;};
    result.equipment=result.equipment.filter(e=>inScope(e.id));
    result.requests=workspace.requests.filter(r=>inScope(r.equipmentId));
    const ids=new Set(result.requests.map(r=>r.id));
    result.workOrders=workspace.workOrders.filter(w=>inScope(w.equipmentId) && (!w.requestId || ids.has(w.requestId)));
    result.preventive=workspace.preventive.filter(p=>inScope(p.equipmentId));
    result.partRequests=[];result.inventory=[];
  } else if(user.role==='Purchasing Department') {
    result.requests=[];result.workOrders=[];result.preventive=[];
    result.inventory=[];
  } else {
    result.requests=[];result.workOrders=[];result.preventive=[];result.partRequests=[];result.inventory=[];result.publicKpis={};
  }
  return result;
}
