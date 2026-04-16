"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  UserCheck, Search, CheckCircle2, XCircle,
  Loader2, AlertCircle
} from "lucide-react";
import { checkInRegistrationAction } from "@/app/(dashboard)/[tenant]/event/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type RegistrationItem = {
  id:                 string;
  registrationNumber: string;
  attendeeName:       string;
  attendeePhone:      string | null;
  status:             "pending" | "confirmed" | "cancelled" | "attended";
  ticketName:         string;
  checkedInAt:        Date | null;
};

// ─── EventCheckinClient ───────────────────────────────────────────────────────

export function EventCheckinClient({
  slug,
  registrations: initialRows,
}: {
  slug:          string;
  registrations: RegistrationItem[];
}) {
  const [rows,   setRows]   = useState<RegistrationItem[]>(initialRows);
  const [search, setSearch] = useState("");
  const [lastCheckedIn, setLastCheckedIn] = useState<string | null>(null);
  const [error,  setError]  = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.attendeeName.toLowerCase().includes(q) ||
      r.registrationNumber.toLowerCase().includes(q) ||
      (r.attendeePhone ?? "").includes(q)
    );
  });

  function handleCheckIn(id: string) {
    setError(null);
    setActionId(id);
    startTransition(async () => {
      const res = await checkInRegistrationAction(slug, id);
      setActionId(null);
      if (!res.success) {
        setError(res.error ?? "Gagal check-in.");
        return;
      }
      const checkedName = rows.find((r) => r.id === id)?.attendeeName ?? "";
      setLastCheckedIn(checkedName);
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: "attended", checkedInAt: new Date() }
            : r
        )
      );
      setTimeout(() => setLastCheckedIn(null), 3000);
    });
  }

  const totalAttended  = rows.filter((r) => r.status === "attended").length;
  const totalConfirmed = rows.filter((r) => r.status === "confirmed").length;
  const totalPending   = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-5">
      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{totalAttended}</p>
          <p className="text-xs text-muted-foreground">Hadir</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold">{totalConfirmed}</p>
          <p className="text-xs text-muted-foreground">Terdaftar</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{totalPending}</p>
          <p className="text-xs text-muted-foreground">Menunggu</p>
        </div>
      </div>

      {/* Notifikasi berhasil check-in */}
      {lastCheckedIn && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-sm dark:bg-green-950 dark:border-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-green-800 dark:text-green-200 font-medium">
            {lastCheckedIn} berhasil check-in!
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-destructive">{error}</span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari nama, nomor pendaftaran, HP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          autoFocus
        />
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.map((reg) => {
          const isLoading  = isPending && actionId === reg.id;
          const isAttended = reg.status === "attended";
          const isCancelled = reg.status === "cancelled";

          return (
            <div
              key={reg.id}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                isAttended  ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950"
                : isCancelled ? "border-border bg-muted/30 opacity-60"
                : "border-border bg-card"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{reg.attendeeName}</span>
                  {isAttended && (
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-xs text-muted-foreground">{reg.registrationNumber}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{reg.ticketName}</span>
                  {reg.attendeePhone && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{reg.attendeePhone}</span>
                    </>
                  )}
                </div>
                {isAttended && reg.checkedInAt && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                    Hadir {new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(reg.checkedInAt))}
                  </p>
                )}
              </div>

              <div className="shrink-0">
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : isAttended ? (
                  <Badge variant="outline" className="text-green-600 border-green-300 text-xs">Hadir</Badge>
                ) : isCancelled ? (
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleCheckIn(reg.id)}
                    disabled={isPending}
                    className="h-8 px-3 text-xs"
                  >
                    <UserCheck className="h-3.5 w-3.5 mr-1" />
                    Check-in
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-10 text-sm text-muted-foreground">
            {search ? `Tidak ada peserta dengan kata kunci "${search}"` : "Belum ada pendaftar."}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {filtered.length} dari {rows.length} peserta
      </p>
    </div>
  );
}
