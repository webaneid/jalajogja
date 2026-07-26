// Halaman penandatangan via link token — membutuhkan login front-end
// Alur: cek session → cek identitas + canSign → tampilkan form TTD
// Jika belum login → tampilkan form login inline (redirect ke halaman ini setelah login)
// Jika login tapi bukan pemilik slot → pesan akses ditolak
import { auth }           from "@/lib/auth";
import { headers }        from "next/headers";
import { createTenantDb, db, members, tenants, getSettings } from "@jalajogja/db";
import { eq }             from "drizzle-orm";
import { notFound }       from "next/navigation";
import { SigningPageClient } from "@/components/letters/signing-page-client";
import { SignLoginForm }  from "./sign-login-form";
import { renderBody }     from "@/lib/letter-render";
import { resolveMergeFields, buildMergeContext } from "@/lib/letter-merge";
import { resolveBaseUrl } from "@/lib/resolve-base-url";

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

  if (!tenant?.isActive) notFound();

  const tenantClient             = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

  // Cari slot TTD by signingToken
  const [sig] = await tenantDb
    .select()
    .from(schema.letterSignatures)
    .where(eq(schema.letterSignatures.signingToken, token))
    .limit(1);

  if (!sig) {
    return (
      <InfoCard
        title="Link Tidak Valid"
        message="Link tanda tangan ini tidak ditemukan atau sudah tidak berlaku."
      />
    );
  }

  // Token kadaluarsa — hanya blokir jika belum TTD
  const isExpired =
    sig.signingTokenExpiresAt !== null &&
    sig.signingTokenExpiresAt !== undefined &&
    (sig.signingTokenExpiresAt as Date) < new Date();

  if (isExpired && !sig.signedAt) {
    return (
      <InfoCard
        title="Link Kadaluarsa"
        message="Link tanda tangan ini sudah tidak berlaku. Minta admin untuk mengirim ulang link baru."
      />
    );
  }

  // Ambil officer dengan canSign + member dengan betterAuthUserId
  const [officer] = await tenantDb
    .select({
      id:         schema.officers.id,
      memberId:   schema.officers.memberId,
      position:   schema.officers.position,
      divisionId: schema.officers.divisionId,
      canSign:    schema.officers.canSign,
    })
    .from(schema.officers)
    .where(eq(schema.officers.id, sig.officerId))
    .limit(1);

  if (!officer) {
    return (
      <InfoCard
        title="Data Tidak Ditemukan"
        message="Data pengurus tidak ditemukan. Hubungi admin."
      />
    );
  }

  const [memberRow] = await db
    .select({ name: members.name, betterAuthUserId: members.betterAuthUserId })
    .from(members)
    .where(eq(members.id, officer.memberId))
    .limit(1);

  const officerName         = memberRow?.name ?? "—";
  const officerBetterAuthId = memberRow?.betterAuthUserId ?? null;

  // Ambil info surat — tambah `body` + `sender` supaya isi surat bisa di-preview sebelum TTD
  // (sebelumnya cuma metadata, officer menandatangani "buta" — lihat
  // docs/arsitektur-modul-surat.md § 4 Bug #2).
  const [letter] = await tenantDb
    .select({
      id:           schema.letters.id,
      subject:      schema.letters.subject,
      letterNumber: schema.letters.letterNumber,
      letterDate:   schema.letters.letterDate,
      recipient:    schema.letters.recipient,
      sender:       schema.letters.sender,
      body:         schema.letters.body,
    })
    .from(schema.letters)
    .where(eq(schema.letters.id, sig.letterId))
    .limit(1);

  if (!letter) notFound();

  // Resolve merge fields + render body → HTML — pola sama persis dengan
  // letters/keluar/[id]/page.tsx (reuse, bukan logic baru). Context minimal (tanpa signers/
  // recipientData penuh) — cukup untuk kebutuhan preview read-only di halaman ini.
  let bodyHtml: string | null = null;
  try {
    const [generalSettingsRaw, orgSettings] = await Promise.all([
      getSettings(tenantClient, "general"),
      getSettings(tenantClient, "contact"),
    ]);
    const orgName    = (generalSettingsRaw["site_name"] as string | undefined) ?? tenant.name ?? "";
    const orgAddress = (orgSettings["contact_address"] as { detail?: string } | undefined)?.detail ?? "";
    const orgPhone   = (orgSettings["contact_phone"] as string | undefined) ?? "";
    const orgEmail   = (orgSettings["contact_email"] as string | undefined) ?? "";

    const mergeCtx = buildMergeContext({
      orgName, orgAddress, orgPhone, orgEmail,
      letterNumber: letter.letterNumber ?? "",
      letterDate:   letter.letterDate   ?? "",
      subject:      letter.subject      ?? "",
      sender:       letter.sender       ?? "",
      recipient:    letter.recipient    ?? "",
      signers:      [],
    });
    const resolvedBody = resolveMergeFields(letter.body ?? "", mergeCtx);
    bodyHtml = renderBody(resolvedBody, { tenantSlug: slug, baseUrl: await resolveBaseUrl(slug) });
  } catch (err) {
    console.error("[sign/token] gagal render body surat:", err);
    bodyHtml = null;
  }

  const divisionName = officer.divisionId
    ? await tenantDb
        .select({ name: schema.divisions.name })
        .from(schema.divisions)
        .where(eq(schema.divisions.id, officer.divisionId))
        .limit(1)
        .then((r) => r[0]?.name ?? null)
    : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  // ── Cek session ───────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() });

  // Belum login → tampilkan form login inline dengan konteks surat
  if (!session?.user?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/5 px-4 py-12">
        <div className="max-w-md w-full space-y-4">
          <p className="text-center text-xs text-muted-foreground">{tenant.name}</p>

          {/* Konteks surat */}
          <div className="rounded-xl border border-border bg-background p-6 space-y-3">
            <p className="text-sm font-semibold">Permintaan Tanda Tangan Surat</p>
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">
                Perihal:{" "}
                <span className="text-foreground font-medium">{letter.subject}</span>
              </p>
              {letter.letterNumber && (
                <p className="text-muted-foreground">
                  Nomor:{" "}
                  <span className="text-foreground font-mono">{letter.letterNumber}</span>
                </p>
              )}
              <p className="text-muted-foreground">
                Penandatangan:{" "}
                <span className="text-foreground font-medium">{officerName}</span>
              </p>
            </div>
          </div>

          {/* Form login */}
          <div className="rounded-xl border border-border bg-background p-6 space-y-4">
            <div>
              <p className="text-sm font-semibold">Masuk untuk menandatangani</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Gunakan akun IKPM yang terdaftar sebagai pengurus.
              </p>
            </div>
            <SignLoginForm slug={slug} redirectTo={`/${slug}/sign/${token}`} />
          </div>
        </div>
      </div>
    );
  }

  // ── Verifikasi identitas + canSign ────────────────────────────────────────
  const isCorrectUser = Boolean(officerBetterAuthId && officerBetterAuthId === session.user.id);
  const hasCanSign    = officer.canSign === true;

  if (!isCorrectUser || !hasCanSign) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/5 px-4">
        <div className="max-w-sm w-full rounded-xl border border-border bg-background p-8 text-center space-y-3">
          <p className="text-lg font-semibold text-destructive">Akses Ditolak</p>
          <p className="text-sm text-muted-foreground">
            Anda tidak memiliki otoritas menandatangi surat ini.
          </p>
        </div>
      </div>
    );
  }

  // ── Authorized → tampilkan halaman TTD ───────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/5 px-4 py-12">
      <div className="max-w-md w-full">
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
          officerPosition={officer.position ?? null}
          officerDivision={divisionName}
          bodyHtml={bodyHtml}
          role={sig.role as "signer" | "approver" | "witness"}
          alreadySigned={sig.signedAt !== null}
          verificationHash={sig.verificationHash}
          appUrl={appUrl}
        />
      </div>
    </div>
  );
}
