import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createPreviewCloser} from '../extension/close-preview.js';
const url='chrome-extension://abc/preview.html?id=capture';
function fixture() {
 const sender={id:'abc',frameId:0,documentId:'document-10',url,tab:{id:10,windowId:1}};
 const context={documentId:sender.documentId,tabId:10,frameId:0,documentUrl:url};
 const state={contexts:[context],windows:[{id:1,type:'popup',tabs:[{id:10}]},{id:2,type:'normal',tabs:[{id:20},{id:21}]}],removed:[],created:[],tab:{id:10,windowId:1},contextReads:0};
 const api={runtime:{id:'abc',getURL:()=>url.split('?')[0],getContexts:async()=>{state.contextReads++;return state.contexts;}},tabs:{get:async()=>state.tab,remove:async id=>{state.removed.push(id);for(const window of state.windows)window.tabs=window.tabs.filter(tab=>tab.id!==id);state.contexts=state.contexts.filter(context=>context.tabId!==id);}},windows:{getAll:async()=>state.windows,create:async options=>{state.created.push(options);const window={id:3,type:'normal',tabs:[{id:30}]};state.windows.push(window);return window;},get:async id=>state.windows.find(window=>window.id===id)}};
 return {sender,state,api,close:createPreviewCloser(api)};
}
test('only Chrome-authenticated preview tab is removed; source window tabs survive',async()=>{
 const f=fixture();assert.equal(await f.close(f.sender),true);assert.deepEqual(f.state.removed,[10]);assert.deepEqual(f.state.created,[]);assert.deepEqual(f.state.windows[1].tabs,[{id:20},{id:21}]);
});
for(const [name,change] of [
 ['other extension',s=>s.id='other'],['content page',s=>s.url='https://example.org/preview.html'],
 ['different extension page',s=>s.url='chrome-extension://abc/other.html'],['subframe',s=>s.frameId=1],
 ['missing document identity',s=>delete s.documentId],['invalid tab ID',s=>s.tab.id=-1]
])test('rejects '+name,async()=>{const f=fixture();change(f.sender);assert.equal(await f.close(f.sender),false);assert.deepEqual(f.state.removed,[]);assert.deepEqual(f.state.created,[]);});
test('live document mismatch refuses removal',async()=>{const f=fixture();f.state.contexts[0].documentId='navigated';assert.equal(await f.close(f.sender),false);assert.deepEqual(f.state.removed,[]);});
test('pending navigation or changed window refuses removal',async()=>{
 for(const fields of [{pendingUrl:'https://example.org'},{url:'https://example.org'},{windowId:99}]){const f=fixture();Object.assign(f.state.tab,fields);assert.equal(await f.close(f.sender),false);assert.deepEqual(f.state.removed,[]);}
});
test('last preview creates and verifies normal New Tab before closing',async()=>{
 const f=fixture();f.state.windows.length=1;assert.equal(await f.close(f.sender),true);assert.deepEqual(f.state.created,[{type:'normal',url:'chrome://newtab/',focused:false}]);assert.deepEqual(f.state.removed,[10]);assert.deepEqual(f.state.windows[1].tabs,[{id:30}]);
});
test('other popup or another preview is not a safe normal survivor',async()=>{
 for(const other of [{id:2,type:'popup',tabs:[{id:20}]},{id:2,type:'normal',tabs:[{id:20}]}]){const f=fixture();f.state.windows[1]=other;f.state.contexts.push({documentId:'document-20',tabId:20,frameId:0,documentUrl:url});assert.equal(await f.close(f.sender),true);assert.equal(f.state.created.length,1);}
});
test('failed or unverified replacement leaves preview intact',async()=>{
 for(const create of [async()=>{throw Error('window creation failed');},async()=>({}),async()=>({id:99})]){const f=fixture();f.state.windows.length=1;f.api.windows.create=create;await f.close(f.sender).catch(()=>false);assert.deepEqual(f.state.removed,[]);}
});
test('navigation during safety checks cancels removal',async()=>{const f=fixture();f.api.windows.getAll=async()=>{f.state.contexts=[];return f.state.windows;};assert.equal(await f.close(f.sender),false);assert.deepEqual(f.state.removed,[]);});
test('overlapping requests are serialized and duplicate request is inert',async()=>{
 const f=fixture();f.state.windows.length=1;assert.deepEqual(await Promise.all([f.close(f.sender),f.close(f.sender)]),[true,false]);assert.deepEqual(f.state.removed,[10]);assert.equal(f.state.created.length,1);
});
test('queue recovers after one request fails without affecting another tab',async()=>{
 const f=fixture();const read=f.api.tabs.get;f.api.tabs.get=async()=>{throw Error('read failure');};await assert.rejects(f.close(f.sender));f.api.tabs.get=read;assert.equal(await f.close(f.sender),true);assert.deepEqual(f.state.removed,[10]);
});
test('shipped runtime has one tab removal site and no window or browser close',async()=>{
 let removalSites=0;
 for(const file of await readdir(new URL('../extension/',import.meta.url))){
  if(!/\.(js|html)$/.test(file))continue;
  const source=await readFile(new URL('../extension/'+file,import.meta.url),'utf8');
  assert.doesNotMatch(source,/\bwindows\s*\.\s*remove\s*\(|\b(?:window|self|globalThis|top|parent)\s*\.\s*close\s*\(/,file);
  const sites=source.match(/\btabs\s*\.\s*remove\s*\(/g)||[];
  if(sites.length)assert.equal(file,'close-preview.js');removalSites+=sites.length;
 }
 assert.equal(removalSites,1);
});
test('preview visibly identifies shipped version',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../extension/manifest.json',import.meta.url),'utf8'));
 const html=await readFile(new URL('../extension/preview.html',import.meta.url),'utf8');
 assert.ok(html.includes('GULIR '+manifest.version));
});
