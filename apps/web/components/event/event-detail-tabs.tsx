"use client";

import { useState } from "react";
import { Users, BarChart2, Info } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TicketStat = {
  ticketId: string;
  name:     string;
  quota:    number | null;
  used:     number;  // confirmed + attended
};

export type StatRow = {
  label: string;
  count: number;
};

export type AttendeeStatsData = {
  angkatan:  StatRow[];
  kabupaten: StatRow[];
  provinsi:  StatRow[];
  profesi:   StatRow[];
};

type Props = {
  showAttendeeList:  boolean;
  showAttendeeStats: boolean;
  attendeeStatsBy:   string[];
  // data peserta
  confirmedCount:    number;
  totalQuota:        number | null;  // null = tidak terbatas
  ticketStats:       TicketStat[];
  attendeeNames:     string[];
  // data statistik
  stats:             AttendeeStatsData;
  // slot konten detail (dari server component)
  detailSlot:        React.ReactNode;
};

// ─── Helper ──────────────────────────────────────────────────────────────────

function StatTable({ rows, label }: { rows: StatRow[]; label: string }) {
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">Tidak ada data {label}.</p>;

  const max = Math.max(...rows.map(r => r.count));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <div className="w-32 shrink-0 text-sm text-muted-foreground truncate" title={r.label}>
            {r.label}
          </div>
          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${max > 0 ? (r.count / max) * 100 : 0}%` }}
            />
          </div>
          <div className="w-8 text-right text-sm font-semibold">{r.count}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EventDetailTabs({
  showAttendeeList,
  showAttendeeStats,
  attendeeStatsBy,
  confirmedCount,
  totalQuota,
  ticketStats,
  attendeeNames,
  stats,
  detailSlot,
}: Props) {
  const hasPesertaTab  = showAttendeeList;
  const hasStatistikTab = showAttendeeStats && attendeeStatsBy.length > 0;

  type TabId = "detail" | "peserta" | "statistik";
  const [active, setActive] = useState<TabId>("detail");

  const tabs: { id: TabId; label: string; icon: React.ReactNode; show: boolean }[] = [
    { id: "detail",    label: "Detail",    icon: <Info      size={14} />, show: true },
    { id: "peserta",   label: "Peserta",   icon: <Users     size={14} />, show: hasPesertaTab },
    { id: "statistik", label: "Statistik", icon: <BarChart2 size={14} />, show: hasStatistikTab },
  ];

  const visibleTabs = tabs.filter(t => t.show);

  // Jika hanya ada 1 tab (Detail), tidak perlu tab bar — render langsung
  if (visibleTabs.length === 1) {
    return <>{detailSlot}</>;
  }

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Detail */}
      {active === "detail" && <>{detailSlot}</>}

      {/* Tab: Peserta */}
      {active === "peserta" && hasPesertaTab && (
        <div className="space-y-5">
          {/* Ringkasan kuota */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-3 text-center">
              <p className="text-2xl font-bold">{confirmedCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Peserta Terdaftar</p>
            </div>
            {totalQuota !== null && (
              <>
                <div className="rounded-lg border border-border bg-card p-3 text-center">
                  <p className="text-2xl font-bold">{totalQuota}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Target Peserta</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3 text-center">
                  <p className={`text-2xl font-bold ${Math.max(0, totalQuota - confirmedCount) === 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                    {Math.max(0, totalQuota - confirmedCount)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Sisa Kuota</p>
                </div>
              </>
            )}
          </div>

          {/* Per tiket */}
          {ticketStats.length > 1 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-left">
                    <th className="px-4 py-2.5 font-medium text-muted-foreground">Jenis Tiket</th>
                    <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">Kuota</th>
                    <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">Terdaftar</th>
                    <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">Sisa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ticketStats.map((t) => (
                    <tr key={t.ticketId}>
                      <td className="px-4 py-2.5">{t.name}</td>
                      <td className="px-4 py-2.5 text-right">{t.quota ?? "∞"}</td>
                      <td className="px-4 py-2.5 text-right">{t.used}</td>
                      <td className="px-4 py-2.5 text-right">
                        {t.quota !== null
                          ? <span className={Math.max(0, t.quota - t.used) === 0 ? "text-destructive" : ""}>
                              {Math.max(0, t.quota - t.used)}
                            </span>
                          : "∞"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Daftar nama */}
          {attendeeNames.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Daftar Nama ({attendeeNames.length})
              </p>
              <div className="rounded-lg border border-border bg-card p-4">
                <ul className="columns-2 space-y-1 text-sm text-muted-foreground">
                  {attendeeNames.map((name, i) => (
                    <li key={i} className="truncate">{name}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada peserta terdaftar.</p>
          )}
        </div>
      )}

      {/* Tab: Statistik */}
      {active === "statistik" && hasStatistikTab && (
        <div className="space-y-6">
          {attendeeStatsBy.includes("angkatan") && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">Angkatan (Tahun Lulus)</p>
              <StatTable rows={stats.angkatan} label="angkatan" />
            </div>
          )}
          {attendeeStatsBy.includes("kabupaten") && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">Domisili — Kabupaten / Kota</p>
              <StatTable rows={stats.kabupaten} label="kabupaten" />
            </div>
          )}
          {attendeeStatsBy.includes("provinsi") && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">Domisili — Provinsi</p>
              <StatTable rows={stats.provinsi} label="provinsi" />
            </div>
          )}
          {attendeeStatsBy.includes("profesi") && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">Profesi</p>
              <StatTable rows={stats.profesi} label="profesi" />
            </div>
          )}
          {confirmedCount === 0 && (
            <p className="text-sm text-muted-foreground">
              Statistik tersedia setelah ada peserta yang terdaftar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
