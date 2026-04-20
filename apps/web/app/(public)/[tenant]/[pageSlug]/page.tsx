import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { createTenantDb, db, tenants } from "@jalajogja/db";
import { DefaultTemplate } from "@/components/website/public/default-template";
import { LandingTemplate } from "@/components/website/public/landing-template";
import { ContactTemplate } from "@/components/website/public/contact-template";
import { LinktreeTemplate } from "@/components/website/public/linktree-template";
import { parseLandingBody, parseContactBody, parseLinktreeBody } from "@/lib/page-templates";
import { getSettings } from "@jalajogja/db";
import type { Metadata } from "next";

export const revalidate = 60;

type Params = Promise<{ tenant: string; pageSlug: string }>;

async function getPage(slug: string, pageSlug: string) {
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant?.isActive) return null;

  const tenantClient             = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

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
    .where(eq(schema.pages.slug, pageSlug))
    .limit(1);

  if (!page || page.status !== "published") return null;

  let coverUrl: string | null = null;
  if (page.coverId) {
    const [media] = await tenantDb
      .select({ path: schema.media.path })
      .from(schema.media)
      .where(eq(schema.media.id, page.coverId))
      .limit(1);
    coverUrl = media?.path ?? null;
  }

  return { page, coverUrl, tenantName: tenant.name, tenantClient, slug };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug, pageSlug } = await params;
  const result = await getPage(slug, pageSlug);
  if (!result) return {};
  const { page, tenantName } = result;
  return {
    title:       page.metaTitle || `${page.title} — ${tenantName}`,
    description: page.metaDesc ?? undefined,
  };
}

export default async function PublicPageRoute({ params }: { params: Params }) {
  const { tenant: slug, pageSlug } = await params;
  const result = await getPage(slug, pageSlug);
  if (!result) notFound();

  const { page, coverUrl, tenantClient, tenantName } = result;

  if (page.template === "landing") {
    const body = parseLandingBody(page.content);
    return (
      <LandingTemplate
        body={body}
        tenantSlug={slug}
        tenantClient={tenantClient}
      />
    );
  }

  if (page.template === "contact") {
    const body     = parseContactBody(page.content);
    const settings = await getSettings(tenantClient, "contact");
    return (
      <ContactTemplate
        tenantSlug={slug}
        pageId={page.id}
        title={page.title}
        body={body}
        settings={settings as Parameters<typeof ContactTemplate>[0]["settings"]}
      />
    );
  }

  if (page.template === "linktree") {
    const body = parseLinktreeBody(page.content);
    return (
      <LinktreeTemplate
        title={page.title}
        body={body}
        orgName={tenantName}
      />
    );
  }

  // default + about template: render Tiptap HTML
  return (
    <DefaultTemplate
      title={page.title}
      content={page.content}
      coverUrl={coverUrl}
      updatedAt={page.updatedAt}
    />
  );
}
