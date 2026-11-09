import {dbOp} from './db.js';
import {safeName,folderPath} from './core.js';
const $ = id => document.getElementById(id);
const id = new URLSearchParams(location.search).get('id');
let record; const urls=[]; const completed=new Set(); const pending=new Map();
const status = text => { $('status').textContent=text; };
$('shortcut').onclick = () => chrome.tabs.create({url:'chrome://extensions/shortcuts'});
$('discard').onclick = async () => { if(pending.size){status('Tunggu unduhan selesai sebelum menghapus preview.');return;} await dbOp('delete',id); window.close(); };
chrome.downloads.onChanged.addListener(delta => {
  if (!pending.has(delta.id)) return;
  if(delta.state?.current === 'complete') { const i=pending.get(delta.id);completed.add(i);pending.delete(delta.id); }
  if(delta.state?.current === 'interrupted') {pending.delete(delta.id);status('Unduhan terhenti. Klik Simpan untuk mencoba gambar ini.');}
  if (!pending.size) { $('save').disabled = completed.size === record.parts.length; if($('save').disabled)status('PNG berhasil disimpan. Nama duplikat diberi nomor otomatis oleh Chrome.'); }
});
$('form').onsubmit = async e => {
  e.preventDefault(); $('save').disabled=true;
  try {
    const folder=folderPath($('folder').value);const name=safeName($('name').value);$('name').value=name;
    await chrome.storage.local.set({folder});
    for(let i=0;i<record.parts.length;i++) {
      if(completed.has(i)||[...pending.values()].includes(i))continue;
      const suffix=record.parts.length>1 ? '-'+String(i+1).padStart(2,'0') : '';
      const downloadId=await chrome.downloads.download({url:urls[i],filename:(folder?folder+'/':'')+name+suffix+'.png',conflictAction:'uniquify',saveAs:false});
      pending.set(downloadId,i);
      const [item]=await chrome.downloads.search({id:downloadId});
      if(item?.state==='complete'){completed.add(i);pending.delete(downloadId);}
      if(item?.state==='interrupted'){pending.delete(downloadId);throw Error('Unduhan terhenti. Coba simpan lagi.');}
    }
    status(completed.size===record.parts.length?'PNG berhasil disimpan.':'Mengunduh… Jangan tutup preview sampai selesai.');
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
}
init().catch(e=>{$('summary').textContent='Belum ada screenshot.';status(e.message);});
window.addEventListener('unload',()=>urls.forEach(URL.revokeObjectURL));
