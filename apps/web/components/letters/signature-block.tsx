"use client";

// Layer 2 — Komponen display TTD read-only
// Mode "preview": tampilkan placeholder slot kosong (untuk halaman template)
// Mode "live":    tampilkan data nyata, slot belum TTD = badge "Menunggu"
//
// Dipakai di: letter-template-form.tsx (preview), keluar/[id] & nota/[id] via signature-slot-manager.tsx

import { QrCode } from "lucide-react";
import {
  type SignatureLayout,
  type SignatureSlot,
  SIGNATURE_LAYOUTS,
  SIGNER_ROLE_LABELS,
  formatSignatureDate,
  getSlotLabel,
  buildEmptyMainSlots,
} from "@/lib/letter-signature-layout";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SignatureBlockProps = {
  layout:   SignatureLayout;
  slots:    SignatureSlot[];          // [] = preview pakai placeholder otomatis
  showDate: boolean;
  dateFormat:  "masehi" | "masehi_hijri";
  hijriOffset: number;
  mode:     "preview" | "live";
  // Callback opsional — dipanggil saat icon QR diklik (untuk signature-slot-manager)
  onQrClick?: (slot: SignatureSlot) => void;
};

// ── Sub-komponen satu slot ────────────────────────────────────────────────────

function SlotCard({
  slot,
  label,
  showDate,
  dateFormat,
  hijriOffset,
  mode,
  onQrClick,
}: {
  slot:        SignatureSlot;
  label:       string;
  showDate:    boolean;
  dateFormat:  "masehi" | "masehi_hijri";
  hijriOffset: number;
  mode:        "preview" | "live";
  onQrClick?:  (slot: SignatureSlot) => void;
}) {
  const isSigned  = slot.signedAt !== null;
  const isEmpty   = slot.officerName === null;
  const roleLabel = slot.role ? (SIGNER_ROLE_LABELS[slot.role] ?? label) : label;

  const dateLines = (showDate && slot.signedAt && isSigned)
    ? formatSignatureDate(slot.signedAt, dateFormat, hijriOffset)
    : [];

  return (
    <div className="flex flex-col items-center min-w-[130px] max-w-[180px]">
      {/* Label role / posisi slot */}
      <p className="text-[10px] text-muted-foreground mb-1.5">{roleLabel}</p>

      {/* Area QR / placeholder */}
      {mode === "preview" || !isSigned ? (
        <div className="w-[90px] h-[90px] rounded border border-dashed border-border bg-muted/20 flex items-center justify-center">
          <QrCode className="h-6 w-6 text-muted-foreground/30" />
        </div>
      ) : (
        <button
          type="button"
          title="Lihat QR verifikasi"
          onClick={() => onQrClick?.(slot)}
          className="w-[90px] h-[90px] rounded border border-border overflow-hidden hover:opacity-80 transition-opacity"
        >
          {slot.qrDataUrl ? (
            <img src={slot.qrDataUrl} alt="QR verifikasi" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-muted/20 flex items-center justify-center">
              <QrCode className="h-6 w-6 text-muted-foreground/40" />
            </div>
          )}
        </button>
      )}

      {/* Nama */}
      <p className="mt-2 text-sm font-semibold text-center leading-tight">
        {isEmpty
          ? <span className="text-muted-foreground/50 font-normal italic text-xs">Belum dipilih</span>
          : slot.officerName
        }
      </p>

      {/* Jabatan */}
      {slot.position && (
        <p className="text-xs text-muted-foreground text-center mt-0.5">
          {slot.position}{slot.division ? ` / ${slot.division}` : ""}
        </p>
      )}

      {/* Tanggal TTD */}
      {dateLines.map((line, i) => (
        <p key={i} className="text-[10px] text-muted-foreground text-center mt-0.5">{line}</p>
      ))}

      {/* Badge status — live mode saja */}
      {mode === "live" && !isSigned && !isEmpty && (
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] text-amber-700">
          ⏳ Menunggu TTD
        </span>
      )}
    </div>
  );
}

// ── Komponen utama ────────────────────────────────────────────────────────────

export function SignatureBlock({
  layout,
  slots,
  showDate,
  dateFormat,
  hijriOffset,
  mode,
  onQrClick,
}: SignatureBlockProps) {
  // Jika slots kosong di mode preview, buat placeholder otomatis
  const displaySlots = slots.length === 0 && mode === "preview"
    ? buildEmptyMainSlots(layout)
    : slots;

  const mainSlots    = displaySlots.filter((s) => s.section === "main").sort((a, b) => a.order - b.order);
  const witnessSlots = displaySlots.filter((s) => s.section === "witnesses").sort((a, b) => a.order - b.order);

  const slotProps = { showDate, dateFormat, hijriOffset, mode, onQrClick };

  // ── Render layout ──
  function renderMain() {
    const count = SIGNATURE_LAYOUTS[layout].mainSlots;

    if (layout === "triple-pyramid" && mainSlots.length === 3) {
      const [s1, s2, s3] = mainSlots;
      return (
        <>
          <div className="flex justify-between gap-6 w-full">
            <SlotCard slot={s1} label={getSlotLabel(layout, s1)} {...slotProps} />
            <SlotCard slot={s2} label={getSlotLabel(layout, s2)} {...slotProps} />
          </div>
          <div className="flex justify-center w-full mt-4">
            <SlotCard slot={s3} label={getSlotLabel(layout, s3)} {...slotProps} />
          </div>
        </>
      );
    }

    const justifyClass: Record<SignatureLayout, string> = {
      "single-center":         "justify-center",
      "single-left":           "justify-start",
      "single-right":          "justify-end",
      "double":                "justify-between",
      "triple-row":            "justify-between",
      "triple-pyramid":        "justify-between",  // fallback
      "double-with-witnesses": "justify-between",
    };

    return (
      <div className={`flex flex-wrap gap-6 w-full ${justifyClass[layout]}`}>
        {mainSlots.slice(0, count).map((s) => (
          <SlotCard key={s.order} slot={s} label={getSlotLabel(layout, s)} {...slotProps} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {renderMain()}

      {/* Seksi Saksi — hanya untuk double-with-witnesses */}
      {layout === "double-with-witnesses" && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Saksi:</p>
          <div className="grid grid-cols-3 gap-4">
            {witnessSlots.map((s) => (
              <SlotCard key={`w-${s.order}`} slot={s} label={getSlotLabel(layout, s)} {...slotProps} />
            ))}
            {/* Placeholder tambah saksi — di mode live via signature-slot-manager */}
            {mode === "preview" && witnessSlots.length === 0 && (
              <div className="flex flex-col items-center min-w-[130px] text-center opacity-40">
                <div className="w-[90px] h-[90px] rounded border border-dashed border-border bg-muted/20" />
                <p className="text-xs text-muted-foreground mt-2 italic">Saksi 1</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
