// Widget presentasional Dashboard Produsen (server-safe, tanpa state). docs/arsitektur-portal-produsen.md § 29.
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Package, Trophy, MapPin, ChevronRight } from "lucide-react";
import { rupiah } from "@/lib/rupiah";
import type { TopProduct } from "@/lib/producer-dashboard.server";

export function Card({ title, hint, action, children, className = "" }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div><h2 className="text-sm font-semibold">{title}</h2>{hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

const TONES = {
  green:  "bg-emerald-50 border-emerald-200 text-emerald-900 [&_.ic]:bg-emerald-100 [&_.ic]:text-emerald-700",
  amber:  "bg-amber-50 border-amber-200 text-amber-900 [&_.ic]:bg-amber-100 [&_.ic]:text-amber-700",
  sky:    "bg-sky-50 border-sky-200 text-sky-900 [&_.ic]:bg-sky-100 [&_.ic]:text-sky-700",
  neutral:"bg-card border-border [&_.ic]:bg-primary/10 [&_.ic]:text-primary",
} as const;

export function KpiCard({ label, value, sub, icon: Icon, tone = "neutral", href }: { label: string; value: string; sub?: string; icon: LucideIcon; tone?: keyof typeof TONES; href?: string }) {
  const body = (
    <div className={`h-full rounded-2xl border p-4 transition-shadow hover:shadow-sm ${TONES[tone]}`}>
      <div className="flex items-center gap-2.5">
        <span className="ic flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"><Icon className="h-[18px] w-[18px]" /></span>
        <p className="min-w-0 truncate text-xs font-medium opacity-80">{label}</p>
      </div>
      <p className="mt-3 truncate text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs opacity-70">{sub}</p>}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

const MEDAL = ["bg-amber-400 text-amber-950", "bg-slate-300 text-slate-800", "bg-orange-300 text-orange-950", "bg-muted text-muted-foreground", "bg-muted text-muted-foreground"];

export function TopProducts({ items, base }: { items: TopProduct[]; base: string }) {
  if (items.length === 0) return <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Belum ada penjualan pada periode ini.</p>;
  const max = Math.max(...items.map((i) => i.units), 1);
  return (
    <ol className="space-y-3">
      {items.map((p, i) => (
        <li key={p.productId}>
          <Link href={`${base}/produk/${p.productId}`} className="group flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-muted/50">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${MEDAL[i] ?? MEDAL[4]}`}>{i === 0 ? <Trophy className="h-3.5 w-3.5" /> : i + 1}</span>
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
              {p.image
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={p.image} alt="" className="h-full w-full object-cover" />
                : <div className="flex h-full w-full items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium group-hover:underline">{p.name}</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(6, (p.units / max) * 100)}%` }} /></div>
              <p className="mt-1 text-[11px] text-muted-foreground">{p.buyers} pembeli · {p.orders} pesanan · hak {rupiah(p.earned)}</p>
            </div>
            <div className="shrink-0 text-right"><p className="text-lg font-semibold tabular-nums leading-none">{p.units}</p><p className="text-[10px] text-muted-foreground">terjual</p></div>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function ShippingFunnel({ steps, base }: { steps: { label: string; n: number; tone: string }[]; base: string }) {
  const max = Math.max(...steps.map((s) => s.n), 1);
  return (
    <div className="space-y-2.5">
      {steps.map((s) => (
        <Link key={s.label} href={`${base}/pesanan`} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 text-xs text-muted-foreground">{s.label}</span>
          <div className="h-6 flex-1 overflow-hidden rounded-md bg-muted/60"><div className={`flex h-full items-center rounded-md px-2 text-[11px] font-semibold text-white ${s.tone}`} style={{ width: s.n === 0 ? "0%" : `${Math.max(12, (s.n / max) * 100)}%` }}>{s.n > 0 ? s.n : ""}</div></div>
          <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{s.n}</span>
        </Link>
      ))}
    </div>
  );
}

export function CityBars({ items }: { items: { city: string; n: number }[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Belum ada data daerah.</p>;
  const max = Math.max(...items.map((i) => i.n), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((c) => (
        <li key={c.city} className="flex items-center gap-3">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm capitalize">{c.city.toLowerCase()}</span>
          <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-sky-500" style={{ width: `${(c.n / max) * 100}%` }} /></div>
          <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{c.n}</span>
        </li>
      ))}
    </ul>
  );
}

export function ActionList({ items }: { items: { label: string; count?: number; href: string; tone: "amber" | "rose" | "sky" }[] }) {
  if (items.length === 0) return <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">Semua beres — tidak ada yang perlu ditindaklanjuti.</p>;
  const dot = { amber: "bg-amber-500", rose: "bg-rose-500", sky: "bg-sky-500" } as const;
  return (
    <ul className="divide-y divide-border">
      {items.map((a) => (
        <li key={a.label}>
          <Link href={a.href} className="flex items-center gap-3 py-2.5 text-sm transition-colors hover:text-primary">
            <span className={`h-2 w-2 shrink-0 rounded-full ${dot[a.tone]}`} />
            <span className="flex-1">{a.label}</span>
            {a.count !== undefined && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">{a.count}</span>}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="rounded-lg bg-muted/50 px-3 py-2.5"><p className="text-[11px] text-muted-foreground">{label}</p><p className="text-lg font-semibold tabular-nums leading-tight">{value}</p>{sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}</div>;
}
