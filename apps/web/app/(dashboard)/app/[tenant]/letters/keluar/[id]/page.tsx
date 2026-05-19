import { createTenantDb, db, members, tenants, getSettings } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft, Pencil, Copy, Users } from "lucide-react";
import { renderBody } from "@/lib/letter-render";
import { generateQrDataUrl, buildVerifyUrl } from "@/lib/qr-code";
import { SignatureSlotManager } from "@/components/letters/signature-slot-manager";
import type { AvailableOfficer } from "@/components/letters/signature-slot-manager";
import type { SignatureSlot } from "@/lib/letter-signature-layout";
import { GeneratePdfButton } from "@/components/letters/generate-pdf-button";
import { BulkChildrenSection } from "@/components/letters/bulk-children-section";
import { resolveMergeFields, buildMergeContext } from "@/lib/letter-merge";

const STATUS_COLORS: Record<string, string> = {
  draft:    "bg-zinc-100 text-zinc-600",
  sent:     "bg-blue-100 text-blue-700",
  received: "bg-green-100 text-green-700",
  archived: "bg-yellow-100 text-yellow-700",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", sent: "Terkirim", received: "Diterima", archived: "Diarsipkan",
};

export default async function SuratKeluarDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: letterId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const tenantClient             = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

  // Fetch settings org — sama persis dengan generate-pdf/route.ts
  const [generalSettingsRaw, orgSettings] = await Promise.all([
    getSettings(tenantClient, "general"),
    getSettings(tenantClient, "contact"),
  ]);

  // Ambil nama tenant dari public.tenants sebagai fallback jika site_name belum diset
  const [tenantRow] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  const orgName    = (generalSettingsRaw["site_name"] as string | undefined) ?? tenantRow?.name ?? "";
  const orgAddress = (orgSettings["contact_address"] as { detail?: string } | undefined)?.detail ?? "";
  const orgPhone   = (orgSettings["contact_phone"] as string | undefined) ?? "";
  const orgEmail   = (orgSettings["contact_email"] as string | undefined) ?? "";

  // dateFormat + hijriOffset dari letter_config
  const rawLetterConfig = (generalSettingsRaw["letter_config"] as {
    date_format?: string; hijri_offset?: number;
  } | undefined) ?? {};
  const globalDateFormat = (rawLetterConfig.date_format ?? "masehi") as "masehi" | "masehi_hijri";
  const hijriOffset = Number(rawLetterConfig.hijri_offset ?? 0);

  // Fetch surat
  const [letter] = await tenantDb
    .select()
    .from(schema.letters)
    .where(eq(schema.letters.id, letterId))
    .limit(1);

  if (!letter || letter.type !== "outgoing") notFound();

  // dateFormat: per jenis surat > global
  const letterTypeData = letter.typeId
    ? await tenantDb
        .select({ name: schema.letterTypes.name, dateFormat: schema.letterTypes.dateFormat })
        .from(schema.letterTypes)
        .where(eq(schema.letterTypes.id, letter.typeId))
        .limit(1)
        .then((r) => r[0] ?? null)
    : null;

  const dateFormat = ((letterTypeData?.dateFormat as "masehi" | "masehi_hijri" | null) ?? globalDateFormat);

  // Layout TTD dari kolom surat
  const signatureLayout   = (letter as { signatureLayout?: string }).signatureLayout as import("@/lib/letter-signature-layout").SignatureLayout ?? "double";
  const signatureShowDate = (letter as { signatureShowDate?: boolean }).signatureShowDate ?? true;

  // Fetch semua officer (aktif — semua bisa jadi penandatangan)
  const officers = await tenantDb
    .select({
      id:         schema.officers.id,
      memberId:   schema.officers.memberId,
      position:   schema.officers.position,
      divisionId: schema.officers.divisionId,
      userId:     schema.officers.userId,
      canSign:    schema.officers.canSign,
      isActive:   schema.officers.isActive,
    })
    .from(schema.officers)
    .where(eq(schema.officers.isActive, true));

  // Fetch nama anggota dari public.members
  const memberMap = new Map<string, string>();
  if (officers.length > 0) {
    const memberIds = officers.map((o) => o.memberId);
    const memberRows = await db
      .select({ id: members.id, name: members.name })
      .from(members)
      .where(inArray(members.id, memberIds));
    memberRows.forEach((m) => memberMap.set(m.id, m.name));
  }

  // Fetch role per member dari tenant.users
  const roleMap = new Map<string, string>();
  if (officers.length > 0) {
    const memberIds = officers.map((o) => o.memberId);
    const userRows = await tenantDb
      .select({ memberId: schema.users.memberId, role: schema.users.role })
      .from(schema.users)
      .where(inArray(schema.users.memberId, memberIds));
    userRows.forEach((u) => { if (u.memberId) roleMap.set(u.memberId, u.role); });
  }

  // Fetch nama divisi
  const divisionMap = new Map<string, string>();
  const divisionIds = officers.map((o) => o.divisionId).filter((d): d is string => !!d);
  if (divisionIds.length > 0) {
    const divRows = await tenantDb
      .select({ id: schema.divisions.id, name: schema.divisions.name })
      .from(schema.divisions)
      .where(inArray(schema.divisions.id, divisionIds));
    divRows.forEach((d) => divisionMap.set(d.id, d.name));
  }

  // Tentukan officer milik user yang login
  const currentUserOfficerId =
    officers.find((o) => o.userId === access.tenantUser.id)?.id ??
    (access.tenantUser.memberId
      ? officers.find((o) => o.memberId === access.tenantUser.memberId)?.id
      : undefined) ??
    null;

  // Fetch tanda tangan yang sudah ada
  const rawSigs = await tenantDb
    .select()
    .from(schema.letterSignatures)
    .where(eq(schema.letterSignatures.letterId, letterId));

  // Convert ke SignatureSlot[] — server-side generate QR hanya untuk yang sudah TTD
  const slots: SignatureSlot[] = await Promise.all(
    rawSigs.map(async (s) => {
      const off      = officers.find((o) => o.id === s.officerId);
      const verifyUrl = s.verificationHash ? buildVerifyUrl(slug, s.verificationHash) : null;
      const qrDataUrl = verifyUrl ? await generateQrDataUrl(verifyUrl) : null;
      return {
        id:           s.id,
        order:        s.slotOrder,
        section:      s.slotSection as SignatureSlot["section"],
        officerId:    s.officerId,
        officerName:  off ? (memberMap.get(off.memberId) ?? "—") : "—",
        position:     off?.position ?? null,
        division:     off?.divisionId ? (divisionMap.get(off.divisionId) ?? null) : null,
        role:         s.role as SignatureSlot["role"],
        signedAt:     s.signedAt,
        qrDataUrl,
        verifyUrl,
        signingToken: s.signingToken,
      };
    })
  );

  const availableOfficers: AvailableOfficer[] = officers.map((o) => ({
    officerId:     o.id,
    name:          memberMap.get(o.memberId) ?? "—",
    position:      o.position,
    division:      o.divisionId ? (divisionMap.get(o.divisionId) ?? null) : null,
    userRole:      roleMap.get(o.memberId) ?? null,
    canSign:       o.canSign ?? false,
    isCurrentUser: o.id === currentUserOfficerId,
  }));

  const isAdmin = hasFullAccess(access.tenantUser, "surat");

  const mf = (letter.mergeFields as Record<string, string> | null) ?? {};

  // Build merge context untuk render body
  const signerInfo = rawSigs
    .filter((s) => s.signedAt !== null)
    .map((s) => {
      const off = officers.find((o) => o.id === s.officerId);
      return {
        name:     off ? (memberMap.get(off.memberId) ?? "—") : "—",
        position: off?.position ?? "—",
        division: off?.divisionId ? (divisionMap.get(off.divisionId) ?? "") : "",
      };
    });

  const mergeCtx = buildMergeContext({
    orgName, orgAddress, orgPhone, orgEmail,
    letterNumber: letter.letterNumber ?? "",
    letterDate:   letter.letterDate   ?? "",
    subject:      letter.subject      ?? "",
    sender:       letter.sender       ?? "",
    recipient:    letter.recipient    ?? "",
    signers:      signerInfo,
    recipientData: {
      name:         letter.recipient               ?? "",
      title:        mf.recipient_title             ?? "",
      organization: mf.recipient_organization      ?? "",
      address:      mf.recipient_address           ?? "",
      phone:        mf.recipient_phone             ?? "",
      email:        mf.recipient_email             ?? "",
    },
  });

  const resolvedBody = resolveMergeFields(letter.body ?? "", mergeCtx);
  const bodyHtml     = renderBody(resolvedBody);

  // Fetch salinan surat (anak dari bulk) jika ini surat induk
  const children = letter.isBulk
    ? await tenantDb
        .select({
          id:           schema.letters.id,
          letterNumber: schema.letters.letterNumber,
          recipient:    schema.letters.recipient,
          status:       schema.letters.status,
          createdAt:    schema.letters.createdAt,
        })
        .from(schema.letters)
        .where(eq(schema.letters.bulkParentId, letterId))
        .orderBy(schema.letters.createdAt)
    : [];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Breadcrumb + tombol aksi */}
      <div className="flex items-center justify-between">
        <Link
          href={`/${slug}/letters/keluar`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Surat Keluar
        </Link>
        <div className="flex items-center gap-2">
          <GeneratePdfButton
            slug={slug}
            letterId={letterId}
            existingPdfUrl={letter.pdfUrl}
          />
          {/* Tombol Kirim Massal — hanya jika admin + belum punya anak */}
          {isAdmin && !letter.isBulk && (
            <Link
              href={`/${slug}/letters/keluar/${letterId}/bulk`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/40"
            >
              <Users className="h-3.5 w-3.5" />
              Kirim Massal
            </Link>
          )}
          <Link
            href={`/${slug}/letters/keluar/${letterId}/edit`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/40"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
        </div>
      </div>

      {/* Warning jika surat sudah di-bulk */}
      {letter.isBulk && (
        <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <Copy className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Surat ini sudah memiliki <strong>{children.length} salinan</strong>.
            Perubahan pada surat induk tidak akan mempengaruhi salinan yang sudah dibuat.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-start gap-3">
          <h1 className="text-xl font-semibold flex-1">{letter.subject || "Tanpa Perihal"}</h1>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[letter.status] ?? "bg-muted text-muted-foreground"}`}>
            {STATUS_LABELS[letter.status] ?? letter.status}
          </span>
        </div>
        {letter.letterNumber && (
          <p className="text-sm font-mono text-muted-foreground">{letter.letterNumber}</p>
        )}
      </div>

      {/* Metadata */}
      <div className="rounded-lg border border-border divide-y divide-border text-sm">
        <div className="grid grid-cols-[120px_1fr] px-4 py-2.5">
          <span className="text-muted-foreground">Tanggal</span>
          <span>{letter.letterDate}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] px-4 py-2.5">
          <span className="text-muted-foreground">Pengirim</span>
          <span>{letter.sender || "—"}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] px-4 py-2.5">
          <span className="text-muted-foreground">Kepada</span>
          <span>{letter.recipient || "—"}</span>
        </div>
        {letterTypeData && (
          <div className="grid grid-cols-[120px_1fr] px-4 py-2.5">
            <span className="text-muted-foreground">Jenis</span>
            <span>{letterTypeData.name}</span>
          </div>
        )}
        <div className="grid grid-cols-[120px_1fr] px-4 py-2.5">
          <span className="text-muted-foreground">Ukuran Kertas</span>
          <span>{letter.paperSize}</span>
        </div>
      </div>

      {/* Isi surat */}
      {bodyHtml && (
        <div>
          <h2 className="text-sm font-medium mb-2">Isi Surat</h2>
          <div
            className="prose prose-sm max-w-none [&_p]:my-2 [&_h2]:mt-4 [&_h2]:mb-2 [&_table]:w-full [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2 [&_th]:bg-muted"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </div>
      )}

      {/* Penandatangan */}
      <div>
        <h2 className="text-sm font-medium mb-3">Penandatangan</h2>
        <SignatureSlotManager
          mode="detail"
          slug={slug}
          letterId={letterId}
          layout={signatureLayout}
          showDate={signatureShowDate}
          dateFormat={dateFormat}
          hijriOffset={hijriOffset}
          initialSlots={slots}
          availableOfficers={availableOfficers}
          isAdmin={isAdmin}
          appUrl={appUrl}
        />
      </div>

      {/* Salinan surat (bulk children) */}
      {letter.isBulk && (
        <div>
          <h2 className="text-sm font-medium mb-3">Salinan Surat ({children.length})</h2>
          <BulkChildrenSection
            slug={slug}
            parentId={letterId}
            isAdmin={isAdmin}
            initialChildren={children.map((c) => ({
              id:           c.id,
              letterNumber: c.letterNumber ?? null,
              recipient:    c.recipient,
              status:       c.status as "draft" | "sent" | "archived",
            }))}
          />
        </div>
      )}
    </div>
  );
}
