import Link from "next/link";

type Props = {
  slug:   string;
  active: "invoice" | "cicilan";
};

// Tab kecil penghubung Invoice <-> Cicilan — billing tidak punya sub-nav shell terpisah
// (struktur folder finance/billing/ flat, page.tsx cuma redirect ke /invoice), jadi
// penghubungnya cukup tab ringan di kedua halaman, bukan layout baru.
export function BillingTabs({ slug, active }: Props) {
  const tabs = [
    { key: "invoice" as const,  label: "Invoice", href: `/app/${slug}/finance/billing/invoice` },
    { key: "cicilan" as const,  label: "Cicilan",  href: `/app/${slug}/finance/billing/cicilan` },
  ];

  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            active === t.key
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
