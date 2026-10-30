// Format & label bersama halaman produk tunggal (admin + produsen).
export const STATUS_LABELS: Record<string, string> = { draft: "Draft", active: "Aktif", archived: "Diarsipkan" };
export const STATUS_COLORS: Record<string, string> = {
  draft:    "bg-muted text-muted-foreground",
  active:   "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200",
  archived: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200",
};

export function rupiah(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n)
    ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n)
    : "—";
}

export function firstImageUrl(images: { url?: string; variants?: Record<string, string> | null }[]): string | null {
  const first = images[0];
  return first?.variants?.square ?? first?.url ?? null;
}
