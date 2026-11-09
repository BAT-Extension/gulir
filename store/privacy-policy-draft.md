# Gulir — draft kebijakan privasi

DRAFT: belum dipublikasikan. Pemilik/pengelola, kontak dukungan dan tanggal berlaku perlu dilengkapi sebelum submit.

Gulir mengambil screenshot hanya ketika Anda menekan shortcut atau ikon. Konten halaman yang dipilih dapat memuat data pribadi; jangan mengambil gambar yang tidak ingin Anda simpan. Nama otomatis berasal dari waktu lokal. Gulir menggunakan akses debugger untuk mengukur, menggulir serta menangkap halaman. Halaman bisa menjalankan JavaScript sendiri ketika digulir.

Screenshot, nama file otomatis, dimensi, waktu pengambilan, peringatan atau error disimpan sementara pada IndexedDB lokal extension untuk preview. Gulir tidak mengunggah konten ini ke server, tidak memakai analytics, iklan, pelacakan browsing atau remote code. Situs yang Anda buka dan Chrome tetap bekerja sesuai layanan/kebijakannya masing-masing.

Capture yang lebih tua dari 24 jam dibersihkan saat capture berikutnya atau startup Chrome; bukan timer penghapusan tepat 24 jam. Menutup preview tidak langsung menghapus record. PNG yang disimpan tetap di folder lokal hingga Anda menghapusnya sendiri. Menghapus extension menghapus penyimpanan extension mengikuti perilaku Chrome, tetapi bukan PNG yang disimpan.

Tidak ada akun Gulir atau penjualan/transfer screenshot oleh Gulir kepada pihak ketiga. Data hanya digunakan untuk fungsi screenshot, preview dan simpan yang diminta pengguna. Penggunaan informasi dari API Google tunduk pada Chrome Web Store User Data Policy, termasuk persyaratan Limited Use.

Izin debugger memberi akses kuat pada tab untuk fungsi screenshot; sambungan dilepas setelah proses, termasuk saat error. Izin activeTab untuk tab yang dipilih melalui tindakan pengguna. Gulir tidak meminta izin downloads atau storage.

Pertanyaan privasi: [pemilik harus menambahkan kontak dukungan].

Dalam mode normal, tombol Simpan PNG atau Enter membuka dialog File System Access browser hanya setelah tindakan pengguna. Gulir menulis PNG ke file yang dipilih pengguna. Handle file tidak disimpan oleh Gulir; browser dapat mengingat direktori terakhir untuk dialog. Jalur ini tidak memakai API downloads dan tidak mengunggah file.

Preview memiliki countdown 60 detik, diulang saat pengguna mengedit dan ditunda selama penyimpanan. Batal atau gagal memulai 60 detik baru. Penyimpanan sukses langsung menutup preview, tanpa menghapus record sementara. Tidak ada fallback unduhan otomatis.

## Opsi simpan cepat (1.2.5)
Default nonaktif. Jika pengguna mengaktifkannya, preferensi dan FileSystemDirectoryHandle dari direktori yang dipilih secara eksplisit disimpan pada IndexedDB lokal ekstensi. Handle digunakan hanya untuk menyimpan screenshot ke direktori tersebut sesuai izin browser, tidak dikirim keluar. Izin dapat kedaluwarsa atau ditolak; pemilihan folder diperlukan kembali. Nonaktifkan centang untuk kembali ke dialog per-file. Preview menampilkan countdown 60 detik dan menutup setelah penyimpanan berhasil; penutupan tidak menghapus file PNG yang sudah disimpan.
