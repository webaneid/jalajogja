// Halaman manajemen kontak surat — penerima untuk surat keluar & bulk
import { createTenantDb, refProvinces, refRegencies, refDistricts } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { inArray } from "drizzle-orm";
import { LetterContactManageClient } from "@/components/letters/letter-contact-manage-client";


export default async function KontakPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Import db publik untuk JOIN ke ref tables wilayah
  const { db } = await import("@jalajogja/db");

  const rows = await tenantDb
    .select({
      id:           schema.letterContacts.id,
      name:         schema.letterContacts.name,
      title:        schema.letterContacts.title,
      organization: schema.letterContacts.organization,
      addressDetail: schema.letterContacts.addressDetail,
      provinceId:   schema.letterContacts.provinceId,
      regencyId:    schema.letterContacts.regencyId,
      districtId:   schema.letterContacts.districtId,
      villageId:    schema.letterContacts.villageId,
      email:        schema.letterContacts.email,
      phone:        schema.letterContacts.phone,
    })
    .from(schema.letterContacts)
    .orderBy(schema.letterContacts.name);

  // Resolve nama wilayah dari public DB — kumpulkan semua ID unik lalu batch query
  const provinceIds = [...new Set(rows.map((r) => r.provinceId).filter((x): x is number => x != null))];
  const regencyIds  = [...new Set(rows.map((r) => r.regencyId).filter((x): x is number => x != null))];
  const districtIds = [...new Set(rows.map((r) => r.districtId).filter((x): x is number => x != null))];

  const [provinceRows, regencyRows, districtRows] = await Promise.all([
    provinceIds.length > 0
      ? db.select({ id: refProvinces.id, name: refProvinces.name }).from(refProvinces).where(inArray(refProvinces.id, provinceIds))
      : Promise.resolve([]),
    regencyIds.length > 0
      ? db.select({ id: refRegencies.id, name: refRegencies.name }).from(refRegencies).where(inArray(refRegencies.id, regencyIds))
      : Promise.resolve([]),
    districtIds.length > 0
      ? db.select({ id: refDistricts.id, name: refDistricts.name }).from(refDistricts).where(inArray(refDistricts.id, districtIds))
      : Promise.resolve([]),
  ]);

  const provinceMap = new Map(provinceRows.map((p) => [p.id, p.name]));
  const regencyMap  = new Map(regencyRows.map((r) => [r.id, r.name]));
  const districtMap = new Map(districtRows.map((d) => [d.id, d.name]));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Kontak Surat</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Kontak pihak luar — instansi, pejabat, atau perorangan — yang sering menjadi penerima surat.
        </p>
      </div>

      <LetterContactManageClient
        slug={slug}
        initialContacts={rows.map((c) => ({
          id:           c.id,
          name:         c.name,
          title:        c.title         ?? null,
          organization: c.organization  ?? null,
          addressDetail: c.addressDetail ?? null,
          provinceId:   c.provinceId    ?? null,
          regencyId:    c.regencyId     ?? null,
          districtId:   c.districtId    ?? null,
          villageId:    c.villageId     ?? null,
          provinceName: c.provinceId ? (provinceMap.get(c.provinceId) ?? null) : null,
          regencyName:  c.regencyId  ? (regencyMap.get(c.regencyId)   ?? null) : null,
          districtName: c.districtId ? (districtMap.get(c.districtId) ?? null) : null,
          email:        c.email         ?? null,
          phone:        c.phone         ?? null,
        }))}
      />
    </div>
  );
}
