import { load } from './workflow.js';

// One IndexedDB transaction persists records and their photos together.
// The previous localStorage record is retained as a migration backup.
const open = () => new Promise((resolve,reject)=>{
  const request=indexedDB.open('amms-workspace',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('workspace');
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
});
export async function readWorkspace() {
  const db=await open();
  try {
    const value=await new Promise((resolve,reject)=>{
      const request=db.transaction('workspace').objectStore('workspace').get('current');
      request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error);
    });
    if(value) return value;
    const migrated=load(); await writeWorkspace(migrated); return migrated;
  } finally { db.close(); }
}
export async function writeWorkspace(value) {
  const db=await open();
  try { await new Promise((resolve,reject)=>{
    const tx=db.transaction('workspace','readwrite');
    const store=tx.objectStore('workspace');
    const request=store.get('current');
    request.onsuccess=()=>{
      if(request.result && (request.result.revision || 0)!==(value.revision || 0)) {
        reject(new Error('Another tab saved changes. Reload before continuing. / Un autre onglet a enregistré des modifications. Rechargez la page.'));
        tx.abort(); return;
      }
      value.revision=(value.revision || 0)+1;
      store.put(value,'current');
    };
    tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error || new Error('Save aborted.'));
  }); } finally { db.close(); }
}
