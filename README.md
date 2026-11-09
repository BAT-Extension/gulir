# Gulir 1.2.2 — release candidate

Extension Chrome untuk screenshot seluruh halaman HTTP/HTTPS menjadi **satu PNG utuh**, termasuk halaman panjang. Gambar tidak diunggah ke server.

## Pemasangan di MSI
Proyek: /home/putrimak/www/extension/gulir

1. Buka chrome://extensions di Chrome desktop versi 118 atau lebih baru.
2. Aktifkan Developer mode, pilih Load unpacked / Muat yang belum dikemas.
3. Pilih folder extension:
   /home/putrimak/www/extension/gulir/extension
   Dari Windows: \\wsl.localhost\Ubuntu-24.04\home\putrimak\www\extension\gulir\extension
4. Jika versi lama sudah dimuat, klik Reload pada kartu Gulir.
5. Buka chrome://extensions/shortcuts. Pastikan Alt+S terpasang; pilih tombol lain bila bentrok. F10/F11 tidak didukung Commands API Chrome.

Gulir 1.2.0 telah diuji di Chrome MSI dan Alt+S membuka preview, tetapi capture JNE ditolak karena tinggi panel. Versi 1.2.1 memperbaiki penyebab scrollbar yang direproduksi secara sintetis; retest JNE nyata masih diperlukan sebelum rilis publik.

## Pemakaian
Buka halaman web dan tunggu muat selesai. Untuk konten lazy-load, scroll dahulu sampai bawah dan tunggu gambar muncul. Tekan Alt+S atau klik ikon Gulir. Jangan berpindah tab, menggulir, atau mengubah zoom selama pengambilan. Halaman akan terlihat bergulir, lalu posisi semula dipulihkan.

Preview menampilkan “1 PNG utuh”. Ubah nama, isi subfolder relatif seperti Screenshots/Proyek, lalu klik Simpan PNG. Pilihan folder terakhir diingat; kosongkan untuk Downloads utama. Tunggu pesan selesai sebelum menutup preview.

Satu capture menghasilkan satu file, tanpa akhiran bagian -01/-02. Nama duplikat diberi nomor oleh Chrome agar file sebelumnya tidak tertimpa. Folder yang dipilih adalah subfolder Downloads, bukan penjelajah seluruh disk. Lokasi Downloads mengikuti pengaturan Chrome dan kebijakan perangkat.

## Halaman sangat panjang
Gulir mengambil viewport yang benar-benar dirender, menggabungkan baris secara bertahap, lalu mengenkode **satu PNG lossless**. Tidak membuat canvas setinggi seluruh halaman. Hasil memakai satu piksel gambar per CSS pixel pada zoom/layar Retina; bukan resolusi fisik Retina dua kali lipat.

Pengujian mencakup satu PNG 1280 × 35.000 dan satu PNG 1280 × 70.001, lengkap dengan pemeriksaan isi piksel dan satu unduhan. Jalur screenshot oversized lama yang menghasilkan pengulangan viewport sudah diganti.

Batas aman saat ini:
- Total 120 juta piksel, lebar 16.000 px, tinggi 120.000 px.
- PNG terkompresi maksimum 256 MiB.
- Viewport fisik maksimum 32 juta piksel, paling banyak 1.200 pengambilan viewport, maksimum 5 menit.
- Memori kerja gambar dibatasi pada band maksimum 4MP dan paling banyak dua bitmap viewport, ditambah PNG terkompresi. Preview/browser tetap perlu memori untuk membuka gambar akhir.

Jika batas tercapai atau pengambilan gagal, Gulir menampilkan kesalahan. **Tidak membagi hasil, tidak menyimpan potongan sebagian, dan tidak mengurangi resolusi diam-diam.** Perbesar jendela jika viewport terlalu kecil. Aplikasi pembuka gambar mungkin memiliki batas ukuran sendiri.

## Batasan isi halaman
Ini pengambilan berurutan, bukan snapshot seluruh halaman pada satu waktu. Animasi/video dapat berbeda antarbagian. Lazy-load, infinite scroll, dan halaman virtualized sebaiknya dimuat/stabil terlebih dahulu. Perubahan ukuran halaman, navigasi, zoom, atau tab yang tidak aktif membatalkan hasil.

Panel fixed pada viewport pertama dipertahankan sekali, termasuk bagian bawah/kanan; sticky ditempatkan pada alur dokumen selama capture. Properti sementara dan posisi gulir dipulihkan. Halaman dapat menjalankan efek samping JavaScript akibat scroll yang tidak bisa dibatalkan. Panel gulir vertikal dan iframe same-origin yang didukung diperluas sementara. Nested horizontal scroll dan daftar virtual ditolak. Iframe lintas-origin hanya menyertakan area yang terlihat dengan peringatan. Closed shadow DOM, konten terlindungi, dan overflow berkoordinat negatif memiliki keterbatasan. Halaman dinamis yang tetap terpotong dibatalkan, bukan dianggap berhasil.

Jika koneksi browser putus atau pemulihan gagal, pesan kesalahan memberi tahu pengguna. Ada pemulihan saat pagehide dan watchdog 5 menit, tetapi tab yang hang dapat menunda timer maupun perintah browser. Muat ulang halaman jika tampilannya berubah.

Chrome/Web Store, extension lain, file lokal, PDF internal, dan halaman yang dibatasi kebijakan mungkin tidak dapat diambil. Ini bukan editor crop/anotasi. Jika preview ditutup, ambil ulang dari toolbar.

## Izin dan privasi
- activeTab: tab yang pengguna pilih melalui toolbar/shortcut.
- debugger: ukuran halaman, pengguliran, dan screenshot Chrome. Banner debugging dapat muncul. Koneksi dilepas setelah proses, termasuk saat gagal. Tutup DevTools pada tab sasaran.
- downloads: menyimpan satu PNG ke Downloads dan memantau status.
- storage: mengingat subfolder.

Screenshot sementara disimpan pada IndexedDB lokal extension. Hapus preview menghapus capture; capture lebih dari 24 jam dibersihkan pada pengambilan berikutnya/startup Chrome, bukan tepat pada jam ke-24. PNG yang telah diunduh tetap ada. Tidak ada analytics, unggahan eksternal, host permission permanen, atau dependensi kode pihak ketiga.

## Validasi
- Unit: npm test (Node 22+).
- Browser: sediakan Playwright pada lingkungan pengembangan, lalu npm run test:browser.
- GULIR_TALL=1 menambahkan halaman 70.001 px.
- GULIR_STRESS=1 menambahkan canvas 20MP.
- GULIR_CHROMIUM_EXECUTABLE memilih executable Chrome lain.
- GULIR_HEADED=1 membuka jendela browser uji terlihat.

Fixture memakai salinan extension/profil sementara dan loopback server. Test hook tidak masuk extension asli. Lihat TEST-REPORT.md untuk hasil dan batas validasi. Keberhasilan ukuran saja tidak membuktikan isi; pengujian memeriksa piksel asli.

Referensi:
https://developer.chrome.com/docs/extensions/reference/api/commands
https://developer.chrome.com/docs/extensions/reference/api/debugger
https://developer.chrome.com/docs/extensions/reference/api/downloads
https://chromedevtools.github.io/devtools-protocol/tot/Page/

## Persiapan publikasi
Lihat `store/READINESS.md`, `store/listing-id.md` dan `store/privacy-policy-draft.md`. ZIP dalam `dist/` adalah kandidat pengujian, bukan bukti persetujuan Chrome Web Store. Jangan menggunakan screenshot JNE atau data pribadi sebagai aset toko.

### Perbaikan 1.2.1
Tinggi panel kini memasukkan ruang scrollbar horizontal klasik yang terukur. Error 1059/1044px direproduksi dan diperbaiki pada fixture browser; batas clipping tetap ketat. Retest pada JNE asli masih diperlukan.

### Perbaikan 1.2.2
Jika ukuran halaman berubah, Gulir membuang seluruh hasil sementara, menyiapkan lazy-load dengan batas 20 detik dan maksimal 3 sapuan / 240 langkah, lalu mengulang gambar utuh satu kali. Header sticky yang mengecil dipertahankan ruang asalnya selama capture. Halaman yang terus berubah tetap ditolak, bukan dipotong. Persiapan dapat memicu lazy-load/JavaScript scroll milik situs. Tidak melakukan klik, login atau navigasi otomatis ke halaman lain.
