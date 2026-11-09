export function allowedUrl(value) {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && u.hostname !== 'chromewebstore.google.com' && !(u.hostname === 'chrome.google.com' && u.pathname.startsWith('/webstore')); } catch { return false; }
}
export function safeName(value) {
  let s = String(value).normalize('NFKC').replace(/\.png$/i, '').replace(/[<>:"/\\|?*\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, '_').trim().replace(/[. ]+$/g, '').slice(0, 100).replace(/[. ]+$/g, '');
  if (!s || /^\.+$/.test(s)) s = 'screenshot';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s)) s = '_' + s;
  return s;
}
export function folderPath(value) {
  const s = String(value).trim();
  if (!s) return '';
  if (s.length > 160 || s.startsWith('/') || s.includes('\\')) throw Error('Gunakan subfolder relatif, contoh: Screenshots/Proyek.');
  const parts = s.split('/');
  if (parts.some(x => !x || x === '.' || x === '..' || x !== safeName(x + '.png'))) throw Error('Nama subfolder tidak valid. Hindari .. dan karakter khusus.');
  return parts.join('/');
}
export function autoName(title, date = new Date()) { return safeName(title) + '_' + date.toISOString().replace(/[:.]/g, '-'); }
export function captureDimensions(width, height) {
  width = Math.ceil(width); height = Math.ceil(height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > 16000 || height > 120000 || width * height > 120000000) throw Error('Halaman melebihi batas aman (120 juta piksel / tinggi 120.000 px / lebar 16.000 px). Halaman tidak akan dipotong atau disimpan sebagian.');
  return {width,height};
}

// Chrome may uniquify the basename, but must retain the requested subfolder.
export function downloadPathMatches(actual, requested) {
  if(typeof actual!=='string'||typeof requested!=='string')return false;
  const insensitive=/^[a-z]:[\\/]/i.test(actual);
  const clean=v=>{const n=v.replace(/\\/g,'/');return insensitive?n.toLowerCase():n;};
  const a=clean(actual).split('/'),r=clean(requested).split('/');
  if(a.length<r.length)return false;
  const actualName=a.pop(),expectedName=r.pop();
  if(r.some((part,i)=>a[a.length-r.length+i]!==part))return false;
  if(actualName===expectedName)return true;
  const stem=expectedName.slice(0,-4);
  return actualName.startsWith(stem+' (')&&/^ \([1-9][0-9]*\)\.png$/.test(actualName.slice(stem.length));
}
