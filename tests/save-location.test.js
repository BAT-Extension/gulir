import test from 'node:test';
import assert from 'node:assert/strict';
import {describeSaveLocation} from '../extension/save-location.js';
test('normal mode never treats a remembered handle as the current destination',()=>{
 const view=describeSaveLocation({preferences:{enabled:false,directoryHandle:{name:'Old folder'},lastSavedLocation:{directoryName:'Pictures',fileName:'previous.png'}},fileName:'new.png'});
 assert.equal(view.path,'Pilih folder saat Simpan PNG');assert.equal(view.lastSaved,'Terakhir disimpan: Pictures / previous.png');assert.match(view.detail,/bukan path lengkap/);
});
test('first quick save clearly has no selected folder',()=>{const view=describeSaveLocation({preferences:{enabled:true},fileName:'shot.png'});assert.equal(view.path,'Belum ada folder tersimpan');assert.equal(view.lastSaved,'');});
for(const [permission,expected] of [['granted','Izin folder tersedia'],['prompt','Konfirmasi izin diperlukan'],['denied','pilih folder lagi'],['unknown','akan diperiksa']])test('stored destination labels permission '+permission,()=>{
 const view=describeSaveLocation({preferences:{enabled:true,directoryHandle:{name:'Screenshots'}},fileName:'shot.png',permission});
 assert.equal(view.path,'Screenshots / shot.png');assert.ok(view.detail.includes(expected));assert.match(view.detail,/bukan path lengkap/);
});
test('actual selected destination wins over edited input and old remembered folder',()=>{
 const view=describeSaveLocation({preferences:{enabled:true,directoryHandle:{name:'Old'}},fileName:'edited-during-write.png',selected:{directoryName:'Chosen',fileName:'shot (1).png'}});
 assert.equal(view.path,'Chosen / shot (1).png');assert.match(view.detail,/sudah dipilih/);
});
test('unnamed directory uses honest generic label rather than invented system path',()=>{const view=describeSaveLocation({selected:{directoryName:'',fileName:'shot.png'}});assert.equal(view.path,'Folder yang dipilih / shot.png');assert.doesNotMatch(view.path,/Downloads|Users|home/);});
