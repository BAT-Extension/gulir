import test from 'node:test';
import assert from 'node:assert/strict';
import {createSavePreferences,saveInDirectory} from '../extension/save-preferences.js';
const missing=()=>new DOMException('missing','NotFoundError');
const locks={request:async(name,work)=>{assert.equal(name,'gulir-save-directory');return work();}};
function fixture(){
 const values=new Map(),writes=[],files=new Map();
 let picks=0,requests=0,state='granted';
 const directory={kind:'directory',name:'Screenshots',
  queryPermission:async()=>state,requestPermission:async()=>{requests++;return state;},
  getFileHandle:async(name,options)=>{
   if(!options?.create&&!files.has(name))throw missing();
   if(!files.has(name))files.set(name,{name,createWritable:async()=>({write:async blob=>writes.push([name,blob]),close:async()=>{},abort:async()=>{}})});
   return files.get(name);
  }};
 const storage=async(method,key,value)=>method==='get'?values.get(key):values.set(key,value);
 const api=createSavePreferences({storage,locks,directoryPicker:async()=>{picks++;return directory;},filePicker:async()=>({name:'normal.png',createWritable:async()=>({write:async()=>{},close:async()=>{}})})});
 return {api,values,files,writes,directory,get picks(){return picks;},get requests(){return requests;},set state(s){state=s;}};
}
test('preference defaults off, toggle persists separately from remembered directory',async()=>{
 const f=fixture();
 assert.deepEqual(await f.api.loadSavePreferences(),{enabled:false,directoryHandle:null});
 await f.api.setRememberFolder(true);
 assert.equal((await f.api.loadSavePreferences()).enabled,true);
 const prefs=await f.api.loadSavePreferences();
 await f.api.saveWithPreferences(new Blob(),'shot.png',prefs);
 await f.api.setRememberFolder(false);
 const restored=await f.api.loadSavePreferences();
 assert.equal(restored.enabled,false);assert.equal(restored.directoryHandle,f.directory);
 await f.api.saveWithPreferences(new Blob(),'shot.png',restored);
 assert.equal(f.picks,1);assert.equal(f.writes.length,1);
});
test('first quick save selects folder; later saves reuse it and suffix collisions',async()=>{
 const f=fixture();await f.api.setRememberFolder(true);
 const prefs=await f.api.loadSavePreferences(),blob=new Blob(['image']);
 assert.equal((await f.api.saveWithPreferences(blob,'shot.png',prefs)).name,'shot.png');
 assert.equal((await f.api.saveWithPreferences(blob,'shot.png',await f.api.loadSavePreferences())).name,'shot (1).png');
 assert.equal(f.picks,1);assert.equal(f.requests,0);assert.equal(f.writes[0][1],blob);
});
test('permission prompts are requested only during save and denial reopens chooser',async()=>{
 const f=fixture();f.values.set('remember-save-folder',true);f.values.set('save-directory-handle',f.directory);f.state='prompt';
 const prefs=await f.api.loadSavePreferences();assert.equal(f.requests,0);
 await f.api.saveWithPreferences(new Blob(),'shot.png',prefs);
 assert.equal(f.requests,1);assert.equal(f.picks,1);
 f.state='denied';await f.api.saveWithPreferences(new Blob(),'next.png',prefs);
 assert.equal(f.requests,1);assert.equal(f.picks,2);
});
test('picker cancel does not write or replace remembered handle',async()=>{
 const old={kind:'directory',queryPermission:async()=>'denied'};
 const prefs={enabled:true,directoryHandle:old};let writes=0;
 const api=createSavePreferences({locks,storage:async()=>{writes++;},directoryPicker:async()=>{throw new DOMException('cancelled','AbortError');}});
 await assert.rejects(api.saveWithPreferences(new Blob(),'shot.png',prefs),{name:'AbortError'});
 assert.equal(writes,0);assert.equal(prefs.directoryHandle,old);
});
test('I/O and write failure propagate; failed writer is aborted',async()=>{
 const denied={getFileHandle:async()=>{throw new DOMException('denied','NotAllowedError');}};
 await assert.rejects(saveInDirectory(new Blob(),'shot.png',denied,locks),{name:'NotAllowedError'});
 let aborts=0;
 const directory={getFileHandle:async(name,options)=>{
  if(!options?.create)throw missing();
  return {name,createWritable:async()=>({write:async()=>{throw Error('disk full');},abort:async()=>{aborts++;}})};
 }};
 await assert.rejects(saveInDirectory(new Blob(),'shot.png',directory,locks),/disk full/);assert.equal(aborts,1);
});
test('directory name collision skips occupied entry; missing locks never writes',async()=>{
 let created;
 const dir={getFileHandle:async(name,options)=>{
  if(name==='shot.png')throw new DOMException('directory','TypeMismatchError');
  if(!options?.create)throw missing();
  created=name;return {name,createWritable:async()=>({write:async()=>{},close:async()=>{}})};
 }};
 await saveInDirectory(new Blob(),'shot.png',dir,locks);assert.equal(created,'shot (1).png');
 await assert.rejects(saveInDirectory(new Blob(),'shot.png',dir,null),/penguncian/);
});
test('shared lock serializes simultaneous previews through committed writes',async()=>{
 const f=fixture();let tail=Promise.resolve();
 const shared={request:(name,work)=>{const result=tail.then(work);tail=result.catch(()=>{});return result;}};
 const results=await Promise.all([saveInDirectory(new Blob(),'same.png',f.directory,shared),saveInDirectory(new Blob(),'same.png',f.directory,shared)]);
 assert.deepEqual(results.map(r=>r.name),['same.png','same (1).png']);
});

test('expired prompt permission granted on save reuses remembered folder',async()=>{
 const f=fixture();const prefs={enabled:true,directoryHandle:f.directory};let requested=0;
 f.directory.queryPermission=async()=>'prompt';f.directory.requestPermission=async()=>{requested++;return 'granted';};
 await f.api.saveWithPreferences(new Blob(['image']),'shot.png',prefs);
 assert.equal(requested,1);assert.equal(f.picks,0);assert.equal(f.writes.length,1);
});
