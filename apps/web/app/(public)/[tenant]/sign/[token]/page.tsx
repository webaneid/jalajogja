// Halaman penandatangan via link token — PUBLIC (tidak butuh login dashboard)
// Officer buka link ini → lihat detail surat → klik "Tanda Tangan"
// Setelah TTD → verificationHash dibuat → QR Code muncul
import { createTenantDb, db, members, tenants } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SigningPageClient } from "@/components/letters/signing-page-client";

export default async function SignPage({
  params,
}: {
  params: Promise<{ tenant: string; token: string }>;
}) {
  const { tenant: slug, token } = await params;

  // Cek tenant valid
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant || !tenant.isActive) notFound();

  const tenantClient             = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

  // Cari slot TTD by signingToken
  const [sig] = await tenantDb
    .select()
    .from(schema.letterSignatures)
    .where(eq(schema.letterSignatures.signingToken, token))
    .limit(1);

  // Fungsi kecil untuk tampilkan pesan status
  function InfoCard({ title, message }: { title: string; message: string }) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/5 px-4">
        <div className="max-w-sm w-full rounded-xl border border-border bg-background p-8 text-center space-y-3">
          <p className="text-lg font-semibold text-destructive">{title}</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  if (!sig) {
    return <InfoCard title="Link Tidak Valid" message="Link tanda tangan ini tidak ditemukan atau sudah tidak berlaku." />;
  }

  // Cek token kadaluarsa (sebelum sudah-TTD agar pesan lebih akurat)
  const isExpired = sig.signingTokenExpiresAt !== null && sig.signingTokenExpiresAt !== undefined
    && (sig.signingTokenExpiresAt as Date) < new Date();
  if (isExpired && !sig.signedAt) {
    return <InfoCard title="Link Kadaluarsa" message="Link tanda tangan ini sudah tidak berlaku. Minta admin untuk mengirim ulang link baru." />;
  }

  // Ambil info officer
  const officer = await tenantDb
    .select({
      id:         schema.officers.id,
      memberId:   schema.officers.memberId,
      position:   schema.officers.position,
      divisionId: schema.officers.divisionId,
    })
    .from(schema.officers)
    .where(eq(schema.officers.id, sig.officerId))
    .limit(1)
    .then((r) => r[0] ?? null);

  const officerName = officer
    ? await db
        .select({ name: members.name })
        .from(members)
        .where(eq(members.id, officer.memberId))
        .limit(1)
        .then((r) => r[0]?.name ?? "—")
    : "—";

  const divisionName = officer?.divisionId
    ? await tenantDb
        .select({ name: schema.divisions.name })
        .from(schema.divisions)
        .where(eq(schema.divisions.id, officer.divisionId))
        .limit(1)
        .then((r) => r[0]?.name ?? null)
    : null;

  // Ambil info surat
  const [letter] = await tenantDb
    .select({
      id:           schema.letters.id,
      subject:      schema.letters.subject,
      letterNumber: schema.letters.letterNumber,
      letterDate:   schema.letters.letterDate,
      recipient:    schema.letters.recipient,
    })
    .from(schema.letters)
    .where(eq(schema.letters.id, sig.letterId))
    .limit(1);

  if (!letter) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/5 px-4 py-12">
      <div className="max-w-md w-full">
        {/* Header tenant */}
        <p className="text-center text-xs text-muted-foreground mb-6">{tenant.name}</p>

        <SigningPageClient
          slug={slug}
          token={token}
          signatureId={sig.id}
          letterId={letter.id}
          letterSubject={letter.subject}
          letterNumber={letter.letterNumber ?? null}
          letterDate={letter.letterDate ?? null}
          recipient={letter.recipient ?? null}
          officerName={officerName}
          officerPosition={officer?.position ?? null}
          officerDivision={divisionName}
          role={sig.role as "signer" | "approver" | "witness"}
          alreadySigned={sig.signedAt !== null}
          verificationHash={sig.verificationHash}
          appUrl={appUrl}
        />
      </div>
    </div>
  );
}
