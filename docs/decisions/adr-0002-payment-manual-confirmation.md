# ADR-0002: Semua Payment Wajib Konfirmasi Manual

**Status:** Accepted
**Tanggal:** 2026-09-06 (diekstrak dari CLAUDE.md, keputusan asli lebih awal)

## Context
Jalakarta menerima pembayaran lewat berbagai metode (cash, transfer bank, QRIS,
payment gateway) untuk donasi, belanja toko, dan iuran. Perlu keputusan konsisten
soal kapan sebuah pembayaran dianggap "lunas" di sistem.

## Decision
**Semua** metode pembayaran — termasuk QRIS dan payment gateway yang secara teknis
bisa auto-confirm via webhook — tetap butuh **konfirmasi manual** oleh admin/bendahara
sebelum status order/donasi berubah jadi lunas.

## Alternatif yang Dipertimbangkan
- **Auto-confirm via webhook gateway** — lebih cepat untuk end-user, tapi menghilangkan
  titik verifikasi manusia untuk kasus edge (pembayaran ganda, nominal tidak cocok,
  webhook gagal/duplikat) yang untuk organisasi non-profit/komunitas ini dianggap
  lebih penting daripada kecepatan.

## Konsekuensi
- Ada delay antara pembayaran masuk dan status "lunas" — perlu UI antrian konfirmasi
  yang jelas untuk admin.
- Mengurangi risiko kesalahan pencatatan double-entry (lihat `docs/arsitektur-keuangan.md`)
  karena tiap pemasukan/pengeluaran melewati review manusia.

---
> Aturan: file ADR TIDAK diedit setelah Accepted. Kalau keputusan berubah,
> buat ADR baru dan tulis "Supersedes ADR-0002" di file baru itu.
