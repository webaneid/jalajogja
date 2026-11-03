// Fondasi SISI SERVER "Produsen mengelola produk sendiri" — docs/arsitektur-produk-produsen.md § 12 (K21–K29).
// Semua fungsi menerima producerId/memberId dari SESI (ProducerAccessResult), TIDAK PERNAH dari body/URL.
//  - Kepemilikan: produk milik produsen lain / internal / mitra = "tidak ditemukan".
//  - Batas produk (K26): semua produk (draf+aktif+arsip) dihitung; hanya penghapusan yang membebaskan slot.
//  - Hapus (K22): ditolak bila ada pesanan LUNAS; mengubah/arsip bebas.
//  - Foto (K28): hanya Media Library anggota pemilik produsen; dipakai-produk tidak boleh dihapus.
import "server-only";
import { and, eq, inArray, isNull, sql, count } from "drizzle-orm";
import { db as publicDb, createTenantDb, memberMedia, tenants } from "@jalajogja/db";
import { publicUrl } from "@/lib/minio";
import { pgErrorCode } from "@/lib/pg-error";
import { isValidUuid } from "@/lib/is-uuid";
import { randomUUID } from "crypto";
import { PRODUCER_PRODUCT_LIMITS, buildProductSlug, computeBaseCost, type ProducerProductImageInput, type ProducerProductInput } from "@/lib/producer-products";
import { DEFAULT_PRODUCER_PRODUCT_LIMIT } from "@/lib/producer-application";

type TenantDb = ReturnType<typeof createTenantDb>;

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

// ── Foto dipakai di mana? (hapus Media Library) ─────────────────────────────────────────────────────────────
/**
 * Dari `mediaIds` milik `memberId`, kembalikan id yang SEDANG dipakai produk (foto utama/galeri `products.images` atau foto
 * variasi `product_variations.images`, termasuk produk arsip) di SEMUA tenant tempat anggota ini punya produk.
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

export async function createProducerProduct(access: ProducerAccessLite, input: ProducerProductInput): Promise<{ ok: true; productId: string } | { ok: false; error: string }> {
  const tc = createTenantDb(access.tenant.slug);
  const com = await requireCommercials(tc, access.producer.id);
  if (!com.ok) return com;

  const images = await resolveProductImages(com.c.memberId, input.images);
  if (!images) return { ok: false, error: "Foto tidak valid. Pilih foto dari Media Library Anda sendiri." };
  if (!(await categoryExists(tc, input.categoryId))) return { ok: false, error: "Kategori tidak ditemukan." };

  const P = tc.schema.products;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const out = await tc.db.transaction(async (tx) => {
        await tx.execute(lockProducer(access.producer.id));
        const over = await assertWithinLimit({ db: tx as unknown as TenantDb["db"], schema: tc.schema }, access.producer.id, com.c.productLimit);
        if (over) return { error: over, id: undefined as string | undefined };
        const [row] = await tx.insert(P).values({
          slug:        buildProductSlug(input.name, randomUUID().slice(0, 8)),
          name:        input.name,
          description: input.description || null,
          price:       computeBaseCost(input.publicPrice, com.c.sharePercent).toFixed(2),   // K24: read-only, bukan input
          publicPrice: input.publicPrice.toFixed(2),
          memberPrice: input.memberPrice !== null ? input.memberPrice.toFixed(2) : null,
          stock:       input.stock,
          weightGram:  input.weightGram,
          images,
          categoryId:  input.categoryId,
          producerId:  access.producer.id,         // dari SESI
          status:      "active",                   // K21
          productType: "simple",
        }).returning({ id: P.id });
        return { error: undefined as string | undefined, id: row.id as string | undefined };
      });
      if (out.error || !out.id) return { ok: false, error: out.error ?? "Gagal membuat produk." };
      return { ok: true, productId: out.id };
    } catch (e) {
      if (pgErrorCode(e) === "23505") continue;   // slug bentrok (sangat jarang) → coba akhiran baru
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
  if (row.productType === "variable") return { ok: false, error: "Produk bervariasi belum bisa diubah dari portal. Hubungi pengurus." };

  // Foto: yang SUDAH ada di produk ini dipertahankan apa adanya (boleh berasal dari Media Library tenant, dipasang admin);
  // yang baru WAJIB milik anggota pemilik produsen. Urutan dan alt mengikuti input.
  const current = new Map((Array.isArray(row.images) ? row.images : []).map((i) => [(i as StoredProductImage).id, i as StoredProductImage]));
  const fresh = input.images.filter((i) => !current.has(i.mediaId));
  const freshResolved = fresh.length ? await resolveProductImages(com.c.memberId, fresh) : [];
  if (!freshResolved) return { ok: false, error: "Foto tidak valid. Pilih foto dari Media Library Anda sendiri." };
  const freshById = new Map(freshResolved.map((i) => [i.id, i]));
  const images: StoredProductImage[] = input.images.map((it, order) => {
    const base = current.get(it.mediaId) ?? freshById.get(it.mediaId)!;
    return { ...base, alt: it.alt, order };
  });

  if (!(await categoryExists(tc, input.categoryId))) return { ok: false, error: "Kategori tidak ditemukan." };

  const P = tc.schema.products;
  const upd = await tc.db.update(P).set({
    name:        input.name,
    description: input.description || null,
    price:       computeBaseCost(input.publicPrice, com.c.sharePercent).toFixed(2),   // K24: dihitung ulang dari persentase TERKINI
    publicPrice: input.publicPrice.toFixed(2),
    memberPrice: input.memberPrice !== null ? input.memberPrice.toFixed(2) : null,
    stock:       input.stock,
    weightGram:  input.weightGram,
    images,
    categoryId:  input.categoryId,
    updatedAt:   new Date(),
  }).where(and(eq(P.id, productId), eq(P.producerId, access.producer.id), isNull(P.mitraId))).returning({ id: P.id });
  return upd.length ? { ok: true } : NOT_FOUND;
}

/** Arsip ⇄ aktif. Tidak perlu cek batas: arsip tetap dihitung (K26), jadi mengaktifkan kembali tidak menambah hitungan. */
export async function setProducerProductStatus(access: ProducerAccessLite, productId: string, status: "active" | "archived"): Promise<{ ok: true } | Fail> {
  if (status !== "active" && status !== "archived") return { ok: false, error: "Status tidak valid." };
  const tc = createTenantDb(access.tenant.slug);
  const com = await getProducerCommercials(tc, access.producer.id);
  if (!com || !com.isActive) return { ok: false, error: "Akun produsen tidak aktif." };
  const P = tc.schema.products;
  // Transisi yang diizinkan HANYA active ⇄ archived. Produk berstatus draft (dipasang admin) tidak bisa ditayangkan produsen:
  // statusnya ditentukan admin. (Catatan: belum ada penanda "dibekukan admin" — produsen masih bisa mengaktifkan produk yang
  // diarsipkan admin; lihat docs/arsitektur-produk-produsen.md § 13.2.)
  const from = status === "archived" ? "active" : "archived";
  const upd = await tc.db.update(P).set({ status, updatedAt: new Date() })
    .where(and(eq(P.id, productId), eq(P.producerId, access.producer.id), isNull(P.mitraId), eq(P.status, from))).returning({ id: P.id });
  if (upd.length) return { ok: true };
  const [cur] = await tc.db.select({ status: P.status }).from(P).where(and(eq(P.id, productId), eq(P.producerId, access.producer.id), isNull(P.mitraId))).limit(1);
  if (!cur) return NOT_FOUND;
  if (cur.status === status) return { ok: true };   // sudah di status itu (klik ganda / dua tab) — idempoten
  return { ok: false, error: "Status produk ini tidak bisa diubah dari portal. Hubungi pengurus." };
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
      const [own] = await tx.select({ id: P.id }).from(P)
        .where(and(eq(P.id, productId), eq(P.producerId, access.producer.id), isNull(P.mitraId))).for("update").limit(1);
      if (!own) return NOT_FOUND;
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
