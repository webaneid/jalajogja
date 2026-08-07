// Opsi enum statis untuk form Usaha — Kategori, Legalitas, Posisi/Jabatan, Jumlah Karyawan,
// Jumlah Cabang, Omzet. Dulu di-re-declare independen di TIGA tempat: `akun/usaha/usaha-
// client.tsx` (self-service), `components/members/wizard/step4-business.tsx` (admin wizard),
// DAN `lib/import-anggota-mapping.ts` (validasi Excel bulk import) — plus KATEGORI_OPTIONS
// terpisah lagi di `usaha/page.tsx` + `usaha-filters-client.tsx` (filter arsip publik). Pola
// drift yang SAMA persis dengan yang sudah dikonsolidasi untuk Sektor (lihat
// `lib/business-sectors.ts`). Konsolidasi 2026-08-07.
//
// Konsolidasi ini SEKALIGUS menutup bug divergensi label yang sudah nyata ada: admin wizard
// (`step4-business.tsx`) sebelumnya membangun label via `.map(v => ({value:v, label:v}))` —
// untuk Karyawan/Cabang/Omzet, admin melihat RAW internal value sebagai label (mis. "1-4",
// "Dibawah 500jt", "500jt-1M"), BUKAN teks manusiawi seperti yang dilihat member di self-
// service ("1–4 orang", "Di bawah Rp 500 juta", "Rp 500 juta – 1 Miliar"). Versi kanonik di
// bawah ini MENGIKUTI label self-service (yang benar) — begitu admin wizard dikonsolidasi ke
// sini, admin otomatis melihat label yang sama bagusnya dengan member.
//
// Pola per field: `BUSINESS_XXX_ENUM` (plain readonly tuple, dipakai `exactMatch()` di importer
// Excel DAN sebagai basis type) + `XXX_COMBOBOX_OPTIONS` (bentuk `{value,label}[]` siap pakai
// untuk <Combobox>/<SimpleCombobox>). Untuk field yang label≠value (Karyawan/Cabang/Omzet),
// label diambil dari `Record<Enum[number], string>` — TypeScript memaksa lengkap (exhaustive)
// setiap kali enum bertambah nilai baru, jadi label tidak bisa lupa disertakan.
//
// ZERO import dari @jalajogja/db — aman dipakai client maupun server, sama seperti
// lib/business-sectors.ts.

// ── Kategori ─────────────────────────────────────────────────────────────────────────────
// "Praktisi" + "Akademisi" ditambahkan 2026-08-07 atas permintaan user — sama seperti Sektor
// "Kreatif", ini penambahan GLOBAL (kanonik, berlaku semua tenant) — TIDAK butuh migration
// (kolom public.member_businesses.category adalah text polos tanpa CHECK constraint, sudah
// dikonfirmasi via grep migrations, murni TS-level enum hint). Tenant yang tidak relevan bisa
// nonaktifkan lewat toggle categoryEnabled (lib/taxonomy-overrides.ts) — tidak perlu dihapus.
export const BUSINESS_CATEGORY_ENUM = [
  "Jasa", "Produsen", "Distributor", "Trading", "Profesional", "Praktisi", "Akademisi",
] as const;
export type BusinessCategory = typeof BUSINESS_CATEGORY_ENUM[number];
export const CATEGORY_COMBOBOX_OPTIONS = BUSINESS_CATEGORY_ENUM.map((v) => ({ value: v, label: v }));

// ── Legalitas ────────────────────────────────────────────────────────────────────────────
export const BUSINESS_LEGALITY_ENUM = [
  "PT Perseorangan", "PT", "CV", "Yayasan",
  "Perkumpulan", "Koperasi", "Belum Memiliki Legalitas",
] as const;
export type BusinessLegality = typeof BUSINESS_LEGALITY_ENUM[number];
export const LEGALITY_COMBOBOX_OPTIONS = BUSINESS_LEGALITY_ENUM.map((v) => ({ value: v, label: v }));

// ── Posisi / Jabatan ─────────────────────────────────────────────────────────────────────
export const BUSINESS_POSITION_ENUM = ["Komisaris", "Direktur", "Pengelola", "Manajer"] as const;
export type BusinessPosition = typeof BUSINESS_POSITION_ENUM[number];
export const POSITION_COMBOBOX_OPTIONS = BUSINESS_POSITION_ENUM.map((v) => ({ value: v, label: v }));

// ── Jumlah Karyawan ──────────────────────────────────────────────────────────────────────
export const BUSINESS_EMPLOYEES_ENUM = ["1-4", "5-10", "11-20", "Lebih dari 20"] as const;
export type BusinessEmployees = typeof BUSINESS_EMPLOYEES_ENUM[number];
const EMPLOYEES_LABELS: Record<BusinessEmployees, string> = {
  "1-4":           "1–4 orang",
  "5-10":          "5–10 orang",
  "11-20":         "11–20 orang",
  "Lebih dari 20": "Lebih dari 20",
};
export const EMPLOYEES_COMBOBOX_OPTIONS =
  BUSINESS_EMPLOYEES_ENUM.map((v) => ({ value: v, label: EMPLOYEES_LABELS[v] }));

// ── Jumlah Cabang ────────────────────────────────────────────────────────────────────────
export const BUSINESS_BRANCHES_ENUM = ["Tidak Ada", "1-3", "Diatas 3"] as const;
export type BusinessBranches = typeof BUSINESS_BRANCHES_ENUM[number];
const BRANCHES_LABELS: Record<BusinessBranches, string> = {
  "Tidak Ada": "Tidak Ada",
  "1-3":       "1–3 cabang",
  "Diatas 3":  "Di atas 3 cabang",
};
export const BRANCHES_COMBOBOX_OPTIONS =
  BUSINESS_BRANCHES_ENUM.map((v) => ({ value: v, label: BRANCHES_LABELS[v] }));

// ── Omzet Usaha ──────────────────────────────────────────────────────────────────────────
export const BUSINESS_REVENUE_ENUM = ["Dibawah 500jt", "500jt-1M", "1M-2M", "Diatas 2M"] as const;
export type BusinessRevenue = typeof BUSINESS_REVENUE_ENUM[number];
const REVENUE_LABELS: Record<BusinessRevenue, string> = {
  "Dibawah 500jt": "Di bawah Rp 500 juta",
  "500jt-1M":      "Rp 500 juta – 1 Miliar",
  "1M-2M":         "Rp 1 – 2 Miliar",
  "Diatas 2M":     "Di atas Rp 2 Miliar",
};
export const REVENUE_COMBOBOX_OPTIONS =
  BUSINESS_REVENUE_ENUM.map((v) => ({ value: v, label: REVENUE_LABELS[v] }));
