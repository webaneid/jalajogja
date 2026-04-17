// Halaman pengiriman massal (mail merge bulk) — hanya untuk surat keluar
// Server component: fetch parent letter + daftar kontak → render picker client

import { createTenantDb, db, refProvinces, refRegencies, refDistricts } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BulkRecipientPicker } from "@/components/letters/bulk-recipient-picker";

export default async function BulkLetterPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: letterId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  // Hanya admin/owner yang bisa akses halaman ini
  if (!hasFullAccess(access.tenantUser, "surat")) {
    redirect(`/${slug}/letters/keluar/${letterId}`);
  }

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Fetch parent letter
  const [letter] = await tenantDb
    .select({
      id:           schema.letters.id,
      subject:      schema.letters.subject,
      letterNumber: schema.letters.letterNumber,
      isBulk:       schema.letters.isBulk,
      type:         schema.letters.type,
    })
    .from(schema.letters)
    .where(eq(schema.letters.id, letterId))
    .limit(1);

  if (!letter || letter.type !== "outgoing") notFound();

  // Fetch semua kontak eksternal — biasanya sedikit, cukup server-side
  const rawContacts = await tenantDb
    .select({
      id:           schema.letterContacts.id,
      name:         schema.letterContacts.name,
      title:        schema.letterContacts.title,
      organization: schema.letterContacts.organization,
      phone:        schema.letterContacts.phone,
      email:        schema.letterContacts.email,
      addressDetail: schema.letterContacts.addressDetail,
      provinceId:   schema.letterContacts.provinceId,
      regencyId:    schema.letterContacts.regencyId,
      districtId:   schema.letterContacts.districtId,
    })
    .from(schema.letterContacts)
    .orderBy(schema.letterContacts.name);

  // Resolve nama wilayah untuk formatted address
  const cProvinceIds = [...new Set(rawContacts.map((c) => c.provinceId).filter((x): x is number => x != null))];
  const cRegencyIds  = [...new Set(rawContacts.map((c) => c.regencyId).filter((x): x is number => x != null))];
  const cDistrictIds = [...new Set(rawContacts.map((c) => c.districtId).filter((x): x is number => x != null))];

  const [cProvinceRows, cRegencyRows, cDistrictRows] = await Promise.all([
    cProvinceIds.length > 0 ? db.select({ id: refProvinces.id, name: refProvinces.name }).from(refProvinces).where(inArray(refProvinces.id, cProvinceIds)) : Promise.resolve([]),
    cRegencyIds.length  > 0 ? db.select({ id: refRegencies.id, name: refRegencies.name }).from(refRegencies).where(inArray(refRegencies.id, cRegencyIds)) : Promise.resolve([]),
    cDistrictIds.length > 0 ? db.select({ id: refDistricts.id, name: refDistricts.name }).from(refDistricts).where(inArray(refDistricts.id, cDistrictIds)) : Promise.resolve([]),
  ]);

  const cProvinceMap = new Map(cProvinceRows.map((p) => [p.id, p.name]));
  const cRegencyMap  = new Map(cRegencyRows.map((r) => [r.id, r.name]));
  const cDistrictMap = new Map(cDistrictRows.map((d) => [d.id, d.name]));

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href={`/${slug}/letters/keluar/${letterId}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Kembali ke Surat
        </Link>
      </div>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Kirim Massal</h1>
        <p className="text-sm text-muted-foreground">
          Buat salinan surat untuk setiap penerima yang dipilih.
          Setiap salinan mendapat nomor{" "}
          <span className="font-mono">
            {letter.letterNumber ? `${letter.letterNumber}/1` : "—/1"}
          </span>
          , dst.
        </p>
      </div>

      {/* Subjek surat */}
      <div className="rounded-lg border border-border px-4 py-3 text-sm">
        <span className="text-muted-foreground mr-2">Perihal:</span>
        <span className="font-medium">{letter.subject || "Tanpa perihal"}</span>
        {letter.letterNumber && (
          <span className="ml-3 font-mono text-xs text-muted-foreground">
            {letter.letterNumber}
          </span>
        )}
      </div>

      {/* Picker — client component */}
      <BulkRecipientPicker
        slug={slug}
        letterId={letterId}
        contacts={rawContacts.map((c) => {
          const parts = [
            c.addressDetail,
            c.districtId ? cDistrictMap.get(c.districtId) : null,
            c.regencyId  ? cRegencyMap.get(c.regencyId)   : null,
            c.provinceId ? cProvinceMap.get(c.provinceId) : null,
          ].filter(Boolean);
          return {
            id:           c.id,
            name:         c.name,
            title:        c.title        ?? null,
            organization: c.organization ?? null,
            phone:        c.phone        ?? null,
            email:        c.email        ?? null,
            address:      parts.length > 0 ? parts.join(", ") : null,
          };
        })}
      />
    </div>
  );
}
