# BBFS 7D Result Center

Website statis untuk menampilkan result pasaran, BBFS 7 digit, ranking 2D/3D, dan arsip result berbasis file JSON manual.

## Struktur File

```text
.
├── index.html
├── assets/
│   ├── css/style.css
│   └── js/app.js
└── data/
    └── results.json
```

## Cara Update Result

Edit file berikut:

```text
data/results.json
```

Contoh blok pasaran:

```json
{
  "name": "SINGAPORE",
  "status": "Aktif",
  "draw_time": "17:45 WIB",
  "latest_date": "2026-06-14",
  "latest_result": "1234",
  "bbfs_7d": ["1", "2", "3", "4", "5", "6", "7"]
}
```

Setelah file diubah dan di-commit, website akan membaca data terbaru.

## Deploy GitHub Pages

1. Buka repository settings.
2. Masuk ke menu **Pages**.
3. Pilih source: **Deploy from a branch**.
4. Pilih branch: **main**.
5. Pilih folder: **/root**.
6. Simpan.

URL biasanya menjadi:

```text
https://jhunaeycodex.github.io/BBFS-7D/
```

## Catatan

BBFS dan ranking di website ini adalah data/statistik/manual display. Tidak ada jaminan hasil dan bukan ajakan taruhan.
