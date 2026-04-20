import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq, desc, isNotNull } from "drizzle-orm";
import { ChevronLeft, UserCheck, UserX, Mail, Phone, MapPin } from "lucide-react";
import { db, profiles, members, tenantMemberships, createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { LinkMemberClient } from "./link-member-client";

// ─── Label maps ───────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:                { label: "Draft",               color: "bg-zinc-100 text-zinc-600" },
  pending:              { label: "Menunggu Pembayaran",  color: "bg-yellow-100 text-yellow-700" },
  waiting_verification: { label: "Menunggu Verifikasi",  color: "bg-orange-100 text-orange-700" },
  partial:              { label: "Bayar Sebagian",       color: "bg-blue-100 text-blue-700" },
  paid:                 { label: "Lunas",                color: "bg-green-100 text-green-700" },
  cancelled:            { label: "Dibatalkan",           color: "bg-red-100 text-red-700" },
  overdue:              { label: "Jatuh Tempo",          color: "bg-red-100 text-red-700" },
};

const SOURCE_LABEL: Record<string, string> = {
  cart:               "Toko",
  order:              "Pesanan",
  donation:           "Donasi",
  event_registration: "Event",
  manual:             "Manual",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-3 border-b last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="col-span-2 text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 mb-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: Date | string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AkunDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: profileId } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  // ── Fetch profile ─────────────────────────────────────────────────────────
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, profileId),
  });

  if (!profile || profile.deletedAt) notFound();

  // ── Fetch linked member (jika ada) ────────────────────────────────────────
  const linkedMember = profile.memberId
    ? await db.query.members.findFirst({ where: eq(members.id, profile.memberId) })
    : null;

  // ── Riwayat invoice di tenant ini ─────────────────────────────────────────
  const { db: tenantDb, schema } = createTenantDb(slug);

  const invoices = await tenantDb
    .select({
      id:            schema.invoices.id,
      invoiceNumber: schema.invoices.invoiceNumber,
      sourceType:    schema.invoices.sourceType,
      customerName:  schema.invoices.customerName,
      total:         schema.invoices.total,
      paidAmount:    schema.invoices.paidAmount,
      status:        schema.invoices.status,
      createdAt:     schema.invoices.createdAt,
    })
    .from(schema.invoices)
    .where(eq(schema.invoices.profileId, profileId))
    .orderBy(desc(schema.invoices.createdAt))
    .limit(50);

  return (
    <div className="p-6 max-w-3xl space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/${slug}/akun`} className="flex items-center gap-1 hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Akun Publik
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{profile.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              profile.accountType === "member"
                ? "bg-blue-100 text-blue-700"
                : "bg-muted text-muted-foreground"
            }`}>
              {profile.accountType === "member"
                ? <UserCheck className="h-3 w-3" />
                : <UserX className="h-3 w-3" />
              }
              {profile.accountType === "member" ? "Alumni IKPM" : "Akun Publik"}
            </span>
            {profile.deletedAt && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                Akun Dihapus
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Identitas */}
      <Section title="Identitas">
        <dl>
          <Row label="Nama" value={profile.name} />
          <Row label="Email" value={profile.email} />
          <Row label="Nomor HP / WA" value={profile.phone} />
          <Row label="Terdaftar" value={formatDate(profile.createdAt)} />
        </dl>
      </Section>

      {/* Alamat (jika ada) */}
      {(profile.addressDetail || profile.provinceId) && (
        <Section title="Alamat">
          <dl>
            <Row label="Detail" value={profile.addressDetail} />
            <Row label="Negara" value={profile.country} />
          </dl>
        </Section>
      )}

      {/* Link ke Anggota */}
      <Section title="Link ke Anggota IKPM">
        {linkedMember ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
              <p className="text-sm font-medium text-blue-900">{linkedMember.name}</p>
              {linkedMember.memberNumber && (
                <p className="text-xs text-blue-700 mt-0.5">No. Anggota: {linkedMember.memberNumber}</p>
              )}
            </div>
            <LinkMemberClient
              slug={slug}
              profileId={profileId}
              currentMemberId={linkedMember.id}
              currentMemberName={linkedMember.name}
              mode="unlink"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Akun ini belum ter-link ke anggota IKPM. Jika pemilik akun adalah alumni, hubungkan ke data anggota untuk verifikasi identitas.
            </p>
            <LinkMemberClient
              slug={slug}
              profileId={profileId}
              currentMemberId={null}
              currentMemberName={null}
              mode="link"
            />
          </div>
        )}
      </Section>

      {/* Riwayat Transaksi */}
      <Section title={`Riwayat Transaksi di Cabang Ini (${invoices.length})`}>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada transaksi di cabang ini.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">No. Invoice</th>
                  <th className="text-left px-3 py-2 font-medium">Sumber</th>
                  <th className="text-left px-3 py-2 font-medium">Total</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => {
                  const st = STATUS_LABEL[inv.status] ?? { label: inv.status, color: "bg-muted text-muted-foreground" };
                  return (
                    <tr key={inv.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2.5 font-mono text-xs">{inv.invoiceNumber ?? "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{SOURCE_LABEL[inv.sourceType ?? ""] ?? inv.sourceType ?? "—"}</td>
                      <td className="px-3 py-2.5">{formatCurrency(parseFloat(String(inv.total ?? 0)))}</td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{formatDate(inv.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
