// Halaman manajemen kontak surat — penerima untuk surat keluar & bulk
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
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

  const contacts = await tenantDb
    .select({
      id:           schema.letterContacts.id,
      name:         schema.letterContacts.name,
      title:        schema.letterContacts.title,
      organization: schema.letterContacts.organization,
      address:      schema.letterContacts.address,
      email:        schema.letterContacts.email,
      phone:        schema.letterContacts.phone,
    })
    .from(schema.letterContacts)
    .orderBy(schema.letterContacts.name);

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
        initialContacts={contacts.map((c) => ({
          id:           c.id,
          name:         c.name,
          title:        c.title        ?? null,
          organization: c.organization ?? null,
          address:      c.address      ?? null,
          email:        c.email        ?? null,
          phone:        c.phone        ?? null,
        }))}
      />
    </div>
  );
}
