import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as core from '../extension/core.js';
const source=(await fs.readFile(new URL('../extension/background.js',import.meta.url),'utf8'))
 .replace("import {allowedUrl,autoName} from './core.js';",'const {allowedUrl,autoName}=globalThis.testCore;')
 .replace("import {captureSinglePng} from './capture.js';",'const {captureSinglePng}=globalThis.testCapture;')
 .replace("import {dbOp,prune} from './db.js';",'const {dbOp,prune}=globalThis.testDb;');
globalThis.testCore=core;
let calls,records,mode;
globalThis.testCapture={captureSinglePng:async()=>{calls.push('capture');if(mode==='capture-fail')throw Error('capture failed');return {width:1280,height:35000,blob:new Blob(['single PNG'],{type:'image/png'})};}};
globalThis.testDb={prune:async()=>{},dbOp:async(m,r)=>records.push(r)};
globalThis.chrome={
 tabs:{getZoom:async()=>1},
 action:{setBadgeText:async()=>{},onClicked:{addListener(){}}},
 runtime:{getURL:s=>'chrome-extension://test/'+s,onStartup:{addListener(){}}},
 windows:{create:async()=>calls.push('preview')},
 debugger:{attach:async()=>{calls.push('attach');if(mode==='denied')throw Error('Access denied');},detach:async()=>calls.push('detach'),sendCommand:async()=>{}}
};
const {capture}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const tab={id:1,url:'https://example.org',title:'Example',status:'complete'};
for(const scenario of ['success','denied','capture-fail','restricted','loading']){
 test('capture wrapper '+scenario,async()=>{
  mode=scenario;calls=[];records=[];
  await capture(scenario==='restricted'?{...tab,url:'chrome://settings'}:scenario==='loading'?{...tab,status:'loading'}:tab);
  assert.equal(records.length,1);assert.equal(calls.filter(x=>x==='preview').length,1);
  if(scenario==='success'){assert.equal(records[0].parts.length,1);assert.equal(records[0].height,35000);}
  else{assert.equal(records[0].parts.length,0);assert.match(records[0].error,/Screenshot gagal/);}
  assert.equal(calls.filter(x=>x==='detach').length,['denied','restricted','loading'].includes(scenario)?0:1);
 });
}
