import { createTenantDb, db, members } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft, Pencil } from "lucide-react";
import { renderBody } from "@/lib/letter-render";
import { LetterSigningSection } from "@/components/letters/letter-signing-section";
import type { AvailableSigner, ExistingSignature } from "@/components/letters/letter-signing-section";

const STATUS_COLORS: Record<string, string> = {
  draft:    "bg-zinc-100 text-zinc-600",
  sent:     "bg-blue-100 text-blue-700",
  received: "bg-green-100 text-green-700",
  archived: "bg-yellow-100 text-yellow-700",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", sent: "Terkirim", received: "Diterima", archived: "Diarsipkan",
};

export default async function NotaDinasDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: letterId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db: tenantDb, schema } = createTenantDb(slug);

  const [letter] = await tenantDb
    .select()
    .from(schema.letters)
    .where(eq(schema.letters.id, letterId))
    .limit(1);

  if (!letter || letter.type !== "internal") notFound();

  const [letterType] = letter.typeId
    ? await tenantDb
        .select({ name: schema.letterTypes.name })
        .from(schema.letterTypes)
        .where(eq(schema.letterTypes.id, letter.typeId))
        .limit(1)
    : [null];

  // Fetch officers yang canSign
  const officers = await tenantDb
    .select({
      id:         schema.officers.id,
      memberId:   schema.officers.memberId,
      position:   schema.officers.position,
      divisionId: schema.officers.divisionId,
      userId:     schema.officers.userId,
    })
    .from(schema.officers)
    .where(eq(schema.officers.canSign, true));

  const memberMap = new Map<string, string>();
  if (officers.length > 0) {
    const memberIds = officers.map((o) => o.memberId);
    const memberRows = await db
      .select({ id: members.id, name: members.name })
      .from(members)
      .where(inArray(members.id, memberIds));
    memberRows.forEach((m) => memberMap.set(m.id, m.name));
  }

  const divisionMap = new Map<string, string>();
  const divisionIds = officers.map((o) => o.divisionId).filter((d): d is string => !!d);
  if (divisionIds.length > 0) {
    const divRows = await tenantDb
      .select({ id: schema.divisions.id, name: schema.divisions.name })
      .from(schema.divisions)
      .where(inArray(schema.divisions.id, divisionIds));
    divRows.forEach((d) => divisionMap.set(d.id, d.name));
  }

  // Cari officer milik user login — via userId dulu, lalu fallback memberId
  const currentUserOfficerId =
    officers.find((o) => o.userId === access.tenantUser.id)?.id ??
    (access.tenantUser.memberId
      ? officers.find((o) => o.memberId === access.tenantUser.memberId)?.id
      : undefined) ??
    null;

  const rawSigs = await tenantDb
    .select()
    .from(schema.letterSignatures)
    .where(eq(schema.letterSignatures.letterId, letterId));

  const signatures: ExistingSignature[] = rawSigs.map((s) => {
    const off = officers.find((o) => o.id === s.officerId);
    return {
      id:               s.id,
      officerId:        s.officerId,
      role:             s.role as "signer" | "approver" | "witness",
      signedAt:         s.signedAt,
      verificationHash: s.verificationHash,
      signerName:       off ? (memberMap.get(off.memberId) ?? "—") : "—",
      signerPosition:   off?.position ?? "—",
      signerDivision:   off?.divisionId ? (divisionMap.get(off.divisionId) ?? null) : null,
    };
  });

  const availableSigners: AvailableSigner[] = officers.map((o) => ({
    officerId:     o.id,
    name:          memberMap.get(o.memberId) ?? "—",
    position:      o.position,
    division:      o.divisionId ? (divisionMap.get(o.divisionId) ?? null) : null,
    canSign:       true,
    isCurrentUser: o.id === currentUserOfficerId,
  }));

  const isAdmin = ["owner", "admin"].includes(access.tenantUser.role);

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Breadcrumb + Edit */}
      <div className="flex items-center justify-between">
        <Link
          href={`/${slug}/letters/nota`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Nota Dinas
        </Link>
        <Link
          href={`/${slug}/letters/nota/${letterId}/edit`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/40"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Link>
      </div>

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
          <span className="text-muted-foreground">Dari</span>
          <span>{letter.sender || "—"}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] px-4 py-2.5">
          <span className="text-muted-foreground">Kepada</span>
          <span>{letter.recipient || "—"}</span>
        </div>
        {letterType && (
          <div className="grid grid-cols-[120px_1fr] px-4 py-2.5">
            <span className="text-muted-foreground">Jenis</span>
            <span>{letterType.name}</span>
          </div>
        )}
      </div>

      {/* Isi nota */}
      {letter.body && (
        <div>
          <h2 className="text-sm font-medium mb-2">Isi Nota Dinas</h2>
          <div
            className="rounded-lg border border-border bg-muted/10 px-6 py-5 text-sm leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: renderBody(letter.body) }}
          />
        </div>
      )}

      {/* Penandatangan */}
      <div>
        <h2 className="text-sm font-medium mb-3">Penandatangan</h2>
        <LetterSigningSection
          slug={slug}
          letterId={letterId}
          availableSigners={availableSigners}
          initialSignatures={signatures}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
