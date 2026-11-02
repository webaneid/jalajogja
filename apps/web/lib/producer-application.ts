// Utilitas MURNI Pengajuan Produsen (tanpa DB/sesi) — validasi isian + bentuk data untuk klien.
// Doc: docs/arsitektur-pengajuan-produsen.md § 7 (form), § 13 (berkas), § 14 (keamanan).
// Dipakai server (aksi/route) DAN klien (batas & pilihan), jadi TIDAK boleh import yang bersifat server-only.
import type {
  ProducerApplication, ProducerApplicationDocument, ProducerApplicationFile, ProducerApplicationSample,
} from "@jalajogja/db";
import { normalizePhone } from "@/lib/phone";

// ── Batas (satu sumber kebenaran; klien memakai untuk UI, server untuk penegakan) ──────────────────────
export const APP_MAX_SAMPLES   = 4;   // K12: minimal 1, tersedia 4 slot
export const APP_MAX_PROCESS   = 3;
export const APP_MAX_DOCUMENTS = 3;
export const APP_MAX_FILES     = APP_MAX_SAMPLES + APP_MAX_PROCESS + APP_MAX_DOCUMENTS; // 10 per draf
export const APP_MAX_LINKS     = 3;
export const APP_IMAGE_MAX_BYTES = 8 * 1024 * 1024;  // sebelum diproses ulang
export const APP_PDF_MAX_BYTES   = 5 * 1024 * 1024;  // PDF disimpan apa adanya
export const APP_DOC_KINDS = ["PIRT", "BPOM", "Halal", "NIB", "Lainnya"] as const;
export const APP_PROCESS_DAYS = [1, 2, 3] as const;  // ×24 jam
export const APP_FIELD_LIMITS = {
  brand: { min: 2, max: 100 }, categories: 200, description: { min: 20, max: 1000 },
  opsName: 100, teamSize: { min: 1, max: 999 }, link: 300, sampleName: 100, docNote: 200,
} as const;

// ── Bentuk yang dikirim ke KLIEN (tanpa `key` berkas) ───────────────────────────────────────────────────
export type FileView = { id: string; url: string; mime: string };
export type DraftView = {
  id:                  string;
  status:              ProducerApplication["status"];
  sourceType:          ProducerApplication["sourceType"];
  sourceId:            string | null;
  brandName:           string;
  productCategories:   string;
  description:         string;
  ownProductDeclared:  boolean;
  offeredSharePercent: string;          // teks supaya input terkontrol
  opsName:             string;
  opsWhatsapp:         string;          // E.164 atau ""
  teamSize:            string;
  processDays:         number | null;
  originRegencyId:     number | null;
  links:               string[];
  samples:             { id: string; name: string; estPriceUmum: number | null; estPriceAnggota: number | null; file: FileView | null }[];
  processFiles:        FileView[];
  documents:           { id: string; kind: string; note: string; file: FileView }[];
  rejectionReason:     string | null;
  submittedAt:         string | null;
  reviewedAt:          string | null;
  producerId:          string | null;
};

export function berkasUrl(slug: string, applicationId: string, fileId: string): string {
  return `/api/produsen/pengajuan/berkas?tenant=${encodeURIComponent(slug)}&app=${applicationId}&f=${fileId}`;
}

function fileView(slug: string, appId: string, f: ProducerApplicationFile): FileView {
  return { id: f.id, url: berkasUrl(slug, appId, f.id), mime: f.mime };
}

export function toDraftView(app: ProducerApplication, slug: string): DraftView {
  return {
    id: app.id, status: app.status, sourceType: app.sourceType ?? null, sourceId: app.sourceId ?? null,
    brandName: app.brandName ?? "", productCategories: app.productCategories ?? "", description: app.description ?? "",
    ownProductDeclared: app.ownProductDeclared,
    offeredSharePercent: app.offeredSharePercent != null ? String(Number(app.offeredSharePercent)) : "",
    opsName: app.opsName ?? "", opsWhatsapp: app.opsWhatsapp ?? "",
    teamSize: app.teamSize != null ? String(app.teamSize) : "",
    processDays: app.processDays ?? null, originRegencyId: app.originRegencyId ?? null,
    links: app.links ?? [],
    samples: (app.sampleProducts ?? []).map((s: ProducerApplicationSample) => ({
      id: s.id, name: s.name, estPriceUmum: s.estPriceUmum, estPriceAnggota: s.estPriceAnggota,
      file: s.file ? fileView(slug, app.id, s.file) : null,
    })),
    processFiles: (app.processMedia ?? []).map((f) => fileView(slug, app.id, f)),
    documents: (app.documentMedia ?? []).map((d: ProducerApplicationDocument) => ({
      id: d.id, kind: d.kind, note: d.note ?? "", file: fileView(slug, app.id, d.file),
    })),
    rejectionReason: app.rejectionReason ?? null,
    submittedAt: app.submittedAt?.toISOString() ?? null,
    reviewedAt: app.reviewedAt?.toISOString() ?? null,
    producerId: app.producerId ?? null,
  };
}

// ── Penyaringan isian DRAF (longgar: semua boleh kosong, tetapi yang terisi harus berbentuk benar) ──────
export type DraftInput = {
  sourceType?:          string | null;
  sourceId?:            string | null;
  brandName?:           string | null;
  productCategories?:   string | null;
  description?:         string | null;
  ownProductDeclared?:  boolean;
  offeredSharePercent?: string | number | null;
  opsName?:             string | null;
  opsWhatsapp?:         string | null;
  teamSize?:            string | number | null;
  processDays?:         number | null;
  originRegencyId?:     number | null;
  links?:               string[] | null;
  samples?:             { id?: string | null; name?: string | null; estPriceUmum?: number | string | null; estPriceAnggota?: number | string | null }[] | null;
};

export type ParsedDraft = {
  sourceType: "usaha" | "pesantren" | "profesional" | null;
  sourceId: string | null;
  brandName: string | null;
  productCategories: string | null;
  description: string | null;
  ownProductDeclared: boolean;
  offeredSharePercent: string | null;     // numeric(5,2) sebagai teks
  opsName: string | null;
  opsWhatsapp: string | null;
  teamSize: number | null;
  processDays: number | null;
  originRegencyId: number | null;
  links: string[];
  samples: { id: string | null; name: string; estPriceUmum: number | null; estPriceAnggota: number | null }[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};
const cleanMultiline = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/\r/g, "").trim();
  return t ? t.slice(0, max) : null;
};
function price(v: unknown): number | null | "bad" {
  if (v == null || v === "") return null;
  if (typeof v !== "number" && typeof v !== "string") return "bad";          // boolean/objek bukan harga
  const n = typeof v === "number" ? v : /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v.trim()) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) return "bad";
  return Math.round(n);
}

export function parseDraftInput(raw: unknown): { ok: true; value: ParsedDraft } | { ok: false; error: string } {
  // Server Action bisa dipanggil dengan JSON bebas → bentuk disaring dulu; tipe yang salah = galat bersih, bukan TypeError/500.
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, error: "Data tidak valid." };
  const input = raw as DraftInput;
  const strOrNull = (v: unknown) => (typeof v === "string" ? v : null);
  if ((input.links != null && !Array.isArray(input.links)) || (input.samples != null && !Array.isArray(input.samples))) return { ok: false, error: "Data tidak valid." };
  if (input.offeredSharePercent != null && typeof input.offeredSharePercent !== "string" && typeof input.offeredSharePercent !== "number") return { ok: false, error: "Persentase bagi hasil tidak valid." };
  if (input.teamSize != null && typeof input.teamSize !== "string" && typeof input.teamSize !== "number") return { ok: false, error: "Jumlah tim tidak valid." };
  if (input.processDays != null && typeof input.processDays !== "number") return { ok: false, error: "Waktu proses pesanan tidak valid." };
  if (input.originRegencyId != null && typeof input.originRegencyId !== "number") return { ok: false, error: "Kota asal tidak valid." };
  const sourceType = input.sourceType === "usaha" || input.sourceType === "pesantren" || input.sourceType === "profesional" ? input.sourceType : null;
  const sourceId = typeof input.sourceId === "string" && UUID_RE.test(input.sourceId) ? input.sourceId : null;
  if ((sourceType && !sourceId) || (!sourceType && sourceId)) return { ok: false, error: "Sumber usaha tidak valid." };

  // Persentase bagi hasil yang ditawarkan: 0 < p < 100, maksimal 2 desimal
  let share: string | null = null;
  if (input.offeredSharePercent != null && String(input.offeredSharePercent).trim() !== "") {
    const shareTxt = String(input.offeredSharePercent).trim().replace(",", ".");
    const n = /^\d+(\.\d+)?$/.test(shareTxt) ? Number(shareTxt) : NaN;      // tanpa "0x10"/"1e1"
    if (!Number.isFinite(n) || n <= 0 || n >= 100) return { ok: false, error: "Persentase bagi hasil harus lebih dari 0 dan kurang dari 100." };
    share = (Math.round(n * 100) / 100).toFixed(2);
  }

  let whatsapp: string | null = null;
  const waRaw = strOrNull(input.opsWhatsapp);
  if (waRaw && waRaw.trim()) {
    // normalizePhone tidak pernah null untuk teks non-kosong → bentuk E.164 divalidasi sendiri (jangan percaya PhoneInput klien)
    whatsapp = normalizePhone(waRaw);
    if (!whatsapp || !/^\+\d{8,15}$/.test(whatsapp)) return { ok: false, error: "Nomor WhatsApp penanggung jawab tidak valid." };
  }

  let teamSize: number | null = null;
  if (input.teamSize != null && String(input.teamSize).trim() !== "") {
    const teamTxt = String(input.teamSize).trim();
    const n = /^\d+$/.test(teamTxt) ? Number(teamTxt) : NaN;
    if (!Number.isInteger(n) || n < APP_FIELD_LIMITS.teamSize.min || n > APP_FIELD_LIMITS.teamSize.max) return { ok: false, error: "Jumlah tim harus bilangan 1–999." };
    teamSize = n;
  }

  let processDays: number | null = null;
  if (input.processDays != null) {
    if (!(APP_PROCESS_DAYS as readonly number[]).includes(input.processDays)) return { ok: false, error: "Waktu proses pesanan tidak valid." };
    processDays = input.processDays;
  }

  let originRegencyId: number | null = null;
  if (input.originRegencyId != null) {
    if (!Number.isInteger(input.originRegencyId) || input.originRegencyId <= 0) return { ok: false, error: "Kota asal tidak valid." };
    originRegencyId = input.originRegencyId;
  }

  // Tautan bukti: hanya https, ≤3, tanpa duplikat
  const links: string[] = [];
  for (const rawLink of (input.links ?? []).slice(0, 10)) {
    const t = clean(rawLink, APP_FIELD_LIMITS.link);
    if (!t) continue;
    let u: URL;
    try { u = new URL(t); } catch { return { ok: false, error: `Tautan tidak valid: ${t.slice(0, 40)}` }; }
    if (u.protocol !== "https:") return { ok: false, error: "Tautan bukti harus diawali https://" };
    if (u.username || u.password) return { ok: false, error: "Tautan tidak boleh memuat nama pengguna/kata sandi." };   // https://user:pass@host = trik phishing
    if (!links.includes(u.toString())) links.push(u.toString());
  }
  if (links.length > APP_MAX_LINKS) return { ok: false, error: `Maksimal ${APP_MAX_LINKS} tautan.` };

  const samples: ParsedDraft["samples"] = [];
  for (const s of (input.samples ?? []).slice(0, APP_MAX_SAMPLES)) {
    if (typeof s !== "object" || s === null) return { ok: false, error: "Data contoh produk tidak valid." };
    const pu = price(s.estPriceUmum), pa = price(s.estPriceAnggota);
    if (pu === "bad" || pa === "bad") return { ok: false, error: "Harga contoh produk tidak valid." };
    if (pu != null && pa != null && pa > pu) return { ok: false, error: "Harga anggota tidak boleh lebih tinggi dari harga umum." };
    const sid = typeof s.id === "string" && UUID_RE.test(s.id) ? s.id : null;
    samples.push({ id: sid, name: clean(s.name, APP_FIELD_LIMITS.sampleName) ?? "", estPriceUmum: pu, estPriceAnggota: pa });
  }
  if ((input.samples ?? []).length > APP_MAX_SAMPLES) return { ok: false, error: `Maksimal ${APP_MAX_SAMPLES} contoh produk.` };

  return { ok: true, value: {
    sourceType, sourceId,
    brandName: clean(input.brandName, APP_FIELD_LIMITS.brand.max),
    productCategories: clean(input.productCategories, APP_FIELD_LIMITS.categories),
    description: cleanMultiline(input.description, APP_FIELD_LIMITS.description.max),
    ownProductDeclared: input.ownProductDeclared === true,
    offeredSharePercent: share, opsName: clean(input.opsName, APP_FIELD_LIMITS.opsName), opsWhatsapp: whatsapp,
    teamSize, processDays, originRegencyId, links, samples,
  } };
}

/** Kelayakan KIRIM (ketat). Mengembalikan pesan galat pertama atau null. Dijalankan di server atas data draf TERSIMPAN. */
export function validateForSubmit(app: ProducerApplication): string | null {
  if (!app.sourceType || !app.sourceId) return "Pilih usaha / pesantren / data profesional yang diajukan.";
  const brand = app.brandName?.trim() ?? "";
  if (brand.length < APP_FIELD_LIMITS.brand.min) return "Nama brand wajib diisi (minimal 2 karakter).";
  if ((app.description?.trim().length ?? 0) < APP_FIELD_LIMITS.description.min) return "Deskripsi minimal 20 karakter.";
  if (!app.ownProductDeclared) return "Centang pernyataan bahwa produk dibuat/dimiliki sendiri.";
  if (app.offeredSharePercent == null) return "Persentase bagi hasil yang ditawarkan wajib diisi.";
  const p = Number(app.offeredSharePercent);
  if (!(p > 0 && p < 100)) return "Persentase bagi hasil harus lebih dari 0 dan kurang dari 100.";
  if (!app.opsName?.trim()) return "Nama penanggung jawab pesanan wajib diisi.";
  if (!app.opsWhatsapp) return "WhatsApp penanggung jawab pesanan wajib diisi.";
  if (app.teamSize == null) return "Jumlah orang di tim wajib diisi.";
  if (app.processDays == null) return "Kesanggupan waktu proses pesanan wajib dipilih.";
  if (!app.originRegencyId) return "Kota/kabupaten asal pengiriman wajib dipilih.";
  const samples = app.sampleProducts ?? [];
  if (samples.length < 1) return "Tambahkan minimal 1 contoh produk.";
  for (const s of samples) {
    if (!s.name.trim()) return "Setiap contoh produk wajib punya nama.";
    if (!s.file) return `Contoh produk "${s.name}" belum ada fotonya.`;
  }
  return null;
}
