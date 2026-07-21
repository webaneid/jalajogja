import { createTenantDb } from "@jalajogja/db";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { getPageSeoOverride } from "@/lib/get-page-seo-override";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

type Params = Promise<{ tenant: string }>;

// SEO Fase 3 (docs/arsitektur-seo.md § 3.3) — halaman ini sebelumnya "use client" murni,
// generateMetadata TIDAK BISA di-export dari Client Component. Logic form dipindah ke
// forgot-password-form.tsx, page.tsx ini jadi Server Component wrapper.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug } = await params;
  const base = await getTenantSeoBase(slug);
  const override = await getPageSeoOverride(createTenantDb(slug), slug, "forgot-password");
  return buildMetadata({
    title:         override?.metaTitle || "Lupa Password",
    description:   override?.metaDesc || undefined,
    ogTitle:       override?.ogTitle || undefined,
    ogDescription: override?.ogDescription || undefined,
    siteName:      base.siteName,
    ogImageUrl:    override?.ogImageUrl || base.logoUrl,
    canonicalUrl:  `${base.baseUrl}/forgot-password`,
    robots:        override?.robots || undefined,
  });
}

export default async function ForgotPasswordPage({ params }: { params: Params }) {
  const { tenant: slug } = await params;
  return <ForgotPasswordForm slug={slug} />;
}
