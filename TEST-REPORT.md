# Gulir 1.1.0 — laporan validasi MSI

## Hasil
Implementasi sekarang menghasilkan **satu PNG utuh**. Keluaran terpisah dari versi awal telah dihapus. Jalur captureBeyondViewport oversized yang sebelumnya mengulang bagian atas diganti dengan screenshot viewport nyata dan encoder PNG streaming.

- 31 unit test lulus.
- PNG tunggal 1280 × 35.000: dimensi, gradient interior, satu file unduhan, dan nama tanpa nomor bagian lulus.
- PNG tunggal 1280 × 70.001: decode preview, isi piksel melintasi 32K/64K, dan satu unduhan lulus.
- Canvas 20MP berisi data berentropi tinggi: capture dan decode lulus.
- Koordinat piksel 2D pada halaman 2203 × 2407, overflow horizontal, potongan terakhir, dan sambungan lulus.
- Fixed atas/bawah/kanan, keturunan visibility:visible, fixed dalam containing block translate, sticky !important, opacity dan posisi gulir dipulihkan.
- Halaman bertambah tinggi membatalkan hasil tanpa PNG sebagian; keadaan sticky/fixed dipulihkan.
- Nama/subfolder, duplikat tanpa menimpa, penolakan ../, retry, halaman terlarang, animasi, dan preferensi setelah browser restart lulus.
- Matriks 12 kombinasi native DPR 1 / 1,25 / 1,5 / 2 × zoom 100% / 125% / 200% memeriksa dimensi satu PNG dan gradient, bukan dimensi saja.
- Encoder diuji terhadap CRC, filter/scanline, alpha, data terpotong/berlebih, pembatalan, tinggi 70.001/120.000, dan batas byte.

## Lingkungan
MSI, Ubuntu-24.04 melalui WSL, Node 24.22.2, Playwright 1.63.0, Chrome for Testing 153.0.8010.12 headless. Profil, unduhan, dan server lokal seluruhnya khusus pengujian. Tidak memasang extension ke profil browser pribadi.

## Belum diverifikasi / batas
- Alt+S terdaftar, tetapi event keyboard headless tidak mengaktifkan accelerator browser. Aktivasi nyata di Chrome/Edge desktop belum diverifikasi.
- Hasil pada situs apa pun tidak dijamin. Capture berurutan dapat berbeda pada video, animasi, virtualized content, dan perubahan aplikasi akibat scroll.
- Nested scrollers/iframe tidak diperluas. Closed shadow DOM dan overflow negatif memiliki keterbatasan.
- Batas piksel/byte/waktu dan memori pembuka gambar tetap berlaku; kegagalan tidak menghasilkan output sebagian.

## Riwayat yang dipertahankan
Versi awal memiliki masalah test harness, normalisasi zoom, serta pengulangan konten pada screenshot oversized. Eksperimen pengulangan snapshot/stability guard dan viewport override yang tidak andal tidak digunakan. Log gagal tetap dipertahankan sebagai riwayat; tidak dianggap kelulusan.

Paket versi awal di Space bukan paket hasil perbaikan ini. Gunakan folder proyek terbaru atau ZIP versi 1.1.0 yang telah diverifikasi.
