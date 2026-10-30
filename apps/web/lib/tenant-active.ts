import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, tenants } from "@jalajogja/db";

// Cek tenant ada + aktif di public.tenants SEBELUM menyentuh tenant schema. WAJIB dipanggil di awal
// generateMetadata / page publik yang memanggil createTenantDb() — Next.js merender layout, page,
// dan generateMetadata PARALEL, jadi guard di layout.tsx saja tidak mencegah query ke schema yang
// tidak ada (bot membuka /sitemap.txt, /wp-login.php, dst → "relation tenant_X.settings does not
// exist"). cache() = satu query per request walau dipanggil di banyak tempat.
export const isActiveTenant = cache(async (slug: string): Promise<boolean> => {
  const [row] = await db
    .select({ isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  return row?.isActive === true;
});
