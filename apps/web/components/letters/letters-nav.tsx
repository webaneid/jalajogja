"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Surat Keluar",  path: "keluar"      },
  { label: "Surat Masuk",   path: "masuk"       },
  { label: "Nota Dinas",    path: "nota"        },
  { label: "Kontak",        path: "kontak"      },
  { label: "Template",      path: "template"    },
  { label: "Pengaturan",    path: "pengaturan"  },
];

export function LettersNav({ slug }: { slug: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-48 shrink-0 border-r border-border min-h-screen">
      <div className="p-4 border-b border-border">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Surat</p>
      </div>
      <nav className="flex flex-col gap-0.5 p-2">
        {navItems.map(({ label, path }) => {
          const href = `/${slug}/letters/${path}`;
          const isActive = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={path}
              href={href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors
                ${isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
