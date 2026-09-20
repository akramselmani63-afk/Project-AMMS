export const STORAGE_KEY = 'amms-demo-v1';
export const roles = ['Requester', 'Technician', 'Planner', 'Supervisor', 'Admin'];
export const permissions = {
  Requester: ['request:create'],
  Technician: ['request:create', 'work:update', 'report:create'],
  Planner: ['request:create', 'request:triage', 'work:create', 'work:update', 'preventive:manage', 'parts:manage', 'document:manage', 'equipment:manage', 'report:create'],
  Supervisor: ['request:create', 'request:triage', 'work:create', 'work:update', 'preventive:manage', 'parts:manage', 'document:manage', 'equipment:manage', 'report:create'],
  Admin: ['request:create', 'request:triage', 'work:create', 'work:update', 'preventive:manage', 'parts:manage', 'document:manage', 'equipment:manage', 'report:create']
};
export const can = (role, action) => permissions[role]?.includes(action) ?? false;
const day = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export function seed() {
  return {
    role: 'Planner',
    equipment: [
      { id: 'EQ-001', name: 'Production', kind: 'Area', parentId: null, status: 'Operational', criticality: 'High', description: 'Sample production area' },
      { id: 'EQ-002', name: 'Packaging line 1', kind: 'Line', parentId: 'EQ-001', status: 'Operational', criticality: 'High', description: 'Sample packaging line' },
      { id: 'EQ-003', name: 'Bagging machine', kind: 'Machine', parentId: 'EQ-002', status: 'Attention', criticality: 'High', description: 'Sample bagging machine' },
      { id: 'EQ-004', name: 'Sewing station', kind: 'Machine', parentId: 'EQ-002', status: 'Operational', criticality: 'Medium', description: 'Sample sewing station' },
      { id: 'EQ-005', name: 'Packaging line 2', kind: 'Line', parentId: 'EQ-001', status: 'Operational', criticality: 'High', description: 'Sample packaging line' },
      { id: 'EQ-006', name: 'Bag conveyor', kind: 'Machine', parentId: 'EQ-005', status: 'Operational', criticality: 'Medium', description: 'Sample conveyor' },
      { id: 'EQ-007', name: 'Utilities', kind: 'Area', parentId: null, status: 'Operational', criticality: 'High', description: 'Sample shared utilities area' },
      { id: 'EQ-008', name: 'Compressed air system', kind: 'System', parentId: 'EQ-007', status: 'Operational', criticality: 'High', description: 'Sample utility system' }
    ],
    requests: [
      { id: 'IR-001', title: 'Intermittent bag feed stop', equipmentId: 'EQ-003', severity: 'S2', priority: 'P1', status: 'Approved', reportedBy: 'Shift operator', createdAt: day(-1), description: 'Bag feed pauses during the afternoon run.' },
      { id: 'IR-002', title: 'Air pressure fluctuation', equipmentId: 'EQ-008', severity: 'S3', priority: 'P2', status: 'New', reportedBy: 'Utilities operator', createdAt: day(0), description: 'Pressure varies under peak load.' },
      { id: 'IR-003', title: 'Conveyor guide adjustment', equipmentId: 'EQ-006', severity: 'S4', priority: 'P3', status: 'New', reportedBy: 'Line operator', createdAt: day(-2), description: 'Guide needs alignment.' }
    ],
    workOrders: [
      { id: 'WO-001', title: 'Inspect bag feed sensor', equipmentId: 'EQ-003', requestId: 'IR-001', type: 'Corrective', priority: 'P1', status: 'In progress', assignee: 'Maintenance team', dueDate: day(1), notes: 'Check sensor alignment and wiring.' },
      { id: 'WO-002', title: 'Inspect sewing head', equipmentId: 'EQ-004', requestId: null, type: 'Preventive', priority: 'P3', status: 'Planned', assignee: 'Maintenance team', dueDate: day(3), notes: 'Clean and check tension.' }
    ],
    preventive: [
      { id: 'PM-001', title: 'Lubricate bag conveyor bearings', equipmentId: 'EQ-006', intervalDays: 30, nextDue: day(4), owner: 'Maintenance team', instructions: 'Isolate, inspect, lubricate and record findings.' },
      { id: 'PM-002', title: 'Inspect compressed air filters', equipmentId: 'EQ-008', intervalDays: 14, nextDue: day(2), owner: 'Utilities team', instructions: 'Check differential pressure and replace if required.' }
    ],
    reports: [
      { id: 'SR-001', date: day(-1), shift: 'Day', author: 'Maintenance team', summary: 'Bag feed inspection started. No line 2 downtime recorded.', downtimeMinutes: 22, linkedWorkOrderId: 'WO-001' }
    ],
    parts: [
      { id: 'SP-001', name: 'Photoelectric sensor', sku: 'SENSOR-PE-01', quantity: 3, reorderPoint: 2, unit: 'pcs', location: 'Workshop A' },
      { id: 'SP-002', name: 'Conveyor bearing', sku: 'BRG-6204', quantity: 1, reorderPoint: 3, unit: 'pcs', location: 'Workshop A' },
      { id: 'SP-003', name: 'Air filter element', sku: 'FILTER-AIR-01', quantity: 6, reorderPoint: 4, unit: 'pcs', location: 'Utilities store' }
    ],
    documents: [
      { id: 'DOC-001', title: 'Bagging machine inspection checklist', category: 'Checklist', equipmentId: 'EQ-003', url: '', note: 'Sample record. Add a verified link when available.' },
      { id: 'DOC-002', title: 'Compressed air service procedure', category: 'Procedure', equipmentId: 'EQ-008', url: '', note: 'Sample record. Add a verified link when available.' }
    ]
  };
}

export function load(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const data = JSON.parse(raw);
    const base = seed();
    for (const key of ['equipment', 'requests', 'workOrders', 'preventive', 'reports', 'parts', 'documents']) if (!Array.isArray(data[key])) data[key] = base[key];
    if (!roles.includes(data.role)) data.role = base.role;
    return data;
  } catch { return seed(); }
}
export function save(data, storage = globalThis.localStorage) { storage.setItem(STORAGE_KEY, JSON.stringify(data)); }
export function nextId(items, prefix) { return `${prefix}-${String(Math.max(0, ...items.map(x => Number(x.id.split('-').at(-1)) || 0)) + 1).padStart(3, '0')}`; }
export function equipmentPath(items, id) {
  const path = []; const seen = new Set(); let current = items.find(x => x.id === id);
  while (current && !seen.has(current.id)) { path.unshift(current.name); seen.add(current.id); current = items.find(x => x.id === current.parentId); }
  return path.join(' / ') || 'Unassigned';
}
export function addRequest(data, value) {
  if (!value.title?.trim() || !data.equipment.some(x => x.id === value.equipmentId)) throw new Error('A title and valid equipment are required.');
  const item = { id: nextId(data.requests, 'IR'), title: value.title.trim(), equipmentId: value.equipmentId, severity: value.severity || 'S3', priority: value.priority || 'P3', status: 'New', reportedBy: value.reportedBy?.trim() || 'Demo user', createdAt: day(), description: value.description?.trim() || '' };
  data.requests.unshift(item); return item;
}
export function createWorkOrder(data, value) {
  if (!value.title?.trim() || !data.equipment.some(x => x.id === value.equipmentId)) throw new Error('A title and valid equipment are required.');
  const item = { id: nextId(data.workOrders, 'WO'), title: value.title.trim(), equipmentId: value.equipmentId, requestId: value.requestId || null, type: value.type || 'Corrective', priority: value.priority || 'P3', status: 'Planned', assignee: value.assignee?.trim() || 'Unassigned', dueDate: value.dueDate || day(1), notes: value.notes?.trim() || '' };
  data.workOrders.unshift(item);
  const request = data.requests.find(x => x.id === item.requestId); if (request) request.status = 'Approved';
  return item;
}
export function completePreventive(data, id) {
  const plan = data.preventive.find(x => x.id === id); if (!plan) throw new Error('Plan not found.');
  const completedOn = day(); const d = new Date(`${completedOn}T12:00:00`); d.setDate(d.getDate() + Number(plan.intervalDays));
  plan.nextDue = d.toISOString().slice(0, 10);
  data.reports.unshift({ id: nextId(data.reports, 'SR'), date: completedOn, shift: 'Day', author: 'Demo user', summary: `Completed preventive task: ${plan.title}.`, downtimeMinutes: 0, linkedWorkOrderId: null });
  return plan;
}
