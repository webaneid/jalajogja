import Link from "next/link";
import { eq, and, ilike, or, isNull, isNotNull } from "drizzle-orm";
import { UserPlus, Search, Upload } from "lucide-react";
import { db, members, tenantMemberships } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { hasReadAccess } from "@/lib/permissions";
import { checkMemberEligibility } from "@/lib/member-eligibility";
import { resolveForumStatusBadge, shouldShowAccountBadge, type ForumStatus } from "@/lib/forum-status-badge";
import { ForumStatusActions } from "@/components/members/forum-status-actions";

const STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  inactive: "Tidak Aktif",
  alumni: "Alumni",
};

const STATUS_COLOR: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-zinc-100 text-zinc-600",
  alumni: "bg-blue-100 text-blue-700",
};

const FORUM_STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Semua" },
  { value: "pending", label: "Menunggu Persetujuan" },
  { value: "active", label: "Aktif" },
  { value: "pending_claim", label: "Pending Claim" },
  { value: "suspended", label: "Ditangguhkan" },
  { value: "rejected", label: "Ditolak" },
];

const GENDER_LABEL: Record<string, string> = {
  male: "L",
  female: "P",
};

const PAGE_SIZE = 20;

export default async function MembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string; unclaimed?: string }>;
}) {
  const { tenant: slug } = await params;
  const { q = "", status = "", page = "1", unclaimed = "" } = await searchParams;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");
  if (!hasReadAccess(access.tenantUser, "anggota")) redirect(`/app/${slug}/dashboard`);

  const isForumTenant = access.tenant.tenantType === "forum";
  const unclaimedOnly = unclaimed === "1";

  const currentPage = Math.max(1, parseInt(page));
  const offset = (currentPage - 1) * PAGE_SIZE;

  // Query anggota cabang ini saja — JOIN tenant_memberships
  const query = db
    .select({
      id: members.id,
      memberNumber: members.memberNumber,
      stambukNumber: members.stambukNumber,
      name: members.name,
      gender: members.gender,
      status: tenantMemberships.status,
      forumStatus: tenantMemberships.forumStatus,
      membershipNumber: tenantMemberships.membershipNumber,
      betterAuthUserId: members.betterAuthUserId,
      joinedAt: tenantMemberships.joinedAt,
    })
    .from(members)
    .innerJoin(
      tenantMemberships,
      and(
        eq(tenantMemberships.memberId, members.id),
        eq(tenantMemberships.tenantId, access.tenant.id)
      )
    );

  // Filter kondisional — forum pakai forum_status (§ 3 docs/arsitektur-gabung-forum.md),
  // cabang/marhalah tetap status generik seperti sebelumnya (tidak berubah).
  const conditions = [];
  if (isForumTenant) {
    if (status === "pending") conditions.push(eq(tenantMemberships.forumStatus, "pending"));
    else if (status === "active") conditions.push(and(eq(tenantMemberships.forumStatus, "active"), isNotNull(members.betterAuthUserId)));
    else if (status === "pending_claim") conditions.push(and(eq(tenantMemberships.forumStatus, "active"), isNull(members.betterAuthUserId)));
    else if (status === "suspended") conditions.push(eq(tenantMemberships.forumStatus, "suspended"));
    else if (status === "rejected") conditions.push(eq(tenantMemberships.forumStatus, "rejected"));
  } else if (status && ["active", "inactive", "alumni"].includes(status)) {
    conditions.push(eq(tenantMemberships.status, status as "active" | "inactive" | "alumni"));
  }
  if (unclaimedOnly) conditions.push(isNull(members.betterAuthUserId));
  if (q) {
    conditions.push(
      or(
        ilike(members.name, `%${q}%`),
        ilike(members.stambukNumber, `%${q}%`),
        ilike(members.memberNumber, `%${q}%`)
      )
    );
  }

  const rows = await query
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(PAGE_SIZE)
    .offset(offset)
    .orderBy(members.name);

  // "Data Belum Lengkap" (§ 8 docs/arsitektur-gabung-forum.md) — HANYA cabang/marhalah, HANYA
  // baris status="active" (yang lain sudah eksplisit non-aktif, tidak perlu kualifikasi
  // tambahan). Murni label tampilan — TIDAK pernah menulis balik ke DB.
  const eligibilityMap = new Map<string, boolean>();
  if (!isForumTenant) {
    const activeIds = rows.filter((r) => r.status === "active").map((r) => r.id);
    await Promise.all(
      activeIds.map(async (id) => {
        const result = await checkMemberEligibility(id, []);
        eligibilityMap.set(id, result.eligible);
      })
    );
  }

  const statusFilters = isForumTenant
    ? FORUM_STATUS_FILTERS
    : ["", "active", "inactive", "alumni"].map((s) => ({ value: s, label: s === "" ? "Semua" : STATUS_LABEL[s] }));

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Anggota</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Data anggota {access.tenant.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/app/${slug}/members/import`}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2
                       text-sm font-medium hover:bg-muted transition-colors"
          >
            <Upload className="h-4 w-4" />
            Import Anggota
          </Link>
          <Link
            href={`/app/${slug}/members/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2
                       text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <UserPlus className="h-4 w-4" />
            Tambah Anggota
          </Link>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Cari nama / stambuk / no. anggota..."
              className="h-9 w-64 rounded-md border bg-background pl-9 pr-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {status && <input type="hidden" name="status" value={status} />}
          {unclaimedOnly && <input type="hidden" name="unclaimed" value="1" />}
          <button
            type="submit"
            className="h-9 rounded-md border bg-background px-3 text-sm hover:bg-accent transition-colors"
          >
            Cari
          </button>
          {(q || status || unclaimedOnly) && (
            <Link
              href={`/app/${slug}/members`}
              className="h-9 flex items-center px-3 text-sm text-muted-foreground hover:text-foreground"
            >
              Reset
            </Link>
          )}
        </form>

        {/* Filter status */}
        <div className="flex flex-wrap gap-1.5">
          {statusFilters.map((f) => (
            <Link
              key={f.value}
              href={`/app/${slug}/members?status=${f.value}${q ? `&q=${q}` : ""}${unclaimedOnly ? "&unclaimed=1" : ""}`}
              className={`h-9 rounded-md px-3 text-sm font-medium transition-colors flex items-center
                ${status === f.value
                  ? "bg-primary text-primary-foreground"
                  : "border bg-background text-muted-foreground hover:bg-accent"
                }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {/* Filter klaim akun — universal semua tipe tenant */}
        <Link
          href={`/app/${slug}/members?${status ? `status=${status}&` : ""}${q ? `q=${q}&` : ""}unclaimed=${unclaimedOnly ? "0" : "1"}`}
          className={`h-9 rounded-md px-3 text-sm font-medium transition-colors flex items-center gap-1.5
            ${unclaimedOnly
              ? "bg-primary text-primary-foreground"
              : "border bg-background text-muted-foreground hover:bg-accent"
            }`}
        >
          Belum Klaim Akun
        </Link>
      </div>

      {/* Tabel */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {q || status || unclaimedOnly ? "Tidak ada anggota yang cocok." : "Belum ada anggota. Tambah yang pertama!"}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nama</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stambuk</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">No. Anggota</th>
                {isForumTenant && (
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">No. ID Forum</th>
                )}
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">L/P</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                {isForumTenant && (
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((m) => {
                const hasAccount = !!m.betterAuthUserId;
                const forumStatus = m.forumStatus as ForumStatus | null;
                const showAccountBadge = shouldShowAccountBadge(isForumTenant, forumStatus, hasAccount);
                const eligible = eligibilityMap.get(m.id);
                const showIncompleteBadge = !isForumTenant && m.status === "active" && eligible === false;

                let badgeLabel: string;
                let badgeColor: string;
                if (isForumTenant) {
                  const badge = resolveForumStatusBadge(forumStatus, hasAccount);
                  badgeLabel = badge.label;
                  badgeColor = badge.colorClass;
                } else if (showIncompleteBadge) {
                  badgeLabel = "Data Belum Lengkap";
                  badgeColor = "bg-amber-100 text-amber-700";
                } else {
                  badgeLabel = STATUS_LABEL[m.status ?? "active"];
                  badgeColor = STATUS_COLOR[m.status ?? "active"];
                }

                return (
                  <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/${slug}/members/${m.id}`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {m.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.stambukNumber ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {m.memberNumber ?? "—"}
                    </td>
                    {isForumTenant && (
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {m.membershipNumber ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-muted-foreground">
                      {m.gender ? GENDER_LABEL[m.gender] : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeColor}`}>
                          {badgeLabel}
                        </span>
                        {showAccountBadge && (
                          <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Belum Klaim Akun
                          </span>
                        )}
                      </div>
                    </td>
                    {isForumTenant && (
                      <td className="px-4 py-3">
                        <ForumStatusActions slug={slug} memberId={m.id} forumStatus={forumStatus} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {rows.length === PAGE_SIZE && (
        <div className="mt-4 flex justify-end gap-2">
          {currentPage > 1 && (
            <Link
              href={`/app/${slug}/members?page=${currentPage - 1}${q ? `&q=${q}` : ""}${status ? `&status=${status}` : ""}${unclaimedOnly ? "&unclaimed=1" : ""}`}
              className="rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent"
            >
              ← Sebelumnya
            </Link>
          )}
          <Link
            href={`/app/${slug}/members?page=${currentPage + 1}${q ? `&q=${q}` : ""}${status ? `&status=${status}` : ""}${unclaimedOnly ? "&unclaimed=1" : ""}`}
            className="rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent"
          >
            Selanjutnya →
          </Link>
        </div>
      )}
    </div>
  );
}
