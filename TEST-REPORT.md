# Gulir 1.2.9 storage-location display

## Current result
- Added a prominent location panel showing the selected/remembered folder name and PNG filename. Editing the filename updates the planned location; collision handling shows the actual numbered filename before writing.
- Before ordinary folder selection, the panel says the destination is not yet selected. Disabling quick save never treats the saved handle as the next destination.
- Granted, prompt, denied, and unknown folder-permission states have honest wording. Opening a preview queries permission only; it never requests a grant.
- Last successful folder/file metadata is kept locally for later previews. Cancelled or failed writes do not replace it. A history-storage error cannot turn a committed PNG into a failed save or retry it.
- Full OS paths are not exposed by File System Access. The UI explicitly labels the display as relative folder/file information and does not invent a Windows/Linux path. No new permissions.

## Final verification
- Unit suite: 97 passed, including 11 new location/history tests.
- Graphical location suite: 5 grouped checks passed, covering no selection, initial quick save, selected destination, edited filename, collision suffix, persisted history, permission prompt/denial, disabling quick save, cancellation and failed write. Report: /tmp/gulir-location-xbA7mb/report.json.
- Full capture/save/nested Chromium suite: 37 passed; native Alt+S unverified in headless. Report: /tmp/gulir-browser-IradX0/report.json.
- Graphical close-safety suite: 7 passed, preserving 1.2.8 multi-window, sole-preview, and concurrent-close protections. Report: /tmp/gulir-close-0lrD3C/report.json.
- Selected and remembered location screenshots inspected visually, including permission wording and last-save separation: /tmp/gulir-location-xbA7mb/selected-location.png and remembered-location.png.
- Package script verified the 1.2.9 archive, runtime contents, and checksum.

## Limits and upgrade
- Tests use separate disposable Chromium profiles on MSI WSL. Native folder selection is controlled in tests; file handles, storage, writes, and browser APIs are real.
- A full path such as C:\Users\name\Pictures is unavailable to this browser API. Folder names alone cannot distinguish two same-named directories. The native picker remains the authoritative way to inspect/select the full filesystem location.
- Last-save text is stored metadata, not a live filesystem browser; files moved or deleted outside Gulir are not tracked.
- Reload Gulir and create a new preview showing GULIR 1.2.9. No deployment or store submission.

## Historical verification below

# Gulir 1.2.8 preview-only close verification

## Current result
- Restored close after committed save and after the idle countdown. The 1.2.7 no-close behavior was intentional and is the confirmed cause of the latest report.
- Background serializes close requests and authenticates the Chrome-provided sender, tab ID, and live document identity. No target ID comes from the message body. Navigation cancels closure. No window.close or windows.remove API exists in runtime.
- A normal non-preview tab must remain. Otherwise a verified normal New Tab window is created first, then only the requesting preview tab is removed. Another popup or expiring preview cannot count as the survivor.
- The former guard counted other previews as survivors and had no shared queue. Those are identifiable safety gaps, not proof of the cause of the user's earlier whole-Chrome incident.
- No new permissions, personal profiles, or user tabs were used. Visible version: GULIR 1.2.8.

## Final verification
- Unit suite: 86 passed. Source guard permits only the single authenticated tab-removal site and bans all window/browser close APIs.
- Full headless Chromium capture/save/nested suite: 37 passed; native Alt+S was not verified. Report: /tmp/gulir-browser-T0ativ/report.json on MSI WSL.
- Separate graphical Chromium suite using unmodified runtime plus a disposable fixture page: 7 passed. Report: /tmp/gulir-close-Qn3Ae8/report.json.
- Both graphical and full runs verify save/countdown closure while multiple independent normal windows and original tab IDs survive unchanged. Also tested preview inside a normal window, sole-preview save and expiry, simultaneous final previews, and non-preview caller rejection.
- Last-window checks continue by navigating the surviving normal tab to a test page, proving browser usability after closing the preview, not merely a momentary automation connection.
- Full suite retains exact PNG hash checks, generated/edited names, collision preservation, quick-save preferences across restart, cancellation/write failures, paused countdown, and zero download events.
- Preview screenshot inspected visually: version, countdown, save controls and last-window behavior note visible. Screenshot: /tmp/gulir-close-Qn3Ae8/preview-1.2.8.png.

## Limits and upgrade
- Native folder picker is mocked; writes use actual OPFS file handles. This does not automate OS chooser appearance or external-directory permission prompts.
- Tests use isolated Chromium on MSI WSL, including a graphical browser run, not the user's personal Windows Chrome profile. The earlier whole-Chrome exit remains unreproduced and its exact cause unproven.
- The safeguard cannot prevent Chrome crashes or a user/another application independently closing the surviving window during an API operation.
- Close older previews manually, reload Gulir in chrome://extensions, and confirm GULIR 1.2.8 on a newly created preview. Reloading does not rewrite already loaded preview scripts.
- No deployment or Chrome Web Store submission was performed.

## Historical evidence below
All closing behavior below describes older versions and is superseded by the results above.

# Historical 1.2.7 safety hotfix (superseded)

## Current result
- User reported 1.2.6 still closed Chrome. Exact whole-browser incident has NOT been reproduced; do not claim its root cause is known.
- Removed every programmatic preview/tab/window closure. The old exported helper is inert and never touches browser APIs.
- Countdown is reminder-only. Successful save, failure, cancellation, error preview, and last-tab situations leave the preview open. Close using Chrome's own X.
- No new permissions. No personal Chrome profile or active user tabs were inspected.
- Preview displays GULIR 1.2.7 to distinguish old loaded code.

## Verification
- Unit regressions and shipped-runtime no-close source guard: 72 passed.
- Isolated real Chromium full suite: 28 passed, one not verified (native Alt+S in headless).
- Report: /tmp/gulir-browser-6alFfp/report.json on MSI WSL.
- Final focused real Chromium save suite: 14 passed; /tmp/gulir-browser-2UXvkf/report.json.
- Real popup + independent normal windows retained their complete tab identities after save and reminder expiry.
- Sole remaining preview tab stays alive after expiry, inert helper invocation, and successful save.
- Exact PNG bytes/default/custom names, persisted quick-save preference and directory handles, collisions without overwrite, cancellation/write failures, delayed writes, zero downloads, browser restart checked.
- The full run preceded only the cosmetic visible-version label; the final focused suite retested the final artifact and passed.

## Limits
- Headless Chromium with isolated disposable profiles, not the user's Chrome session.
- Native directory picker is replaced by a stub returning actual OPFS handles. Native OS dialog appearance/permissions are not automated.
- Headless native Alt+S is not verified.
- This removes extension-initiated closure; it cannot prove Chrome itself can never crash or establish why the user's earlier browser exited.
- Existing previews from older loaded versions must be closed manually; reload/reinstall the extension and verify 1.2.7 visibly.

## Historical reports (superseded for closing behavior)
# Gulir 1.2.6 — validasi dan gate publikasi

## Riwayat pengujian versi sebelumnya
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

## 1.2.4 scrolled-header regression (2026-11-09)
- Reproduced the real public Bitwarden failure from scrollY=1200 with classic scrollbars:1905x8866 to1905x8846, retry1. The user reported11px rather than this20px; exact content heights differ by environment.
- Synthetic sticky animated header reproduces exactly 11px shrink on the old code (3350 to3339). Fix scrolls to top, lets scroll handlers run, then disables sticky transition before measuring its full footprint. No size tolerance was relaxed.
- Fixed public capture at exactly 1920x907 viewport, DPR1 yields one1905x8866PNG; original scroll/URL restored. Visually reviewed full image through final footer. Evidence: gulir-public-3VvoxW/report.json.
- Synthetic regression verifies 3350px image and bottom green pixel plus original scroll restoration; tests/scrolled-header.browser.cjs.
- All 58 unit tests and four classic15px scrollbar variants passed. Unbounded growth and actual clipping continue to reject without partial PNG.

### 1.2.4 integrated save and expiry checks
- Final public Bitwarden evidence: gulir-public-04QOeu/report.json, capture viewport 1920x907, DPR1, PNG1905x8866, original scroll restored.
- Full+nested browser suite: 31 passed, 1 shortcut simulation unverified. Evidence: gulir-browser-FuE3yc/report.json.
- Save/expiry suite: 11 passed. Evidence: gulir-browser-waR7xw/report.json. Exact saved PNG hash matches preview; zero Chrome download events/files even with UUID routing enabled. Cancel, repeated submits, write failure/retry and expiry during pending picker/write verified.
- OS chooser is mocked with real OPFS file handles; native overwrite dialog not automated. 60-second timer uses controlled test clock. Source of user's original extra UUID file not proven; automatic download path and downloads/storage permissions removed entirely.
- Latest full-page JNE retest and Chrome Web Store publication remain pending; no user HR data accessed.

## 1.2.5 quick-save and countdown
- 69 unit tests pass: default-off preference, separate persisted directory handle, permission renewal/denial, same-name suffixes and cross-tab locks, interrupted writes, local timestamp naming and countdown safety.
- Preview UI visually checked: one editable name, unchecked quick-save option by default, visible60-second countdown, Enter-save label, no delete-preview button.
- Save-only browser checks pass: real OPFS writes and hash match, IndexedDB handle structured clone across previews with real queryPermission, Enter/success auto-close, cancellation, denied-permission picker fallback, zero Downloads, editing resets and active picker/write pauses countdown. OS chooser and revoked permission interaction are simulated; actual OS dialogs not automated.
- Native File System Access lacks atomic exclusive-create against unrelated external applications. Origin Web Lock prevents Gulir previews colliding; already existing files are skipped with numbered suffixes.

- Final full+nested browser report: gulir-browser-9FAMrm/report.json. Browser restart retains checkbox and structured-cloned directory handle; real OPFS queryPermission granted, reuse without picker and exact saved PNG hash verified. Existing unrelated filename sentinel remains unchanged after collision.
- Supplemental1.2.5 public Bitwarden rerun blocked before load by DNS ERR_NAME_NOT_RESOLVED. Capture code unchanged from1.2.4 verified public run; this is not a new live-page pass.

## 1.2.6 preview-only close safety and authoritative filename
- 73 unit tests pass. Removed window.close from preview paths; close helper validates executing extension URL and current-tab ID, removes only that tab, and refuses to remove Chrome's last remaining tab.
- Real Chrome redacts tab.url without tabs permission; guard now validates the executing extension location and Chrome-provided self ID without requiring additional access.
- Normal save now opens directory picker and writes the exact preview filename, as quick-save already did. Existing names are skipped via numbered suffix; no automatic Downloads route. Native folder chooser still simulated with real OPFS writes in browser tests.
- Original user's entire-browser shutdown/name substitution is not asserted reproduced; changes constrain closure and filename paths and are verified against actual browser tab/window behavior.

- Final full+nested evidence: gulir-browser-aZlQDS/report.json. Two independent normal windows and all their tabs survive successful save/countdown/error expiry. Last-tab timer, direct helper and saved-file closure all leave the sole preview open. Generated and edited filenames are exact, collision suffix preserves originals.
- In a disposable profile the legacy window.close removed the sole preview window; automation connection was still alive immediately afterward. Entire Chrome process exit is not proven.
