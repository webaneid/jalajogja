export const dynamic = "force-dynamic";
// GET /api/members/import/template?slug={slug}
// Unduh template Excel untuk fitur Import Anggota — kolom + nilai PERSIS sama dengan skema
// kita sendiri (docs/arsitektur-import-anggota.md § 11/§ 14). Database eksternal manapun
// (termasuk yang lama/sudah ada) harus diubah dulu ke bentuk template ini sebelum diupload —
// tool ini TIDAK menerjemahkan/menebak struktur data eksternal.
//
// Kolom "Nomor Keanggotaan" SENGAJA generik (bukan menyebut nama forum tertentu) — kolom ini
// cuma relevan untuk tenant tipe forum yang PUNYA nomor keanggotaan historis, dan tetap boleh
// dikosongkan untuk forum yang belum punya penomoran apa pun (lihat docs/arsitektur-import-
// anggota.md § 14).

import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { asc, eq } from "drizzle-orm";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { db, refProfessions, refIkpmCabang } from "@jalajogja/db";
import {
  BUSINESS_CATEGORY_ENUM, BUSINESS_SECTOR_ENUM, BUSINESS_LEGALITY_ENUM, BUSINESS_POSITION_ENUM,
  BUSINESS_EMPLOYEES_ENUM, BUSINESS_BRANCHES_ENUM, BUSINESS_REVENUE_ENUM,
  WALI_SANTRI_DISPLAY_ENUM, DOMICILE_STATUS_DISPLAY_ENUM,
} from "@/lib/import-anggota-mapping";
import { SECTOR_SUB_FIELDS } from "@/lib/business-sectors";

// 45 kolom — HARUS sama persis (nama, urutan tidak masalah karena dicocokkan by-name) dengan
// TEMPLATE_HEADERS di lib/import-anggota.server.ts. Kalau menambah/mengubah kolom di sana,
// update juga di sini.
const HEADERS = [
  "Nomor Keanggotaan", "Nama", "NIK", "Jenis Kelamin", "Tanggal Lahir", "Tempat Lahir",
  "Alumni", "Periode Angkatan 1999", "No Stambuk Gontor", "Profesi", "PC IKPM Cabang", "Wali Santri", "Status Domisili",
  "No HP", "No WhatsApp", "Email",
  "Alamat", "Desa/Kelurahan", "Kecamatan", "Kabupaten/Kota", "Provinsi", "Kode Pos", "Negara",
  "Nama Usaha", "Deskripsi Usaha", "Kategori Usaha", "Sektor", "Bidang Usaha", "Produk", "Merk / Brand Produk",
  "Badan Hukum", "Posisi", "Jumlah Karyawan", "Jumlah Cabang", "Omzet Pertahun",
  "Alamat Usaha", "Kabupaten", "Provinsi", "Negara",
  "URL Facebook", "ID Instagram", "URL Tiktok", "Website", "Telepon Usaha", "WhatsApp Usaha",
];

const EXAMPLE_ROW = [
  "2026.00001", "Contoh Nama", "", "Laki-laki", "1990-05-17", "Yogyakarta",
  "2010", "", "", "Wirausaha", "PC IKPM Yogyakarta", "Bukan Wali Santri", "Domisili Tetap",
  "081234567890", "081234567890", "contoh@email.com",
  "Jalan Contoh No. 1", "", "Kecamatan Contoh", "Kabupaten Contoh", "Jawa Barat", "", "",
  "Nama Usaha Contoh", "Deskripsi singkat usaha",
  "Jasa", "Perdagangan, Ritel & F&B", "Kuliner Modern & F&B, Toko Ritel & Minimarket",
  "Produk/jasa yang ditawarkan", "Merk Contoh",
  "Belum Memiliki Legalitas", "Direktur", "1-4", "Tidak Ada", "Dibawah 500jt",
  "Jalan Usaha No. 1", "Kabupaten Contoh", "Jawa Barat", "", "", "", "", "", "", "",
];

function bulletList(values: readonly string[]): string[][] {
  return values.map((v) => [`  - ${v}`]);
}

function bulletListProfessions(rows: { category: string; name: string }[]): string[][] {
  return rows.map((r) => [`  - ${r.name} (${r.category})`]);
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return Response.json({ error: "slug diperlukan" }, { status: 400 });

  const access = await getTenantAccess(slug);
  if (!access) return Response.json({ error: "Akses ditolak." }, { status: 401 });
  if (!hasFullAccess(access.tenantUser, "anggota")) {
    return Response.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const [professionRows, cabangRows] = await Promise.all([
    db
      .select({ category: refProfessions.category, name: refProfessions.name })
      .from(refProfessions)
      .orderBy(refProfessions.category, refProfessions.order),
    db
      .select({ id: refIkpmCabang.id, nama: refIkpmCabang.nama, kode: refIkpmCabang.kode })
      .from(refIkpmCabang)
      .where(eq(refIkpmCabang.isActive, true))
      .orderBy(asc(refIkpmCabang.nama)),
  ]);

  const PANDUAN_ROWS: string[][] = [
    ["PANDUAN PENGISIAN — IMPORT ANGGOTA"],
    [""],
    ["PRINSIP UTAMA"],
    ["Kolom dan nilai di template ini HARUS diikuti persis. Kalau punya database lama dengan"],
    ["istilah berbeda (nama kolom lain, singkatan, dsb), ubah dulu SECARA MANUAL ke bentuk"],
    ["template ini sebelum upload — sistem TIDAK menerjemahkan/menebak istilah lain."],
    ["Kalau sebuah sel kosong atau nilainya tidak persis cocok dengan daftar baku di bawah,"],
    ["field itu akan DIBIARKAN KOSONG (bukan ditebak) — anggotanya melengkapi sendiri nanti"],
    ["setelah login."],
    [""],
    ["Nomor Keanggotaan (opsional, KHUSUS organisasi bertipe FORUM)"],
    ["- Kalau organisasi Anda BUKAN forum (cabang atau angkatan/marhalah), kolom ini SELALU"],
    ["  diabaikan sistem — apa pun yang diisi tidak akan tersimpan. Kosongkan saja."],
    ["- Untuk forum: HANYA relevan kalau sudah punya nomor keanggotaan historis sendiri"],
    ["  sebelum pindah ke sistem ini. Kosongkan kalau belum ada — sistem akan menomori"],
    ["  otomatis nanti saat anggota menyelesaikan pendaftaran sendiri."],
    ["- Diterima APA ADANYA sebagai teks, tidak divalidasi format tertentu. Kalau formatnya"],
    ["  persis \"TAHUN.URUTAN\" (misal 2017.00001), sistem otomatis melanjutkan nomor urut"],
    ["  berikutnya dari angka tertinggi yang ditemukan — format lain tetap tersimpan apa"],
    ["  adanya, hanya tidak ikut proses lanjutan nomor urut ini."],
    [""],
    ["Tanggal Lahir"],
    ["- Format YYYY-MM-DD (contoh: 1990-05-17) atau DD/MM/YYYY (contoh: 17/05/1990)"],
    [""],
    ["Periode Angkatan 1999"],
    ["- HANYA diisi kalau kolom Alumni = 1999 (Gontor punya dua angkatan di tahun itu)"],
    ["- Isi persis \"Awal\" atau \"Akhir\", atau kosongkan kalau tahun lulusnya bukan 1999"],
    [""],
    ["Profesi (pilih PERSIS salah satu, atau kosongkan):"],
    ...bulletListProfessions(professionRows),
    [""],
    ["PC IKPM Cabang (pilih PERSIS salah satu dari sheet 'Daftar PC IKPM Cabang', atau kosongkan):"],
    ...bulletList(cabangRows.map((c) => c.nama)),
    [""],
    ["Wali Santri (pilih PERSIS salah satu, atau kosongkan):"],
    ...bulletList(WALI_SANTRI_DISPLAY_ENUM),
    [""],
    ["Status Domisili (pilih PERSIS salah satu, atau kosongkan):"],
    ...bulletList(DOMICILE_STATUS_DISPLAY_ENUM),
    [""],
    ["Nomor HP / WhatsApp"],
    ["- Satu nomor per sel — jangan gabung 2 nomor dengan \"/\" atau \"atau\""],
    ["- Format sel sebagai TEKS (bukan Angka/General) sebelum mengetik nomor — kalau tidak,"],
    ["  nomor bisa berubah jadi notasi ilmiah dan rusak permanen tidak bisa diperbaiki otomatis"],
    ["- Boleh diawali 08..., 62..., atau +62... — sistem menormalkan otomatis"],
    [""],
    ["Email"],
    ["- Satu alamat per sel, format standar nama@domain.com"],
    ["- Jangan isi nomor HP atau username media sosial di kolom ini"],
    [""],
    ["Alamat"],
    ["- Provinsi, Kabupaten/Kota, Kecamatan, Desa/Kelurahan — pakai ejaan resmi BPS"],
    ["- Kolom Negara — kosongkan saja kalau alamatnya di Indonesia, isi HANYA kalau di luar negeri"],
    ["- Kode Pos — kosongkan saja kalau tidak tahu, sistem coba isi otomatis dari data Desa/"],
    ["  Kelurahan yang cocok kalau tersedia"],
    [""],
    ["Kategori Usaha (pilih PERSIS salah satu, case-insensitive):"],
    ...bulletList(BUSINESS_CATEGORY_ENUM),
    [""],
    ["Sektor & Bidang Usaha"],
    ["- Sektor: pilih PERSIS salah satu dari 10 nama sektor di bawah (baris \"SEKTOR: ...\")."],
    ["- Bidang Usaha: BEDA dari Sektor, boleh lebih dari satu nilai, pisahkan dengan koma dalam"],
    ["  SATU sel. Bebas ketik apa saja, TAPI disarankan pilih dari daftar di bawah tiap sektor"],
    ["  (tinggal copy-paste) — tidak harus sesuai Sektor yang dipilih, boleh ambil dari sektor"],
    ["  manapun. Contoh: \"Kuliner Modern & F&B, Toko Ritel & Minimarket\""],
    [""],
    ...BUSINESS_SECTOR_ENUM.flatMap((sector) => [
      [`SEKTOR: ${sector}`],
      ...bulletList(SECTOR_SUB_FIELDS[sector]),
      [""],
    ]),
    ["Badan Hukum (pilih PERSIS salah satu, atau kosongkan):"],
    ...bulletList(BUSINESS_LEGALITY_ENUM),
    [""],
    ["Posisi (pilih PERSIS salah satu, atau kosongkan):"],
    ...bulletList(BUSINESS_POSITION_ENUM),
    [""],
    ["Jumlah Karyawan (pilih PERSIS salah satu, atau kosongkan):"],
    ...bulletList(BUSINESS_EMPLOYEES_ENUM),
    [""],
    ["Jumlah Cabang (pilih PERSIS salah satu, atau kosongkan):"],
    ...bulletList(BUSINESS_BRANCHES_ENUM),
    [""],
    ["Omzet Pertahun (pilih PERSIS salah satu, atau kosongkan):"],
    ...bulletList(BUSINESS_REVENUE_ENUM),
  ];

  const wb = XLSX.utils.book_new();
  const dataSheet = XLSX.utils.aoa_to_sheet([HEADERS, EXAMPLE_ROW]);
  XLSX.utils.book_append_sheet(wb, dataSheet, "ANGGOTA RESMI");

  const panduanSheet = XLSX.utils.aoa_to_sheet(PANDUAN_ROWS);
  XLSX.utils.book_append_sheet(wb, panduanSheet, "Panduan");

  // Sheet 3: Referensi Resmi Daftar PC IKPM Cabang untuk memudahkan user copy-paste
  const cabangSheetRows = [
    ["Nama PC IKPM Cabang", "Kode Cabang"],
    ...cabangRows.map((c) => [c.nama, c.kode ?? ""]),
  ];
  const cabangSheet = XLSX.utils.aoa_to_sheet(cabangSheetRows);
  XLSX.utils.book_append_sheet(wb, cabangSheet, "Daftar PC IKPM Cabang");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=\"template-import-anggota.xlsx\"",
    },
  });
}
