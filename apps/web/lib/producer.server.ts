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
  membership:   "ok" | "left" | "n/a";    // "left" = pemilik bukan anggota sah tenant lagi
  sourceMissing: boolean;                 // baris sumber sudah dihapus / tidak lagi milik anggota itu
  notes:        string | null;
};

type TenantRef = { id: string; name: string; tenantType: string | null };

// ─── Alamat dari field wilayah (custom + internal) — urutan sama dengan composeAddress() ──────────
async function composeRegionText(f: {
  detail?: string | null; provinceId?: number | null; regencyId?: number | null;
  districtId?: number | null; villageId?: number | string | null; postalCode?: string | null;
}): Promise<string | null> {
  const [prov, reg, dist, vil] = await Promise.all([
    f.provinceId ? publicDb.query.refProvinces.findFirst({ where: eq(refProvinces.id, f.provinceId), columns: { name: true } }) : null,
    f.regencyId  ? publicDb.query.refRegencies.findFirst({ where: eq(refRegencies.id, f.regencyId),  columns: { name: true } }) : null,
    f.districtId ? publicDb.query.refDistricts.findFirst({ where: eq(refDistricts.id, f.districtId), columns: { name: true } }) : null,
    f.villageId  ? publicDb.query.refVillages.findFirst({ where: eq(refVillages.id, Number(f.villageId)), columns: { name: true } }) : null,
  ]);
  const parts = [f.detail, vil?.name, dist?.name, reg?.name, prov?.name, f.postalCode]
    .filter((p): p is string => !!p?.trim());
  return parts.length > 0 ? parts.join(", ") : null;
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

  for (const r of rows) {
    if (r.type === "custom") {
      const addrText = await composeRegionText({
        detail: r.customAddressDetail, provinceId: r.customProvinceId, regencyId: r.customRegencyId,
        districtId: r.customDistrictId, villageId: r.customVillageId, postalCode: r.customPostalCode,
      });
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

    let name = r.nameCache?.trim() || "(sumber dihapus)";
    let subtitle: string | null = owner ? `Pemilik: ${owner.name}` : null;
    if (!sourceMissing && src) {
      if (kind === "usaha")      name = composeProducerName("usaha", { name: (src as typeof biz[number]).name, brand: (src as typeof biz[number]).brand });
      if (kind === "pesantren")  name = composeProducerName("pesantren", { name: (src as typeof pes[number]).name });
      if (kind === "profesional") {
        const p = src as typeof pro[number];
        name = composeProducerName("profesional", { title: p.title, ownerName: owner?.name });
        subtitle = [p.professionType, p.institution].filter(Boolean).join(" · ") || subtitle;
      }
    }

    out.set(r.id, {
      id: r.id, kind: "member", sourceType: kind, isActive: r.isActive, name, subtitle,
      phone:   pickProducerPhone(kind, sourceContact, ownerContact),
      address: pickProducerAddress(sourceAddress, ownerAddress),
      owner:   owner ? { memberId: owner.id, name: owner.name } : null,
      membership: r.memberId && memberSet.has(r.memberId) ? "ok" : "left",
      sourceMissing, notes: r.notes,
    });
  }
  return out;
}
