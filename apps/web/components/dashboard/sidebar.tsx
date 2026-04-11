import Link from "next/link";
import { SidebarNav } from "./sidebar-nav";

type SidebarProps = {
  slug: string;
  orgName: string;
};

export function Sidebar({ slug, orgName }: SidebarProps) {
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r bg-card">
      {/* Logo + nama organisasi */}
      <div className="flex h-14 items-center border-b px-5">
        <Link
          href={`/${slug}/dashboard`}
          className="flex items-center gap-2 font-semibold text-foreground hover:opacity-80"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            {orgName.charAt(0).toUpperCase()}
          </span>
          <span className="truncate text-sm">{orgName}</span>
        </Link>
      </div>

      {/* Navigasi modul */}
      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNav slug={slug} />
      </div>

      {/* Footer sidebar — versi app */}
      <div className="border-t px-5 py-3">
        <p className="text-xs text-muted-foreground">jalajogja v0.1</p>
      </div>
    </aside>
  );
}
