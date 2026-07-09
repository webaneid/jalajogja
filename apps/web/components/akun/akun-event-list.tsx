"use client";

import { useState } from "react";
import { CalendarDays, Ticket, X, CheckCircle2, Clock, ExternalLink } from "lucide-react";

type EventItem = {
  id:                 string;
  registrationNumber: string;
  status:             string;
  statusLabel:        string;
  invoiceStatus:      string | null;
  attendeeName:       string;
  attendeePhone:      string | null;
  attendeeEmail:      string | null;
  ticketName:         string | null;
  eventTitle:         string;
  eventSlug:          string | null;
  eventStartsAt:      string | null;
  qrDataUrl:          string | null;
  invoiceId:          string | null;
  tenantSlug:         string;
};

type Props = { items: EventItem[] };

const STATUS_COLOR: Record<string, string> = {
  pending:              "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  waiting_verification: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  confirmed:            "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  attended:             "bg-primary/10 text-primary",
  cancelled:            "bg-muted text-muted-foreground",
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "long", year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

export function AkunEventList({ items }: Props) {
  const [selected, setSelected] = useState<EventItem | null>(null);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <CalendarDays className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">Belum ada keikutsertaan event.</p>
      </div>
    );
  }

  return (
    <>
      {/* List */}
      <div className="space-y-3">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelected(item)}
            className="w-full text-left rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-muted/30 transition-all p-4 space-y-2"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-sm leading-snug">{item.eventTitle}</p>
              <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                item.invoiceStatus === "waiting_verification"
                  ? STATUS_COLOR.waiting_verification
                  : (STATUS_COLOR[item.status] ?? STATUS_COLOR.cancelled)
              }`}>
                {item.statusLabel}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {item.eventStartsAt && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {formatDate(item.eventStartsAt)}
                </span>
              )}
              {item.ticketName && (
                <span className="flex items-center gap-1">
                  <Ticket className="h-3 w-3" />
                  {item.ticketName}
                </span>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground font-mono">{item.registrationNumber}</p>
          </button>
        ))}
      </div>

      {/* Modal QR Tiket */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative w-full max-w-xs bg-card rounded-2xl shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-4 py-3 flex items-center justify-between gap-2 ${
              selected.invoiceStatus === "waiting_verification"
                ? "bg-blue-600"
                : selected.status === "pending"
                ? "bg-amber-500"
                : "bg-primary"
            }`}>
              <div className="flex items-center gap-2">
                {selected.invoiceStatus === "waiting_verification"
                  ? <Clock className="h-4 w-4 text-white" />
                  : selected.status === "pending"
                  ? <Clock className="h-4 w-4 text-white" />
                  : <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                }
                <p className="text-sm font-semibold text-white">Tiket Pendaftaran</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
                  {selected.statusLabel}
                </span>
                <button onClick={() => setSelected(null)} className="text-white/80 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Menunggu verifikasi admin */}
            {selected.invoiceStatus === "waiting_verification" ? (
              <div className="px-4 py-5 border-b border-dashed border-border bg-blue-50 dark:bg-blue-950/30">
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-1">
                  Bukti pembayaran Anda sudah diterima.
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                  Menunggu konfirmasi dari panitia. QR tiket akan tersedia setelah dikonfirmasi.
                </p>
                {selected.invoiceId && (
                  <a
                    href={`/${selected.tenantSlug}/invoice/${selected.invoiceId}`}
                    className="flex items-center justify-center gap-2 w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Lihat Invoice
                  </a>
                )}
              </div>
            ) : selected.status === "pending" ? (
              /* Belum bayar: tampilkan link ke invoice pembayaran */
              <div className="px-4 py-5 border-b border-dashed border-border bg-amber-50 dark:bg-amber-950/30">
                <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-3">
                  Pendaftaran Anda menunggu pembayaran.
                </p>
                {selected.invoiceId ? (
                  <a
                    href={`/${selected.tenantSlug}/invoice/${selected.invoiceId}`}
                    className="flex items-center justify-center gap-2 w-full rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Lihat Invoice &amp; Bayar Sekarang
                  </a>
                ) : (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Hubungi panitia untuk informasi pembayaran.
                  </p>
                )}
              </div>
            ) : selected.qrDataUrl ? (
              /* Confirmed/Attended: tampilkan QR */
              <div className="flex justify-center py-5 bg-white dark:bg-neutral-950 border-b border-dashed border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selected.qrDataUrl} alt="QR Tiket" className="w-44 h-44" />
              </div>
            ) : null}

            {/* Info */}
            <div className="px-4 py-4 space-y-2.5 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Event</p>
                <p className="font-semibold leading-snug">{selected.eventTitle}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">No. Pendaftaran</p>
                <p className="font-mono font-bold text-base">{selected.registrationNumber}</p>
              </div>
              {selected.ticketName && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Tiket</p>
                  <p>{selected.ticketName}</p>
                </div>
              )}
              <div className="border-t border-border pt-2.5 space-y-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Nama</p>
                  <p className="font-medium">{selected.attendeeName}</p>
                </div>
                {selected.attendeePhone && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">HP</p>
                    <p>{selected.attendeePhone}</p>
                  </div>
                )}
                {selected.attendeeEmail && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Email</p>
                    <p className="truncate">{selected.attendeeEmail}</p>
                  </div>
                )}
              </div>
              {selected.status !== "pending" && (
                <p className="text-[10px] text-muted-foreground pt-1 text-center">
                  Tunjukkan QR ini kepada panitia saat acara
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
