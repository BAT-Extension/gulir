const open = () => new Promise((resolve, reject) => {
  const r = indexedDB.open('page-shot', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('captures', {keyPath:'id'});
  r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
});
export async function dbOp(method, value) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('captures', method === 'get' ? 'readonly' : 'readwrite');
    const r = tx.objectStore('captures')[method](value);
    tx.oncomplete = () => { db.close(); resolve(r.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || Error('Penyimpanan lokal gagal')); };
  });
}
export async function prune() {
  const db = await open();
  await new Promise((resolve,reject) => {
    const tx = db.transaction('captures','readwrite');
    const r = tx.objectStore('captures').openCursor();
    r.onsuccess = () => {const c=r.result;if(c){if(Date.now()-c.value.created>86400000)c.delete();c.continue();}};
    tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
  }); db.close();
}
