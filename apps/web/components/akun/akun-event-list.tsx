"use client";

import { useState } from "react";
import { CalendarDays, Ticket, X, CheckCircle2 } from "lucide-react";

type EventItem = {
  id:                 string;
  registrationNumber: string;
  status:             string;
  statusLabel:        string;
  attendeeName:       string;
  attendeePhone:      string | null;
  attendeeEmail:      string | null;
  ticketName:         string | null;
  eventTitle:         string;
  eventSlug:          string | null;
  eventStartsAt:      string | null;
  qrDataUrl:          string;
  tenantSlug:         string;
};

type Props = { items: EventItem[] };

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  confirmed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  attended:  "bg-primary/10 text-primary",
  cancelled: "bg-muted text-muted-foreground",
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
              <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[item.status] ?? STATUS_COLOR.cancelled}`}>
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
            <div className="bg-primary px-4 py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                <p className="text-sm font-semibold text-primary-foreground">Tiket Pendaftaran</p>
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

            {/* QR Code */}
            <div className="flex justify-center py-5 bg-white dark:bg-neutral-950 border-b border-dashed border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selected.qrDataUrl} alt="QR Tiket" className="w-44 h-44" />
            </div>

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
              <p className="text-[10px] text-muted-foreground pt-1 text-center">
                Tunjukkan QR ini kepada panitia saat acara
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
