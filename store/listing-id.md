# Draft listing Gulir

Nama: Gulir
Kategori usulan: Tools
Bahasa utama: Indonesia
Ringkasan: Screenshot halaman web menjadi satu PNG, dengan preview, nama otomatis, dan dialog pemilihan lokasi simpan.

## Deskripsi
Ambil screenshot halaman panjang dengan Alt+S atau satu klik ikon Gulir. Hasil digabung menjadi satu PNG utuh, bukan beberapa potongan.

- Preview sebelum menyimpan.
- Nama otomatis yang bisa diubah.
- Ubah nama di preview dan pilih folder lewat dialog native, tanpa unduhan tambahan.
- Countdown 60 detik terlihat; mengedit mengulang waktu, penyimpanan aktif menunda waktu, simpan berhasil menutup preview.
- Enter untuk simpan. Opsi folder terakhir tersimpan dan default nonaktif; izin folder dipilih pengguna.
- Nama singkat berbasis waktu lokal, dapat diedit; simpan cepat menghindari nama yang sudah ada.
- Jika file sudah ada, periksa konfirmasi penggantian file pada dialog.
- Pemrosesan lokal, tanpa akun Gulir atau unggahan screenshot ke server.
- Panel gulir vertikal tertentu dan iframe same-origin dapat diperluas sementara.

Buka halaman HTTP/HTTPS, tunggu konten termuat, lalu tekan Alt+S. Jika bentrok dengan shortcut lain, ubah melalui pengaturan shortcut extension Chrome. Jangan berpindah tab saat mengambil gambar.

Batasan: tidak semua dashboard didukung. Daftar virtual, panel horizontal, konten dinamis dan iframe lintas-origin dapat dibatasi. Iframe lintas-origin hanya mencakup bagian yang terlihat dan menampilkan peringatan. Capture yang berubah/terpotong dibatalkan tanpa file sebagian. Halaman Chrome, Chrome Web Store dan PDF internal tidak didukung. Batas ukuran/memori berlaku.

Chrome dapat menampilkan banner debugging selama screenshot karena Gulir menggunakan debugger API untuk mengambil viewport dan memulihkan posisi. Tidak memerlukan login atau langganan.

## Reviewer notes / single purpose
Single purpose: capture the user-invoked active web page as one local PNG, preview it and save it to a user-selected file. Packaged source only. No analytics or remote code. Review using a public long page or bundled synthetic fixtures, not private JNE credentials.

Permissions: activeTab scopes user invocation; debugger obtains layout, temporary styles/scroll and viewport screenshots. File System Access writes to the explicitly selected file; no downloads or storage permission. No requested host_permissions. Debugger is powerful and needs clear disclosure; do not describe the extension as having no website access.

## Belum diisi
Support contact/URL dan URL kebijakan privasi publik harus ditentukan pemilik. Pernyataan privacy dashboard harus cocok dengan policy dan kode, termasuk pemrosesan screenshot lokal. Jangan klaim nol data ditangani hanya karena tidak ada unggahan.
