"use client";

import { useState } from "react";
import { ChevronUp, Ticket } from "lucide-react";

type Props = {
  registered:   boolean;
  qrSrc?:       string | null;
  statusLabel?: string;
  regNumber?:   string;
  priceLabel?:  string | null;   // dipakai hanya kalau !registered
  children:     React.ReactNode; // konten penuh — sama persis dengan kartu QR / EventRegisterForm di desktop
};

// Bottom sheet tiket untuk shell mobile halaman single event — bar ringkas nempel di bawah
// layar, tap untuk expand jadi sheet penuh (tinggi tumbuh dari bawah, konten TIDAK di-unmount
// saat collapse supaya state form pendaftaran tidak hilang). Pola drawer di-reuse dari
// flex-header.tsx (backdrop bg-black/40 + rounded-t-2xl), animasi max-height baru (belum ada
// presedennya di project). Lihat docs/arsitektur-frontend-publik.md § "Mobile Single-Page Shell".
export function EventMobileTicketBar({ registered, qrSrc, statusLabel, regNumber, priceLabel, children }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="md:hidden">
      {/* Spacer — cegah konten terakhir ketutupan bar collapsed */}
      <div className="h-24" />

      {expanded && (
        <div
          className="fixed inset-0 z-[70] bg-black/40"
          onClick={() => setExpanded(false)}
        />
      )}

      <div
        className={`fixed bottom-0 left-0 right-0 z-[71] bg-background rounded-t-2xl border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.12)] overflow-hidden transition-[max-height] duration-300 ease-out ${
          expanded ? "max-h-[85vh]" : "max-h-24"
        }`}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-3 px-4 py-3"
        >
          {registered ? (
            <>
              {qrSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrSrc} alt="QR Tiket" className="w-12 h-12 rounded-md border border-border shrink-0 bg-white" />
              ) : (
                <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Ticket size={20} className="text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs text-muted-foreground">{statusLabel}</p>
                <p className="text-sm font-semibold font-mono truncate">{regNumber}</p>
              </div>
            </>
          ) : (
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs text-muted-foreground">Tiket</p>
              <p className="text-sm font-semibold">{priceLabel ?? "Daftar Sekarang"}</p>
            </div>
          )}
          {!registered && (
            <span className="btn btn-primary btn-sm shrink-0 pointer-events-none">Daftar</span>
          )}
          <ChevronUp
            size={18}
            className={`text-muted-foreground shrink-0 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
          />
        </button>

        <div
          className="overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          style={{ maxHeight: "calc(85vh - 60px)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
