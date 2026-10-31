"use client";

// Bilah aksi di halaman DETAIL pesanan — SAMA di admin dan produsen (permintaan user 2026-11-01): Cetak Label + Input/Ubah Resi.
// Aksi resi hanya muncul bila pesanan sudah masuk batch DAN berstatus Dikemas (Input Resi) / Dikirim (Ubah Resi, seperti di halaman
// batch); Diterima terkunci. ResiForm yang sama dengan halaman batch (POST /api/produsen/resi; server memeriksa ulang semuanya).
// Doc: arsitektur-portal-produsen.md § 23.
import { useState } from "react";
import { Truck } from "lucide-react";
import { PrintLabelsButton } from "@/components/orders/print-label-dialog";
import { ResiForm } from "@/components/producer/batch-detail-actions";

export function OrderDetailActions({ slug, invoiceId, status, batch, trackingNumber, proofUrl, canChangePhoto, canPrint, printReason, canResi }: {
  slug: string; invoiceId: string; status: string | null;
  batch: { id: string; name: string } | null;
  trackingNumber: string | null; proofUrl: string | null; canChangePhoto: boolean;
  canPrint: boolean; printReason?: string;
  /** Hak mengisi resi (admin: akses penuh toko; produsen: selalu). Server tetap memeriksa ulang. */
  canResi: boolean;
}) {
  const [open, setOpen] = useState(false);
  const resiMode = canResi && batch && (status === "packed" ? "create" : status === "shipped" ? "edit" : null);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <PrintLabelsButton slug={slug} invoiceIds={[invoiceId]} label="Cetak Label" disabled={!canPrint} title={canPrint ? "Cetak label" : printReason} />
        {resiMode && !open && (
          <button type="button" onClick={() => setOpen(true)}
            className={resiMode === "create"
              ? "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
              : "inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted"}>
            <Truck className="h-4 w-4" /> {resiMode === "create" ? "Input Resi" : "Ubah Resi"}
          </button>
        )}
      </div>
      {resiMode && open && batch && (
        <ResiForm slug={slug} batchId={batch.id} invoiceId={invoiceId} edit={resiMode === "edit"} initialResi={trackingNumber ?? ""}
          canChangePhoto={canChangePhoto} onClose={() => setOpen(false)} />
      )}
      {resiMode === "edit" && proofUrl && (
        <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Lihat foto resi</a>
      )}
    </div>
  );
}
