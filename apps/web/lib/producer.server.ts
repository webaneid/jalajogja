// Pemuat data produsen — ADMIN-ONLY (dashboard, hasFullAccess toko). JANGAN dipakai/diimpor oleh halaman,
// API, atau komponen publik: berisi nomor WhatsApp pribadi anggota. Doc: docs/arsitektur-produsen.md.
//
// Semua dibaca LANGSUNG dari sumber (referensi hidup) saat dipanggil — tidak ada salinan kecuali
// producers.name_cache (cadangan nama kalau baris sumber kelak dihapus). Aturan fallback ada di
// lib/producer-resolve.ts (murni, diuji). Aturan "anggota tenant" di lib/tenant-membership.server.ts.
import "server-only";
import { eq, inArray } from "drizzle-orm";
import {
  db as publicDb, members, contacts, memberBusinesses, memberOwnedPesantren, memberProfessionals,
  composeAddress, getSettings, refProvinces, refRegencies, refDistricts, refVillages,
  type TenantDb,
} from "@jalajogja/db";
import { filterTenantMembers } from "@/lib/tenant-membership.server";
import {
  pickProducerPhone, pickProducerAddress, composeProducerName,
  type ProducerPhone, type ProducerAddress, type ProducerSourceKind,
} from "@/lib/producer-resolve";

export type ProducerView = {
  id:           string | null;            // null = internal (tenant sendiri)
  kind:         "internal" | "member" | "custom";
  sourceType:   ProducerSourceKind | null;
  isActive:     boolean;
  name:         string;
  subtitle:     string | null;            // jenis profesi / institusi / nama pemilik
  phone:        ProducerPhone | null;
  address:      ProducerAddress | null;
  owner:        { memberId: string; name: string } | null;
  membership:   "ok" | "left" | "n/a";    // "left" = pemilik bukan anggota sah tenant lagi (hanya lencana; data tetap tampil)
  sourceMissing: boolean;                 // baris sumber sudah dihapus / tidak lagi milik anggota itu
  notes:        string | null;
};

type TenantRef = { id: string; name: string; tenantType: string | null };

// ─── Alamat dari field wilayah (custom + internal) — urutan sama dengan composeAddress() ──────────
// `cache` (opsional) dipakai bersama dalam satu panggilan batch: produsen custom di provinsi/kota yang sama
// tidak mengulang query nama wilayah yang sama.
type RegionCache = Map<string, Promise<string | undefined>>;

function regionName(cache: RegionCache | undefined, kind: "prov" | "reg" | "dist" | "vil", id: number | null | undefined): Promise<string | undefined> | null {
  if (!id) return null;
  const run = async (): Promise<string | undefined> => {
    if (kind === "prov") return (await publicDb.query.refProvinces.findFirst({ where: eq(refProvinces.id, id), columns: { name: true } }))?.name;
    if (kind === "reg")  return (await publicDb.query.refRegencies.findFirst({ where: eq(refRegencies.id, id),  columns: { name: true } }))?.name;
    if (kind === "dist") return (await publicDb.query.refDistricts.findFirst({ where: eq(refDistricts.id, id), columns: { name: true } }))?.name;
    return (await publicDb.query.refVillages.findFirst({ where: eq(refVillages.id, id), columns: { name: true } }))?.name;
  };
  if (!cache) return run();
  const key = `${kind}:${id}`;
  let hit = cache.get(key);
  if (!hit) { hit = run(); cache.set(key, hit); }
  return hit;
}

async function composeRegionText(f: {
  detail?: string | null; provinceId?: number | null; regencyId?: number | null;
  districtId?: number | null; villageId?: number | string | null; postalCode?: string | null;
}, cache?: RegionCache): Promise<string | null> {
  const [prov, reg, dist, vil] = await Promise.all([
    regionName(cache, "prov", f.provinceId),
    regionName(cache, "reg", f.regencyId),
    regionName(cache, "dist", f.districtId),
    regionName(cache, "vil", f.villageId ? Number(f.villageId) : null),
  ]);
  const parts = [f.detail, vil, dist, reg, prov, f.postalCode]
    .filter((p): p is string => !!p?.trim());
  return parts.length > 0 ? parts.join(", ") : null;
}

// ─── Nama produsen anggota — SATU fungsi untuk kartu (resolveProducers) dan dropdown (listProducerOptions) ──
// Dipakai bersama supaya label di form produk selalu identik dengan nama di halaman Produsen.
function memberProducerName(
  kind: ProducerSourceKind,
  nameCache: string | null,
  sourceMissing: boolean,
  src: { name?: string | null; brand?: string | null; title?: string | null } | undefined,
  ownerName: string | undefined,
): string {
  let name = nameCache?.trim() || "(sumber dihapus)";
  if (!sourceMissing && src) {
    if (kind === "usaha")       name = composeProducerName("usaha", { name: src.name, brand: src.brand });
    if (kind === "pesantren")   name = composeProducerName("pesantren", { name: src.name });
    if (kind === "profesional") name = composeProducerName("profesional", { title: src.title, ownerName });
  }
  return name;
}

// ─── Internal: tenant sendiri (data dari pengaturan) ──────────────────────────────────────────────
export async function resolveInternalProducer(tenantClient: TenantDb, tenant: TenantRef): Promise<ProducerView> {
  const [general, contact] = await Promise.all([getSettings(tenantClient, "general"), getSettings(tenantClient, "contact")]);
  const name  = (general["site_name"] as string | undefined)?.trim() || tenant.name;
  const phone = (contact["contact_phone"] as string | undefined)?.trim() || null;
  const addr  = contact["contact_address"] as {
    detail?: string; provinceId?: number; regencyId?: number; districtId?: number; villageId?: number | string; postalCode?: string;
  } | undefined;
  const addressText = addr ? await composeRegionText(addr) : null;
  return {
    id: null, kind: "internal", sourceType: null, isActive: true, name, subtitle: "Produsen internal (tenant sendiri)",
    // contact_phone belum tentu WhatsApp (pengaturan kontak tenant) → isWhatsapp false, tampil sebagai kontak
    phone:   phone ? { value: phone, source: "tenant", isWhatsapp: false } : null,
    address: addressText ? { text: addressText, source: "tenant" } : null,
    owner: null, membership: "n/a", sourceMissing: false, notes: null,
  };
}

// ─── Produsen tersimpan (member/custom) → ProducerView, batch (tanpa N+1 per produsen) ─────────────
export async function resolveProducers(
  tenantClient: TenantDb,
  tenant:       TenantRef,
  producerIds:  string[],
): Promise<Map<string, ProducerView>> {
  const out = new Map<string, ProducerView>();
  if (producerIds.length === 0) return out;

  const { db: tdb, schema } = tenantClient;
  const rows = await tdb.select().from(schema.producers).where(inArray(schema.producers.id, producerIds));
  if (rows.length === 0) return out;

  const memberRows = rows.filter((r) => r.type === "member");
  const idsOf = (t: ProducerSourceKind) => memberRows.filter((r) => r.sourceType === t && r.sourceId).map((r) => r.sourceId as string);

  // Sumber (3 tabel public) — kolom hanya yang dibutuhkan
  const [biz, pes, pro] = await Promise.all([
    idsOf("usaha").length ? publicDb.select({ id: memberBusinesses.id, memberId: memberBusinesses.memberId, name: memberBusinesses.name, brand: memberBusinesses.brand, contactId: memberBusinesses.contactId, addressId: memberBusinesses.addressId })
      .from(memberBusinesses).where(inArray(memberBusinesses.id, idsOf("usaha"))) : [],
    idsOf("pesantren").length ? publicDb.select({ id: memberOwnedPesantren.id, memberId: memberOwnedPesantren.memberId, name: memberOwnedPesantren.name, contactId: memberOwnedPesantren.contactId, addressId: memberOwnedPesantren.addressId })
      .from(memberOwnedPesantren).where(inArray(memberOwnedPesantren.id, idsOf("pesantren"))) : [],
    idsOf("profesional").length ? publicDb.select({ id: memberProfessionals.id, memberId: memberProfessionals.memberId, title: memberProfessionals.title, professionType: memberProfessionals.professionType, institution: memberProfessionals.institution, contactId: memberProfessionals.contactId, addressId: memberProfessionals.addressId })
      .from(memberProfessionals).where(inArray(memberProfessionals.id, idsOf("profesional"))) : [],
  ]);
  const bizMap = new Map(biz.map((r) => [r.id, r]));
  const pesMap = new Map(pes.map((r) => [r.id, r]));
  const proMap = new Map(pro.map((r) => [r.id, r]));

  // Pemilik (anggota) + kontaknya + keanggotaan tenant
  const ownerIds = [...new Set(memberRows.map((r) => r.memberId).filter((x): x is string => !!x))];
  const ownerRows = ownerIds.length
    ? await publicDb.select({ id: members.id, name: members.name, contactId: members.contactId, homeAddressId: members.homeAddressId })
        .from(members).where(inArray(members.id, ownerIds))
    : [];
  const ownerMap = new Map(ownerRows.map((m) => [m.id, m]));
  const memberSet = await filterTenantMembers(ownerIds, tenant);

  const contactIds = [...new Set([
    ...biz.map((r) => r.contactId), ...pes.map((r) => r.contactId), ...pro.map((r) => r.contactId),
    ...ownerRows.map((m) => m.contactId),
  ].filter((x): x is string => !!x))];
  const contactRows = contactIds.length
    ? await publicDb.select({ id: contacts.id, phone: contacts.phone, whatsapp: contacts.whatsapp }).from(contacts).where(inArray(contacts.id, contactIds))
    : [];
  const contactMap = new Map(contactRows.map((c) => [c.id, c]));

  const addressIds = [...new Set([
    ...biz.map((r) => r.addressId), ...pes.map((r) => r.addressId), ...pro.map((r) => r.addressId),
    ...ownerRows.map((m) => m.homeAddressId),
  ].filter((x): x is string => !!x))];
  const addressTexts = new Map<string, string | undefined>(
    await Promise.all(addressIds.map(async (id) => [id, await composeAddress(publicDb, id)] as const)),
  );

  const regionCache: RegionCache = new Map();
  for (const r of rows) {
    if (r.type === "custom") {
      const addrText = await composeRegionText({
        detail: r.customAddressDetail, provinceId: r.customProvinceId, regencyId: r.customRegencyId,
        districtId: r.customDistrictId, villageId: r.customVillageId, postalCode: r.customPostalCode,
      }, regionCache);
      out.set(r.id, {
        id: r.id, kind: "custom", sourceType: null, isActive: r.isActive,
        name: r.customName?.trim() || "(tanpa nama)", subtitle: "Produsen custom (bukan anggota)",
        phone:   r.customWhatsapp ? { value: r.customWhatsapp, source: "custom", isWhatsapp: true } : null,
        address: addrText ? { text: addrText, source: "custom" } : null,
        owner: null, membership: "n/a", sourceMissing: false, notes: r.notes,
      });
      continue;
    }

    // type = member
    const kind  = r.sourceType as ProducerSourceKind;
    const owner = r.memberId ? ownerMap.get(r.memberId) : undefined;
    const src   = kind === "usaha" ? bizMap.get(r.sourceId ?? "") : kind === "pesantren" ? pesMap.get(r.sourceId ?? "") : proMap.get(r.sourceId ?? "");
    // Sumber dianggap hilang kalau barisnya tak ada ATAU bukan lagi milik anggota yang tercatat
    const sourceMissing = !src || src.memberId !== r.memberId;

    const sourceContact = !sourceMissing && src?.contactId ? contactMap.get(src.contactId) : null;
    const ownerContact  = owner?.contactId ? contactMap.get(owner.contactId) : null;
    const sourceAddress = !sourceMissing && src?.addressId ? addressTexts.get(src.addressId) : null;
    const ownerAddress  = owner?.homeAddressId ? addressTexts.get(owner.homeAddressId) : null;

    const name = memberProducerName(kind, r.nameCache, sourceMissing, src as Parameters<typeof memberProducerName>[3], owner?.name);
    let subtitle: string | null = owner ? `Pemilik: ${owner.name}` : null;
    if (!sourceMissing && src && kind === "profesional") {
      const p = src as typeof pro[number];
      subtitle = [p.professionType, p.institution].filter(Boolean).join(" · ") || subtitle;
    }

    // Keputusan user: ini alat internal admin untuk menghubungi produsen — data TETAP tampil walau pemilik
    // sudah bukan anggota tenant; yang ada hanya lencana "Bukan anggota lagi" (admin yang memutuskan).
    const isMember = !!r.memberId && memberSet.has(r.memberId);

    out.set(r.id, {
      id: r.id, kind: "member", sourceType: kind, isActive: r.isActive, name, subtitle,
      phone:   pickProducerPhone(kind, sourceContact, ownerContact),
      address: pickProducerAddress(sourceAddress, ownerAddress),
      owner:   owner ? { memberId: owner.id, name: owner.name } : null,
      membership: isMember ? "ok" : "left",
      sourceMissing, notes: r.notes,
    });
  }
  return out;
}

// ─── Opsi dropdown produsen (form produk) — RINGAN: hanya nama, tanpa kontak/alamat/wilayah/keanggotaan ──
// Aturan nama sama persis dengan resolveProducers lewat memberProducerName(). Produsen internal tidak ikut
// (form menambahkan pilihan "Internal" sendiri). `alsoIncludeId` = produsen nonaktif yang sedang dipakai
// produk itu agar pilihan sekarang tidak "hilang" dari form.
export type ProducerOption = { id: string; name: string; kind: "member" | "custom"; sourceType: ProducerSourceKind | null; isActive: boolean };

export async function listProducerOptions(
  tenantClient: TenantDb,
  opts: { alsoIncludeId?: string | null } = {},
): Promise<ProducerOption[]> {
  const { db: tdb, schema } = tenantClient;
  const all = await tdb.select({
    id: schema.producers.id, type: schema.producers.type, sourceType: schema.producers.sourceType, sourceId: schema.producers.sourceId,
    memberId: schema.producers.memberId, nameCache: schema.producers.nameCache, customName: schema.producers.customName, isActive: schema.producers.isActive,
  }).from(schema.producers);
  const rows = all.filter((r) => r.isActive || r.id === opts.alsoIncludeId);
  if (rows.length === 0) return [];

  const memberRows = rows.filter((r) => r.type === "member");
  const idsOf = (t: ProducerSourceKind) => memberRows.filter((r) => r.sourceType === t && r.sourceId).map((r) => r.sourceId as string);
  const [biz, pes, pro] = await Promise.all([
    idsOf("usaha").length ? publicDb.select({ id: memberBusinesses.id, memberId: memberBusinesses.memberId, name: memberBusinesses.name, brand: memberBusinesses.brand })
      .from(memberBusinesses).where(inArray(memberBusinesses.id, idsOf("usaha"))) : [],
    idsOf("pesantren").length ? publicDb.select({ id: memberOwnedPesantren.id, memberId: memberOwnedPesantren.memberId, name: memberOwnedPesantren.name })
      .from(memberOwnedPesantren).where(inArray(memberOwnedPesantren.id, idsOf("pesantren"))) : [],
    idsOf("profesional").length ? publicDb.select({ id: memberProfessionals.id, memberId: memberProfessionals.memberId, title: memberProfessionals.title })
      .from(memberProfessionals).where(inArray(memberProfessionals.id, idsOf("profesional"))) : [],
  ]);
  const bizMap = new Map(biz.map((r) => [r.id, r]));
  const pesMap = new Map(pes.map((r) => [r.id, r]));
  const proMap = new Map(pro.map((r) => [r.id, r]));

  const ownerIds = [...new Set(memberRows.map((r) => r.memberId).filter((x): x is string => !!x))];
  const ownerRows = ownerIds.length
    ? await publicDb.select({ id: members.id, name: members.name }).from(members).where(inArray(members.id, ownerIds))
    : [];
  const ownerName = new Map(ownerRows.map((m) => [m.id, m.name]));

  return rows.map((r): ProducerOption => {
    if (r.type === "custom") {
      return { id: r.id, name: r.customName?.trim() || "(tanpa nama)", kind: "custom", sourceType: null, isActive: r.isActive };
    }
    const kind = r.sourceType as ProducerSourceKind;
    const src  = kind === "usaha" ? bizMap.get(r.sourceId ?? "") : kind === "pesantren" ? pesMap.get(r.sourceId ?? "") : proMap.get(r.sourceId ?? "");
    const sourceMissing = !src || src.memberId !== r.memberId;
    return {
      id: r.id, kind: "member", sourceType: kind, isActive: r.isActive,
      name: memberProducerName(kind, r.nameCache, sourceMissing, src as Parameters<typeof memberProducerName>[3], r.memberId ? ownerName.get(r.memberId) : undefined),
    };
  });
}
