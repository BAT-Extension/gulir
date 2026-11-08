import {allowedUrl,autoName} from './core.js';
import {captureSinglePng} from './capture.js';
import {dbOp,prune} from './db.js';
let busy = false;
async function preview(id) {
  await chrome.windows.create({url:chrome.runtime.getURL('preview.html?id='+encodeURIComponent(id)),type:'popup',width:1000,height:800});
}
export async function capture(tab) {
  if (busy) return;
  busy = true;
  let attached = false;
  const target = {tabId:tab.id};
  const id = crypto.randomUUID();
  const record = {id,created:Date.now(),name:autoName(tab.title || 'screenshot'),parts:[]};
  try {
    if (!allowedUrl(tab.url)) throw Error('Tab ini tidak dapat diambil. Buka halaman http/https biasa; halaman Chrome, Web Store, PDF internal, dan file lokal tidak didukung.');
    if (tab.status === 'loading') throw Error('Halaman masih dimuat. Tunggu selesai lalu tekan Alt+S lagi.');
    await chrome.action.setBadgeText({text:'…'});
    await chrome.debugger.attach(target, '1.3'); attached = true;
    const send = (method,params={}) => chrome.debugger.sendCommand(target,method,params);
    const result=await captureSinglePng(send,()=>chrome.tabs.getZoom(tab.id));
    record.width=result.width;record.height=result.height;record.parts=[result.blob];
  } catch (e) {
    record.parts=[];
    record.error = 'Screenshot gagal. ' + e.message + ' Jika DevTools terbuka, tutup dahulu. Izin atau kebijakan Chrome mungkin membatasi akses.';
  } finally {
    if (attached) await chrome.debugger.detach(target).catch(()=>{});
    await chrome.action.setBadgeText({text:''}).catch(()=>{});
    busy = false;
  }
  try { await prune(); await dbOp('put',record); await preview(id); }
  catch { await chrome.windows.create({url:chrome.runtime.getURL('preview.html?storageError=1'),type:'popup',width:700,height:500}); }
}
chrome.action.onClicked.addListener(tab => { capture(tab).catch(console.error); });
chrome.runtime.onStartup.addListener(()=>{prune().catch(console.error);});
