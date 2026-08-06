import Link from "next/link";
import { SidebarNav } from "./sidebar-nav";
import type { TenantUserForPermission } from "@/lib/permissions";

type SidebarProps = {
  slug:       string;
  orgName:    string;
  tenantUser: TenantUserForPermission;
  /** Logo tenant — hanya diisi saat diakses lewat /admin/* di custom domain (§ 5.3 arsitektur-domain.md) */
  logoUrl?:   string | null;
  /** false saat tenant-branded (custom domain) — sembunyikan atribusi platform */
  showPlatformFooter?: boolean;
  /** true untuk tenant tipe "pusat" (IKPM Pusat) — tampilkan menu "Ringkasan Tenant" */
  isPusatTenant?: boolean;
};

export function Sidebar({
  slug, orgName, tenantUser, logoUrl = null, showPlatformFooter = true, isPusatTenant = false,
}: SidebarProps) {
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r bg-card">
      {/* Logo + nama organisasi */}
      <div className="flex h-14 items-center border-b px-5">
        <Link
          href={`/app/${slug}/dashboard`}
          className="flex items-center gap-2 font-semibold text-foreground hover:opacity-80"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={orgName} className="h-7 w-7 rounded-md object-contain" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              {orgName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate text-sm">{orgName}</span>
        </Link>
      </div>

      {/* Navigasi modul */}
      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNav slug={slug} tenantUser={tenantUser} isPusatTenant={isPusatTenant} />
      </div>

      {/* Footer sidebar — atribusi platform hanya di domain sendiri, bukan custom domain tenant */}
      {showPlatformFooter && (
        <div className="border-t px-5 py-3">
          <p className="text-xs text-muted-foreground">jalakarta v0.1</p>
        </div>
      )}
    </aside>
  );
}
