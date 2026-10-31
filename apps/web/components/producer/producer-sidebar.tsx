"use client";

// Sidebar Portal Produsen — tampilan disamakan dengan sidebar dashboard admin (components/dashboard/sidebar*.tsx),
// tetapi daftar menu TETAP (tidak ada permission matrix: produsen = status akun, bukan role pengurus).
// Doc: docs/arsitektur-portal-produsen.md § 19.
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, ClipboardList, Truck, Menu, X } from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard",  icon: LayoutDashboard, path: "dashboard"  },
  { label: "Produk",     icon: Package,         path: "produk"     },
  { label: "Pesanan",    icon: ClipboardList,   path: "pesanan"    },
  { label: "Pengiriman", icon: Truck,           path: "pengiriman" },
] as const;

function SidebarBody({ slug, orgName, producerName, onNavigate }: {
  slug: string; orgName: string; producerName: string; onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const base = `/app/${slug}/portal-produsen`;
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-5">
        <Link href={`${base}/dashboard`} onClick={onNavigate} className="flex min-w-0 items-center gap-2 font-semibold text-foreground hover:opacity-80">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            {orgName.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm leading-tight">{orgName}</span>
            <span className="block truncate text-[11px] font-normal leading-tight text-muted-foreground">Portal Produsen</span>
          </span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="flex flex-col gap-0.5 px-3">
          {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
            const href = `${base}/${path}`;
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={path}
                href={href}
                onClick={onNavigate}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
                  ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t px-5 py-3">
        <p className="truncate text-xs text-muted-foreground">{producerName}</p>
      </div>
    </aside>
  );
}

/** Sidebar tetap untuk desktop (md ke atas). */
export function ProducerSidebar(props: { slug: string; orgName: string; producerName: string }) {
  return <SidebarBody {...props} />;
}

/** Tombol hamburger + drawer untuk HP (di bawah md). */
export function ProducerMobileSidebar(props: { slug: string; orgName: string; producerName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center rounded-md p-1.5 transition-colors hover:bg-accent md:hidden"
        aria-label="Buka menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-40 flex">
            <SidebarBody {...props} onNavigate={() => setOpen(false)} />
            <button onClick={() => setOpen(false)} className="absolute right-2 top-2 rounded-md p-1 hover:bg-accent" aria-label="Tutup menu">
              <X className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </>
  );
}
