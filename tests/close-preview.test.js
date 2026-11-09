import test from 'node:test';import assert from 'node:assert/strict';import {closePreviewOnly} from '../extension/close-preview.js';
const url='chrome-extension://abc/preview.html?id=capture';
function fixture(current={id:4,url},others=[{id:9}]){const removed=[];return {removed,tabs:{getCurrent:async()=>current,query:async()=>[current,...others],remove:async id=>removed.push(id)}};}
test('only exact preview tab is removed, never another tab/window',async()=>{const f=fixture();assert.equal(await closePreviewOnly(f.tabs,url,'chrome-extension://abc/preview.html'),true);assert.deepEqual(f.removed,[4]);});
test('last remaining Chrome tab is kept open',async()=>{const f=fixture({id:4,url},[]);assert.equal(await closePreviewOnly(f.tabs,url,'chrome-extension://abc/preview.html'),false);assert.deepEqual(f.removed,[]);});
test('wrong tab identity, non-preview URL and missing context fail closed',async()=>{for(const current of [{id:4,url:'https://example.org'},{id:-1,url},{url},{id:4,url:'chrome-extension://abc/settings.html'}]){const f=fixture(current);assert.equal(await closePreviewOnly(f.tabs,url,'chrome-extension://abc/preview.html'),false);assert.deepEqual(f.removed,[]);}assert.equal(await closePreviewOnly({},url,url),false);});

test('Chrome current-tab URL may be omitted without tabs permission',async()=>{const f=fixture({id:4});assert.equal(await closePreviewOnly(f.tabs,url,'chrome-extension://abc/preview.html'),true);assert.deepEqual(f.removed,[4]);});
