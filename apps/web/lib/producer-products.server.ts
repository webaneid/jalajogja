// Fondasi SISI SERVER "Produsen mengelola produk sendiri" — docs/arsitektur-produk-produsen.md § 12 (K21–K29).
// Semua fungsi menerima producerId/memberId dari SESI (ProducerAccessResult), TIDAK PERNAH dari body/URL.
//  - Kepemilikan: produk milik produsen lain / internal / mitra = "tidak ditemukan".
//  - Batas produk (K26): semua produk (draf+aktif+arsip) dihitung; hanya penghapusan yang membebaskan slot.
//  - Hapus (K22): ditolak bila ada pesanan LUNAS; mengubah/arsip bebas.
//  - Foto (K28): hanya Media Library anggota pemilik produsen; dipakai-produk tidak boleh dihapus.
import "server-only";
import { and, eq, ne, inArray, isNull, sql, count } from "drizzle-orm";
import { db as publicDb, createTenantDb, memberMedia, tenants } from "@jalajogja/db";
import { publicUrl } from "@/lib/minio";
import { pgErrorCode } from "@/lib/pg-error";
import { isValidUuid } from "@/lib/is-uuid";
import { randomUUID } from "crypto";
import { PRODUCER_PRODUCT_LIMITS, buildProductSlug, computeBaseCost, type ProducerProductImageInput, type ProducerProductInput, type ProducerVariationInput } from "@/lib/producer-products";
import { originBelongsTo } from "@/lib/shipping-origins.server";
import { DEFAULT_PRODUCER_PRODUCT_LIMIT } from "@/lib/producer-application";

type TenantDb = ReturnType<typeof createTenantDb>;
type TxLike = { db: TenantDb["db"]; schema: TenantDb["schema"] };

/** Bentuk foto yang disimpan di `products.images` (sama dengan form admin: toko/actions.ts ProductImage). */
export type StoredProductImage = {
  id: string; url: string; variants: Record<string, string> | null; alt: string; order: number;
};

// ── Kunci per produsen: serialisasi buat-produk (batas) dan hapus ───────────────────────────────────────────
export const lockProducer = (producerId: string) => sql`SELECT pg_advisory_xact_lock(hashtext(${"prodproduct:" + producerId}))`;

// ── Data komersial produsen (persentase + batas) ────────────────────────────────────────────────────────────
export type ProducerCommercials = { sharePercent: number | null; productLimit: number; isActive: boolean; memberId: string | null };

export async function getProducerCommercials(tc: TenantDb, producerId: string): Promise<ProducerCommercials | null> {
  const P = tc.schema.producers;
  const [r] = await tc.db.select({
    share: P.revenueSharePercent, limit: P.productLimit, isActive: P.isActive, memberId: P.memberId,
  }).from(P).where(eq(P.id, producerId)).limit(1);
  if (!r) return null;
  const share = r.share === null || r.share === undefined ? null : Number(r.share);
  return {
    sharePercent: share !== null && Number.isFinite(share) && share > 0 && share < 100 ? share : null,
    productLimit: r.limit ?? DEFAULT_PRODUCER_PRODUCT_LIMIT,
    isActive: r.isActive,
    memberId: r.memberId,
  };
}

// ── Kepemilikan & hitungan ──────────────────────────────────────────────────────────────────────────────────
/** Produk milik produsen ini (bukan mitra). null = tidak ada/bukan miliknya — jangan bedakan keduanya ke klien. */
export async function requireOwnedProduct(tc: TenantDb, producerId: string, productId: string) {
  if (!isValidUuid(productId)) return null;
  const P = tc.schema.products;
  const [row] = await tc.db.select().from(P)
    .where(and(eq(P.id, productId), eq(P.producerId, producerId), isNull(P.mitraId))).limit(1);
  return row ?? null;
}

/** K26: SEMUA produk produsen dihitung — draf, aktif, dan arsip. */
export async function countOwnedProducts(tc: TenantDb | { db: TenantDb["db"]; schema: TenantDb["schema"] }, producerId: string): Promise<number> {
  const P = tc.schema.products;
  const [{ n }] = await tc.db.select({ n: count() }).from(P).where(and(eq(P.producerId, producerId), isNull(P.mitraId)));
  return Number(n);
}

// ── Aturan hapus (K22) ──────────────────────────────────────────────────────────────────────────────────────
/**
 * Apakah produk (atau variasinya) punya pesanan LUNAS? Dua alur:
 *  - keranjang/invoice: invoice_items(item_type='product', item_id ∈ {produk, variasi}) pada invoices.status ∈ {paid, partial} (uang sudah masuk)
 *  - pesanan lama: order_items pada orders berstatus paid/processing/shipped/done (bukan pending/cancelled)
 */
export async function hasPaidOrders(tc: TenantDb | { db: TenantDb["db"]; schema: TenantDb["schema"] }, productId: string): Promise<boolean> {
  const { db, schema: s } = tc;
  const vars = await db.select({ id: s.productVariations.id }).from(s.productVariations).where(eq(s.productVariations.productId, productId));
  const ids = [productId, ...vars.map((v) => v.id)];

  const [inv] = await db.select({ id: s.invoiceItems.id }).from(s.invoiceItems)
    .innerJoin(s.invoices, eq(s.invoices.id, s.invoiceItems.invoiceId))
    .where(and(eq(s.invoiceItems.itemType, "product"), inArray(s.invoiceItems.itemId, ids), inArray(s.invoices.status, ["paid", "partial"])))
    .limit(1);
  if (inv) return true;

  const [old] = await db.select({ id: s.orderItems.id }).from(s.orderItems)
    .innerJoin(s.orders, eq(s.orders.id, s.orderItems.orderId))
    .where(and(inArray(s.orderItems.productId, ids), inArray(s.orders.status, ["paid", "processing", "shipped", "done"])))
    .limit(1);
  return !!old;
}

// ── Foto (K28) ──────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Ubah id Media Library anggota → objek foto produk. SEMUA id harus milik `memberId` (anggota pemilik produsen),
 * bukan media bertujuan khusus (resi), dan sudah selesai diproses; selain itu → null (tolak seluruhnya).
 * URL/varian di-resolve dari baris DB (bukan dari klien). Urutan mengikuti input.
 */
export async function resolveProductImages(memberId: string, input: ProducerProductImageInput[]): Promise<StoredProductImage[] | null> {
  const ids = input.map((i) => i.mediaId);
  if (ids.length === 0 || ids.length > PRODUCER_PRODUCT_LIMITS.imagesMax) return null;
  const rows = await publicDb.select().from(memberMedia)
    .where(and(inArray(memberMedia.id, ids), eq(memberMedia.memberId, memberId), isNull(memberMedia.purpose), eq(memberMedia.processingStatus, "done")));
  if (rows.length !== new Set(ids).size) return null;
  const byId = new Map(rows.map((r) => [r.id, r]));
  return input.map((it, order) => {
    const m = byId.get(it.mediaId)!;
    const resolved = m.variants
      ? Object.fromEntries(Object.entries(m.variants).map(([k, v]) => [k, publicUrl(m.sourceTenantSlug, v as string)]))
      : null;
    // Tampilan toko memakai variants.square (kartu) dan url (detail). Anggota tidak punya "square-large": pakai "large".
    const url = resolved?.large ?? resolved?.medium ?? publicUrl(m.sourceTenantSlug, m.path);
    return { id: m.id, url, variants: resolved, alt: it.alt, order };
  });
}

// ── Gambar di dalam deskripsi ────────────────────────────────────────────────────────────────────────────────
/**
 * Deskripsi (JSON Tiptap, SUDAH lewat sanitizeDescription) → bangun ulang `src` tiap node `image` dari Media Library anggota
 * `memberId`. Gambar yang bukan milik anggota ini / bertujuan khusus (resi) / belum selesai diproses DIBUANG. src dari klien tak pernah dipakai.
 */
export async function resolveDescriptionImages(memberId: string, description: string): Promise<string> {
  if (!description) return description;
  const doc = JSON.parse(description) as { content?: unknown[] };
  const ids = new Set<string>();
  const collect = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: string; attrs?: { mediaId?: string }; content?: unknown[] };
    if (node.type === "image" && node.attrs?.mediaId) ids.add(node.attrs.mediaId);
    node.content?.forEach(collect);
  };
  collect(doc);
  if (ids.size === 0) return description;
  const rows = await publicDb.select().from(memberMedia)
    .where(and(inArray(memberMedia.id, [...ids]), eq(memberMedia.memberId, memberId), isNull(memberMedia.purpose), eq(memberMedia.processingStatus, "done")));
  const urlById = new Map(rows.map((m) => {
    const v = m.variants as Record<string, string> | null;
    const path = v?.large ?? v?.medium ?? m.path;
    return [m.id, publicUrl(m.sourceTenantSlug, path)] as const;
  }));
  const rebuild = (n: unknown): unknown => {
    if (!n || typeof n !== "object") return n;
    const node = n as { type?: string; attrs?: Record<string, unknown>; content?: unknown[] };
    if (node.content) node.content = node.content.map(rebuild).filter((c) => c !== null);
    if (node.type === "image") {
      const url = urlById.get(String(node.attrs?.mediaId));
      return url ? { ...node, attrs: { src: url, alt: node.attrs?.alt ?? "", mediaId: node.attrs?.mediaId } } : null;
    }
    return node;
  };
  return JSON.stringify(rebuild(doc));
}

// ── Foto dipakai di mana? (hapus Media Library) ─────────────────────────────────────────────────────────────
/**
 * Dari `mediaIds` milik `memberId`, kembalikan id yang SEDANG dipakai produk (foto utama/galeri `products.images`, foto
 * variasi `product_variations.images`, atau gambar di deskripsi, termasuk produk arsip) di SEMUA tenant tempat anggota ini punya produk.
 * Tenant yang belum punya tabel produsen (42P01) dilewati; galat lain DILEMPAR (jangan fail-open → foto dipakai terhapus).
 */
export async function findMediaInUse(memberId: string, mediaIds: string[]): Promise<Set<string>> {
  const wanted = mediaIds.filter(isValidUuid);
  const used = new Set<string>();
  if (wanted.length === 0) return used;

  // SEMUA tenant aktif (bukan hanya yang anggota ini masih terdaftar di tenant_memberships): produsen yang keluar dari
  // keanggotaan kehilangan akses portal, tetapi produknya masih tayang dan fotonya masih dipakai. Tiap tenant hanya satu query ringan
  // (daftar produsen milik anggota); pemanggilnya jarang (hapus foto), jadi jumlah tenant bukan masalah.
  const slugs = await publicDb.select({ slug: tenants.slug }).from(tenants).where(eq(tenants.isActive, true));

  const inList = sql.join(wanted.map((id) => sql`${id}`), sql`, `);
  for (const { slug } of slugs) {
    try {
      const tc = createTenantDb(slug);
      const { db, schema: s } = tc;
      const owned = await db.select({ id: s.producers.id }).from(s.producers).where(eq(s.producers.memberId, memberId));
      if (owned.length === 0) continue;
      const pids = owned.map((o) => o.id);

      const inProducts = await db.select({ images: s.products.images }).from(s.products)
        .where(and(
          inArray(s.products.producerId, pids),
          sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${s.products.images}) e WHERE e->>'id' IN (${inList}))`,
        ));
      const inVariations = await db.select({ images: s.productVariations.images }).from(s.productVariations)
        .innerJoin(s.products, eq(s.products.id, s.productVariations.productId))
        .where(and(
          inArray(s.products.producerId, pids),
          sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${s.productVariations.images}) e WHERE e->>'id' IN (${inList}))`,
        ));
      // Foto yang disisipkan di DESKRIPSI (node image menyimpan "mediaId":"<uuid>") juga dihitung dipakai.
      for (const id of wanted) {
        const [d] = await db.select({ id: s.products.id }).from(s.products)
          .where(and(inArray(s.products.producerId, pids), sql`${s.products.description} LIKE ${'%"mediaId":"' + id + '"%'}`)).limit(1);
        if (d) used.add(id);
      }
      for (const r of [...inProducts, ...inVariations]) {
        for (const img of (Array.isArray(r.images) ? r.images : []) as Array<{ id?: string }>) {
          if (img?.id && wanted.includes(img.id)) used.add(img.id);
        }
      }
    } catch (e) {
      if (pgErrorCode(e) === "42P01") continue;   // tenant lama tanpa tabel itu = tidak ada produk produsen di sana
      throw e;
    }
  }
  return used;
}

// ── Penjaga batas pada transaksi pembuatan/aktivasi (dipanggil dari dalam tx yang sudah mengunci produsen) ─────
export async function assertWithinLimit(tx: { db: TenantDb["db"]; schema: TenantDb["schema"] }, producerId: string, limit: number): Promise<string | null> {
  const n = await countOwnedProducts(tx, producerId);
  return n >= limit
    ? `Batas produk tercapai (${limit}). Hapus produk yang tidak diperlukan, atau minta pengurus menaikkan batas Anda.`
    : null;
}

// ── Pembuatan produk (K21 langsung tayang, K24 harga dasar otomatis, K26 batas, K27 field terbatas) ────────────
export type ProducerAccessLite = { tenant: { slug: string }; producer: { id: string } };

/** Pemeriksaan komersial bersama buat/ubah: produsen aktif, punya anggota pemilik, dan persentase bagi hasil sudah ditetapkan. */
async function requireCommercials(tc: TenantDb, producerId: string): Promise<{ ok: true; c: ProducerCommercials & { sharePercent: number; memberId: string } } | { ok: false; error: string }> {
  const c = await getProducerCommercials(tc, producerId);
  if (!c || !c.isActive) return { ok: false, error: "Akun produsen tidak aktif." };
  if (!c.memberId) return { ok: false, error: "Produsen belum terhubung ke akun anggota." };
  if (c.sharePercent === null) return { ok: false, error: "Persentase bagi hasil Anda belum ditetapkan pengurus. Hubungi pengurus." };
  return { ok: true, c: { ...c, sharePercent: c.sharePercent, memberId: c.memberId } };
}

async function categoryExists(tc: TenantDb, id: string | null): Promise<boolean> {
  if (!id) return true;
  const [r] = await tc.db.select({ id: tc.schema.productCategories.id }).from(tc.schema.productCategories).where(eq(tc.schema.productCategories.id, id)).limit(1);
  return !!r;
}

/**
 * K24/K33: hitung ulang harga dasar SEMUA produk milik produsen (dan variasi yang punya harga jual sendiri) dari persentase `p`.
 * Dipanggil admin dalam transaksi yang sama dengan perubahan persentase. Variasi tanpa harga jual sendiri tidak disimpan (ikut induk).
 * Mengembalikan jumlah produk yang dihitung ulang.
 */
export async function syncBaseCosts(tx: TxLike, producerId: string, p: number): Promise<number> {
  const P = tx.schema.products, V = tx.schema.productVariations;
  const pct = p.toFixed(2);
  const synced = await tx.db.update(P)
    .set({ price: sql`ROUND(${P.publicPrice} * (100 - ${pct}::numeric) / 100, 2)`, updatedAt: new Date() })
    .where(and(eq(P.producerId, producerId), isNull(P.mitraId), sql`${P.publicPrice} IS NOT NULL`))
    .returning({ id: P.id });
  await tx.db.update(V)
    .set({ price: sql`ROUND(${V.publicPrice} * (100 - ${pct}::numeric) / 100, 2)` })
    .where(and(
      sql`${V.publicPrice} IS NOT NULL`,
      sql`${V.productId} IN (SELECT ${P.id} FROM ${P} WHERE ${P.producerId} = ${producerId} AND ${P.mitraId} IS NULL)`,
    ));
  return synced.length;
}

/** Persentase TERKINI dibaca DI DALAM transaksi dengan kunci baca pada baris produsen: perubahan persentase admin tidak bisa menyelip lalu tertimpa harga dasar lama. */
async function shareInTx(tx: TxLike, producerId: string, fallback: number): Promise<number> {
  const Pr = tx.schema.producers;
  const [r] = await tx.db.select({ share: Pr.revenueSharePercent }).from(Pr).where(eq(Pr.id, producerId)).for("share").limit(1);
  const n = r?.share === null || r?.share === undefined ? NaN : Number(r.share);
  return Number.isFinite(n) && n > 0 && n < 100 ? n : fallback;
}

/** Gudang: harus milik produsen ini; bila produsen punya >1 gudang, wajib dipilih (K31). null = ikut gudang utama produsen. */
async function checkOrigin(tc: TenantDb, producerId: string, originId: string | null): Promise<string | null> {
  if (originId) return (await originBelongsTo(tc, originId, producerId)) ? null : "Gudang tidak valid. Pilih salah satu gudang Anda.";
  const [{ n }] = await tc.db.select({ n: count() }).from(tc.schema.shippingOrigins).where(eq(tc.schema.shippingOrigins.producerId, producerId));
  return Number(n) > 1 ? "Pilih gudang pengiriman produk ini." : null;
}

/**
 * Gabungkan foto input dengan foto yang SUDAH ada: yang sudah ada dipertahankan apa adanya (boleh berasal dari Media Library
 * tenant, dipasang admin); yang baru WAJIB milik anggota pemilik produsen. Urutan dan alt mengikuti input. null = ada foto tidak sah.
 */
async function mergeImages(memberId: string, currentRaw: unknown, input: ProducerProductImageInput[]): Promise<StoredProductImage[] | null> {
  const current = new Map((Array.isArray(currentRaw) ? currentRaw : []).map((i) => [(i as StoredProductImage).id, i as StoredProductImage]));
  const fresh = input.filter((i) => !current.has(i.mediaId));
  const freshResolved = fresh.length ? await resolveProductImages(memberId, fresh) : [];
  if (!freshResolved) return null;
  const freshById = new Map(freshResolved.map((i) => [i.id, i]));
  return input.map((it, order) => ({ ...(current.get(it.mediaId) ?? freshById.get(it.mediaId)!), alt: it.alt, order }));
}


/**
 * Buang variasi yang tidak dikirim lagi. Variasi yang SUDAH dirujuk baris pesanan (invoice_items / order_items) hanya DINONAKTIFKAN —
 * dihapus akan membuat item_id di riwayat pesanan menunjuk ke id yang tidak ada (stok, fulfillment, laporan kehilangan konteks).
 */
async function dropVariations(tx: TxLike, productId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { db, schema: s } = tx;
  const V = s.productVariations;
  const usedInv = await db.select({ id: s.invoiceItems.itemId }).from(s.invoiceItems).where(and(eq(s.invoiceItems.itemType, "product"), inArray(s.invoiceItems.itemId, ids)));
  const usedOld = await db.select({ id: s.orderItems.productId }).from(s.orderItems).where(inArray(s.orderItems.productId, ids));
  const used = new Set([...usedInv.map((r) => r.id), ...usedOld.map((r) => r.id)].filter((x): x is string => !!x));
  const del = ids.filter((id) => !used.has(id));
  if (used.size) await db.update(V).set({ isActive: false }).where(and(eq(V.productId, productId), inArray(V.id, [...used])));
  if (del.length) await db.delete(V).where(and(eq(V.productId, productId), inArray(V.id, del)));
}

/**
 * Simpan variasi (K33) — diff-upsert seperti admin: variasi yang masih dikirim dipertahankan UUID-nya (keranjang pembeli tidak yatim).
 * Harga dasar variasi DIHITUNG server: bila variasi punya harga jual sendiri → jual × (100 − persen)/100; bila kosong → null (ikut induk).
 * Hanya variasi MILIK produk ini yang disentuh (id lain diperlakukan sebagai baru).
 */
async function saveVariations(
  tx: TxLike, productId: string, sharePercent: number, memberId: string,
  variations: ProducerVariationInput[], images: Map<number, StoredProductImage[]>,
): Promise<void> {
  const V = tx.schema.productVariations;
  const existing = await tx.db.select({ id: V.id }).from(V).where(eq(V.productId, productId));
  const existingIds = new Set(existing.map((r) => r.id));
  const keep = new Set(variations.filter((v) => v.id && existingIds.has(v.id)).map((v) => v.id!));
  await dropVariations(tx, productId, [...existingIds].filter((id) => !keep.has(id)));
  void memberId;
  for (let i = 0; i < variations.length; i++) {
    const v = variations[i];
    const values = {
      productId,
      sku:            v.sku,
      price:          v.publicPrice !== null ? computeBaseCost(v.publicPrice, sharePercent).toFixed(2) : null,
      publicPrice:    v.publicPrice !== null ? v.publicPrice.toFixed(2) : null,
      memberPrice:    v.memberPrice !== null ? v.memberPrice.toFixed(2) : null,
      stock:          v.stock,
      weightGram:     v.weightGram,
      images:         images.get(i) ?? [],
      attributeCombo: v.attributeCombo,
      isActive:       v.isActive,
    };
    if (v.id && existingIds.has(v.id)) await tx.db.update(V).set(values).where(and(eq(V.id, v.id), eq(V.productId, productId)));
    else await tx.db.insert(V).values(values);
  }
}

/** Foto tiap variasi: yang lama dipertahankan, yang baru wajib milik anggota. null = ada foto tidak sah. */
async function resolveVariationImages(memberId: string, productId: string | null, tc: TenantDb, variations: ProducerVariationInput[]): Promise<Map<number, StoredProductImage[]> | null> {
  const currentById = new Map<string, unknown>();
  if (productId) {
    const rows = await tc.db.select({ id: tc.schema.productVariations.id, images: tc.schema.productVariations.images })
      .from(tc.schema.productVariations).where(eq(tc.schema.productVariations.productId, productId));
    for (const r of rows) currentById.set(r.id, r.images);
  }
  const out = new Map<number, StoredProductImage[]>();
  for (let i = 0; i < variations.length; i++) {
    const v = variations[i];
    const merged = await mergeImages(memberId, v.id ? currentById.get(v.id) : [], v.images);
    if (!merged) return null;
    out.set(i, merged);
  }
  return out;
}

const SEO_COLS = (seo: ProducerProductInput["seo"]) => ({
  metaTitle: seo.metaTitle, metaDesc: seo.metaDesc, focusKeyword: seo.focusKeyword,
  ogTitle: seo.ogTitle, ogDescription: seo.ogDescription, twitterCard: seo.twitterCard,
});

const FREE_COLS = (f: ProducerProductInput["freeShipping"]) => ({
  freeShippingMode: f.mode, freeShippingProvinces: f.provinces, freeShippingCities: f.cities,
});

/** Slug/SKU produk harus unik di tenant ini (kolom unik DB). Mengembalikan pesan galat atau null. */
async function checkSlugSku(tc: TenantDb, input: ProducerProductInput, exceptId: string | null): Promise<string | null> {
  const P = tc.schema.products;
  const notSelf = exceptId ? ne(P.id, exceptId) : undefined;
  if (input.slug) {
    const [d] = await tc.db.select({ id: P.id }).from(P).where(and(eq(P.slug, input.slug), notSelf)).limit(1);
    if (d) return "Slug sudah digunakan produk lain.";
  }
  if (input.sku) {
    const [d] = await tc.db.select({ id: P.id }).from(P).where(and(eq(P.sku, input.sku), notSelf)).limit(1);
    if (d) return "SKU sudah digunakan produk lain.";
  }
  return null;
}

export async function createProducerProduct(access: ProducerAccessLite, input: ProducerProductInput): Promise<{ ok: true; productId: string } | { ok: false; error: string }> {
  const tc = createTenantDb(access.tenant.slug);
  const com = await requireCommercials(tc, access.producer.id);
  if (!com.ok) return com;

  const images = await resolveProductImages(com.c.memberId, input.images);
  if (!images) return { ok: false, error: "Foto tidak valid. Pilih foto dari Media Library Anda sendiri." };
  if (!com.c.memberId) return { ok: false, error: "Akun produsen belum tertaut ke anggota." };
  input = { ...input, description: await resolveDescriptionImages(com.c.memberId, input.description) };
  const varImages = await resolveVariationImages(com.c.memberId, null, tc, input.variations);
  if (!varImages) return { ok: false, error: "Foto variasi tidak valid. Pilih foto dari Media Library Anda sendiri." };
  if (!(await categoryExists(tc, input.categoryId))) return { ok: false, error: "Kategori tidak ditemukan." };
  const originErr = await checkOrigin(tc, access.producer.id, input.originId);
  if (originErr) return { ok: false, error: originErr };
  const dupErr = await checkSlugSku(tc, input, null);
  if (dupErr) return { ok: false, error: dupErr };

  const P = tc.schema.products;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const out = await tc.db.transaction(async (tx) => {
        await tx.execute(lockProducer(access.producer.id));
        const txl = { db: tx as unknown as TenantDb["db"], schema: tc.schema };
        const over = await assertWithinLimit(txl, access.producer.id, com.c.productLimit);
        if (over) return { error: over, id: undefined as string | undefined };
        const pct = await shareInTx(txl, access.producer.id, com.c.sharePercent);
        const [row] = await tx.insert(P).values({
          slug:        input.slug ?? buildProductSlug(input.name, randomUUID().slice(0, 8)),
          sku:         input.sku,
          ...SEO_COLS(input.seo),
          ...FREE_COLS(input.freeShipping),
          name:        input.name,
          description: input.description || null,
          price:       computeBaseCost(input.publicPrice, pct).toFixed(2),   // K24: read-only, bukan input
          publicPrice: input.publicPrice.toFixed(2),
          memberPrice: input.memberPrice !== null ? input.memberPrice.toFixed(2) : null,
          stock:       input.productType === "variable" ? 0 : input.stock,
          weightGram:  input.weightGram,
          originId:    input.originId,
          images,
          categoryId:  input.categoryId,
          producerId:  access.producer.id,         // dari SESI
          status:      input.status,               // K32: bawaan draft, produsen sendiri yang menayangkan
          productType: input.productType,
          attributeGroups: input.productType === "variable" ? input.attributeGroups : null,
        }).returning({ id: P.id });
        if (input.productType === "variable") await saveVariations(txl, row.id, pct, com.c.memberId, input.variations, varImages);
        return { error: undefined as string | undefined, id: row.id as string | undefined };
      });
      if (out.error || !out.id) return { ok: false, error: out.error ?? "Gagal membuat produk." };
      return { ok: true, productId: out.id };
    } catch (e) {
      if (pgErrorCode(e) === "23505") { if (input.slug || input.sku) return { ok: false, error: "Slug atau SKU sudah digunakan produk lain." }; continue; }   // slug otomatis bentrok (sangat jarang) → coba akhiran baru
      throw e;
    }
  }
  return { ok: false, error: "Gagal membuat produk. Coba lagi." };
}

// ── Ubah / status / hapus (K22: ubah BEBAS walau sudah dipesan; hapus ditolak bila ada pesanan lunas) ──────────
type Fail = { ok: false; error: string };
const NOT_FOUND: Fail = { ok: false, error: "Produk tidak ditemukan." };

export async function updateProducerProduct(access: ProducerAccessLite, productId: string, input: ProducerProductInput): Promise<{ ok: true } | Fail> {
  const tc = createTenantDb(access.tenant.slug);
  const com = await requireCommercials(tc, access.producer.id);
  if (!com.ok) return com;
  const row = await requireOwnedProduct(tc, access.producer.id, productId);
  if (!row) return NOT_FOUND;

  const images = await mergeImages(com.c.memberId, row.images, input.images);
  if (!images) return { ok: false, error: "Foto tidak valid. Pilih foto dari Media Library Anda sendiri." };
  if (!com.c.memberId) return { ok: false, error: "Akun produsen belum tertaut ke anggota." };
  input = { ...input, description: await resolveDescriptionImages(com.c.memberId, input.description) };
  const varImages = await resolveVariationImages(com.c.memberId, productId, tc, input.variations);
  if (!varImages) return { ok: false, error: "Foto variasi tidak valid. Pilih foto dari Media Library Anda sendiri." };
  if (!(await categoryExists(tc, input.categoryId))) return { ok: false, error: "Kategori tidak ditemukan." };
  const originErr = await checkOrigin(tc, access.producer.id, input.originId);
  if (originErr) return { ok: false, error: originErr };
  const dupErr = await checkSlugSku(tc, input, productId);
  if (dupErr) return { ok: false, error: dupErr };

  const P = tc.schema.products;
  try {
  return await tc.db.transaction(async (tx) => {
    const txl = { db: tx as unknown as TenantDb["db"], schema: tc.schema };
    const [cur] = await tx.select({ id: P.id, status: P.status }).from(P)
      .where(and(eq(P.id, productId), eq(P.producerId, access.producer.id), isNull(P.mitraId))).for("update").limit(1);
    if (!cur) return NOT_FOUND;
    const pct = await shareInTx(txl, access.producer.id, com.c.sharePercent);   // dibaca SETELAH baris produk terkunci
    const upd = await tx.update(P).set({
      name:        input.name,
      ...(input.slug ? { slug: input.slug } : {}),   // kosong = slug lama dipertahankan (tautan publik tidak putus)
      sku:         input.sku,
      ...SEO_COLS(input.seo),
      ...FREE_COLS(input.freeShipping),
      description: input.description || null,
      price:       computeBaseCost(input.publicPrice, pct).toFixed(2),   // K24: dihitung ulang dari persentase TERKINI
      publicPrice: input.publicPrice.toFixed(2),
      memberPrice: input.memberPrice !== null ? input.memberPrice.toFixed(2) : null,
      stock:       input.productType === "variable" ? 0 : input.stock,
      weightGram:  input.weightGram,
      originId:    input.originId,
      images,
      categoryId:  input.categoryId,
      productType: input.productType,
      attributeGroups: input.productType === "variable" ? input.attributeGroups : null,
      // K30: produk yang dibekukan admin TIDAK berubah statusnya dari sini (isi tetap boleh diperbaiki).
      ...(cur.status === "frozen" ? {} : { status: input.status }),
      updatedAt:   new Date(),
    }).where(and(eq(P.id, productId), eq(P.producerId, access.producer.id), isNull(P.mitraId))).returning({ id: P.id });
    if (!upd.length) return NOT_FOUND;
    if (input.productType === "variable") await saveVariations(txl, productId, pct, com.c.memberId, input.variations, varImages);
    else {   // kembali jadi produk sederhana: variasi dibuang (yang sudah dipesan hanya dinonaktifkan)
      const ids = (await tx.select({ id: tc.schema.productVariations.id }).from(tc.schema.productVariations).where(eq(tc.schema.productVariations.productId, productId))).map((r) => r.id);
      await dropVariations(txl, productId, ids);
    }
    return { ok: true as const };
  });
  } catch (e) {
    if (pgErrorCode(e) === "23505") return { ok: false, error: "Slug atau SKU sudah digunakan produk lain." };   // balapan setelah checkSlugSku
    throw e;
  }
}

/**
 * Ubah status antar draft / aktif / arsip (K32 — produsen menayangkan sendiri, seperti admin). Tidak perlu cek batas: semua status
 * dihitung (K26). Produk 'frozen' (dibekukan admin, K30) TIDAK bisa diubah dari sini (juga tak bisa dibekukan oleh produsen).
 */
export async function setProducerProductStatus(access: ProducerAccessLite, productId: string, status: "draft" | "active" | "archived"): Promise<{ ok: true } | Fail> {
  if (status !== "draft" && status !== "active" && status !== "archived") return { ok: false, error: "Status tidak valid." };
  const tc = createTenantDb(access.tenant.slug);
  const com = await getProducerCommercials(tc, access.producer.id);
  if (!com || !com.isActive) return { ok: false, error: "Akun produsen tidak aktif." };
  const P = tc.schema.products;
  const mine = and(eq(P.id, productId), eq(P.producerId, access.producer.id), isNull(P.mitraId));
  const upd = await tc.db.update(P).set({ status, updatedAt: new Date() }).where(and(mine, ne(P.status, "frozen"))).returning({ id: P.id });
  if (upd.length) return { ok: true };
  const [cur] = await tc.db.select({ status: P.status }).from(P).where(mine).limit(1);
  if (!cur) return NOT_FOUND;
  if (cur.status === "frozen") return { ok: false, error: "Produk ini dibekukan pengurus sehingga statusnya tidak bisa diubah dari portal. Hubungi pengurus." };
  return NOT_FOUND;
}

/** Hapus: ditolak bila ada pesanan LUNAS (cukup arsipkan). Menghapus membebaskan 1 slot (K26). */
export async function deleteProducerProduct(access: ProducerAccessLite, productId: string): Promise<{ ok: true } | Fail> {
  if (!isValidUuid(productId)) return NOT_FOUND;
  const tc = createTenantDb(access.tenant.slug);
  const com = await getProducerCommercials(tc, access.producer.id);
  if (!com || !com.isActive) return { ok: false, error: "Akun produsen tidak aktif." };
  const P = tc.schema.products;
  try {
    return await tc.db.transaction(async (tx) => {
      await tx.execute(lockProducer(access.producer.id));
      const [own] = await tx.select({ id: P.id, status: P.status }).from(P)
        .where(and(eq(P.id, productId), eq(P.producerId, access.producer.id), isNull(P.mitraId))).for("update").limit(1);
      if (!own) return NOT_FOUND;
      // K30: produk beku tidak bisa dihapus produsen (hapus + buat ulang = melewati pembekuan dan mengembalikan slot).
      if (own.status === "frozen") return { ok: false as const, error: "Produk ini dibekukan pengurus sehingga tidak bisa dihapus dari portal. Hubungi pengurus." };
      if (await hasPaidOrders({ db: tx as unknown as TenantDb["db"], schema: tc.schema }, productId)) {
        return { ok: false as const, error: "Produk ini sudah memiliki pesanan lunas sehingga tidak bisa dihapus. Arsipkan saja agar tidak tampil di toko." };
      }
      await tx.delete(tc.schema.productVariations).where(eq(tc.schema.productVariations.productId, productId));
      await tx.delete(P).where(and(eq(P.id, productId), eq(P.producerId, access.producer.id)));
      return { ok: true as const };
    });
  } catch (e) {
    if (pgErrorCode(e) === "23503") return { ok: false, error: "Produk masih dipakai data lain sehingga tidak bisa dihapus. Arsipkan saja." };
    throw e;
  }
}
