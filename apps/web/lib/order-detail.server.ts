// Pemetaan data detail pesanan untuk halaman admin & produsen (dipakai bersama OrderDetailView). Doc: arsitektur-portal-produsen.md § 23.4.
import "server-only";
import { publicUrl } from "@/lib/minio";
import type { FulfillmentShippingLine } from "@/components/toko/fulfillment-client";

type ShippingRow = {
  id: string; sellerType: string; sellerName: string; courier: string | null; service: string | null; etd: string | null;
  cost: string | number; trackingNumber: string | null; trackingProofPath: string | null; shippedAt: Date | null; status: string;
};

/** Baris pengiriman penjual TENANT → kartu fulfillment (urutan sama dengan input). */
export function mapTenantLines(rows: ShippingRow[], tenantSlug: string): FulfillmentShippingLine[] {
  return rows.filter((sl) => sl.sellerType === "tenant").map((sl) => ({
    id:             sl.id,
    sellerType:     sl.sellerType as "tenant" | "mitra",
    sellerName:     sl.sellerName,
    courier:        sl.courier,
    service:        sl.service,
    etd:            sl.etd ?? null,
    cost:           parseFloat(String(sl.cost)),
    trackingNumber: sl.trackingNumber ?? null,
    trackingProofUrl: sl.trackingProofPath ? publicUrl(tenantSlug, sl.trackingProofPath) : null,
    shippedAt:      sl.shippedAt?.toISOString() ?? null,
    status:         sl.status as FulfillmentShippingLine["status"],
  }));
}

/** Gambar pertama produk (variant square bila ada) — sama dengan getThumb halaman admin. */
export function firstProductImage(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const img = images[0] as { variants?: Record<string, string>; url?: string };
  return img.variants?.square ?? img.url ?? null;
}
