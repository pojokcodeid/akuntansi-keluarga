# Akuntansi Rumah Tangga

Aplikasi web pencatat keuangan keluarga. 100% di sisi klien: SQLite (sql.js/WebAssembly) disimpan di IndexedDB browser, tanpa server.

## Fitur
- Autentikasi PIN 4-6 angka (hash SHA-256 + salt, kunci otomatis, pembatasan percobaan)
- Akun/dompet, kategori, transaksi (pemasukan, pengeluaran, transfer) dengan filter
- Budget harian/mingguan/bulanan/kustom, global atau per kategori, auto-renew, sisa & batas aman harian
- Input nominal berformat titik ribuan otomatis
- Grafik pie & bar yang responsif di mobile
- Ekspor Excel (3 sheet), backup/restore `.sqlite`
- PWA: bisa di-install dan jalan offline setelah kunjungan pertama

## Struktur
```
index.html        halaman utama
css/style.css     gaya (mobile-first, mendukung dark mode)
js/app.js         seluruh logika aplikasi
sw.js             service worker (cache offline)
manifest.json     konfigurasi PWA
icons/            ikon 192 & 512
```

## Deploy ke GitHub Pages
1. Buat repository baru, unggah **isi** folder ini (index.html harus di root).
2. Settings > Pages > Source: *Deploy from a branch* > branch `main`, folder `/ (root)`.
3. Buka `https://<username>.github.io/<repo>/`. Kunjungan pertama butuh internet agar library ter-cache.

## Uji lokal
Service worker dan crypto memerlukan localhost/HTTPS:
```
python3 -m http.server 8000
```
lalu buka http://localhost:8000

## Catatan keamanan
PIN hanya mengunci tampilan aplikasi; data di browser tidak dienkripsi. Lupa PIN = hapus data situs di browser (data hilang), jadi rutin lakukan Backup di Pengaturan.
Library (sql.js, Chart.js, SheetJS) dimuat dari cdnjs dan di-cache oleh service worker. Untuk kemandirian penuh, unduh dan letakkan di folder `lib/`, lalu ubah URL di index.html dan sw.js.
