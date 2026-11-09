import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=new URL('../extension/',import.meta.url);
test('Chrome icon mappings point to correctly sized transparent PNG assets',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',base)));
 for(const n of [16,32,48,128]){const file=manifest.icons[n];assert.equal(file,`icons/gulir-${n}.png`);const data=fs.readFileSync(new URL(file,base));assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(data.readUInt32BE(16),n);assert.equal(data.readUInt32BE(20),n);assert.equal(data[25],6);}
 for(const n of [16,32])assert.equal(manifest.action.default_icon[n],manifest.icons[n]);
});
test('Preview branding is local, accessible, and separate from captured images',()=>{const html=fs.readFileSync(new URL('preview.html',base),'utf8');assert.match(html,/class="brand-icon"[^>]*alt=""/);assert.match(html,/href="icons\/gulir-32.png"/);assert.ok(html.indexOf('class="brand-icon"')<html.indexOf('id="images"'));});
