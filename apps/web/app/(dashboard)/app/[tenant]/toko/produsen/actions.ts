"use server";
// Server Actions Produsen produk — ADMIN-ONLY. Setiap action: getTenantAccess(slug) + hasFullAccess(toko).
// Doc: docs/arsitektur-produsen.md. Aturan keamanan inti:
//  - sourceId/memberId dari client TIDAK dipercaya: baris sumber di-load ulang dari `public`, pemiliknya
//    WAJIB anggota sah tenant ini (lib/tenant-membership.server.ts) — kalau tidak, admin tenant A bisa
//    memasukkan usaha anggota tenant B (IDOR lintas-tenant).
//  - Produsen yang dipakai produk tidak boleh dihapus (hanya dinonaktifkan).
import { revalidatePath } from "next/cache";
import { eq, and, count } from "drizzle-orm";
import { db as publicDb, createTenantDb, memberBusinesses, memberOwnedPesantren, memberProfessionals } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { normalizePhone } from "@/lib/phone";
import { isValidUuid } from "@/lib/is-uuid";
import { isTenantMember } from "@/lib/tenant-membership.server";
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
      const [r] = await publicDb.select({ memberId: memberProfessionals.memberId }).from(memberProfessionals).where(eq(memberProfessionals.id, input.sourceId)).limit(1);
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
    const [{ n }] = await db.select({ n: count() }).from(schema.products).where(eq(schema.products.producerId, producerId));
    if (Number(n) > 0) return { success: false, error: `Produsen dipakai ${n} produk — nonaktifkan saja, atau ganti produsen produknya dulu.` };
    await db.delete(schema.producers).where(eq(schema.producers.id, producerId));
    refresh(slug);
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[deleteProducerAction]", err);
    return { success: false, error: "Gagal menghapus produsen." };
  }
}
