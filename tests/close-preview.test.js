import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {closePreviewOnly} from '../extension/close-preview.js';
test('safety stop never reads or invokes any browser tab API',async()=>{
 const tabs=new Proxy({}, {get(){throw Error('Browser API must never be touched');}});
 assert.equal(await closePreviewOnly(tabs,'chrome-extension://abc/preview.html','chrome-extension://abc/preview.html'),false);
 assert.equal(await closePreviewOnly(),false);
});
test('shipped extension has no tab/window close or removal call',async()=>{
 for(const file of await readdir(new URL('../extension/',import.meta.url))){
  if(!/\.(js|html)$/.test(file))continue;
  const source=await readFile(new URL('../extension/'+file,import.meta.url),'utf8');
  assert.doesNotMatch(source,/\b(?:tabs|windows)\s*\.\s*remove\s*\(|\b(?:window|self|globalThis|top|parent)\s*\.\s*close\s*\(/,file);
 }
});

test('preview visibly identifies hotfix version',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../extension/manifest.json',import.meta.url),'utf8'));
 const html=await readFile(new URL('../extension/preview.html',import.meta.url),'utf8');
 assert.ok(html.includes('GULIR '+manifest.version));
});
