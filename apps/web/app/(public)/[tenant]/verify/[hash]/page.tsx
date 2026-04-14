// Halaman verifikasi tanda tangan digital — PUBLIC, tanpa auth
// Siapapun bisa scan QR Code dan melihat validitas TTD
import { createTenantDb, db, members, tenants } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CheckCircle2, XCircle, Shield } from "lucide-react";
import { generateQrDataUrl, buildVerifyUrl } from "@/lib/qr-code";

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ tenant: string; hash: string }>;
}) {
  const { tenant: slug, hash } = await params;

  // Cek tenant valid
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant || !tenant.isActive) notFound();

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Cari signature by hash
  const [sig] = await tenantDb
    .select()
    .from(schema.letterSignatures)
    .where(eq(schema.letterSignatures.verificationHash, hash))
    .limit(1);

  // Jika hash tidak ditemukan — tampilkan invalid, bukan 404
  if (!sig) {
    return <VerifyLayout orgName={tenant.name} valid={false} />;
  }

  // Fetch surat
  const [letter] = await tenantDb
    .select({
      id:           schema.letters.id,
      letterNumber: schema.letters.letterNumber,
      subject:      schema.letters.subject,
      letterDate:   schema.letters.letterDate,
      type:         schema.letters.type,
    })
    .from(schema.letters)
    .where(eq(schema.letters.id, sig.letterId))
    .limit(1);

  // Fetch officer
  const [officer] = await tenantDb
    .select({
      id:         schema.officers.id,
      memberId:   schema.officers.memberId,
      position:   schema.officers.position,
      divisionId: schema.officers.divisionId,
    })
    .from(schema.officers)
    .where(eq(schema.officers.id, sig.officerId))
    .limit(1);

  // Fetch nama anggota
  const [member] = officer
    ? await db
        .select({ name: members.name })
        .from(members)
        .where(eq(members.id, officer.memberId))
        .limit(1)
    : [null];

  // Fetch nama divisi
  const [division] = officer?.divisionId
    ? await tenantDb
        .select({ name: schema.divisions.name })
        .from(schema.divisions)
        .where(eq(schema.divisions.id, officer.divisionId))
        .limit(1)
    : [null];

  // Generate QR untuk ditampilkan ulang di halaman ini
  const verifyUrl = buildVerifyUrl(slug, hash);
  const qrDataUrl = await generateQrDataUrl(verifyUrl);

  const ROLE_LABELS: Record<string, string> = {
    signer:   "Penandatangan",
    approver: "Penyetuju",
    witness:  "Saksi",
  };

  const LETTER_TYPE_LABELS: Record<string, string> = {
    outgoing: "Surat Keluar",
    incoming: "Surat Masuk",
    internal: "Nota Dinas",
  };

  return (
    <VerifyLayout orgName={tenant.name} valid>
      {/* Status valid */}
      <div className="flex items-center gap-3 text-green-600">
        <CheckCircle2 className="h-7 w-7 shrink-0" />
        <div>
          <p className="font-semibold text-base">Tanda Tangan Valid</p>
          <p className="text-sm text-muted-foreground">
            Dokumen ini telah ditandatangani secara digital oleh {tenant.name}
          </p>
        </div>
      </div>

      {/* Info surat */}
      {letter && (
        <div className="rounded-lg border border-border divide-y divide-border text-sm">
          <div className="px-4 py-2.5 grid grid-cols-[140px_1fr]">
            <span className="text-muted-foreground">Jenis</span>
            <span>{LETTER_TYPE_LABELS[letter.type] ?? letter.type}</span>
          </div>
          {letter.letterNumber && (
            <div className="px-4 py-2.5 grid grid-cols-[140px_1fr]">
              <span className="text-muted-foreground">Nomor Surat</span>
              <span className="font-mono">{letter.letterNumber}</span>
            </div>
          )}
          <div className="px-4 py-2.5 grid grid-cols-[140px_1fr]">
            <span className="text-muted-foreground">Perihal</span>
            <span>{letter.subject || "—"}</span>
          </div>
          <div className="px-4 py-2.5 grid grid-cols-[140px_1fr]">
            <span className="text-muted-foreground">Tanggal Surat</span>
            <span>{letter.letterDate}</span>
          </div>
        </div>
      )}

      {/* Info penandatangan */}
      <div className="rounded-lg border border-border divide-y divide-border text-sm">
        <div className="px-4 py-2.5 grid grid-cols-[140px_1fr]">
          <span className="text-muted-foreground">Penandatangan</span>
          <span className="font-medium">{member?.name ?? "—"}</span>
        </div>
        <div className="px-4 py-2.5 grid grid-cols-[140px_1fr]">
          <span className="text-muted-foreground">Jabatan</span>
          <span>{officer?.position ?? "—"}</span>
        </div>
        {division && (
          <div className="px-4 py-2.5 grid grid-cols-[140px_1fr]">
            <span className="text-muted-foreground">Divisi</span>
            <span>{division.name}</span>
          </div>
        )}
        <div className="px-4 py-2.5 grid grid-cols-[140px_1fr]">
          <span className="text-muted-foreground">Peran</span>
          <span>{ROLE_LABELS[sig.role] ?? sig.role}</span>
        </div>
        <div className="px-4 py-2.5 grid grid-cols-[140px_1fr]">
          <span className="text-muted-foreground">Waktu TTD</span>
          <span>{new Date(sig.signedAt).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })}</span>
        </div>
      </div>

      {/* Hash + QR */}
      <div className="flex items-start gap-5">
        <div className="shrink-0">
          <img
            src={qrDataUrl}
            alt="QR Code verifikasi"
            width={120}
            height={120}
            className="rounded border border-border"
          />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">Hash verifikasi</p>
          <p className="font-mono text-[11px] break-all text-muted-foreground bg-muted/30 rounded p-2">{hash}</p>
        </div>
      </div>
    </VerifyLayout>
  );
}

// ─── Layout wrapper ───────────────────────────────────────────────────────────

function VerifyLayout({
  orgName,
  valid,
  children,
}: {
  orgName: string;
  valid: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header minimal */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">{orgName}</span>
          <span className="text-xs text-muted-foreground ml-1">· Verifikasi Dokumen</span>
        </div>
      </header>

      {/* Konten */}
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg space-y-5">
          {!valid && (
            <div className="flex items-center gap-3 text-destructive">
              <XCircle className="h-7 w-7 shrink-0" />
              <div>
                <p className="font-semibold text-base">Tanda Tangan Tidak Valid</p>
                <p className="text-sm text-muted-foreground">
                  Hash ini tidak ditemukan dalam sistem {orgName}.
                  Dokumen mungkin telah dimodifikasi atau hash tidak valid.
                </p>
              </div>
            </div>
          )}
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
        Sistem surat digital oleh jalajogja · Verifikasi otomatis
      </footer>
    </div>
  );
}
