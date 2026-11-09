import test from 'node:test';
import assert from 'node:assert/strict';
import {saveDirect} from '../extension/save-direct.js';
test('direct save uses user-selected handle, suggested PNG name and exact blob',async()=>{
 const blob=new Blob(['png fixture'],{type:'image/png'}),calls=[];
 const result=await saveDirect(blob,'review.png',options=>{
  assert.equal(options.suggestedName,'review.png');assert.equal(options.id,'gulir-screenshots');assert.equal(options.startIn,'downloads');
  return {name:'user-renamed.png',createWritable:async()=>({write:async value=>{assert.equal(value,blob);calls.push('write')},close:async()=>calls.push('close')})};
 });
 assert.deepEqual(calls,['write','close']);assert.equal(result.name,'user-renamed.png');
});
test('direct save cancellation does not write or retry',async()=>{
 let attempts=0;
 await assert.rejects(saveDirect(new Blob(),'review.png',()=>{attempts++;throw new DOMException('cancelled','AbortError')}),{name:'AbortError'});
 assert.equal(attempts,1);
});
test('direct save aborts failed writer and never reports success',async()=>{
 let aborted=false,closed=false;
 await assert.rejects(saveDirect(new Blob(),'review.png',()=>({createWritable:async()=>({write:async()=>{throw Error('disk full')},close:async()=>{closed=true},abort:async()=>{aborted=true}})})),/disk full/);
 assert.equal(aborted,true);assert.equal(closed,false);
});
