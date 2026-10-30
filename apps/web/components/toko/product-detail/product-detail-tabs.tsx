// Navigasi tab produk tunggal — server component, tab = TAUTAN (?tab=...), tanpa state/JS client.
// Daftar tab didefinisikan SATU kali di sini; `view` menentukan tab mana yang ada (tab "laporan" hanya admin).
// Doc: docs/arsitektur-portal-produsen.md § 17.
import Link from "next/link";

export type ProductDetailView = "admin" | "producer";
export type ProductTabId = "ringkasan" | "pesanan" | "detail" | "laporan";

export function productTabs(view: ProductDetailView, opts: { canSeeReport?: boolean } = {}): { id: ProductTabId; label: string }[] {
  return [
    { id: "ringkasan", label: "Ringkasan" },
    { id: "pesanan",   label: "Pesanan Masuk" },
    { id: "detail",    label: "Detail Produk" },
    ...(view === "admin" && opts.canSeeReport ? [{ id: "laporan" as const, label: "Laporan & Produsen" }] : []),
  ];
}

/** Tab aktif dari ?tab= — nilai tak dikenal / tak diizinkan untuk view ini → tab pertama (jangan percaya query). */
export function resolveActiveTab(raw: string | undefined, tabs: { id: ProductTabId }[]): ProductTabId {
  return tabs.find((t) => t.id === raw)?.id ?? tabs[0].id;
}

export function ProductDetailTabNav({ basePath, tabs, active }: {
  basePath: string; tabs: { id: ProductTabId; label: string }[]; active: ProductTabId;
}) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border" aria-label="Bagian halaman produk">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.id === tabs[0].id ? basePath : `${basePath}?tab=${t.id}`}
          className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            active === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          aria-current={active === t.id ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
