import {saveDirect} from './save-direct.js';
import {dbOp} from './db.js';
import {safeName,folderPath,downloadPathMatches} from './core.js';
const $ = id => document.getElementById(id);
const id = new URLSearchParams(location.search).get('id');
let record; const urls=[]; const completed=new Set(); const pending=new Map(); const requested=new Map(); const mismatches=new Set();
let directSaving=false;
const status = text => { $('status').textContent=text; };
$('shortcut').onclick = () => chrome.tabs.create({url:'chrome://extensions/shortcuts'});
$('discard').onclick = async () => { if(pending.size||directSaving){status('Tunggu unduhan selesai sebelum menghapus preview.');return;} await dbOp('delete',id); window.close(); };
const savedStatus=()=>mismatches.size
  ? 'Chrome menyimpan dengan nama/lokasi berbeda dari pilihan Gulir. Gunakan Pilih lokasi untuk menyimpan langsung dengan nama/folder yang Anda tentukan. File unduhan sebelumnya tidak dihapus atau diulang otomatis.'
  : 'PNG berhasil disimpan sesuai nama dan subfolder pilihan. Nama duplikat diberi nomor otomatis oleh Chrome.';
async function inspectDownload(downloadId) {
  if(!pending.has(downloadId))return;
  const i=pending.get(downloadId),[item]=await chrome.downloads.search({id:downloadId});
  if(item?.state==='complete'){
    if(!downloadPathMatches(item.filename,requested.get(downloadId)))mismatches.add(i);
    completed.add(i);pending.delete(downloadId);
  }else if(item?.state==='interrupted'){
    pending.delete(downloadId);status('Unduhan terhenti. Klik Simpan untuk mencoba gambar ini.');
  }
  $('save').disabled=pending.size>0||completed.size===record.parts.length;
  if(completed.size===record.parts.length)status(savedStatus());
}
chrome.downloads.onChanged.addListener(delta=>{
  if(pending.has(delta.id)&&(delta.state||delta.filename))inspectDownload(delta.id).catch(()=>status('Status lokasi unduhan belum dapat dipastikan. Periksa Downloads sebelum mencoba lagi.'));
});
$('save-direct').onclick=async()=>{
  if(directSaving||pending.size)return;
  directSaving=true;$('save-direct').disabled=true;$('save').disabled=true;
  try{
    const name=safeName($('name').value)+'.png';
    const saved=await saveDirect(record.parts[0],name);
    status('PNG disimpan langsung: '+saved.name+'. Folder mengikuti pilihan pada dialog, bukan kolom subfolder.');
  }catch(error){
    status(error.name==='AbortError'?'Dialog simpan dibatalkan. Preview tetap tersedia.':'Simpan langsung belum berhasil. '+error.message);
  }finally{
    directSaving=false;$('save-direct').disabled=false;
    $('save').disabled=pending.size>0||completed.size===record.parts.length;
  }
};
$('form').onsubmit = async e => {
  e.preventDefault(); if(directSaving)return; $('save').disabled=true;
  try {
    const folder=folderPath($('folder').value);const name=safeName($('name').value);$('name').value=name;
    await chrome.storage.local.set({folder});
    for(let i=0;i<record.parts.length;i++) {
      if(completed.has(i)||[...pending.values()].includes(i))continue;
      const suffix=record.parts.length>1 ? '-'+String(i+1).padStart(2,'0') : '';
      const filename=(folder?folder+'/':'')+name+suffix+'.png';
      const downloadId=await chrome.downloads.download({url:urls[i],filename,conflictAction:'uniquify',saveAs:false});
      requested.set(downloadId,filename);pending.set(downloadId,i);
      await inspectDownload(downloadId);
    }
    if(completed.size===record.parts.length)status(savedStatus());
    else if(pending.size)status('Mengunduh… Jangan tutup preview sampai selesai.');
  } catch(e) { status(e.message); }
  finally { $('save').disabled = pending.size>0 || completed.size===record.parts.length; }
};
async function init() {
  if(!id)throw Error('Penyimpanan preview gagal. Periksa ruang disk lalu coba ulang.');
  record=await dbOp('get',id);
  if(!record)throw Error('Preview sudah dihapus atau kedaluwarsa. Ambil screenshot baru.');
  if(record.error)throw Error(record.error);
  if(record.parts.length!==1)throw Error('Preview lama terdiri dari beberapa file. Ambil ulang untuk satu PNG utuh.');
  $('name').value=record.name;
  $('folder').value=(await chrome.storage.local.get({folder:'Screenshots'})).folder;
  $('summary').textContent=record.width+' × '+record.height+' px · 1 PNG utuh';
  $('warnings').textContent=(record.captureInfo?.warnings||[]).join(' ');
  const expanded=(record.captureInfo?.expandedContainers||0)+(record.captureInfo?.expandedFrames||0);
  if(expanded)$('summary').textContent+=' · '+expanded+' area scroll diperluas';
  record.parts.forEach((blob,i)=>{const url=URL.createObjectURL(blob);urls.push(url);const f=document.createElement('figure');const cap=document.createElement('figcaption');cap.textContent='Seluruh halaman';const img=new Image();img.src=url;img.alt='Screenshot seluruh halaman';f.append(cap,img);$('images').append(f);});
  const commands=await chrome.commands.getAll();const key=commands.find(x=>x.name==='_execute_action')?.shortcut;
  $('keys').textContent=key?'Shortcut aktif: '+key:'Alt+S belum terpasang (mungkin bentrok). Klik Atur shortcut untuk memilih tombol.';
  $('save').disabled=false;
  $('save-direct').disabled=typeof showSaveFilePicker!=='function';
}
init().catch(e=>{$('summary').textContent='Belum ada screenshot.';status(e.message);});
window.addEventListener('unload',()=>urls.forEach(URL.revokeObjectURL));
