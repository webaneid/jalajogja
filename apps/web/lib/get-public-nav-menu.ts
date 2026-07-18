import "server-only";
import { getSettings, type TenantDb } from "@jalajogja/db";
import { parseNavMenu, type NavMenu } from "./nav-menu";

// Fetch + parse nav_menu untuk konsumen di luar layout.tsx (mis. mobile single-page topbar).
// Logika strip-prefix custom-domain SAMA PERSIS dengan yang ada di layout.tsx — jangan
// duplikasi ulang di caller manapun, selalu panggil ini.
//
// Sengaja file TERPISAH dari nav-menu.ts (bukan digabung) — nav-menu.ts diimpor juga oleh
// client component (website-settings-client.tsx), dan import value dari "@jalajogja/db" di
// sana akan menarik postgres client (Node-only) ke client bundle dan bikin build gagal.
export async function getPublicNavMenu(tenantDb: TenantDb, slug: string, baseUrl: string): Promise<NavMenu> {
  const websiteSettings = await getSettings(tenantDb, "website");
  const raw = parseNavMenu(websiteSettings.nav_menu, slug);
  if (baseUrl !== "") return raw;
  return raw.map((item) => ({
    ...item,
    href: item.href.startsWith(`/${slug}/`) ? item.href.slice(`/${slug}`.length)
        : item.href === `/${slug}`           ? "/"
        : item.href,
  }));
}
