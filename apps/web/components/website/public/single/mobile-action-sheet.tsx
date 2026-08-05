"use client";

import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";

type Props = {
  // Konten baris ringkas, selalu tampil, seluruh area jadi tombol toggle. Render-prop (bukan
  // node statis) — dilewatkan `expanded` supaya badge CTA (Donasi/Beli/Daftar) di dalamnya bisa
  // berubah dari solid ke outline saat sheet terbuka, agar perhatian tetap ke tombol submit
  // sungguhan di dalam `children`, bukan bersaing dengan badge ini yang tetap terlihat.
  collapsedBar: (expanded: boolean) => React.ReactNode;
  children:     React.ReactNode;   // konten penuh saat expanded
  /** Opsional — set `true` (mis. dari state dialog lain yang akan dibuka) untuk memaksa sheet
   *  collapse. Dipakai supaya sheet ini tidak menutupi dialog/modal LAIN yang dibuka di atasnya
   *  (z-71 di sini lebih tinggi dari z-50 shadcn Dialog/AlertDialog — tanpa collapse, dialog itu
   *  akan render TERSEMBUNYI di baliknya, terlihat seperti "tidak ada respons" saat diklik).
   *  Tidak dipakai (undefined) → sheet murni self-managed seperti sebelumnya, backward compatible. */
  collapseSignal?: boolean;
};

// Bottom sheet generik untuk shell mobile halaman single (event/donasi/produk) — bar ringkas
// nempel di bawah layar, tap untuk expand jadi sheet penuh. Diekstrak dari
// EventMobileTicketBar supaya mekanisme sheet (posisi, animasi, backdrop) dipakai bersama
// lintas modul — yang beda per modul cuma isi `collapsedBar` (QR mini/harga/dll) dan
// `children` (form pendaftaran/form donasi/panel beli).
//
// Animasi max-height (bukan translate) — karena elemen tetap bottom:0 sementara max-height
// tumbuh, sisi ATAS sheet yang naik (bukan geser dari luar layar), menghasilkan efek
// "naik/melebar" tanpa perlu portal atau ukur tinggi konten via JS.
//
// Konten TIDAK di-unmount saat collapse — cuma di-clip via overflow-hidden pada wrapper luar,
// supaya state form di dalam `children` (pilihan tiket/nominal/variasi, dst) tidak hilang
// setiap kali sheet ditutup-buka.
export function MobileActionSheet({ collapsedBar, children, collapseSignal }: Props) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (collapseSignal) setExpanded(false);
  }, [collapseSignal]);

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
          {collapsedBar(expanded)}
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
