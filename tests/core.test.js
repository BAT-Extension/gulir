import test from 'node:test';
import assert from 'node:assert/strict';
import {safeName,folderPath,captureDimensions,allowedUrl,autoName,downloadPathMatches} from '../extension/core.js';
test('portable filenames and reserved device names',()=>{assert.equal(safeName('../CON.png'),'.._CON');assert.equal(safeName('CON.png'),'_CON');assert.equal(safeName('a/b:c?.png'),'a_b_c_');assert.equal(safeName('..'),'screenshot');assert.equal(safeName('ok.png'),'ok');});
test('folder traversal and absolute paths rejected',()=>{for(const s of ['../x','/tmp','C:/x','a\\b','a//b','a/./b','CON','a/..','a/ bad'])assert.throws(()=>folderPath(s));assert.equal(folderPath('Screenshots/Proyek'),'Screenshots/Proyek');assert.equal(folderPath(''),'');});
test('restricted schemes and stores',()=>{for(const s of ['chrome://settings','file:///tmp/x','https://chromewebstore.google.com/detail/x','https://chrome.google.com/webstore/x','invalid'])assert.equal(allowedUrl(s),false);assert.equal(allowedUrl('https://example.org'),true);});
test('single image dimensions enforce resource budget',()=>{assert.deepEqual(captureDimensions(1920,50000),{width:1920,height:50000});for(const dims of [[20000,100],[100,120001],[16000,10000],[NaN,50],[0,50]])assert.throws(()=>captureDimensions(...dims));});
test('short local-time filename is sortable and excludes page title',()=>{assert.equal(autoName('Private title',new Date(2026,10,9,14,30,25)),'20261109-143025');assert.ok(autoName('',new Date(2026,10,9,14,30,26))>autoName('',new Date(2026,10,9,14,30,25)));});

test('download result verifies exact relative folder and permits Chrome duplicate suffix only',()=>{
 assert.equal(downloadPathMatches('/tmp/Downloads/Screenshots/Project/shot.png','Screenshots/Project/shot.png'),true);
 assert.equal(downloadPathMatches('C:\\Users\\demo\\Downloads\\Screenshots\\shot (2).png','Screenshots/shot.png'),true);
 for(const a of ['/tmp/Downloads/uuid.png','/tmp/Downloads/shot.png','/tmp/Downloads/Other/shot.png','/tmp/Downloads/Screenshots/shot-renamed.png'])assert.equal(downloadPathMatches(a,'Screenshots/shot.png'),false);
 assert.equal(downloadPathMatches('/tmp/Downloads/Screenshots/shot (0).png','Screenshots/shot.png'),false);
});
