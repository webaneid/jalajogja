"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  XCircle, UserCheck,
  Search, Loader2, BadgeCheck, BanknoteIcon
} from "lucide-react";
import {
  approveRegistrationAction,
  confirmRegistrationPaymentAction,
  cancelRegistrationAction,
} from "@/app/(dashboard)/[tenant]/event/actions";
import { EventCertificateButton } from "./event-certificate-button";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RegistrationRow = {
  id:                 string;
  registrationNumber: string;
  attendeeName:       string;
  attendeePhone:      string | null;
  attendeeEmail:      string | null;
  status:             "pending" | "confirmed" | "cancelled" | "attended";
  checkedInAt:        Date | null;
  ticketName:         string;
  ticketPrice:        number;
  paymentId:          string | null;
  paymentStatus:      "pending" | "submitted" | "paid" | "cancelled" | null;
  paymentMethod:      string | null;
  certificateUrl:     string | null;
  createdAt:          Date;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RegistrationRow["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending:   { label: "Menunggu",   variant: "secondary"   },
  confirmed: { label: "Dikonfirmasi", variant: "default"   },
  cancelled: { label: "Dibatalkan", variant: "destructive" },
  attended:  { label: "Hadir",      variant: "outline"     },
};

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

// ─── EventRegistrationList ────────────────────────────────────────────────────

export function EventRegistrationList({
  slug,
  eventId,
  registrations: initialRows,
}: {
  slug:          string;
  eventId:       string;
  registrations: RegistrationRow[];
}) {
  const [rows,   setRows]   = useState<RegistrationRow[]>(initialRows);
  const [search, setSearch] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.attendeeName.toLowerCase().includes(q) ||
      r.registrationNumber.toLowerCase().includes(q) ||
      (r.attendeePhone ?? "").toLowerCase().includes(q) ||
      (r.attendeeEmail ?? "").toLowerCase().includes(q)
    );
  });

  function runAction(
    id: string,
    fn: () => Promise<{ success: boolean; error?: string }>
  ) {
    setError(null);
    setActionId(id);
    startTransition(async () => {
      const res = await fn();
      setActionId(null);
      if (!res.success) {
        setError(res.error ?? "Terjadi kesalahan.");
        return;
      }
      // Optimistic update status
      setRows((prev) => prev.map((r) => {
        if (r.id !== id) return r;
        return r; // data sudah di-revalidate via server action
      }));
      // Refresh data via router (server revalidatePath sudah dipanggil)
      window.location.reload();
    });
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        Belum ada pendaftaran untuk event ini.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari nama, nomor, email, HP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground">No. Daftar</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground">Peserta</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground hidden sm:table-cell">Tiket</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground hidden md:table-cell">Daftar</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground">Status</th>
              <th className="text-right px-3 py-2.5 font-medium text-xs text-muted-foreground">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((reg) => {
              const isLoading = isPending && actionId === reg.id;
              const isPaid    = reg.paymentStatus === "paid" || reg.ticketPrice <= 0;

              return (
                <tr key={reg.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {reg.registrationNumber}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium">{reg.attendeeName}</p>
                    {reg.attendeePhone && (
                      <p className="text-xs text-muted-foreground">{reg.attendeePhone}</p>
                    )}
                    {reg.attendeeEmail && (
                      <p className="text-xs text-muted-foreground">{reg.attendeeEmail}</p>
                    )}
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell">
                    <p className="text-xs">{reg.ticketName}</p>
                    {reg.ticketPrice > 0 && (
                      <p className="text-xs text-muted-foreground">{formatRupiah(reg.ticketPrice)}</p>
                    )}
                    {reg.ticketPrice <= 0 && (
                      <p className="text-xs text-muted-foreground">Gratis</p>
                    )}
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(reg.createdAt)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="space-y-1">
                      <Badge variant={STATUS_CONFIG[reg.status].variant} className="text-xs">
                        {STATUS_CONFIG[reg.status].label}
                      </Badge>
                      {reg.paymentStatus && reg.ticketPrice > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Bayar:{" "}
                          {reg.paymentStatus === "paid"      ? "✓ Lunas"
                          : reg.paymentStatus === "submitted" ? "Menunggu konfirmasi"
                          : reg.paymentStatus === "cancelled" ? "Dibatalkan"
                          : "Belum bayar"}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {isLoading && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      )}

                      {/* Konfirmasi pembayaran */}
                      {!isLoading && reg.paymentId &&
                        reg.paymentStatus &&
                        ["pending", "submitted"].includes(reg.paymentStatus) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          title="Konfirmasi Pembayaran"
                          onClick={() =>
                            runAction(reg.id, () =>
                              confirmRegistrationPaymentAction(slug, reg.paymentId!)
                            )
                          }
                        >
                          <BanknoteIcon className="h-3 w-3 mr-1" />
                          Konfirmasi
                        </Button>
                      )}

                      {/* Setujui pendaftaran gratis / waiting approval */}
                      {!isLoading &&
                        reg.status === "pending" &&
                        (isPaid || reg.ticketPrice <= 0) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          title="Setujui Pendaftaran"
                          onClick={() =>
                            runAction(reg.id, () =>
                              approveRegistrationAction(slug, reg.id)
                            )
                          }
                        >
                          <BadgeCheck className="h-3 w-3 mr-1" />
                          Setujui
                        </Button>
                      )}

                      {/* Batalkan */}
                      {!isLoading && reg.status !== "cancelled" && reg.status !== "attended" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Batalkan Pendaftaran"
                          onClick={() =>
                            runAction(reg.id, () =>
                              cancelRegistrationAction(slug, reg.id)
                            )
                          }
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {/* Sertifikat — hanya untuk hadir/confirmed */}
                      {!isLoading && (reg.status === "attended" || reg.status === "confirmed") && (
                        <EventCertificateButton
                          slug={slug}
                          eventId={eventId}
                          registrationId={reg.id}
                          existingUrl={reg.certificateUrl}
                        />
                      )}

                      {/* Status icons */}
                      {reg.status === "attended" && (
                        <UserCheck className="h-4 w-4 text-green-500" />
                      )}
                      {reg.status === "cancelled" && (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && search && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Tidak ada hasil untuk &ldquo;{search}&rdquo;
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Menampilkan {filtered.length} dari {rows.length} pendaftar
      </p>
    </div>
  );
}
