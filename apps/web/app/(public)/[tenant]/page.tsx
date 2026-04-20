import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { createTenantDb, db, tenants, getSettings } from "@jalajogja/db";
import { DefaultTemplate } from "@/components/website/public/default-template";
import { LandingTemplate } from "@/components/website/public/landing-template";
import { ContactTemplate } from "@/components/website/public/contact-template";
import { LinktreeTemplate } from "@/components/website/public/linktree-template";
import { parseLandingBody, parseContactBody, parseLinktreeBody } from "@/lib/page-templates";
import type { Metadata } from "next";

export const revalidate = 60;

type Params = Promise<{ tenant: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug } = await params;
  const [tenant] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  return { title: tenant?.name ?? slug };
}

export default async function PublicHomePage({ params }: { params: Params }) {
  const { tenant: slug } = await params;

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant?.isActive) notFound();

  const tenantClient             = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

  // Baca homepage_slug dari settings
  const websiteSettings = await getSettings(tenantClient, "website");
  const homepageSlug    = (websiteSettings.homepage_slug as string | undefined) ?? "";

  // Fallback: tidak ada homepage → tampilkan placeholder
  if (!homepageSlug) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="text-3xl font-bold">{tenant.name}</h1>
        <p className="text-muted-foreground">
          Website sedang dipersiapkan. Silakan atur halaman beranda di{" "}
          <strong>Pengaturan → Website</strong>.
        </p>
      </div>
    );
  }

  const [page] = await tenantDb
    .select({
      id:        schema.pages.id,
      title:     schema.pages.title,
      content:   schema.pages.content,
      template:  schema.pages.template,
      status:    schema.pages.status,
      coverId:   schema.pages.coverId,
      updatedAt: schema.pages.updatedAt,
      metaTitle: schema.pages.metaTitle,
      metaDesc:  schema.pages.metaDesc,
    })
    .from(schema.pages)
    .where(eq(schema.pages.slug, homepageSlug))
    .limit(1);

  if (!page || page.status !== "published") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="text-3xl font-bold">{tenant.name}</h1>
        <p className="text-muted-foreground">Halaman beranda belum tersedia.</p>
      </div>
    );
  }

  if (page.template === "landing") {
    return (
      <LandingTemplate
        body={parseLandingBody(page.content)}
        tenantSlug={slug}
        tenantClient={tenantClient}
      />
    );
  }

  if (page.template === "contact") {
    const generalSettings = await getSettings(tenantClient, "contact");
    return (
      <ContactTemplate
        tenantSlug={slug}
        pageId={page.id}
        title={page.title}
        body={parseContactBody(page.content)}
        settings={generalSettings as Parameters<typeof ContactTemplate>[0]["settings"]}
      />
    );
  }

  if (page.template === "linktree") {
    return (
      <LinktreeTemplate
        title={page.title}
        body={parseLinktreeBody(page.content)}
        orgName={tenant.name}
      />
    );
  }

  // default + about
  let coverUrl: string | null = null;
  if (page.coverId) {
    const [media] = await tenantDb
      .select({ path: schema.media.path })
      .from(schema.media)
      .where(eq(schema.media.id, page.coverId))
      .limit(1);
    coverUrl = media?.path ?? null;
  }

  return (
    <DefaultTemplate
      title={page.title}
      content={page.content}
      coverUrl={coverUrl}
      updatedAt={page.updatedAt}
    />
  );
}
