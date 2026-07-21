import { redirect }    from "next/navigation";
import { headers }     from "next/headers";
import { auth }        from "@/lib/auth";
import { createTenantDb } from "@jalajogja/db";
import { resolveBaseUrl } from "@/lib/resolve-base-url";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { getPageSeoOverride } from "@/lib/get-page-seo-override";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { LoginForm }   from "./login-form";

type Params       = Promise<{ tenant: string }>;
type SearchParams  = Promise<{ redirect?: string }>;

// SEO Fase 3 (docs/arsitektur-seo.md § 3.3) — sebelumnya halaman ini tidak punya
// generateMetadata sama sekali (warisan title default "{siteName}" dari layout).
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug } = await params;
  const base = await getTenantSeoBase(slug);
  const override = await getPageSeoOverride(createTenantDb(slug), slug, "login");
  return buildMetadata({
    title:         override?.metaTitle || "Masuk",
    description:   override?.metaDesc || undefined,
    ogTitle:       override?.ogTitle || undefined,
    ogDescription: override?.ogDescription || undefined,
    siteName:      base.siteName,
    ogImageUrl:    override?.ogImageUrl || base.logoUrl,
    canonicalUrl:  `${base.baseUrl}/login`,
    robots:        override?.robots || undefined,
  });
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params:       Params;
  searchParams: SearchParams;
}) {
  const { tenant: slug }   = await params;
  const { redirect: dest } = await searchParams;

  // Tentukan baseUrl: custom domain → "" (no prefix), jalakarta.com → "/{slug}"
  const reqHeaders  = await headers();
  const baseUrl     = await resolveBaseUrl(slug);
  const defaultDest = `${baseUrl}/akun`;

  // Jika sudah login → langsung ke akun (atau URL tujuan)
  // Hindari redirect ke /akun jika dest adalah /login (loop guard)
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (session?.user) {
    const safe = dest && !dest.includes("/login") ? dest : defaultDest;
    redirect(safe);
  }

  return <LoginForm slug={slug} redirectTo={dest} baseUrl={baseUrl} />;
}
