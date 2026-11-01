// Asal kirim (gudang/pabrik/toko): indeks pembaca + CRUD terikat PEMILIK. Pemilik (scope) ditentukan PEMANGGIL dari sesi/otorisasi —
// produsen: getProducerAccess; admin: getTenantAccess+hasFullAccess(toko). Setiap query menyertakan kolom pemilik (anti-IDOR antar
// produsen). Doc: docs/arsitektur-alamat.md § 20.
import "server-only";
import { and, asc, count, desc, eq, isNull, ne, sql, type SQL } from "drizzle-orm";
import { db as publicDb, roDestinations, type TenantDb } from "@jalajogja/db";
import { MAX_ORIGINS_PER_OWNER, type OriginDTO, type OriginIndex, type OriginInput, type ResolvedOrigin } from "@/lib/shipping-origins";

/** Pemilik asal: produsen tertentu, atau toko/internal (producerId null). */
export type OriginScope = { producerId: string | null };

const scopeEq = (tc: TenantDb, scope: OriginScope): SQL =>
  scope.producerId ? eq(tc.schema.shippingOrigins.producerId, scope.producerId) : isNull(tc.schema.shippingOrigins.producerId);

function baseSelect(tc: TenantDb) {
  const O = tc.schema.shippingOrigins;
  return tc.db.select({
    id: O.id, producerId: O.producerId, label: O.label, detail: O.detail, isDefault: O.isDefault,
    dId: roDestinations.id, dLabel: roDestinations.label, dCity: roDestinations.cityName, dDistrict: roDestinations.districtName,
    dSub: roDestinations.subdistrictName, dProv: roDestinations.provinceName, dZip: roDestinations.zipCode,
  }).from(O).innerJoin(roDestinations, eq(roDestinations.id, O.destinationId));
}
type Row = Awaited<ReturnType<ReturnType<typeof baseSelect>["limit"]>>[number];
const toDto = (r: Row): OriginDTO => ({
  id: r.id, producerId: r.producerId, label: r.label, detail: r.detail, isDefault: r.isDefault,
  destination: { id: r.dId, label: r.dLabel, cityName: r.dCity, districtName: r.dDistrict, subdistrictName: r.dSub, provinceName: r.dProv, zipCode: r.dZip },
});
const toResolved = (r: Row): ResolvedOrigin => ({
  id: r.id, producerId: r.producerId, cityId: r.dId, fullLabel: r.dLabel, name: r.label, addressDetail: r.detail,
});

export async function listOrigins(tc: TenantDb, scope: OriginScope): Promise<OriginDTO[]> {
  const O = tc.schema.shippingOrigins;
  return (await baseSelect(tc).where(scopeEq(tc, scope)).orderBy(desc(O.isDefault), asc(O.createdAt))).map(toDto);
}

/** Semua asal tenant (semua pemilik) — untuk halaman admin & form produk. */
export async function listAllOrigins(tc: TenantDb): Promise<OriginDTO[]> {
  const O = tc.schema.shippingOrigins;
  return (await baseSelect(tc).orderBy(desc(O.isDefault), asc(O.createdAt))).map(toDto);
}

/**
 * Indeks asal untuk penentuan kelompok paket. Gagal baca (tabel belum ada karena migration 0088 terlambat) → indeks KOSONG
 * + log — jangan merusak checkout publik (pemanggil menganggap tidak ada asal → paket dilewati seperti "kota asal tak diketahui").
 * `activeProducerIds` (opsional): hanya asal milik produsen AKTIF yang masuk indeks produsen.
 */
export async function loadOriginIndex(tc: TenantDb, opts: { strict?: boolean } = {}): Promise<OriginIndex> {
  const idx: OriginIndex = { byId: new Map(), producerDefault: new Map(), tenantDefault: null };
  try {
    const P = tc.schema.producers;
    const rows = await baseSelect(tc)
      .leftJoin(P, eq(P.id, tc.schema.shippingOrigins.producerId))
      .where(sql`(${tc.schema.shippingOrigins.producerId} IS NULL OR ${P.isActive} = true)`); // produsen nonaktif: asalnya tak dipakai (produknya tak bisa dipesan)
    for (const r of rows as unknown as Row[]) {
      const o = toResolved(r);
      idx.byId.set(o.id, o);
      if (r.isDefault) { if (o.producerId) idx.producerDefault.set(o.producerId, o); else idx.tenantDefault = o; }
    }
  } catch (e) {
    // `strict` (penentuan ONGKIR): JANGAN telan galat — indeks kosong membuat semua paket "tak punya asal" lalu dilewati = ongkir Rp0
    // diam-diam. Biarkan melempar supaya pemanggil gagal-tertutup. Non-strict (teks alamat pickup/pratinjau admin) boleh degradasi.
    if (opts.strict) throw e;
    console.error("[shipping-origins] loadOriginIndex gagal (migration 0088 belum jalan?):", e);
  }
  return idx;
}

export type OriginResult = { ok: true; origins: OriginDTO[]; savedId?: string } | { ok: false; error: string };

export async function saveOrigin(tc: TenantDb, scope: OriginScope, input: OriginInput): Promise<OriginResult> {
  const O = tc.schema.shippingOrigins;
  const [dest] = await publicDb.select({ id: roDestinations.id }).from(roDestinations).where(eq(roDestinations.id, input.destinationId)).limit(1);
  if (!dest) return { ok: false, error: "Lokasi tidak ditemukan. Cari dan pilih ulang lokasi dari daftar." };

  let savedId = input.id ?? "";
  const error = await tc.db.transaction(async (tx): Promise<string | null> => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"shipping_origins:" + (scope.producerId ?? "tenant")}))`);
    const existing = await tx.select({ id: O.id, isDefault: O.isDefault }).from(O).where(scopeEq(tc, scope));
    if (input.id) { if (!existing.some((e) => e.id === input.id)) return "Asal kirim tidak ditemukan."; }
    else if (existing.length >= MAX_ORIGINS_PER_OWNER) return `Maksimal ${MAX_ORIGINS_PER_OWNER} asal kirim. Hapus salah satu dulu.`;

    const wasDefault = !!input.id && existing.find((e) => e.id === input.id)?.isDefault === true;
    const makeDefault = input.isDefault || existing.length === 0 || wasDefault;
    if (makeDefault) await tx.update(O).set({ isDefault: false }).where(and(scopeEq(tc, scope), input.id ? ne(O.id, input.id) : undefined));

    const values = { label: input.label, detail: input.detail, destinationId: input.destinationId, isDefault: makeDefault };
    if (input.id) {
      await tx.update(O).set({ ...values, updatedAt: new Date() }).where(and(eq(O.id, input.id), scopeEq(tc, scope)));
    } else {
      const [ins] = await tx.insert(O).values({ ...values, producerId: scope.producerId }).returning({ id: O.id });
      savedId = ins.id;
    }
    return null;
  });
  if (error) return { ok: false, error };
  return { ok: true, origins: await listOrigins(tc, scope), savedId };
}

export async function deleteOrigin(tc: TenantDb, scope: OriginScope, id: string): Promise<OriginResult> {
  const O = tc.schema.shippingOrigins;
  const error = await tc.db.transaction(async (tx): Promise<string | null> => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"shipping_origins:" + (scope.producerId ?? "tenant")}))`);
    const [target] = await tx.select({ id: O.id, isDefault: O.isDefault }).from(O).where(and(eq(O.id, id), scopeEq(tc, scope))).limit(1);
    if (!target) return "Asal kirim tidak ditemukan.";
    const [{ n }] = await tx.select({ n: count() }).from(tc.schema.products).where(eq(tc.schema.products.originId, id));
    if (n > 0) return `Asal kirim ini dipakai ${n} produk. Ganti asal kirim produk-produk itu dulu.`;
    await tx.delete(O).where(and(eq(O.id, id), scopeEq(tc, scope)));
    if (target.isDefault) {
      const [next] = await tx.select({ id: O.id }).from(O).where(scopeEq(tc, scope)).orderBy(asc(O.createdAt)).limit(1);
      if (next) await tx.update(O).set({ isDefault: true }).where(and(eq(O.id, next.id), scopeEq(tc, scope)));
    }
    return null;
  });
  if (error) return { ok: false, error };
  return { ok: true, origins: await listOrigins(tc, scope) };
}

export async function setDefaultOrigin(tc: TenantDb, scope: OriginScope, id: string): Promise<OriginResult> {
  const O = tc.schema.shippingOrigins;
  const error = await tc.db.transaction(async (tx): Promise<string | null> => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"shipping_origins:" + (scope.producerId ?? "tenant")}))`);
    const [target] = await tx.select({ id: O.id }).from(O).where(and(eq(O.id, id), scopeEq(tc, scope))).limit(1);
    if (!target) return "Asal kirim tidak ditemukan.";
    await tx.update(O).set({ isDefault: false }).where(scopeEq(tc, scope));
    await tx.update(O).set({ isDefault: true, updatedAt: new Date() }).where(and(eq(O.id, id), scopeEq(tc, scope)));
    return null;
  });
  if (error) return { ok: false, error };
  return { ok: true, origins: await listOrigins(tc, scope) };
}

/** Apakah `originId` boleh dipakai produk dengan produsen ini? (asal harus milik pemilik yang sama) */
export async function originBelongsTo(tc: TenantDb, originId: string, producerId: string | null): Promise<boolean> {
  const O = tc.schema.shippingOrigins;
  const [r] = await tc.db.select({ id: O.id }).from(O).where(and(eq(O.id, originId), producerId ? eq(O.producerId, producerId) : isNull(O.producerId))).limit(1);
  return !!r;
}
