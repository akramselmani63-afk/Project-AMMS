import { load, save, seed, roles, can, nextId, equipmentPath, addRequest, createWorkOrder, completePreventive } from './data.js';

let db = load();
let page = 'Overview';
let query = '';
let filter = 'All';
let selectedEquipment = null;
let dialog = '';
let notice = '';
const app = document.querySelector('#app');
const nav = [
  ['Overview', 'Overview'], ['Equipment', 'Equipment'], ['Requests', 'Intervention requests'], ['Work orders', 'Work orders'],
  ['Preventive', 'Preventive maintenance'], ['Reports', 'Shift reports'], ['Parts', 'Spare parts'], ['Documents', 'Documents'], ['Roles', 'Roles & access']
];
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const attr = esc;
const equipmentName = id => db.equipment.find(x => x.id === id)?.name || 'Unassigned';
const badge = (text, tone) => `<span class="badge ${tone || toneFor(text)}">${esc(text)}</span>`;
const toneFor = text => ({ P1:'red', P2:'amber', P3:'blue', P4:'slate', S1:'red', S2:'amber', S3:'blue', S4:'slate', New:'blue', Approved:'green', Planned:'slate', 'In progress':'amber', Completed:'green', Operational:'green', Attention:'amber', Low:'red' })[text] || 'slate';
const eqOptions = (selected = '') => db.equipment.filter(x => !['Area'].includes(x.kind)).map(x => `<option value="${x.id}" ${x.id === selected ? 'selected' : ''}>${esc(equipmentPath(db.equipment, x.id))}</option>`).join('');
const empty = (message = 'No records match this view.') => `<div class="empty"><strong>Nothing to show</strong><p>${esc(message)}</p></div>`;
const matches = (...values) => !query || values.some(x => String(x ?? '').toLowerCase().includes(query));
const header = (title, description, action = '') => `<div class="section-head"><div><p class="eyebrow">Maintenance workspace</p><h1>${title}</h1><p class="lede">${description}</p></div>${action}</div>`;
const btn = (label, action, enabled = true, extra = '') => enabled ? `<button class="button ${extra}" data-action="${action}">${label}</button>` : '';
const stat = (value, label, detail, tone = '') => `<div class="stat"><strong class="stat-number ${tone}">${value}</strong><span>${label}</span><small>${detail}</small></div>`;
const rows = (heads, body) => `<div class="table-wrap"><table><thead><tr>${heads.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
const today = () => new Date().toISOString().slice(0,10);

function render() {
  const active = db.workOrders.filter(x => x.status !== 'Completed').length;
  app.innerHTML = `<div class="shell">
    <aside class="sidebar" id="sidebar"><div class="brand"><span class="brand-mark">A</span><div><strong>AMMS</strong><small>AGRIDIAM MAINTENANCE</small></div></div>
      <div class="workspace-label">WORKSPACE <span>DEMO</span></div>
      <nav aria-label="Main navigation">${nav.map(([id,label]) => `<button class="nav-item ${page === id ? 'active' : ''}" data-page="${id}"><span class="nav-mark"></span>${label}${id === 'Work orders' ? `<em>${active}</em>` : ''}</button>`).join('')}</nav>
      <div class="sidebar-foot"><strong>Prototype workspace</strong><p>Sample records are stored in this browser. AGRIDIAM source data has not been verified.</p></div>
    </aside>
    <main class="main"><header class="topbar"><button class="menu-button" data-action="menu" aria-label="Toggle menu">☰</button><div class="breadcrumb">AMMS <span>/</span> ${esc(page)}</div><div class="top-actions"><label class="search"><span>Search</span><input id="global-search" type="search" placeholder="Search current view" value="${attr(query)}" aria-label="Search current view"></label><span class="role-chip">${esc(db.role)}</span></div></header>
    <div class="content"><div class="demo-banner"><span>DEMO DATA</span> Equipment names, activities and quantities shown here are illustrative until verified against AGRIDIAM records.</div>${view()}</div></main>
    ${dialog ? modal() : ''}
  </div>`;
  if (dialog) document.querySelector('.modal input:not([type=hidden]), .modal select, .modal textarea')?.focus();
}

function view() {
  if (page === 'Overview') return overview();
  if (page === 'Equipment') return equipment();
  if (page === 'Requests') return requests();
  if (page === 'Work orders') return workOrders();
  if (page === 'Preventive') return preventive();
  if (page === 'Reports') return reports();
  if (page === 'Parts') return parts();
  if (page === 'Documents') return documents();
  return roleView();
}

function overview() {
  const open = db.requests.filter(x => x.status === 'New');
  const active = db.workOrders.filter(x => x.status !== 'Completed');
  const due = db.preventive.filter(x => x.nextDue <= new Date(Date.now() + 7*86400000).toISOString().slice(0,10));
  const low = db.parts.filter(x => x.quantity <= x.reorderPoint);
  return `${header('Operational overview', 'A clear view of today’s maintenance workload.', btn('New intervention request', 'new-request', can(db.role,'request:create'), 'primary'))}
    <div class="stats">${stat(open.length,'New requests','Awaiting triage','blue')}${stat(active.length,'Open work orders','Corrective and preventive','amber')}${stat(due.length,'PM due within 7 days','Upcoming planned work','')}${stat(low.length,'Parts at reorder point','Review stock coverage','red')}</div>
    <div class="overview-grid"><section class="panel wide"><div class="panel-head"><div><p class="eyebrow">ACTION QUEUE</p><h2>Priority work</h2></div><button class="text-button" data-page="Work orders">View all work orders →</button></div>${active.length ? `<div class="queue">${active.slice(0,5).map(x => `<button class="queue-row" data-page="Work orders"><span class="queue-id">${x.id}</span><span class="queue-main"><strong>${esc(x.title)}</strong><small>${esc(equipmentPath(db.equipment,x.equipmentId))}</small></span>${badge(x.priority)}${badge(x.status)}</button>`).join('')}</div>` : empty('No open work orders.')}</section>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">NEXT 7 DAYS</p><h2>Preventive schedule</h2></div></div>${due.length ? due.map(x => `<div class="mini-row"><div><strong>${esc(x.title)}</strong><small>${esc(equipmentName(x.equipmentId))}</small></div><span>${esc(x.nextDue)}</span></div>`).join('') : empty('No preventive tasks due soon.')}<button class="text-button panel-link" data-page="Preventive">Open schedule →</button></section>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">INTAKE</p><h2>New requests</h2></div></div>${open.length ? open.slice(0,4).map(x => `<div class="mini-row"><div><strong>${esc(x.title)}</strong><small>${esc(equipmentName(x.equipmentId))}</small></div>${badge(x.severity)}</div>`).join('') : empty('No new requests.')}<button class="text-button panel-link" data-page="Requests">Review requests →</button></section>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">STORES</p><h2>Stock attention</h2></div></div>${low.length ? low.map(x => `<div class="mini-row"><div><strong>${esc(x.name)}</strong><small>${esc(x.sku)}</small></div><span class="stock-low">${x.quantity} ${esc(x.unit)}</span></div>`).join('') : empty('All sample parts are above reorder point.')}<button class="text-button panel-link" data-page="Parts">Open spare parts →</button></section></div>`;
}

function equipment() {
  const parents = db.equipment.filter(x => x.parentId === null);
  const selected = db.equipment.find(x => x.id === selectedEquipment) || parents[0];
  const tree = (parentId, depth = 0) => db.equipment.filter(x => x.parentId === parentId).map(x => `<div class="tree-node" style="--depth:${depth}"><button data-select-equipment="${x.id}" class="tree-button ${selected?.id === x.id ? 'selected' : ''}"><span class="tree-glyph">${x.kind === 'Area' ? '▣' : x.kind === 'Line' ? '▤' : '◇'}</span><span>${esc(x.name)}</span><small>${esc(x.kind)}</small></button>${tree(x.id,depth+1)}</div>`).join('');
  const related = db.workOrders.filter(x => x.equipmentId === selected?.id);
  return `${header('Equipment register', 'Navigate areas, lines, systems and machines in one hierarchy.', btn('Add equipment','new-equipment',can(db.role,'equipment:manage'),'primary'))}<div class="equipment-layout"><section class="panel tree-panel"><div class="panel-head"><h2>Asset hierarchy</h2><small>${db.equipment.length} records</small></div>${tree(null)}</section><section class="panel detail-panel">${selected ? `<p class="eyebrow">${esc(selected.id)} · ${esc(selected.kind)}</p><h2>${esc(selected.name)}</h2><p class="muted">${esc(equipmentPath(db.equipment,selected.id))}</p><div class="detail-grid"><div><small>Status</small>${badge(selected.status)}</div><div><small>Criticality</small><strong>${esc(selected.criticality)}</strong></div><div><small>Parent</small><strong>${esc(equipmentName(selected.parentId))}</strong></div><div><small>Open work orders</small><strong>${related.filter(x => x.status !== 'Completed').length}</strong></div></div><h3>About this equipment</h3><p>${esc(selected.description || 'No description recorded.')}</p><h3>Related work</h3>${related.length ? related.map(x => `<div class="mini-row"><strong>${esc(x.id)} · ${esc(x.title)}</strong>${badge(x.status)}</div>`).join('') : empty('No linked work orders.')}` : empty('Select an asset.')}</section></div>`;
}

function requests() {
  const items = db.requests.filter(x => (filter === 'All' || x.status === filter) && matches(x.id,x.title,equipmentName(x.equipmentId),x.reportedBy,x.description));
  return `${header('Intervention requests','Capture a problem, assess severity, then plan the work.',btn('New request','new-request',can(db.role,'request:create'),'primary'))}<div class="legend"><strong>Severity</strong> S1 safety or critical stop · S2 major disruption · S3 degraded operation · S4 minor issue <span></span><strong>Priority</strong> P1 immediate · P2 urgent · P3 planned · P4 routine</div>${filters(['All','New','Approved','Closed'])}${items.length ? rows(['Request','Equipment','Severity','Priority','Status','Reported','Action'],items.map(x => `<tr><td><strong>${esc(x.id)}</strong><small>${esc(x.title)}</small></td><td>${esc(equipmentName(x.equipmentId))}</td><td>${badge(x.severity)}</td><td>${badge(x.priority)}</td><td>${badge(x.status)}</td><td>${esc(x.createdAt)}</td><td>${can(db.role,'request:triage') && x.status === 'New' ? `<button class="inline-button" data-action="triage:${x.id}">Triage</button>` : ''}${can(db.role,'work:create') && !db.workOrders.some(w => w.requestId === x.id) && x.status !== 'Closed' ? `<button class="inline-button" data-action="convert:${x.id}">Create WO</button>` : ''}</td></tr>`).join('')) : empty()}`;
}
function filters(values) { return `<div class="filters" role="group" aria-label="Status filter">${values.map(x => `<button class="filter ${filter === x ? 'active' : ''}" data-filter="${x}">${x}</button>`).join('')}</div>`; }

function workOrders() {
  const items = db.workOrders.filter(x => (filter === 'All' || x.status === filter || x.type === filter) && matches(x.id,x.title,equipmentName(x.equipmentId),x.assignee,x.notes));
  return `${header('Work orders','Plan, assign and close corrective and preventive work.',btn('New work order','new-work',can(db.role,'work:create'),'primary'))}${filters(['All','Planned','In progress','Completed','Corrective','Preventive'])}${items.length ? rows(['Work order','Asset / type','Priority','Due','Owner','Status','Action'],items.map(x => `<tr><td><strong>${esc(x.id)}</strong><small>${esc(x.title)}</small></td><td>${esc(equipmentName(x.equipmentId))}<small>${esc(x.type)}</small></td><td>${badge(x.priority)}</td><td>${esc(x.dueDate)}</td><td>${esc(x.assignee)}</td><td>${badge(x.status)}</td><td>${can(db.role,'work:update') && x.status !== 'Completed' ? `<button class="inline-button" data-action="advance:${x.id}">${x.status === 'Planned' ? 'Start' : 'Complete'}</button>` : ''}</td></tr>`).join('')) : empty()}`;
}

function preventive() {
  const items = db.preventive.filter(x => matches(x.id,x.title,equipmentName(x.equipmentId),x.owner,x.instructions));
  return `${header('Preventive maintenance','Keep recurring inspections visible before they become urgent.',btn('New PM plan','new-pm',can(db.role,'preventive:manage'),'primary'))}<div class="cards-grid">${items.length ? items.map(x => `<article class="pm-card"><div class="card-top"><span class="eyebrow">${esc(x.id)} · EVERY ${x.intervalDays} DAYS</span>${badge(x.nextDue <= today() ? 'Due' : 'Scheduled',x.nextDue <= today() ? 'amber' : 'green')}</div><h2>${esc(x.title)}</h2><p>${esc(equipmentPath(db.equipment,x.equipmentId))}</p><div class="card-meta"><div><small>Next due</small><strong>${esc(x.nextDue)}</strong></div><div><small>Owner</small><strong>${esc(x.owner)}</strong></div></div><p class="instructions">${esc(x.instructions)}</p>${btn('Mark done','complete-pm:'+x.id,can(db.role,'preventive:manage'),'secondary')}</article>`).join('') : empty()}</div>`;
}

function reports() {
  const items = db.reports.filter(x => matches(x.id,x.summary,x.shift,x.author,x.linkedWorkOrderId));
  return `${header('Shift reports','Keep a concise log of maintenance activity and downtime.',btn('New shift report','new-report',can(db.role,'report:create'),'primary'))}${items.length ? `<div class="report-list">${items.map(x => `<article class="report"><div class="report-date"><strong>${esc(x.date)}</strong><span>${esc(x.shift)} shift</span></div><div><p class="eyebrow">${esc(x.id)} · ${esc(x.author)}</p><h2>${esc(x.summary)}</h2><div class="report-meta"><span>Downtime: ${x.downtimeMinutes} min</span><span>${x.linkedWorkOrderId ? 'Linked: '+esc(x.linkedWorkOrderId) : 'No linked work order'}</span></div></div></article>`).join('')}</div>` : empty()}`;
}

function parts() {
  const items = db.parts.filter(x => matches(x.id,x.name,x.sku,x.location));
  return `${header('Spare parts','Monitor sample stock levels and reorder thresholds.',btn('Add part','new-part',can(db.role,'parts:manage'),'primary'))}${items.length ? rows(['Part','SKU','On hand','Reorder at','Location','Action'],items.map(x => `<tr><td><strong>${esc(x.name)}</strong><small>${esc(x.id)}</small></td><td>${esc(x.sku)}</td><td>${badge(`${x.quantity} ${x.unit}`,x.quantity <= x.reorderPoint ? 'red' : 'green')}</td><td>${x.reorderPoint} ${esc(x.unit)}</td><td>${esc(x.location)}</td><td>${can(db.role,'parts:manage') ? `<button class="inline-button" data-action="adjust:${x.id}">Adjust stock</button>` : ''}</td></tr>`).join('')) : empty()}`;
}

function documents() {
  const items = db.documents.filter(x => matches(x.id,x.title,x.category,equipmentName(x.equipmentId),x.note));
  return `${header('Documents','Link procedures, manuals and checklists to equipment.',btn('Add document','new-document',can(db.role,'document:manage'),'primary'))}<div class="cards-grid">${items.length ? items.map(x => `<article class="document-card"><div class="doc-symbol">▤</div><p class="eyebrow">${esc(x.category)} · ${esc(x.id)}</p><h2>${esc(x.title)}</h2><p>${esc(equipmentName(x.equipmentId))}</p><small>${esc(x.note || 'No note')}</small>${x.url ? `<a href="${attr(x.url)}" target="_blank" rel="noopener noreferrer">Open document ↗</a>` : '<span class="unlinked">No file linked</span>'}</article>`).join('') : empty()}</div>`;
}

function roleView() {
  return `${header('Roles & access','Explore prototype permissions using the demo role switcher.')}<section class="panel role-panel"><h2>Current role</h2><p>Choose a role to preview which maintenance actions appear. This is a demo control, not authentication.</p><label class="field"><span>Preview role</span><select id="role-select">${roles.map(x => `<option ${x === db.role ? 'selected' : ''}>${x}</option>`).join('')}</select></label><div class="role-grid">${roles.map(x => `<div><h3>${x}</h3><ul>${({Requester:['Submit requests'],Technician:['Submit requests','Update work orders','Write shift reports'],Planner:['Triage requests','Plan and update work','Manage PM, parts, equipment and documents'],Supervisor:['All planning and operational actions'],Admin:['All prototype actions']})[x].map(p => `<li>${p}</li>`).join('')}</ul></div>`).join('')}</div><div class="callout"><strong>Production note</strong><p>Accounts, server-side permissions, an audit trail and shared storage must be added before real operational use.</p></div><button class="text-button" data-action="reset">Reset demo records</button></section>`;
}

function field(name,label,type='text',value='',required=false) { return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${attr(value)}" ${required ? 'required' : ''}></label>`; }
function select(name,label,options,selected='') { return `<label class="field"><span>${label}</span><select name="${name}">${options.map(x => `<option value="${attr(x)}" ${x === selected ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>`; }
function eqField(selected='') { return `<label class="field"><span>Equipment</span><select name="equipmentId">${eqOptions(selected)}</select></label>`; }
function textarea(name,label,value='') { return `<label class="field full"><span>${label}</span><textarea name="${name}" rows="3">${esc(value)}</textarea></label>`; }
function modal() {
  const [type,id] = dialog.split(':');
  const request = db.requests.find(x => x.id === id);
  const part = db.parts.find(x => x.id === id);
  const forms = {
    'new-request': ['New intervention request', `${field('title','Problem title','text','',true)}${eqField()}${select('severity','Severity',['S1','S2','S3','S4'],'S3')}${select('priority','Priority',['P1','P2','P3','P4'],'P3')}${field('reportedBy','Reported by','text','Demo user')}${textarea('description','Description')}`],
    'new-work': ['New work order', `${field('title','Work title','text',request ? 'Investigate '+request.title : '',true)}${eqField(request?.equipmentId)}${select('type','Work type',['Corrective','Preventive'],'Corrective')}${select('priority','Priority',['P1','P2','P3','P4'],request?.priority || 'P3')}${field('assignee','Assigned to','text','Maintenance team')}${field('dueDate','Due date','date',today())}${textarea('notes','Work instructions')}${request ? `<input type="hidden" name="requestId" value="${request.id}">` : ''}`],
    'triage': ['Triage request', `${select('severity','Severity',['S1','S2','S3','S4'],request?.severity)}${select('priority','Priority',['P1','P2','P3','P4'],request?.priority)}${select('status','Decision',['New','Approved','Closed'],request?.status)}`],
    'new-equipment': ['Add equipment', `${field('name','Equipment name','text','',true)}${select('kind','Type',['Area','Line','System','Machine','Component'])}<label class="field"><span>Parent asset</span><select name="parentId"><option value="">Top level</option>${db.equipment.map(x => `<option value="${x.id}">${esc(equipmentPath(db.equipment,x.id))}</option>`).join('')}</select></label>${select('status','Status',['Operational','Attention','Out of service'])}${select('criticality','Criticality',['High','Medium','Low'],'Medium')}${textarea('description','Description')}`],
    'new-pm': ['New preventive plan', `${field('title','Task title','text','',true)}${eqField()}${field('intervalDays','Interval in days','number','30',true)}${field('nextDue','Next due','date',today(),true)}${field('owner','Owner','text','Maintenance team')}${textarea('instructions','Instructions')}`],
    'new-report': ['New shift report', `${field('date','Date','date',today(),true)}${select('shift','Shift',['Day','Night'])}${field('author','Author','text','Demo user')}${field('downtimeMinutes','Downtime in minutes','number','0')}${select('linkedWorkOrderId','Linked work order',['',...db.workOrders.map(x=>x.id)])}${textarea('summary','Shift summary')}`],
    'new-part': ['Add spare part', `${field('name','Part name','text','',true)}${field('sku','SKU','text','',true)}${field('quantity','Quantity','number','0')}${field('reorderPoint','Reorder point','number','0')}${field('unit','Unit','text','pcs')}${field('location','Store location')}`],
    'adjust': ['Adjust stock', `<p class="modal-context">${esc(part?.name)} · current stock ${part?.quantity} ${esc(part?.unit)}</p>${field('delta','Change in quantity (+ or −)','number','0',true)}`],
    'new-document': ['Add document', `${field('title','Document title','text','',true)}${select('category','Category',['Manual','Procedure','Checklist','Drawing','Other'])}${eqField()}${field('url','Document URL','url')}${textarea('note','Note')}`]
  };
  const [title,content] = forms[type] || forms['new-request'];
  return `<div class="modal-backdrop" data-action="close"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><div><p class="eyebrow">AMMS · DEMO</p><h2>${esc(title)}</h2></div><button type="button" class="close" data-action="close" aria-label="Close">×</button></div><form id="entry-form" data-form="${type}" data-id="${attr(id || '')}"><div class="form-grid">${content}</div><div class="form-actions"><button type="button" class="button secondary" data-action="close">Cancel</button><button type="submit" class="button primary">Save record</button></div></form></div></div>`;
}

function commit() { save(db); render(); }
function flash(message) { notice = message; let old = document.querySelector('.toast'); if (old) old.remove(); const el = document.createElement('div'); el.className='toast'; el.textContent=message; document.body.append(el); setTimeout(()=>el.remove(),3500); }
document.addEventListener('click', e => {
  const pageButton = e.target.closest('[data-page]'); if (pageButton) { page = pageButton.dataset.page; query=''; filter='All'; dialog=''; render(); return; }
  const eqButton = e.target.closest('[data-select-equipment]'); if (eqButton) { selectedEquipment=eqButton.dataset.selectEquipment; render(); return; }
  const filterButton = e.target.closest('[data-filter]'); if (filterButton) { filter=filterButton.dataset.filter; render(); return; }
  const button = e.target.closest('[data-action]'); if (!button) return;
  if (button.dataset.action === 'close' && e.target !== button && !e.target.closest('.close')) return;
  const [action,id] = button.dataset.action.split(':');
  const restricted = { 'new-request':'request:create','new-work':'work:create','new-equipment':'equipment:manage','new-pm':'preventive:manage','new-report':'report:create','new-part':'parts:manage','new-document':'document:manage',triage:'request:triage',convert:'work:create',advance:'work:update','complete-pm':'preventive:manage',adjust:'parts:manage' };
  if (restricted[action] && !can(db.role,restricted[action])) return flash('This demo role cannot perform that action.');
  if (action === 'menu') { document.querySelector('#sidebar').classList.toggle('open'); return; }
  if (action === 'close') { dialog=''; render(); return; }
  if (action === 'reset') { if (confirm('Reset all browser demo records?')) { db=seed(); page='Overview'; query=''; filter='All'; commit(); flash('Demo records restored.'); } return; }
  if (action === 'advance') { const x=db.workOrders.find(w=>w.id===id); if(x) { x.status=x.status==='Planned'?'In progress':'Completed'; commit(); flash(`${x.id} is now ${x.status.toLowerCase()}.`); } return; }
  if (action === 'complete-pm') { completePreventive(db,id); commit(); flash('Preventive task recorded and next due date updated.'); return; }
  dialog = action === 'convert' ? `new-work:${id}` : button.dataset.action; render();
});
document.addEventListener('input', e => { if (e.target.id === 'global-search') { query=e.target.value.trim().toLowerCase(); const start=e.target.selectionStart; render(); const input=document.querySelector('#global-search'); input.focus(); input.setSelectionRange(start,start); } });
document.addEventListener('change', e => { if (e.target.id === 'role-select') { db.role=e.target.value; commit(); flash(`Previewing ${db.role} access.`); } });
document.addEventListener('submit', e => {
  if (e.target.id !== 'entry-form') return; e.preventDefault();
  const form=e.target; const type=form.dataset.form; const id=form.dataset.id; const v=Object.fromEntries(new FormData(form));
  try {
    if (type==='new-request') addRequest(db,v);
    if (type==='new-work') createWorkOrder(db,v);
    if (type==='triage') { const x=db.requests.find(x=>x.id===id); Object.assign(x,{severity:v.severity,priority:v.priority,status:v.status}); }
    if (type==='new-equipment') db.equipment.push({id:nextId(db.equipment,'EQ'),name:v.name.trim(),kind:v.kind,parentId:v.parentId||null,status:v.status,criticality:v.criticality,description:v.description.trim()});
    if (type==='new-pm') db.preventive.push({id:nextId(db.preventive,'PM'),title:v.title.trim(),equipmentId:v.equipmentId,intervalDays:Math.max(1,Number(v.intervalDays)),nextDue:v.nextDue,owner:v.owner.trim(),instructions:v.instructions.trim()});
    if (type==='new-report') db.reports.unshift({id:nextId(db.reports,'SR'),date:v.date,shift:v.shift,author:v.author.trim(),summary:v.summary.trim(),downtimeMinutes:Math.max(0,Number(v.downtimeMinutes)),linkedWorkOrderId:v.linkedWorkOrderId||null});
    if (type==='new-part') db.parts.push({id:nextId(db.parts,'SP'),name:v.name.trim(),sku:v.sku.trim(),quantity:Math.max(0,Number(v.quantity)),reorderPoint:Math.max(0,Number(v.reorderPoint)),unit:v.unit.trim()||'pcs',location:v.location.trim()});
    if (type==='adjust') { const part=db.parts.find(x=>x.id===id); const next=part.quantity+Number(v.delta); if(next<0) throw new Error('Stock cannot be negative.'); part.quantity=next; }
    if (type==='new-document') { if (v.url && !/^https?:\/\//i.test(v.url)) throw new Error('Use an http or https document URL.'); db.documents.push({id:nextId(db.documents,'DOC'),title:v.title.trim(),category:v.category,equipmentId:v.equipmentId,url:v.url.trim(),note:v.note.trim()}); }
    dialog=''; commit(); flash('Record saved in this browser.');
  } catch (err) { flash(err.message || 'Could not save record.'); }
});
render();
