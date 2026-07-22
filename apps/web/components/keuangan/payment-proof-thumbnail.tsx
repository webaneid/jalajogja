"use client";

// PaymentProofThumbnail — thumbnail bukti transfer/tanda terima di halaman detail
// pemasukan. Klik = lightbox popup (bukan buka tab baru) — konsisten dengan pola
// yang sudah dipakai di invoice-detail-client.tsx.

import { useState } from "react";
import { X } from "lucide-react";

type Props = { url: string; label: string };

export function PaymentProofThumbnail({ url, label }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full overflow-hidden rounded-md border border-border"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} className="w-full max-h-64 object-contain bg-muted/20 cursor-zoom-in" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition-colors"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={label}
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
