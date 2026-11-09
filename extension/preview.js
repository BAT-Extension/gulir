import {saveDirect} from './save-direct.js';
import {dbOp} from './db.js';
import {safeName} from './core.js';
const $ = id => document.getElementById(id);
const id = new URLSearchParams(location.search).get('id');
let record; const urls=[];
let saving=false, closeWhenReady=false;
// Expire the preview after one minute, but never interrupt a picker or write.
let closeTimer;
const startCloseTimer=()=>{closeTimer=setTimeout(()=>{
  if(saving){closeWhenReady=true;return;}
  window.close();
},60_000);};
const status = text => { $('status').textContent=text; };
$('shortcut').onclick = () => chrome.tabs.create({url:'chrome://extensions/shortcuts'});
$('discard').onclick = async () => {
  if(saving){status('Tunggu penyimpanan selesai sebelum menghapus preview.');return;}
  await dbOp('delete',id); window.close();
};
// One save action only: never start a Chrome download or fall back to one.
// Calling the picker before any unrelated await preserves user activation.
$('form').onsubmit = async event => {
  event.preventDefault();
  if(saving||!record?.parts?.length||$('save').disabled)return;
  saving=true; $('save').disabled=true; $('discard').disabled=true;
  try {
    const name=safeName($('name').value); $('name').value=name;
    const saved=await saveDirect(record.parts[0],name+'.png');
    status('PNG berhasil disimpan: '+saved.name+'. Lokasi sesuai pilihan pada dialog.');
  } catch(error) {
    status(error.name==='AbortError'?'Dialog simpan dibatalkan. Preview tetap tersedia.':'Simpan belum berhasil. '+error.message);
  } finally {
    saving=false; $('save').disabled=typeof showSaveFilePicker!=='function'; $('discard').disabled=false;
    if(closeWhenReady)window.close();
  }
};
async function init() {
  if(!id)throw Error('Penyimpanan preview gagal. Periksa ruang disk lalu coba ulang.');
  record=await dbOp('get',id);
  if(!record)throw Error('Preview sudah dihapus atau kedaluwarsa. Ambil screenshot baru.');
  if(record.error)throw Error(record.error);
  if(record.parts.length!==1)throw Error('Preview lama terdiri dari beberapa file. Ambil ulang untuk satu PNG utuh.');
  $('name').value=record.name;
  $('summary').textContent=record.width+' × '+record.height+' px · 1 PNG utuh';
  $('warnings').textContent=(record.captureInfo?.warnings||[]).join(' ');
  const expanded=(record.captureInfo?.expandedContainers||0)+(record.captureInfo?.expandedFrames||0);
  if(expanded)$('summary').textContent+=' · '+expanded+' area scroll diperluas';
  record.parts.forEach((blob,i)=>{const url=URL.createObjectURL(blob);urls.push(url);const f=document.createElement('figure');const cap=document.createElement('figcaption');cap.textContent='Seluruh halaman';const img=new Image();img.src=url;img.alt='Screenshot seluruh halaman';f.append(cap,img);$('images').append(f);});
  const commands=await chrome.commands.getAll();const key=commands.find(x=>x.name==='_execute_action')?.shortcut;
  $('keys').textContent=key?'Shortcut aktif: '+key:'Alt+S belum terpasang (mungkin bentrok). Klik Atur shortcut untuk memilih tombol.';
  $('save').disabled=typeof showSaveFilePicker!=='function';
  startCloseTimer();
  if($('save').disabled)status('Dialog simpan tidak tersedia di browser ini. Buka preview di Chrome desktop yang mendukung pemilihan file.');
}
init().catch(e=>{$('summary').textContent='Belum ada screenshot.';status(e.message);startCloseTimer();});
window.addEventListener('unload',()=>{clearTimeout(closeTimer);urls.forEach(URL.revokeObjectURL);});
