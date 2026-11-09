# Gulir 1.2.3 — validasi dan gate publikasi

## Lulus
- 53 unit tests (run terbaru pada MSI).
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

## 1.2.2 public Bitwarden and bounded loading
Public https://bitwarden.com/ reproduced a size-change error at first scroll. Lazy-loading grew page height 7778→8534px and its sticky header repeatedly shrank 20px. A bounded warm-up plus single whole-image retry and reversible sticky minimum-height preservation produced one 1280×8554PNG in isolated Chromium. No login/forms/private profile used. Full+nested regression gulir-browser-jvTwt3 passed, including finite lazy growth, unbounded growth refusal and shrinking-header bottom pixels/restoration. Unit 53/53 passed. This does not certify every JNE page; no HR pages accessed.

Public screenshot visually inspected through footer: 1280×8554, cookie banner retained once in first viewport, no repeated overlays. Delayed overlays are re-scanned before each strip and restored. Public artifact: gulir-public-rpATOD/bitwarden-public.png.

Final 1.2.2 verification: gulir-browser-Sf8nPd/report.json full+nested+late-overlay suite passed; gulir-public-99Ohxs/report.json confirmed one1280×8554PNG and exact scroll/URL restoration; four classic-scrollbar cases passed.

## 1.2.3 diagnostic follow-up
User reports Bitwarden still fails on another laptop with1.2.2. Could not reproduce in fresh isolated profiles at1366×768,1920×1080,1536×864 withDPR1.25; successful PNG dimensions1366×8826,1920×8866,1538×8860 respectively. Added PAGE_SIZE non-content diagnostics and a bounded-retry failure unit test; do not claim the remaining user-specific issue fixed.

## Save-routing diagnosis
Native default Chrome downloads preserve chosen filename, nested subfolder and duplicate uniquification. Browser-level allowAndName override reproduced UUID filenames in redirected Downloads despite correct API filename input. Added final-path validation and warning, no automatic duplicate retry. Root cause on user laptop still unconfirmed; no personal Downloads inspected. Unit55/55 passed.

## Direct save fallback
Added native Save File Picker path independent of download routing, with suggested name from form and explicit user-selected directory.58unit tests pass including exact blob write, cancellation and failed-writer abort. Browser chooser is mocked for automation; writable stream uses real isolated origin storage. Manual OS chooser verification still needed on user laptop.
