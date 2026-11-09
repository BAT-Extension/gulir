const open = () => new Promise((resolve, reject) => {
  const r = indexedDB.open('page-shot', 2);
  r.onupgradeneeded = () => {
    if(!r.result.objectStoreNames.contains('captures'))r.result.createObjectStore('captures', {keyPath:'id'});
    if(!r.result.objectStoreNames.contains('preferences'))r.result.createObjectStore('preferences');
  };
  r.onsuccess = () => {
    const db=r.result;
    db.onversionchange=()=>db.close();
    resolve(db);
  };
  r.onerror = () => reject(r.error);
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
// A separate store retains preferences/structured-cloned directory handles when captures expire.
export async function preferenceOp(method, key, value) {
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('preferences',method==='get'?'readonly':'readwrite');
    const store=tx.objectStore('preferences');
    const r=method==='get'?store.get(key):store.put(value,key);
    tx.oncomplete=()=>{db.close();resolve(r.result);};
    tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||Error('Preferensi penyimpanan gagal disimpan'));};
  });
}
export async function prune() {
  const db = await open();
  try{
    await new Promise((resolve,reject) => {
      const tx = db.transaction('captures','readwrite');
      const r = tx.objectStore('captures').openCursor();
      r.onsuccess = () => {const c=r.result;if(c){if(Date.now()-c.value.created>86400000)c.delete();c.continue();}};
      tx.oncomplete=resolve; tx.onerror=tx.onabort=()=>reject(tx.error);
    });
  }finally{db.close();}
}
