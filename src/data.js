import { sourceEquipment } from './source-assets.js';

export const STORAGE_KEY = 'amms-demo-v1';
export const roles = ['Employee', 'Maintenance Engineer', 'Maintenance Responsible', 'HSE', 'Service Achats', 'Developer Admin'];
const day = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export function seed() {
  return {
    schemaVersion: 2,
    role: 'Planner',
    language: 'fr',
    equipment: sourceEquipment.map(x => ({ ...x })),
    requests: [
      { id: 'IR-001', title: 'Intermittent bag feed stop', equipmentId: 'EQ-139', severity: 'S3', priority: 'P1', status: 'Approved', reportedBy: 'Demo operator', createdAt: day(-1), description: 'Illustrative incident; not taken from the workbook.' },
      { id: 'IR-002', title: 'Compressor pressure fluctuation', equipmentId: 'EQ-151', severity: 'S2', priority: 'P2', status: 'New', reportedBy: 'Demo operator', createdAt: day(0), description: 'Illustrative incident; not taken from the workbook.' },
      { id: 'IR-003', title: 'Conveyor guide adjustment', equipmentId: 'EQ-141', severity: 'S1', priority: 'P3', status: 'New', reportedBy: 'Demo operator', createdAt: day(-2), description: 'Illustrative incident; not taken from the workbook.' }
    ],
    workOrders: [
      { id: 'WO-001', title: 'Inspect bag transfer', equipmentId: 'EQ-139', requestId: 'IR-001', type: 'Corrective', priority: 'P1', status: 'In progress', assignee: 'Demo maintenance team', dueDate: day(1), notes: 'Illustrative work instructions.' },
      { id: 'WO-002', title: 'Inspect sewing head', equipmentId: 'EQ-131', requestId: null, type: 'Preventive', priority: 'P3', status: 'Planned', assignee: 'Demo maintenance team', dueDate: day(3), notes: 'Illustrative work instructions.' }
    ],
    preventive: [
      { id: 'PM-001', title: 'Inspect conveyor bearings', equipmentId: 'EQ-141', intervalDays: 30, nextDue: day(4), owner: 'Demo maintenance team', instructions: 'Illustrative schedule; verify maintenance intervals with AGRIDIAM.' },
      { id: 'PM-002', title: 'Inspect compressor filters', equipmentId: 'EQ-151', intervalDays: 14, nextDue: day(2), owner: 'Demo utilities team', instructions: 'Illustrative schedule; verify maintenance intervals with AGRIDIAM.' }
    ],
    reports: [
      { id: 'SR-001', date: day(-1), shift: 'Day', author: 'Demo maintenance team', summary: 'Illustrative shift report; not an imported AGRIDIAM incident.', downtimeMinutes: 22, linkedWorkOrderId: 'WO-001' }
    ],
    parts: [
      { id: 'SP-001', name: 'Photoelectric sensor', sku: 'SENSOR-PE-01', quantity: 3, reorderPoint: 2, unit: 'pcs', location: 'Workshop A' },
      { id: 'SP-002', name: 'Conveyor bearing', sku: 'BRG-6204', quantity: 1, reorderPoint: 3, unit: 'pcs', location: 'Workshop A' },
      { id: 'SP-003', name: 'Air filter element', sku: 'FILTER-AIR-01', quantity: 6, reorderPoint: 4, unit: 'pcs', location: 'Utilities store' }
    ],
    documents: [
      { id: 'DOC-001', title: 'Bagging inspection checklist', category: 'Checklist', equipmentId: 'EQ-139', url: '', note: 'Sample record. Add a verified link when available.' },
      { id: 'DOC-002', title: 'Compressor service procedure', category: 'Procedure', equipmentId: 'EQ-151', url: '', note: 'Sample record. Add a verified link when available.' }
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
    if (!data.schemaVersion || data.schemaVersion < 2) {
      const originalTitles = {
        requests: { 'IR-001': 'Intermittent bag feed stop', 'IR-002': 'Air pressure fluctuation', 'IR-003': 'Conveyor guide adjustment' },
        workOrders: { 'WO-001': 'Inspect bag feed sensor', 'WO-002': 'Inspect sewing head' },
        preventive: { 'PM-001': 'Lubricate bag conveyor bearings', 'PM-002': 'Inspect compressed air filters' },
        documents: { 'DOC-001': 'Bagging machine inspection checklist', 'DOC-002': 'Compressed air service procedure' }
      };
      for (const [section, names] of Object.entries(originalTitles)) {
        for (const item of data[section]) {
          if (item.title === names[item.id]) Object.assign(item, base[section].find(x => x.id === item.id));
        }
      }
      const sampleReport = data.reports.find(x => x.id === 'SR-001');
      if (sampleReport?.summary === 'Bag feed inspection started. No line 2 downtime recorded.') Object.assign(sampleReport, base.reports[0]);
      data.schemaVersion = 2;
    }
    const existing = new Set(data.equipment.map(x => x.id));
    data.equipment = [...sourceEquipment.filter(x => !existing.has(x.id)).map(x => ({...x})), ...data.equipment];
    for (const item of data.equipment) if (!item.source) item.source = 'Demo record';
    if (!roles.includes(data.role)) data.role = ({Requester:'Employee',Technician:'Maintenance Engineer',Planner:'Maintenance Engineer',Supervisor:'Maintenance Responsible',Admin:'Developer Admin'})[data.role] || 'Maintenance Engineer';
    if (!['en', 'fr'].includes(data.language)) data.language = 'fr';
    return data;
  } catch { throw new Error('Saved data could not be read. It has not been overwritten.'); }
}
export function save(data, storage = globalThis.localStorage) { storage.setItem(STORAGE_KEY, JSON.stringify(data)); }
export function nextId(items, prefix) { return `${prefix}-${String(Math.max(0, ...items.map(x => Number(x.id.split('-').at(-1)) || 0)) + 1).padStart(3, '0')}`; }
export function equipmentPath(items, id) {
  const path = []; const seen = new Set(); let current = items.find(x => x.id === id);
  while (current && !seen.has(current.id)) { path.unshift(current.name); seen.add(current.id); current = items.find(x => x.id === current.parentId); }
  return path.join(' / ') || 'Unassigned';
}
