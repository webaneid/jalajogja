// Halaman pengiriman massal (mail merge bulk) — hanya untuk surat keluar
// Server component: fetch parent letter + daftar kontak → render picker client

import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
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
  if (!["owner", "admin"].includes(access.tenantUser.role)) {
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
  const contacts = await tenantDb
    .select({
      id:           schema.letterContacts.id,
      name:         schema.letterContacts.name,
      title:        schema.letterContacts.title,
      organization: schema.letterContacts.organization,
      phone:        schema.letterContacts.phone,
      email:        schema.letterContacts.email,
      address:      schema.letterContacts.address,
    })
    .from(schema.letterContacts)
    .orderBy(schema.letterContacts.name);

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
        contacts={contacts.map((c) => ({
          id:           c.id,
          name:         c.name,
          title:        c.title        ?? null,
          organization: c.organization ?? null,
          phone:        c.phone        ?? null,
          email:        c.email        ?? null,
          address:      c.address      ?? null,
        }))}
      />
    </div>
  );
}
