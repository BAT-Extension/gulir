import test from 'node:test';
import assert from 'node:assert/strict';
import {safeName,folderPath,captureDimensions,allowedUrl,autoName} from '../extension/core.js';
test('portable filenames and reserved device names',()=>{assert.equal(safeName('../CON.png'),'.._CON');assert.equal(safeName('CON.png'),'_CON');assert.equal(safeName('a/b:c?.png'),'a_b_c_');assert.equal(safeName('..'),'screenshot');assert.equal(safeName('ok.png'),'ok');});
test('folder traversal and absolute paths rejected',()=>{for(const s of ['../x','/tmp','C:/x','a\\b','a//b','a/./b','CON','a/..','a/ bad'])assert.throws(()=>folderPath(s));assert.equal(folderPath('Screenshots/Proyek'),'Screenshots/Proyek');assert.equal(folderPath(''),'');});
test('restricted schemes and stores',()=>{for(const s of ['chrome://settings','file:///tmp/x','https://chromewebstore.google.com/detail/x','https://chrome.google.com/webstore/x','invalid'])assert.equal(allowedUrl(s),false);assert.equal(allowedUrl('https://example.org'),true);});
test('single image dimensions enforce resource budget',()=>{assert.deepEqual(captureDimensions(1920,50000),{width:1920,height:50000});for(const dims of [[20000,100],[100,120001],[16000,10000],[NaN,50],[0,50]])assert.throws(()=>captureDimensions(...dims));});
test('generated filename contains timestamp',()=>assert.equal(autoName('Page',new Date('2026-11-08T01:02:03Z')),'Page_2026-11-08T01-02-03-000Z'));
