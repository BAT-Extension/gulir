# Publication gate — NOT READY

- [x] Logo/icon dan manifest
- [x] Unit/regression sintetis
- [x] Draft listing dan privacy berdasarkan perilaku nyata
- [x] Error geometri 1059/1044px direproduksi; ruang scrollbar klasik diperbaiki dan diuji sintetis di 1.2.1
- [ ] Retest JNE nyata setelah perbaikan, tanpa data dikirim keluar
- [ ] Pemilik menentukan kontak dukungan, hosting dan URL privacy policy
- [ ] Dashboard developer/2FA/registrasi diverifikasi
- [ ] Pernyataan privacy dan alasan setiap izin diperiksa terhadap kode
- [x] Screenshot listing 1280x800 dan promo 440x280 diperiksa visual; demo sintetis tanpa data pribadi
- [ ] ZIP final diikat ke versi/commit yang direview
- [ ] Submit review, lalu tunggu keputusan Chrome Web Store

## Bantuan pengguna yang dibutuhkan untuk JNE
1. Di chrome://extensions, Reload Gulir dari folder proyek yang sama.
2. Kembali ke halaman JNE yang sebelumnya bermasalah, tunggu selesai muat, tekan Alt+S. Jangan berpindah tab selama proses.
3. Kirim hanya teks error yang mencantumkan PANEL_HEIGHT (tag, ukuran dan overflow/position). Tidak perlu screenshot data HR, password, cookie atau DevTools. Jika berhasil, cukup laporkan dimensi dan apakah bagian paling bawah masuk.

Jangan menonaktifkan pemeriksaan clipping demi lolos test. Paket kandidat boleh diuji lokal, bukan dianggap siap publik.

Sumber: https://developer.chrome.com/docs/webstore/cws-dashboard-listing
https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
https://developer.chrome.com/docs/webstore/publish
