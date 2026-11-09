import {describeSaveLocation} from './save-location.js';
import {CLOSE_PREVIEW} from './close-preview.js';
import {loadSavePreferences,setRememberFolder,saveWithPreferences} from './save-preferences.js';
import {createCountdown} from './countdown.js';
import {dbOp} from './db.js';
import {safeName} from './core.js';
const $=id=>document.getElementById(id);
const id=new URLSearchParams(location.search).get('id');
let record,preferences={enabled:false},saving=false,preferencePending=false,countdown,selectedDestination=null,directoryPermission='unknown',permissionRevision=0;const urls=[];
const status=text=>{$('status').textContent=text;};
const closePreview=async()=>{try{const result=await chrome.runtime.sendMessage({type:CLOSE_PREVIEW});if(result?.closed)return;}catch{}$('countdown').textContent='Preview tidak dapat ditutup otomatis. Tutup melalui X Chrome.';};
const startCountdown=()=>{countdown?.stop();countdown=createCountdown({onTick:seconds=>{$('countdown').textContent=seconds===null?'Waktu ditunda selama penyimpanan...':'Tutup otomatis dalam '+seconds+' detik';},onExpire:closePreview});};
const renderSaveLocation=()=>{
  const view=describeSaveLocation({preferences,fileName:safeName($('name').value)+'.png',selected:selectedDestination,permission:directoryPermission});
  $('save-location').textContent=view.path;$('location-note').textContent=view.detail;
  $('last-save').textContent=view.lastSaved;$('last-save').hidden=!view.lastSaved;
};
const refreshFolderPermission=async()=>{
  const revision=++permissionRevision,handle=preferences.directoryHandle;directoryPermission='unknown';renderSaveLocation();
  if(preferences.enabled&&handle?.queryPermission){try{const permission=await handle.queryPermission({mode:'readwrite'});if(revision!==permissionRevision)return;directoryPermission=permission;}catch{}}
  if(revision===permissionRevision)renderSaveLocation();
};
const describeFolder=()=>{$('folder-note').textContent=preferences.enabled?(preferences.directoryHandle?.name?'Simpan cepat ke: '+preferences.directoryHandle.name+'. Jika izin kedaluwarsa, pilih folder lagi.':'Saat menyimpan pertama kali, pilih folder dan izinkan akses. Pilihan ini disimpan di browser ini.'):'Setiap simpan membuka pemilih folder; nama tetap mengikuti kolom di atas. Centang untuk memakai folder tersimpan tanpa dialog jika izin masih berlaku.';renderSaveLocation();};
$('name').addEventListener('input',renderSaveLocation);
$('shortcut').onclick=()=>chrome.tabs.create({url:'chrome://extensions/shortcuts'});
for(const event of ['input','keydown','pointerdown'])$('form').addEventListener(event,()=>{if(!saving)countdown?.reset();});
$('quick-save').onchange=async()=>{
  if(saving||preferencePending)return;
  const previous=preferences,enabled=$('quick-save').checked;preferencePending=true;$('save').disabled=true;$('quick-save').disabled=true;countdown?.pause();
  preferences={...preferences,enabled};selectedDestination=null;describeFolder();refreshFolderPermission();
  try{await setRememberFolder(enabled);describeFolder();}
  catch(error){preferences=previous;$('quick-save').checked=previous.enabled;describeFolder();refreshFolderPermission();status('Pilihan belum tersimpan. '+error.message);}
  finally{preferencePending=false;$('save').disabled=saving||typeof showDirectoryPicker!=='function';$('quick-save').disabled=false;countdown?.resume();}
};
$('form').onsubmit=async event=>{
  event.preventDefault();if(saving||preferencePending||!record?.parts?.length||$('save').disabled)return;
  saving=true;selectedDestination=null;renderSaveLocation();$('save').disabled=true;$('quick-save').disabled=true;countdown?.pause();
  try{
    const name=safeName($('name').value);$('name').value=name;
    const saved=await saveWithPreferences(record.parts[0],name+'.png',preferences,{onDestination:destination=>{selectedDestination=destination;renderSaveLocation();}});
    preferences=saved.preferences||preferences;renderSaveLocation();status('PNG berhasil disimpan: '+saved.name+'.');countdown?.stop();await closePreview();
  }catch(error){selectedDestination=null;refreshFolderPermission();status(error.name==='AbortError'?'Penyimpanan dibatalkan. Preview tetap tersedia.':'Simpan belum berhasil. '+error.message);}
  finally{saving=false;$('save').disabled=typeof showDirectoryPicker!=='function';$('quick-save').disabled=false;countdown?.resume();}
};
async function init() {
  if(!id)throw Error('Penyimpanan preview gagal. Periksa ruang disk lalu coba ulang.');
  record=await dbOp('get',id);
  if(!record)throw Error('Preview sudah dihapus atau kedaluwarsa. Ambil screenshot baru.');
  if(record.error)throw Error(record.error);
  if(record.parts.length!==1)throw Error('Preview lama terdiri dari beberapa file. Ambil ulang untuk satu PNG utuh.');
  preferences=await loadSavePreferences();
  $('quick-save').checked=preferences.enabled;
  $('name').value=record.name;
  describeFolder();refreshFolderPermission();
  $('summary').textContent=record.width+' × '+record.height+' px · 1 PNG utuh';
  $('warnings').textContent=(record.captureInfo?.warnings||[]).join(' ');
  const expanded=(record.captureInfo?.expandedContainers||0)+(record.captureInfo?.expandedFrames||0);
  if(expanded)$('summary').textContent+=' · '+expanded+' area scroll diperluas';
  record.parts.forEach((blob,i)=>{const url=URL.createObjectURL(blob);urls.push(url);const f=document.createElement('figure');const cap=document.createElement('figcaption');cap.textContent='Seluruh halaman';const img=new Image();img.src=url;img.alt='Screenshot seluruh halaman';f.append(cap,img);$('images').append(f);});
  const commands=await chrome.commands.getAll();const key=commands.find(x=>x.name==='_execute_action')?.shortcut;
  $('keys').textContent=key?'Shortcut aktif: '+key:'Alt+S belum terpasang (mungkin bentrok). Klik Atur shortcut untuk memilih tombol.';
  $('save').disabled=typeof showDirectoryPicker!=='function';
  startCountdown();
  $('name').focus();$('name').select();
  if($('save').disabled)status('Dialog simpan tidak tersedia di browser ini. Buka preview di Chrome desktop yang mendukung pemilihan file.');
}
init().catch(e=>{$('summary').textContent='Belum ada screenshot.';status(e.message);startCountdown();});
window.addEventListener('unload',()=>{countdown?.stop();urls.forEach(URL.revokeObjectURL);});
