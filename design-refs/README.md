# Design References

Folder ini **bukan bagian dari aplikasi** — Next.js tidak membaca folder ini sama sekali, jadi
tidak menambah beban build/runtime apa pun. Fungsinya cuma tempat parkir sumber desain (HTML/CSS
export, screenshot, dsb) yang jadi bahan mentah untuk dibangun ulang sebagai komponen React
mengikuti pola variant yang sudah ada — header, footer, section landing, card, dll (lihat
`docs/arsitektur-frontend-publik.md`).

## Cara pakai

1. Buat satu folder per desain: `design-refs/{nama-desain}/`
2. Taruh file sumber di dalamnya — `index.html` + `style.css` (kalau terpisah), atau langsung satu
   file HTML lengkap dengan `<style>` inline.
3. Kasih tahu Claude Code path-nya (mis. `design-refs/landing-baru/index.html`).
4. Claude Code akan **membaca desain lalu memecahnya per bagian** (header/hero/footer/section lain)
   — bukan mengambil satu file utuh jadi satu "tema" — karena arsitektur kita berbasis komponen
   lepas yang bisa dicampur-cocok per tenant (lihat § 4 `docs/arsitektur-frontend-publik.md`).
5. Tiap bagian yang relevan dikonversi jadi komponen React baru (varian baru di katalog yang sudah
   ada), pakai Tailwind + CSS variables tema tenant (`--primary`, `--secondary`, dst) — bukan warna
   hardcoded dari desain aslinya, supaya tetap otomatis ikut tema tiap organisasi.
6. Setelah jadi komponen, didaftarkan ke design picker admin (`/app/{slug}/settings/display`) supaya
   bisa dipilih tenant seperti varian yang sudah ada.

## Yang TIDAK diambil mentah-mentah

- Warna/font hardcoded dari desain sumber → diganti CSS variable tema tenant
- Library JS berat yang mungkin ada di export (animasi, dsb) → dievaluasi dulu, prioritas tetap
  ringan (lihat CLAUDE.md § "UI Standards" dan diskusi soal desain variatif tapi ringan)
- Struktur HTML yang tidak sesuai konvensi container (`max-w-7xl mx-auto px-4`) → disesuaikan

## Status folder ini

Boleh dibiarkan di git (isinya kecil, teks) sebagai riwayat/referensi — atau dihapus manual kalau
sudah tidak perlu setelah komponennya jadi. Tidak wajib dibersihkan, tidak mempengaruhi build.
