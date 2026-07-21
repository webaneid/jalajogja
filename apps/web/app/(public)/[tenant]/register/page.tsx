import { redirect }      from "next/navigation";
import { headers }       from "next/headers";
import { auth }          from "@/lib/auth";
import { db, tenants, createTenantDb } from "@jalajogja/db";
import { eq }            from "drizzle-orm";
import { RegisterForm }  from "./register-form";
import { resolveOrgLabels } from "@/lib/tenant-org-label";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { getPageSeoOverride } from "@/lib/get-page-seo-override";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

type Params = Promise<{ tenant: string }>;

// SEO Fase 3 (docs/arsitektur-seo.md § 3.3) — sebelumnya halaman ini tidak punya
// generateMetadata sama sekali.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug } = await params;
  const base = await getTenantSeoBase(slug);
  const override = await getPageSeoOverride(createTenantDb(slug), slug, "register");
  return buildMetadata({
    title:         override?.metaTitle || "Daftar",
    description:   override?.metaDesc || undefined,
    ogTitle:       override?.ogTitle || undefined,
    ogDescription: override?.ogDescription || undefined,
    siteName:      base.siteName,
    ogImageUrl:    override?.ogImageUrl || base.logoUrl,
    canonicalUrl:  `${base.baseUrl}/register`,
    robots:        override?.robots || undefined,
  });
}

export default async function RegisterPage({ params }: { params: Params }) {
  const { tenant: slug } = await params;

  // Jika sudah login → langsung ke akun
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    redirect(`/${slug}/akun`);
  }

  const [tenant] = await db
    .select({
      name:           tenants.name,
      tenantType:     tenants.tenantType,
      marhalahYear:   tenants.marhalahYear,
      marhalahPeriod: tenants.marhalahPeriod,
    })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  const orgLabels = resolveOrgLabels({
    name:           tenant?.name ?? "IKPM Gontor",
    tenantType:     (tenant?.tenantType as "cabang" | "marhalah" | "forum") ?? "cabang",
    marhalahYear:   tenant?.marhalahYear ?? null,
    marhalahPeriod: (tenant?.marhalahPeriod as "awal" | "akhir" | null) ?? null,
  });

  return <RegisterForm slug={slug} orgLabels={orgLabels} />;
}
