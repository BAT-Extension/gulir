# Gulir 1.2.1 — validasi dan gate publikasi

## Lulus
- 52 unit tests (run terbaru pada MSI).
- Browser suite setelah integrasi logo: capture nyata debugger, preview, filename/folder, duplicate-safe download, scrolling/restoration,35.000px satu PNG, zoom/DPR, folder persistence.
- Nested suite: fixed app shell, nested panels, body scroller, same-origin iframe, clipped ancestor, initial scroll offsets; horizontal unsupported fails safely; cross-origin warning.
- Stress run sebelum perubahan logo:70.001px satu PNG dan20MP high-entropy. Logo hanya menambah aset/UI; selector pengujian kini khusus #images img.
- Alt+S nyata membuka preview di Chrome MSI.
- Logo dan semua ukuran PNG diperiksa.

## Gagal / belum selesai
- JNE nyata: capture dibatalkan dengan tinggi isi panel berubah/tetap terpotong. Penyebab scrollbar direproduksi dan diperbaiki pada 1.2.1; belum diverifikasi ulang di JNE nyata.
- Akses UI berhenti karena URL browser Windows tidak dapat ditentukan secara yakin. Tidak dilakukan bypass.
- Tambahan diagnosa PANEL_HEIGHT hanya menampilkan tag, tinggi dan CSS overflow/position; tidak menampilkan teks halaman, URL, ID elemen, token atau konten screenshot. Ini bukan perbaikan JNE.
- Chrome Web Store belum disubmit; akun developer dan status verifikasi belum diperiksa.

## Evidence lokal
- gulir-browser-O8GPP9/report.json: full+70.001px+20MP
- gulir-browser-XgwZEd/report.json: nested
- gulir-browser-E5gzKL/report.json: sesudah logo
Semua di /home/putrimak/.cache/gulir-validation-20261108/. Profil sintetis terpisah dari Chrome pribadi.

## Latest publication-candidate regression
2026-11-09: nested browser regression passed after geometry-only diagnostic update. Report: /home/putrimak/.cache/gulir-validation-20261108/gulir-browser-aKSb5E/report.json. This does not verify JNE. Store screenshot 1280x800 and promo 440x280 visually reviewed, synthetic only.

## 1.2.1 classic-scrollbar regression
Reproduced the exact user-reported DIV 1059/1044px, overflow=auto, position=static error by enabling classic scrollbars in isolated Chromium (Playwright otherwise hides scrollbars). Fix adds measured scrollbar height to expanded box sizing. No clipping tolerance increase. New tests/scrollbar.browser.cjs covers border-box and content-box with/without padding/borders, visible bottom green pixels, late-growth rejection, exact style/scroll/size restoration. Real JNE retest is still pending.

Latest full+nested regression after 1.2.1 fix: /home/putrimak/.cache/gulir-validation-20261108/gulir-browser-k3gsBn/report.json, passed. Four classic-scrollbar browser cases passed. Unit52/52 passed.
