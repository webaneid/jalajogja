import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, gte, lte, inArray, sql, desc, asc } from "drizzle-orm";
import { db, tenantMemberships, createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { StatCard } from "@/components/dashboard/stat-card";
import { ModuleCard } from "@/components/dashboard/module-card";
import { IncomeExpenseChart } from "@/components/dashboard/income-expense-chart";
import {
  Users, Wallet, AlertCircle, Calendar, ShoppingBag, Handshake, FileText, Globe,
  UserPlus, FilePlus, PenSquare, PackagePlus, HeartHandshake, CalendarPlus,
  ImageIcon,
} from "lucide-react";

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// Normalisasi hasil GROUP BY DATE(...) — postgres.js bisa kembalikan Date object atau string
// tergantung tipe kolom sumber, jadi disamakan ke "YYYY-MM-DD" di sini.
function normalizeDay(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

export default async function TenantDashboardPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const { db: tdb, schema } = createTenantDb(slug);

  const now            = new Date();
  const startOfMonth   = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo  = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const [
    memberTotalRow,
    memberActiveRow,
    memberAlumniRow,
    newMembersRow,
    incomeStatRow,
    expenseStatRow,
    pendingExpenseRow,
    invoicesWaitingRow,
    eventRegPendingRow,
    lowStockRow,
    mitraPendingRow,
    activeProductsRow,
    activeCampaignsRow,
    campaignsCollectedRow,
    upcomingEventsCountRow,
    upcomingEventsList,
    lettersDraftRow,
    recentPosts,
    mediaStatsRow,
    dailyIncomeRows,
    dailyExpenseRows,
  ] = await Promise.all([
    // Anggota — public schema, scoped ke tenant ini
    db.select({ count: sql<string>`COUNT(*)` }).from(tenantMemberships)
      .where(and(eq(tenantMemberships.tenantId, access.tenant.id), inArray(tenantMemberships.status, ["active", "alumni"]))),
    db.select({ count: sql<string>`COUNT(*)` }).from(tenantMemberships)
      .where(and(eq(tenantMemberships.tenantId, access.tenant.id), eq(tenantMemberships.status, "active"))),
    db.select({ count: sql<string>`COUNT(*)` }).from(tenantMemberships)
      .where(and(eq(tenantMemberships.tenantId, access.tenant.id), eq(tenantMemberships.status, "alumni"))),
    db.select({ count: sql<string>`COUNT(*)` }).from(tenantMemberships)
      .where(and(
        eq(tenantMemberships.tenantId, access.tenant.id),
        inArray(tenantMemberships.status, ["active", "alumni"]),
        sql`COALESCE(${tenantMemberships.joinedAt}, ${tenantMemberships.createdAt}) >= ${startOfMonth}`,
      )),

    // Keuangan
    tdb.select({ total: sql<string>`COALESCE(SUM(${schema.payments.amount}), 0)` }).from(schema.payments)
      .where(and(eq(schema.payments.status, "paid"), gte(schema.payments.confirmedAt, startOfMonth))),
    tdb.select({ total: sql<string>`COALESCE(SUM(${schema.disbursements.amount}), 0)` }).from(schema.disbursements)
      .where(and(eq(schema.disbursements.status, "paid"), gte(schema.disbursements.paidAt, startOfMonth))),
    tdb.select({ count: sql<string>`COUNT(*)` }).from(schema.disbursements)
      .where(inArray(schema.disbursements.status, ["draft", "approved"])),
    tdb.select({ count: sql<string>`COUNT(*)` }).from(schema.invoices)
      .where(eq(schema.invoices.status, "waiting_verification")),

    // Perlu tindakan — modul lain
    tdb.select({ count: sql<string>`COUNT(*)` }).from(schema.eventRegistrations)
      .where(eq(schema.eventRegistrations.status, "pending")),
    tdb.select({ count: sql<string>`COUNT(*)` }).from(schema.products)
      .where(and(lte(schema.products.stock, 5), eq(schema.products.status, "active"))),
    tdb.select({ count: sql<string>`COUNT(*)` }).from(schema.mitraApplications)
      .where(eq(schema.mitraApplications.status, "pending")),

    // Toko
    tdb.select({ count: sql<string>`COUNT(*)` }).from(schema.products)
      .where(eq(schema.products.status, "active")),

    // Donasi
    tdb.select({ count: sql<string>`COUNT(*)` }).from(schema.campaigns)
      .where(eq(schema.campaigns.status, "active")),
    tdb.select({ total: sql<string>`COALESCE(SUM(${schema.campaigns.collectedAmount}), 0)` }).from(schema.campaigns)
      .where(eq(schema.campaigns.status, "active")),

    // Event
    tdb.select({ count: sql<string>`COUNT(*)` }).from(schema.events)
      .where(and(eq(schema.events.status, "published"), gte(schema.events.startsAt, now), lte(schema.events.startsAt, sevenDaysAhead))),
    tdb.select({ id: schema.events.id, slug: schema.events.slug, title: schema.events.title, startsAt: schema.events.startsAt })
      .from(schema.events)
      .where(and(eq(schema.events.status, "published"), gte(schema.events.startsAt, now)))
      .orderBy(asc(schema.events.startsAt))
      .limit(3),

    // Surat
    tdb.select({ count: sql<string>`COUNT(*)` }).from(schema.letters)
      .where(eq(schema.letters.status, "draft")),

    // Website
    tdb.select({ id: schema.posts.id, slug: schema.posts.slug, title: schema.posts.title, status: schema.posts.status, createdAt: schema.posts.createdAt })
      .from(schema.posts)
      .orderBy(desc(schema.posts.createdAt))
      .limit(3),
    tdb.select({ count: sql<string>`COUNT(*)`, totalSize: sql<string>`COALESCE(SUM(${schema.media.size}), 0)` }).from(schema.media),

    // Tren 30 hari — grouped by day, bukan 30 query terpisah
    tdb.select({
      day:   sql<unknown>`DATE(${schema.payments.confirmedAt})`,
      total: sql<string>`COALESCE(SUM(${schema.payments.amount}), 0)`,
    }).from(schema.payments)
      .where(and(eq(schema.payments.status, "paid"), gte(schema.payments.confirmedAt, thirtyDaysAgo)))
      .groupBy(sql`DATE(${schema.payments.confirmedAt})`),
    tdb.select({
      day:   sql<unknown>`DATE(${schema.disbursements.paidAt})`,
      total: sql<string>`COALESCE(SUM(${schema.disbursements.amount}), 0)`,
    }).from(schema.disbursements)
      .where(and(eq(schema.disbursements.status, "paid"), gte(schema.disbursements.paidAt, thirtyDaysAgo)))
      .groupBy(sql`DATE(${schema.disbursements.paidAt})`),
  ]);

  // ── Derivasi angka ──────────────────────────────────────────────────────────
  const memberTotal   = Number(memberTotalRow[0]?.count ?? 0);
  const memberActive  = Number(memberActiveRow[0]?.count ?? 0);
  const memberAlumni  = Number(memberAlumniRow[0]?.count ?? 0);
  const newMembers    = Number(newMembersRow[0]?.count ?? 0);

  const incomeTotal   = parseFloat(String(incomeStatRow[0]?.total ?? 0));
  const expenseTotal  = parseFloat(String(expenseStatRow[0]?.total ?? 0));
  const saldo         = incomeTotal - expenseTotal;

  const pendingExpenseCount  = Number(pendingExpenseRow[0]?.count ?? 0);
  const invoicesWaitingCount = Number(invoicesWaitingRow[0]?.count ?? 0);
  const eventRegPendingCount = Number(eventRegPendingRow[0]?.count ?? 0);
  const lowStockCount        = Number(lowStockRow[0]?.count ?? 0);
  const mitraPendingCount    = Number(mitraPendingRow[0]?.count ?? 0);

  const activeProductsCount  = Number(activeProductsRow[0]?.count ?? 0);
  const activeCampaignsCount = Number(activeCampaignsRow[0]?.count ?? 0);
  const campaignsCollected   = parseFloat(String(campaignsCollectedRow[0]?.total ?? 0));
  const upcomingEventsCount  = Number(upcomingEventsCountRow[0]?.count ?? 0);
  const lettersDraftCount    = Number(lettersDraftRow[0]?.count ?? 0);
  const mediaCount           = Number(mediaStatsRow[0]?.count ?? 0);
  const mediaTotalSize       = Number(mediaStatsRow[0]?.totalSize ?? 0);

  const actionItems = [
    { label: "Invoice menunggu verifikasi pembayaran", count: invoicesWaitingCount, href: `/app/${slug}/finance/billing/invoice?status=waiting_verification` },
    { label: "Pencairan menunggu persetujuan",          count: pendingExpenseCount, href: `/app/${slug}/finance/pengeluaran?status=draft` },
    { label: "Pendaftaran event menunggu konfirmasi",   count: eventRegPendingCount, href: `/app/${slug}/event/acara` },
    { label: "Produk stok rendah (≤5)",                 count: lowStockCount, href: `/app/${slug}/toko/produk` },
    { label: "Pengajuan mitra menunggu review",         count: mitraPendingCount, href: `/app/${slug}/toko/mitra` },
  ].filter((item) => item.count > 0);

  const totalActionItems = invoicesWaitingCount + pendingExpenseCount + eventRegPendingCount + lowStockCount + mitraPendingCount;

  // Tren 30 hari
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const incomeMap  = new Map(dailyIncomeRows.map((r) => [normalizeDay(r.day), parseFloat(String(r.total))]));
  const expenseMap = new Map(dailyExpenseRows.map((r) => [normalizeDay(r.day), parseFloat(String(r.total))]));
  const chartData  = days.map((date) => ({
    date,
    income:  incomeMap.get(date)  ?? 0,
    expense: expenseMap.get(date) ?? 0,
  }));

  const quickActions = [
    { label: "Tambah Anggota",       href: `/app/${slug}/members/new`,         icon: UserPlus },
    { label: "Buat Post",            href: `/app/${slug}/website/posts/new`,   icon: PenSquare },
    { label: "Buat Surat",           href: `/app/${slug}/letters/keluar/new`,  icon: FilePlus },
    { label: "Tambah Produk",        href: `/app/${slug}/toko/produk/new`,     icon: PackagePlus },
    { label: "Buat Campaign Donasi", href: `/app/${slug}/donasi/campaign/new`, icon: HeartHandshake },
    { label: "Buat Event",           href: `/app/${slug}/event/acara/new`,     icon: CalendarPlus },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{access.tenant.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ringkasan organisasi — {now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Anggota"
          value={memberTotal.toLocaleString("id-ID")}
          sublabel={newMembers > 0 ? `+${newMembers} bulan ini` : undefined}
          icon={Users}
          href={`/app/${slug}/members`}
        />
        <StatCard
          label="Saldo Kas Bulan Ini"
          value={formatRupiah(saldo)}
          sublabel={now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
          icon={Wallet}
          tone={saldo >= 0 ? "positive" : "negative"}
          href={`/app/${slug}/finance/dashboard`}
        />
        <StatCard
          label="Perlu Tindakan"
          value={String(totalActionItems)}
          sublabel={totalActionItems > 0 ? "lintas semua modul" : "semua beres"}
          icon={AlertCircle}
          tone={totalActionItems > 0 ? "warning" : "positive"}
        />
        <StatCard
          label="Event Mendatang"
          value={String(upcomingEventsCount)}
          sublabel="7 hari ke depan"
          icon={Calendar}
          href={`/app/${slug}/event/acara`}
        />
      </div>

      {/* Grafik Tren */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold">Tren Pemasukan vs Pengeluaran</h2>
          <p className="text-xs text-muted-foreground">30 hari terakhir</p>
        </div>
        <div className="flex items-center gap-4 mb-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-600" /> Pemasukan</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-600" /> Pengeluaran</span>
        </div>
        <IncomeExpenseChart data={chartData} />
      </div>

      {/* Perlu Tindakan */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-3">Perlu Tindakan</h2>
        {actionItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Semua beres, tidak ada tindakan tertunda. 🎉</p>
        ) : (
          <ul className="space-y-1">
            {actionItems.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                    {item.label}
                  </span>
                  <span className="rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5">
                    {item.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Grid Ringkasan Modul */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ModuleCard title="Keuangan" icon={Wallet} href={`/app/${slug}/finance/dashboard`}>
          <p>Pemasukan bulan ini: <span className="font-medium text-foreground">{formatRupiah(incomeTotal)}</span></p>
          <p>Pengeluaran bulan ini: <span className="font-medium text-foreground">{formatRupiah(expenseTotal)}</span></p>
        </ModuleCard>

        <ModuleCard title="Anggota" icon={Users} href={`/app/${slug}/members`}>
          <p>Aktif: <span className="font-medium text-foreground">{memberActive.toLocaleString("id-ID")}</span></p>
          <p>Alumni: <span className="font-medium text-foreground">{memberAlumni.toLocaleString("id-ID")}</span></p>
        </ModuleCard>

        <ModuleCard title="Toko" icon={ShoppingBag} href={`/app/${slug}/toko/produk`}>
          <p>Produk aktif: <span className="font-medium text-foreground">{activeProductsCount.toLocaleString("id-ID")}</span></p>
          <p>Stok rendah: <span className="font-medium text-foreground">{lowStockCount.toLocaleString("id-ID")}</span></p>
        </ModuleCard>

        <ModuleCard title="Donasi" icon={Handshake} href={`/app/${slug}/donasi/campaign`}>
          <p>Campaign aktif: <span className="font-medium text-foreground">{activeCampaignsCount.toLocaleString("id-ID")}</span></p>
          <p>Terkumpul: <span className="font-medium text-foreground">{formatRupiah(campaignsCollected)}</span></p>
        </ModuleCard>

        <ModuleCard title="Event" icon={Calendar} href={`/app/${slug}/event/acara`}>
          {upcomingEventsList.length === 0 ? (
            <p>Belum ada event mendatang.</p>
          ) : (
            upcomingEventsList.map((ev) => (
              <p key={ev.id} className="truncate">
                <span className="font-medium text-foreground">{ev.title}</span>
                {ev.startsAt && <span> — {formatDateShort(ev.startsAt)}</span>}
              </p>
            ))
          )}
        </ModuleCard>

        <ModuleCard title="Surat" icon={FileText} href={`/app/${slug}/letters/keluar`}>
          <p>Draft belum selesai: <span className="font-medium text-foreground">{lettersDraftCount.toLocaleString("id-ID")}</span></p>
        </ModuleCard>

        <ModuleCard title="Website" icon={Globe} href={`/app/${slug}/website/posts`} hrefLabel="Lihat Semua Post">
          {recentPosts.length === 0 ? (
            <p>Belum ada post.</p>
          ) : (
            recentPosts.map((p) => (
              <p key={p.id} className="truncate">{p.title}</p>
            ))
          )}
        </ModuleCard>

        <ModuleCard title="Media" icon={ImageIcon} href={`/app/${slug}/media`}>
          <p>Total file: <span className="font-medium text-foreground">{mediaCount.toLocaleString("id-ID")}</span></p>
          <p>Ukuran: <span className="font-medium text-foreground">{formatBytes(mediaTotalSize)}</span></p>
        </ModuleCard>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Aksi Cepat</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {quickActions.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center text-xs font-medium hover:border-primary/50 hover:bg-muted/40 transition-colors"
            >
              <Icon className="h-5 w-5 text-primary" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
