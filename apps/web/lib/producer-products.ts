// Bagian MURNI (tanpa DB/jaringan, aman diimpor klien) dari fitur "Produsen mengelola produk sendiri".
// Docs: docs/arsitektur-produk-produsen.md § 12 (K21–K29). Semua nilai dari klien dianggap TIDAK TEPERCAYA:
// parseProductInput menerima `unknown` karena Server Action bisa dipanggil dengan JSON bebas.
import { isValidUuid } from "@/lib/is-uuid";

export const PRODUCER_PRODUCT_LIMITS = {
  nameMax:        120,
  descriptionMax: 60_000,   // JSON Tiptap tersimpan sebagai teks
  altMax:         160,
  imagesMin:      1,
  imagesMax:      8,
  variationsMax:  100,
  variationImagesMax: 4,
  attributeGroupsMax: 3,
  attributeValuesMax: 20,
  attributeNameMax:   40,
  skuMax:         64,
  priceMax:       1_000_000_000,   // Rp1 miliar per unit — batas kewajaran, bukan aturan bisnis
  stockMax:       1_000_000,
  weightMaxGram:  200_000,         // 200 kg
} as const;

/** Satu foto dalam input: HANYA id Media Library anggota + alt. URL/varian di-resolve server dari baris DB. */
export type ProducerProductImageInput = { mediaId: string; alt: string };

/** Status yang boleh dipilih produsen (K32). `frozen` hanya admin (K30). */
export const PRODUCER_SELECTABLE_STATUSES = ["draft", "active", "archived"] as const;
export type ProducerSelectableStatus = typeof PRODUCER_SELECTABLE_STATUSES[number];

/** Satu variasi dalam input. Kosong (null) = ikut produk induk — logika sama dengan form admin (K33). */
export type ProducerVariationInput = {
  id:             string | null;          // id variasi yang sudah ada (milik produk ini) atau null = baru
  sku:            string | null;
  publicPrice:    number | null;          // null = ikut harga jual induk
  memberPrice:    number | null;          // null = ikut harga anggota induk
  stock:          number;
  weightGram:     number | null;          // null = ikut berat induk
  images:         ProducerProductImageInput[];
  attributeCombo: Record<string, string>;
  isActive:       boolean;
};
export type ProducerAttributeGroup = { name: string; values: string[] };

export type ProducerProductInput = {
  name:        string;
  description: string;                       // JSON Tiptap ("" = kosong)
  categoryId:  string | null;
  images:      ProducerProductImageInput[];  // urutan = urutan tampil; [0] = foto utama
  publicPrice: number;                       // harga jual publik (wajib)
  memberPrice: number | null;                // null = sama dengan publik
  stock:       number;                       // produk bervariasi: diabaikan (stok = Σ stok variasi aktif)
  weightGram:  number;                       // WAJIB (ongkir)
  status:      ProducerSelectableStatus;     // K32: bawaan draft; produsen sendiri yang mengubah ke aktif
  originId:    string | null;                // gudang MILIK produsen; kepemilikan diverifikasi server
  productType: "simple" | "variable";
  attributeGroups: ProducerAttributeGroup[]; // [] bila simple
  variations:  ProducerVariationInput[];     // [] bila simple
};

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function toMoney(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}
function toInt(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isInteger(n) ? n : null;
}

// ── Deskripsi: daftar putih node/mark Tiptap untuk produsen ─────────────────────────────────────────────────
// Produsen BUKAN pengguna tenant: tanpa gambar/embed/galeri/tabel/tautan terkait/code (toolbar `basic` menyembunyikannya, tetapi
// JSON bisa dikirim langsung ke Server Action → server membuang semua yang di luar daftar, bukan sekadar percaya klien).
const ALLOWED_NODES = new Set(["doc", "paragraph", "heading", "text", "bulletList", "orderedList", "listItem", "blockquote", "hardBreak", "horizontalRule"]);
const ALLOWED_MARKS = new Set(["bold", "italic", "underline", "strike", "link"]);
const ALIGNS = new Set(["left", "center", "right", "justify"]);
const MAX_NODES = 3000, MAX_DEPTH = 12, MAX_TEXT_NODE = 5000;

type TNode = { type?: unknown; text?: unknown; attrs?: unknown; marks?: unknown; content?: unknown };

function cleanNode(n: unknown, depth: number, budget: { left: number }): Record<string, unknown> | null {
  if (!isRecord(n) || depth > MAX_DEPTH || budget.left-- <= 0) return null;
  const node = n as TNode;
  const type = node.type;
  if (typeof type !== "string" || !ALLOWED_NODES.has(type)) return null;
  const out: Record<string, unknown> = { type };

  if (type === "text") {
    if (typeof node.text !== "string" || node.text === "") return null;
    out.text = node.text.slice(0, MAX_TEXT_NODE);
    if (Array.isArray(node.marks)) {
      const marks: Array<Record<string, unknown>> = [];
      for (const m of node.marks) {
        if (!isRecord(m) || typeof m.type !== "string" || !ALLOWED_MARKS.has(m.type)) continue;
        if (m.type === "link") {
          const href = isRecord(m.attrs) && typeof m.attrs.href === "string" ? m.attrs.href.trim() : "";
          if (/^(https?:\/\/|mailto:|tel:)/i.test(href) && href.length <= 2000) marks.push({ type: "link", attrs: { href } });
        } else marks.push({ type: m.type });
      }
      if (marks.length) out.marks = marks;
    }
    return out;
  }

  if (type === "heading" || type === "paragraph") {
    const attrs: Record<string, unknown> = {};
    if (isRecord(node.attrs)) {
      if (typeof node.attrs.textAlign === "string" && ALIGNS.has(node.attrs.textAlign)) attrs.textAlign = node.attrs.textAlign;
      if (type === "heading") { const lv = Number(node.attrs.level); attrs.level = Number.isInteger(lv) && lv >= 2 && lv <= 4 ? lv : 2; }
    } else if (type === "heading") attrs.level = 2;
    if (Object.keys(attrs).length) out.attrs = attrs;
  }

  if (Array.isArray(node.content)) {
    const kids = node.content.map((c) => cleanNode(c, depth + 1, budget)).filter((c): c is Record<string, unknown> => c !== null);
    if (kids.length) out.content = kids;
  }
  return out;
}

/**
 * Deskripsi → JSON Tiptap TERSANITASI (hanya node/mark dalam daftar putih). "" = kosong. Gagal parse / bukan dokumen → galat.
 * Mengembalikan string yang SUDAH dibersihkan: simpan yang ini, bukan input klien.
 */
export function sanitizeDescription(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  if (raw === "") return { ok: true, value: "" };
  if (raw.length > PRODUCER_PRODUCT_LIMITS.descriptionMax) return { ok: false, error: "Deskripsi terlalu panjang." };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, error: "Format deskripsi tidak valid." }; }
  if (!isRecord(parsed) || parsed.type !== "doc") return { ok: false, error: "Format deskripsi tidak valid." };
  const cleaned = cleanNode(parsed, 0, { left: MAX_NODES }) ?? { type: "doc" };
  return { ok: true, value: JSON.stringify(cleaned) };
}


function parseImages(raw: unknown, max: number): Parsed<ProducerProductImageInput[]> {
  if (!Array.isArray(raw)) return { ok: false, error: "Foto produk tidak valid." };
  if (raw.length > max) return { ok: false, error: `Maksimal ${max} foto.` };
  const out: ProducerProductImageInput[] = [];
  const seen = new Set<string>();
  for (const it of raw) {
    if (!isRecord(it) || typeof it.mediaId !== "string" || !isValidUuid(it.mediaId)) return { ok: false, error: "Foto produk tidak valid." };
    if (seen.has(it.mediaId)) return { ok: false, error: "Foto yang sama dipilih lebih dari sekali." };
    seen.add(it.mediaId);
    out.push({ mediaId: it.mediaId, alt: typeof it.alt === "string" ? it.alt.trim().slice(0, PRODUCER_PRODUCT_LIMITS.altMax) : "" });
  }
  return { ok: true, value: out };
}

function parseAttributeGroups(raw: unknown): Parsed<ProducerAttributeGroup[]> {
  const L = PRODUCER_PRODUCT_LIMITS;
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "Produk bervariasi butuh minimal satu atribut (mis. Ukuran)." };
  if (raw.length > L.attributeGroupsMax) return { ok: false, error: `Maksimal ${L.attributeGroupsMax} atribut.` };
  const out: ProducerAttributeGroup[] = [];
  const names = new Set<string>();
  for (const g of raw) {
    if (!isRecord(g) || typeof g.name !== "string" || !Array.isArray(g.values)) return { ok: false, error: "Atribut tidak valid." };
    const name = g.name.trim().replace(/\s+/g, " ");
    if (!name || name.length > L.attributeNameMax) return { ok: false, error: "Nama atribut tidak valid." };
    if (names.has(name.toLowerCase())) return { ok: false, error: "Nama atribut tidak boleh sama." };
    names.add(name.toLowerCase());
    const values: string[] = [];
    for (const v of g.values) {
      if (typeof v !== "string") return { ok: false, error: "Nilai atribut tidak valid." };
      const val = v.trim().replace(/\s+/g, " ");
      if (!val || val.length > L.attributeNameMax) return { ok: false, error: "Nilai atribut tidak valid." };
      if (!values.some((x) => x.toLowerCase() === val.toLowerCase())) values.push(val);
    }
    if (values.length === 0) return { ok: false, error: `Atribut "${name}" butuh minimal satu nilai.` };
    if (values.length > L.attributeValuesMax) return { ok: false, error: `Atribut "${name}" maksimal ${L.attributeValuesMax} nilai.` };
    out.push({ name, values });
  }
  return { ok: true, value: out };
}

function parseVariations(raw: unknown, groups: ProducerAttributeGroup[], parentPublic: number): Parsed<ProducerVariationInput[]> {
  const L = PRODUCER_PRODUCT_LIMITS;
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "Produk bervariasi butuh minimal satu variasi." };
  if (raw.length > L.variationsMax) return { ok: false, error: `Maksimal ${L.variationsMax} variasi.` };
  const out: ProducerVariationInput[] = [];
  const combos = new Set<string>();
  const ids = new Set<string>();
  for (const v of raw) {
    if (!isRecord(v)) return { ok: false, error: "Variasi tidak valid." };
    let id: string | null = null;
    if (v.id !== null && v.id !== undefined && v.id !== "") {
      if (typeof v.id !== "string" || !isValidUuid(v.id)) return { ok: false, error: "Variasi tidak valid." };
      if (ids.has(v.id)) return { ok: false, error: "Variasi ganda." };
      ids.add(v.id); id = v.id;
    }
    // Kombinasi atribut: persis satu nilai per atribut, dan nilainya harus ada di daftar atribut.
    if (!isRecord(v.attributeCombo)) return { ok: false, error: "Kombinasi variasi tidak valid." };
    const combo: Record<string, string> = {};
    for (const g of groups) {
      const val = v.attributeCombo[g.name];
      if (typeof val !== "string" || !g.values.includes(val)) return { ok: false, error: "Kombinasi variasi tidak sesuai atribut." };
      combo[g.name] = val;
    }
    if (Object.keys(v.attributeCombo).length !== groups.length) return { ok: false, error: "Kombinasi variasi tidak sesuai atribut." };
    const key = JSON.stringify(groups.map((g) => combo[g.name]));
    if (combos.has(key)) return { ok: false, error: "Ada kombinasi variasi yang sama." };
    combos.add(key);

    let sku: string | null = null;
    if (typeof v.sku === "string" && v.sku.trim() !== "") { sku = v.sku.trim(); if (sku.length > L.skuMax) return { ok: false, error: "SKU variasi terlalu panjang." }; }

    let publicPrice: number | null = null;
    if (v.publicPrice !== null && v.publicPrice !== undefined && v.publicPrice !== "") {
      publicPrice = toMoney(v.publicPrice);
      if (publicPrice === null || !(publicPrice > 0) || publicPrice > L.priceMax) return { ok: false, error: "Harga jual variasi tidak valid." };
    }
    let memberPrice: number | null = null;
    if (v.memberPrice !== null && v.memberPrice !== undefined && v.memberPrice !== "") {
      memberPrice = toMoney(v.memberPrice);
      if (memberPrice === null || !(memberPrice > 0)) return { ok: false, error: "Harga anggota variasi tidak valid." };
      if (memberPrice > (publicPrice ?? parentPublic)) return { ok: false, error: "Harga anggota variasi tidak boleh lebih tinggi dari harga jualnya." };
    }
    const stock = toInt(v.stock);
    if (stock === null || stock < 0 || stock > L.stockMax) return { ok: false, error: "Stok variasi harus bilangan bulat 0 atau lebih." };
    let weightGram: number | null = null;
    if (v.weightGram !== null && v.weightGram !== undefined && v.weightGram !== "") {
      weightGram = toInt(v.weightGram);
      if (weightGram === null || weightGram < 1 || weightGram > L.weightMaxGram) return { ok: false, error: "Berat variasi tidak valid." };
    }
    const imgs = parseImages(v.images ?? [], L.variationImagesMax);
    if (!imgs.ok) return imgs;
    out.push({ id, sku, publicPrice, memberPrice, stock, weightGram, images: imgs.value, attributeCombo: combo, isActive: v.isActive !== false });
  }
  return { ok: true, value: out };
}

export function parseProductInput(input: unknown): Parsed<ProducerProductInput> {
  if (!isRecord(input)) return { ok: false, error: "Data produk tidak valid." };
  const L = PRODUCER_PRODUCT_LIMITS;

  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 3) return { ok: false, error: "Nama produk minimal 3 karakter." };
  if (name.length > L.nameMax) return { ok: false, error: `Nama produk maksimal ${L.nameMax} karakter.` };

  const descRes = sanitizeDescription(typeof input.description === "string" ? input.description : "");
  if (!descRes.ok) return { ok: false, error: descRes.error };
  const description = descRes.value;

  let categoryId: string | null = null;
  if (input.categoryId !== null && input.categoryId !== undefined && input.categoryId !== "") {
    if (typeof input.categoryId !== "string" || !isValidUuid(input.categoryId)) return { ok: false, error: "Kategori tidak valid." };
    categoryId = input.categoryId;
  }

  const imgRes = parseImages(input.images, L.imagesMax);
  if (!imgRes.ok) return imgRes;
  if (imgRes.value.length < L.imagesMin) return { ok: false, error: "Minimal 1 foto produk." };
  const images = imgRes.value;

  const publicPrice = toMoney(input.publicPrice);
  if (publicPrice === null || !(publicPrice > 0)) return { ok: false, error: "Harga jual wajib diisi." };
  if (publicPrice > L.priceMax) return { ok: false, error: "Harga jual terlalu besar." };

  let memberPrice: number | null = null;
  if (input.memberPrice !== null && input.memberPrice !== undefined && input.memberPrice !== "") {
    memberPrice = toMoney(input.memberPrice);
    if (memberPrice === null || !(memberPrice > 0)) return { ok: false, error: "Harga anggota tidak valid." };
    if (memberPrice > publicPrice) return { ok: false, error: "Harga anggota tidak boleh lebih tinggi dari harga jual." };
  }

  const stock = toInt(input.stock);
  if (stock === null || stock < 0 || stock > L.stockMax) return { ok: false, error: "Stok harus bilangan bulat 0 atau lebih." };

  const weightGram = toInt(input.weightGram);
  if (weightGram === null || weightGram < 1) return { ok: false, error: "Berat (gram) wajib diisi." };
  if (weightGram > L.weightMaxGram) return { ok: false, error: "Berat terlalu besar." };

  // K32: status bawaan draft; produsen hanya boleh draft/aktif/arsip (frozen = hanya admin).
  let status: ProducerSelectableStatus = "draft";
  if (input.status !== undefined && input.status !== null) {
    if (typeof input.status !== "string" || !(PRODUCER_SELECTABLE_STATUSES as readonly string[]).includes(input.status)) return { ok: false, error: "Status tidak valid." };
    status = input.status as ProducerSelectableStatus;
  }

  let originId: string | null = null;
  if (input.originId !== null && input.originId !== undefined && input.originId !== "") {
    if (typeof input.originId !== "string" || !isValidUuid(input.originId)) return { ok: false, error: "Gudang tidak valid." };
    originId = input.originId;
  }

  let productType: "simple" | "variable" = "simple";
  let attributeGroups: ProducerAttributeGroup[] = [];
  let variations: ProducerVariationInput[] = [];
  if (input.productType === "variable") {
    productType = "variable";
    const g = parseAttributeGroups(input.attributeGroups);
    if (!g.ok) return g;
    attributeGroups = g.value;
    const v = parseVariations(input.variations, attributeGroups, publicPrice);
    if (!v.ok) return v;
    variations = v.value;
  } else if (input.productType !== undefined && input.productType !== "simple") {
    return { ok: false, error: "Tipe produk tidak valid." };
  }

  return { ok: true, value: { name, description, categoryId, images, publicPrice, memberPrice, stock: productType === "variable" ? 0 : stock, weightGram, status, originId, productType, attributeGroups, variations } };
}

/**
 * K24 — Harga Dasar (modal) otomatis = harga jual publik × (100 − persen tenant) / 100, dibulatkan 2 desimal.
 * Hanya untuk TAMPILAN/rekap; laba & pencairan memakai persentase × uang yang dibayar (K25), bukan angka ini.
 */
export function computeBaseCost(publicPrice: number, sharePercent: number): number {
  return Math.round(publicPrice * (100 - sharePercent)) / 100;
}

/** Slug unik: nama → slug + akhiran acak pendek (cegah tabrakan antar produsen tanpa query berulang). */
export function buildProductSlug(name: string, suffix: string): string {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60).replace(/^-|-$/g, "");
  return `${base || "produk"}-${suffix}`;
}
