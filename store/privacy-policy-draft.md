# Gulir — draft kebijakan privasi

DRAFT: belum dipublikasikan. Pemilik/pengelola, kontak dukungan dan tanggal berlaku perlu dilengkapi sebelum submit.

Gulir mengambil screenshot hanya ketika Anda menekan shortcut atau ikon. Konten halaman yang dipilih dapat memuat data pribadi; jangan mengambil gambar yang tidak ingin Anda simpan. Gulir membaca judul tab untuk nama file otomatis dan menggunakan akses debugger untuk mengukur, menggulir serta menangkap halaman. Halaman bisa menjalankan JavaScript sendiri ketika digulir.

Screenshot, nama file otomatis, dimensi, waktu pengambilan, peringatan atau error disimpan sementara pada IndexedDB lokal extension untuk preview. Subfolder Downloads pilihan terakhir disimpan di chrome.storage.local. Gulir tidak mengunggah konten ini ke server, tidak memakai analytics, iklan, pelacakan browsing atau remote code. Situs yang Anda buka dan Chrome tetap bekerja sesuai layanan/kebijakannya masing-masing.

Klik Hapus preview untuk menghapus capture sementara. Capture yang lebih tua dari 24 jam dibersihkan saat capture berikutnya atau startup Chrome; bukan timer penghapusan tepat 24 jam. Menutup preview tidak langsung menghapus record. PNG yang diunduh tetap di folder lokal hingga Anda menghapusnya sendiri. Menghapus extension menghapus penyimpanan extension mengikuti perilaku Chrome, tetapi bukan PNG unduhan.

Tidak ada akun Gulir atau penjualan/transfer screenshot oleh Gulir kepada pihak ketiga. Data hanya digunakan untuk fungsi screenshot, preview dan simpan yang diminta pengguna. Penggunaan informasi dari API Google tunduk pada Chrome Web Store User Data Policy, termasuk persyaratan Limited Use.

Izin debugger memberi akses kuat pada tab untuk fungsi screenshot; sambungan dilepas setelah proses, termasuk saat error. Izin downloads dipakai menyimpan dan mengecek status; storage untuk preferensi; activeTab untuk tab yang dipilih melalui tindakan pengguna.

Pertanyaan privasi: [pemilik harus menambahkan kontak dukungan].

Pilihan Pilih lokasi membuka dialog File System Access browser hanya setelah klik pengguna. Gulir menulis PNG ke file yang dipilih pengguna. Handle file tidak disimpan oleh Gulir; browser dapat mengingat direktori terakhir untuk dialog. Jalur ini tidak memakai API downloads dan tidak mengunggah file.
