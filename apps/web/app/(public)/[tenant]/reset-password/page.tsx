import { createTenantDb } from "@jalajogja/db";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { getPageSeoOverride } from "@/lib/get-page-seo-override";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

type Params = Promise<{ tenant: string }>;

// SEO Fase 3 (docs/arsitektur-seo.md § 3.3) — halaman ini sebelumnya "use client" murni,
// generateMetadata TIDAK BISA di-export dari Client Component. Logic form dipindah ke
// reset-password-form.tsx, page.tsx ini jadi Server Component wrapper.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug } = await params;
  const base = await getTenantSeoBase(slug);
  const override = await getPageSeoOverride(createTenantDb(slug), slug, "reset-password");
  return buildMetadata({
    title:         override?.metaTitle || "Reset Password",
    description:   override?.metaDesc || undefined,
    ogTitle:       override?.ogTitle || undefined,
    ogDescription: override?.ogDescription || undefined,
    siteName:      base.siteName,
    ogImageUrl:    override?.ogImageUrl || base.logoUrl,
    canonicalUrl:  `${base.baseUrl}/reset-password`,
    robots:        override?.robots || undefined,
  });
}

export default async function ResetPasswordPage({ params }: { params: Params }) {
  const { tenant: slug } = await params;
  return <ResetPasswordForm slug={slug} />;
}
