"use server";
// Server Actions Produsen produk — ADMIN-ONLY. Setiap action: getTenantAccess(slug) + hasFullAccess(toko).
// Doc: docs/arsitektur-produsen.md. Aturan keamanan inti:
//  - sourceId/memberId dari client TIDAK dipercaya: baris sumber di-load ulang dari `public`, pemiliknya
//    WAJIB anggota sah tenant ini (lib/tenant-membership.server.ts) — kalau tidak, admin tenant A bisa
//    memasukkan usaha anggota tenant B (IDOR lintas-tenant).
//  - Produsen yang dipakai produk tidak boleh dihapus (hanya dinonaktifkan).
import { parseCouriersInput } from "@/lib/producer-couriers";
import { revalidatePath } from "next/cache";
import { eq, and, count, sql } from "drizzle-orm";
import { db as publicDb, createTenantDb, memberBusinesses, memberOwnedPesantren, memberProfessionals, members, producerLogins } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { normalizePhone } from "@/lib/phone";
import { isValidUuid } from "@/lib/is-uuid";
import { isTenantMember } from "@/lib/tenant-membership.server";
import { pgErrorCode } from "@/lib/pg-error";
import { resolveProducers } from "@/lib/producer.server";
import type { ProducerSourceKind } from "@/lib/producer-resolve";

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

const SOURCE_TYPES: readonly ProducerSourceKind[] = ["usaha", "pesantren", "profesional"];

async function guard(slug: string) {
  const access = await getTenantAccess(slug);
  if (!access) return { access: null, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "toko")) return { access: null, error: "Akses ditolak." };
  return { access, error: null };
}

function refresh(slug: string) {
  revalidatePath(`/app/${slug}/toko/produsen`);
  revalidatePath(`/app/${slug}/toko/produk`);
}

const trimOrNull = (v: string | null | undefined, max = 500): string | null => {
  const t = v?.trim();
  return t ? t.slice(0, max) : null;
};

// ─── Tambah produsen dari ANGGOTA ─────────────────────────────────────────────────────────────────
export async function createMemberProducerAction(
  slug: string,
  input: { sourceType: ProducerSourceKind; sourceId: string; notes?: string | null },
): Promise<ActionResult<{ producerId: string }>> {
  const g = await guard(slug);
  if (!g.access) return { success: false, error: g.error ?? "Akses ditolak." };
  const access = g.access;

  if (!SOURCE_TYPES.includes(input.sourceType)) return { success: false, error: "Jenis sumber tidak valid." };
  if (!isValidUuid(input.sourceId)) return { success: false, error: "Sumber tidak valid." };

  try {
    // Load baris sumber dari `public` — ambil pemiliknya dari DATABASE, bukan dari client.
    let ownerId: string | null = null;
    if (input.sourceType === "usaha") {
      const [r] = await publicDb.select({ memberId: memberBusinesses.memberId }).from(memberBusinesses).where(eq(memberBusinesses.id, input.sourceId)).limit(1);
      ownerId = r?.memberId ?? null;
    } else if (input.sourceType === "pesantren") {
      const [r] = await publicDb.select({ memberId: memberOwnedPesantren.memberId }).from(memberOwnedPesantren).where(eq(memberOwnedPesantren.id, input.sourceId)).limit(1);
      ownerId = r?.memberId ?? null;
    } else {
      const [r] = await publicDb.select({ memberId: memberProfessionals.memberId, isActive: memberProfessionals.isActive }).from(memberProfessionals).where(eq(memberProfessionals.id, input.sourceId)).limit(1);
      // Picker sudah menyaring profesional nonaktif; aksi dipanggil langsung tidak boleh melewatinya.
      if (r && !r.isActive) return { success: false, error: "Profesional nonaktif tidak bisa dijadikan produsen." };
      ownerId = r?.memberId ?? null;
    }
    if (!ownerId) return { success: false, error: "Data sumber tidak ditemukan." };

    // Isolasi tenant: pemilik WAJIB anggota sah tenant ini.
    const tenant = { id: access.tenant.id, name: access.tenant.name, tenantType: access.tenant.tenantType };
    if (!(await isTenantMember(ownerId, tenant))) {
      return { success: false, error: "Pemilik bukan anggota tenant ini." };
    }

    const tenantClient = createTenantDb(slug);
    const { db, schema } = tenantClient;

    const [dup] = await db.select({ id: schema.producers.id }).from(schema.producers)
      .where(and(eq(schema.producers.sourceType, input.sourceType), eq(schema.producers.sourceId, input.sourceId))).limit(1);
    if (dup) return { success: false, error: "Sumber ini sudah terdaftar sebagai produsen." };

    const [row] = await db.insert(schema.producers).values({
      type: "member", sourceType: input.sourceType, sourceId: input.sourceId, memberId: ownerId,
      notes: trimOrNull(input.notes), createdBy: access.tenantUser.id,
    }).returning({ id: schema.producers.id });

    // Cadangan nama (dipakai kalau baris sumber kelak dihapus)
    const view = (await resolveProducers(tenantClient, tenant, [row.id])).get(row.id);
    if (view?.name) await db.update(schema.producers).set({ nameCache: view.name }).where(eq(schema.producers.id, row.id));

    refresh(slug);
    return { success: true, data: { producerId: row.id } };
  } catch (err) {
    // Dua klik bersamaan lolos cek duplikat di atas → ditahan unique index producers_source_uniq (0075)
    if (pgErrorCode(err) === "23505") return { success: false, error: "Sumber ini sudah terdaftar sebagai produsen." };
    console.error("[createMemberProducerAction]", err);
    return { success: false, error: "Gagal menyimpan produsen." };
  }
}

// ─── Tambah produsen CUSTOM (bukan anggota) ───────────────────────────────────────────────────────
export type CustomProducerInput = {
  name:           string;
  whatsapp?:      string | null;
  addressDetail?: string | null;
  provinceId?:    number | null;
  regencyId?:     number | null;
  districtId?:    number | null;
  villageId?:     number | string | null;
  postalCode?:    string | null;
  notes?:         string | null;
};

function parseCustom(input: CustomProducerInput): { error: string } | { values: {
  customName: string; customWhatsapp: string | null; customAddressDetail: string | null;
  customProvinceId: number | null; customRegencyId: number | null; customDistrictId: number | null;
  customVillageId: string | null; customPostalCode: string | null; notes: string | null;
} } {
  const name = input.name?.trim();
  if (!name) return { error: "Nama produsen wajib diisi." };
  let wa: string | null = null;
  if (input.whatsapp?.trim()) {
    wa = normalizePhone(input.whatsapp);
    // normalizePhone TIDAK pernah mengembalikan null untuk teks non-kosong (teks acak jadi "+62…") —
    // validasi bentuk E.164 sendiri di server, jangan percaya PhoneInput di client.
    if (!wa || !/^\+\d{8,15}$/.test(wa)) return { error: "Nomor WhatsApp tidak valid." };
  }
  const int = (v: number | null | undefined) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : null);
  const village = input.villageId != null && /^\d+$/.test(String(input.villageId)) ? String(input.villageId) : null;
  return { values: {
    customName: name.slice(0, 150), customWhatsapp: wa, customAddressDetail: trimOrNull(input.addressDetail, 300),
    customProvinceId: int(input.provinceId), customRegencyId: int(input.regencyId), customDistrictId: int(input.districtId),
    customVillageId: village, customPostalCode: trimOrNull(input.postalCode, 10), notes: trimOrNull(input.notes),
  } };
}

export async function createCustomProducerAction(slug: string, input: CustomProducerInput): Promise<ActionResult<{ producerId: string }>> {
  const g = await guard(slug);
  if (!g.access) return { success: false, error: g.error ?? "Akses ditolak." };
  const parsed = parseCustom(input);
  if ("error" in parsed) return { success: false, error: parsed.error };
  try {
    const { db, schema } = createTenantDb(slug);
    const [row] = await db.insert(schema.producers).values({
      type: "custom", ...parsed.values, createdBy: g.access.tenantUser.id,
    }).returning({ id: schema.producers.id });
    refresh(slug);
    return { success: true, data: { producerId: row.id } };
  } catch (err) {
    console.error("[createCustomProducerAction]", err);
    return { success: false, error: "Gagal menyimpan produsen." };
  }
}

// ─── Ubah produsen: custom = semua field; anggota = hanya catatan (ganti sumber → buat produsen baru) ──
export async function updateProducerAction(
  slug: string, producerId: string, input: CustomProducerInput,
): Promise<ActionResult> {
  const g = await guard(slug);
  if (!g.access) return { success: false, error: g.error ?? "Akses ditolak." };
  if (!isValidUuid(producerId)) return { success: false, error: "Produsen tidak ditemukan." };
  try {
    const { db, schema } = createTenantDb(slug);
    const [p] = await db.select({ id: schema.producers.id, type: schema.producers.type }).from(schema.producers).where(eq(schema.producers.id, producerId)).limit(1);
    if (!p) return { success: false, error: "Produsen tidak ditemukan." };

    if (p.type === "member") {
      await db.update(schema.producers).set({ notes: trimOrNull(input.notes), updatedAt: new Date() }).where(eq(schema.producers.id, producerId));
    } else {
      const parsed = parseCustom(input);
      if ("error" in parsed) return { success: false, error: parsed.error };
      await db.update(schema.producers).set({ ...parsed.values, updatedAt: new Date() }).where(eq(schema.producers.id, producerId));
    }
    refresh(slug);
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[updateProducerAction]", err);
    return { success: false, error: "Gagal menyimpan produsen." };
  }
}

// ─── Aktif / nonaktif ─────────────────────────────────────────────────────────────────────────────
export async function toggleProducerActiveAction(slug: string, producerId: string): Promise<ActionResult<{ isActive: boolean }>> {
  const g = await guard(slug);
  if (!g.access) return { success: false, error: g.error ?? "Akses ditolak." };
  if (!isValidUuid(producerId)) return { success: false, error: "Produsen tidak ditemukan." };
  try {
    const { db, schema } = createTenantDb(slug);
    const [p] = await db.select({ isActive: schema.producers.isActive }).from(schema.producers).where(eq(schema.producers.id, producerId)).limit(1);
    if (!p) return { success: false, error: "Produsen tidak ditemukan." };
    await db.update(schema.producers).set({ isActive: !p.isActive, updatedAt: new Date() }).where(eq(schema.producers.id, producerId));
    refresh(slug);
    return { success: true, data: { isActive: !p.isActive } };
  } catch (err) {
    console.error("[toggleProducerActiveAction]", err);
    return { success: false, error: "Gagal mengubah status produsen." };
  }
}

// ─── Hapus — HANYA kalau tidak dipakai produk manapun ────────────────────────────────────────────
export async function deleteProducerAction(slug: string, producerId: string): Promise<ActionResult> {
  const g = await guard(slug);
  if (!g.access) return { success: false, error: g.error ?? "Akses ditolak." };
  if (!isValidUuid(producerId)) return { success: false, error: "Produsen tidak ditemukan." };
  try {
    const { db, schema } = createTenantDb(slug);
    // Satu pernyataan atomik: hapus HANYA bila tidak ada produk yang merujuk. Cek-lalu-hapus terpisah
    // membuka celah — produk yang baru dipasangi produsen ini di antara dua langkah akan diam-diam
    // jadi "internal" lewat FK ON DELETE SET NULL.
    const notUsed = sql`NOT EXISTS (SELECT 1 FROM ${schema.products} WHERE ${schema.products.producerId} = ${producerId})`;
    const deleted = await db.transaction(async (tx) => {
      // Asal kirim milik produsen ini (shipping_origins, FK RESTRICT) ikut dihapus — hanya bila produsen memang tidak dipakai produk
      // (kalau dipakai, tidak ada yang dihapus: transaksi tetap sah, produsen tidak terhapus).
      await tx.delete(schema.shippingOrigins).where(and(eq(schema.shippingOrigins.producerId, producerId), notUsed));
      return tx.delete(schema.producers)
        .where(and(
          eq(schema.producers.id, producerId),
          sql`NOT EXISTS (SELECT 1 FROM ${schema.products} WHERE ${schema.products.producerId} = ${schema.producers.id})`,
        ))
        .returning({ id: schema.producers.id });
    });
    if (deleted.length === 0) {
      // Tidak terhapus: jelaskan alasannya (hanya untuk pesan; keputusan hapus sudah diambil atomik di atas).
      const [exists] = await db.select({ id: schema.producers.id }).from(schema.producers).where(eq(schema.producers.id, producerId)).limit(1);
      if (!exists) return { success: false, error: "Produsen tidak ditemukan." };
      const [{ n }] = await db.select({ n: count() }).from(schema.products).where(eq(schema.products.producerId, producerId));
      return { success: false, error: `Produsen dipakai ${n} produk — nonaktifkan saja, atau ganti produsen produknya dulu.` };
    }
    // Status login portal produsen ini (tabel public, tanpa FK lintas-schema) ikut dibersihkan. Dibatasi tenant_id
    // dari session — tidak pernah menyentuh baris tenant lain. Baris yatim pun tetap ditolak getProducerAccess.
    await publicDb.delete(producerLogins).where(and(eq(producerLogins.tenantId, g.access.tenant.id), eq(producerLogins.producerId, producerId)));
    refresh(slug);
    return { success: true, data: undefined };
  } catch (err) {
    // FK ON DELETE RESTRICT (0075): produk baru dipasangi produsen ini tepat saat dihapus → database menolak
    if (pgErrorCode(err) === "23503") return { success: false, error: "Produsen baru saja dipakai produk — nonaktifkan saja, atau ganti produsen produknya dulu." };
    console.error("[deleteProducerAction]", err);
    return { success: false, error: "Gagal menghapus produsen." };
  }
}

// ─── Portal Produsen: beri / cabut akses login (docs/arsitektur-portal-produsen.md § 3–4, P3) ──────────
// Produsen = STATUS pada akun anggota (public.producer_logins), bukan role pengurus. Syarat memberi akses:
// produsen ANGGOTA & aktif, pemilik punya akun Better Auth, pemilik anggota sah tenant ini, dan akun itu belum
// menjadi produsen di tempat lain (UNIQUE(user_id) — satu akun = satu tenant).
export async function grantProducerLoginAction(slug: string, producerId: string): Promise<ActionResult> {
  const g = await guard(slug);
  if (!g.access) return { success: false, error: g.error ?? "Akses ditolak." };
  const access = g.access;
  if (!isValidUuid(producerId)) return { success: false, error: "Produsen tidak ditemukan." };

  try {
    const { db, schema } = createTenantDb(slug);
    const [p] = await db.select({ type: schema.producers.type, memberId: schema.producers.memberId, isActive: schema.producers.isActive })
      .from(schema.producers).where(eq(schema.producers.id, producerId)).limit(1);
    if (!p) return { success: false, error: "Produsen tidak ditemukan." };
    if (p.type !== "member" || !p.memberId) return { success: false, error: "Hanya produsen anggota yang bisa diberi akses login." };
    if (!p.isActive) return { success: false, error: "Produsen nonaktif — aktifkan dulu." };

    // Akun diambil dari DATABASE (pemilik produsen), bukan dari klien
    const [owner] = await publicDb.select({ betterAuthUserId: members.betterAuthUserId }).from(members).where(eq(members.id, p.memberId)).limit(1);
    if (!owner?.betterAuthUserId) return { success: false, error: "Anggota ini belum mengklaim akunnya (status Pending Claim). Minta anggota mengklaim akun dulu, baru bisa jadi produsen." };

    const tenant = { id: access.tenant.id, tenantType: access.tenant.tenantType };
    if (!(await isTenantMember(p.memberId, tenant))) return { success: false, error: "Pemilik bukan anggota aktif tenant ini." };

    const [existing] = await publicDb.select({ id: producerLogins.id }).from(producerLogins)
      .where(and(eq(producerLogins.tenantId, access.tenant.id), eq(producerLogins.producerId, producerId))).limit(1);
    if (existing) return { success: false, error: "Produsen ini sudah punya akses login." };

    await publicDb.insert(producerLogins).values({
      userId: owner.betterAuthUserId, tenantId: access.tenant.id, producerId, grantedBy: access.tenantUser.id,
    });
    refresh(slug);
    return { success: true, data: undefined };
  } catch (err) {
    // UNIQUE(user_id): akun ini sudah berstatus produsen (di tenant ini untuk produsen lain, atau di tenant lain).
    // Sengaja TIDAK menyebut tenant mana — admin satu tenant tidak boleh tahu data tenant lain.
    if (pgErrorCode(err) === "23505") {
      // Dua sumber 23505: UNIQUE(tenant_id, producer_id) = dua klik bersamaan untuk produsen yang SAMA (bukan konflik akun).
      const [now] = await publicDb.select({ id: producerLogins.id }).from(producerLogins)
        .where(and(eq(producerLogins.tenantId, access.tenant.id), eq(producerLogins.producerId, producerId))).limit(1);
      if (now) return { success: false, error: "Produsen ini sudah punya akses login." };
      return { success: false, error: "Akun anggota ini sudah terdaftar sebagai produsen di tempat lain, jadi tidak bisa ditambahkan di sini." };
    }
    console.error("[grantProducerLoginAction]", err);
    return { success: false, error: "Gagal memberi akses login." };
  }
}

export async function revokeProducerLoginAction(slug: string, producerId: string): Promise<ActionResult> {
  const g = await guard(slug);
  if (!g.access) return { success: false, error: g.error ?? "Akses ditolak." };
  if (!isValidUuid(producerId)) return { success: false, error: "Produsen tidak ditemukan." };
  try {
    // WAJIB dibatasi tenant_id dari session: tabel ini lintas-tenant, tanpa filter admin tenant A bisa mencabut tenant B
    const deleted = await publicDb.delete(producerLogins)
      .where(and(eq(producerLogins.tenantId, g.access.tenant.id), eq(producerLogins.producerId, producerId)))
      .returning({ id: producerLogins.id });
    if (deleted.length === 0) return { success: false, error: "Produsen ini tidak punya akses login." };
    refresh(slug);
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[revokeProducerLoginAction]", err);
    return { success: false, error: "Gagal mencabut akses login." };
  }
}

/** Admin mengatur kurir pilihan produsen atas namanya (§ 25). null = ikut pengaturan admin. */
export async function setProducerCouriersAction(slug: string, producerId: string, couriers: string[] | null): Promise<ActionResult> {
  const g = await guard(slug);
  if (!g.access) return { success: false, error: g.error ?? "Akses ditolak." };
  if (!isValidUuid(producerId)) return { success: false, error: "Produsen tidak ditemukan." };
  const parsed = parseCouriersInput(couriers);
  if (!parsed.ok) return { success: false, error: parsed.error };
  try {
    const { db, schema } = createTenantDb(slug);
    const updated = await db.update(schema.producers).set({ couriers: parsed.value, updatedAt: new Date() })
      .where(eq(schema.producers.id, producerId)).returning({ id: schema.producers.id });
    if (updated.length === 0) return { success: false, error: "Produsen tidak ditemukan." };
    refresh(slug);
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[setProducerCouriersAction]", err);
    return { success: false, error: "Gagal menyimpan kurir." };
  }
}
