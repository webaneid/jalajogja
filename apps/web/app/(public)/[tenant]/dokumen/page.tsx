import { notFound }      from "next/navigation";
import { eq, and, ilike, isNotNull } from "drizzle-orm";
import { createTenantDb, db, tenants } from "@jalajogja/db";
import { FileText, FolderOpen, Search, FileDown, Eye } from "lucide-react";
import type { Metadata } from "next";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { getPageSeoOverride } from "@/lib/get-page-seo-override";

export const revalidate = 60;

type Params       = Promise<{ tenant: string }>;
type SearchParams = Promise<{ q?: string; category?: string }>;

// ─── Metadata ─────────────────────────────────────────────────────────────────
// SEO ringan per kategori (Fase 2, docs/arsitektur-seo.md § 3.2) — kalau ?category= aktif
// (kuirk: nilainya ID, bukan slug — lihat komentar buildDocumentCategoryUrl di
// lib/public-url-registry.ts) dan kategori itu punya metaTitle/metaDesc, timpa default.
// Selain itu jatuh ke override page-wide (Fase 3, § 3.3), lalu fallback hardcode
// "Dokumen — {siteName}".

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { tenant: slug } = await params;
  const { category }     = await searchParams;
  const base = await getTenantSeoBase(slug);
  const tenantClient = createTenantDb(slug);

  const override = await getPageSeoOverride(tenantClient, slug, "dokumen-archive");
  let title       = override?.metaTitle || `Dokumen — ${base.siteName}`;
  let description = override?.metaDesc || undefined;
  let canonicalUrl = `${base.baseUrl}/dokumen`;

  if (category) {
    const { db: tenantDb, schema } = tenantClient;
    const [cat] = await tenantDb
      .select({ name: schema.documentCategories.name, metaTitle: schema.documentCategories.metaTitle, metaDesc: schema.documentCategories.metaDesc })
      .from(schema.documentCategories).where(eq(schema.documentCategories.id, category)).limit(1);
    if (cat) {
      title        = cat.metaTitle || `Dokumen ${cat.name} — ${base.siteName}`;
      description  = cat.metaDesc || undefined;
      canonicalUrl = `${base.baseUrl}/dokumen?category=${category}`;
    }
  }

  return buildMetadata({
    title, description,
    ogTitle:       override?.ogTitle || undefined,
    ogDescription: override?.ogDescription || undefined,
    siteName:      base.siteName,
    ogImageUrl:    override?.ogImageUrl || base.logoUrl,
    canonicalUrl,
    robots:        override?.robots || undefined,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: Date | null) {
  if (!d) return null;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DokumenArchivePage({
  params,
  searchParams,
}: {
  params:       Params;
  searchParams: SearchParams;
}) {
  const { tenant: slug }   = await params;
  const { q, category }    = await searchParams;

  // Validasi tenant
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenant?.isActive) notFound();

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Query dokumen publik + join versi aktif + join kategori
  const rows = await tenantDb
    .select({
      id:            schema.documents.id,
      title:         schema.documents.title,
      description:   schema.documents.description,
      tags:          schema.documents.tags,
      updatedAt:     schema.documents.updatedAt,
      categoryId:    schema.documents.categoryId,
      categoryName:  schema.documentCategories.name,
      // versi aktif
      versionId:     schema.documentVersions.id,
      fileName:      schema.documentVersions.fileName,
      fileSize:      schema.documentVersions.fileSize,
      mimeType:      schema.documentVersions.mimeType,
      versionNumber: schema.documentVersions.versionNumber,
    })
    .from(schema.documents)
    .leftJoin(
      schema.documentVersions,
      eq(schema.documentVersions.id, schema.documents.currentVersionId),
    )
    .leftJoin(
      schema.documentCategories,
      eq(schema.documentCategories.id, schema.documents.categoryId),
    )
    .where(
      and(
        eq(schema.documents.visibility, "public"),
        isNotNull(schema.documents.currentVersionId),
        q ? ilike(schema.documents.title, `%${q}%`) : undefined,
        category ? eq(schema.documents.categoryId, category) : undefined,
      ),
    )
    .orderBy(schema.documentCategories.name, schema.documents.title);

  // Ambil semua kategori yang punya dokumen publik (untuk filter)
  const allCategories = await tenantDb
    .selectDistinct({
      id:   schema.documentCategories.id,
      name: schema.documentCategories.name,
    })
    .from(schema.documents)
    .innerJoin(
      schema.documentCategories,
      eq(schema.documentCategories.id, schema.documents.categoryId),
    )
    .where(eq(schema.documents.visibility, "public"))
    .orderBy(schema.documentCategories.name);

  // Grouping by kategori
  const grouped: Record<string, { catName: string | null; docs: typeof rows }> = {};
  const uncategorized: typeof rows = [];

  for (const row of rows) {
    if (row.categoryId && row.categoryName) {
      if (!grouped[row.categoryId]) {
        grouped[row.categoryId] = { catName: row.categoryName, docs: [] };
      }
      grouped[row.categoryId].docs.push(row);
    } else {
      uncategorized.push(row);
    }
  }

  const baseUrl = `/${slug}`;

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <FolderOpen className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Dokumen</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Arsip dokumen resmi {tenant.name}
        </p>
      </div>

      {/* Search + Filter */}
      <form method="get" className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Cari dokumen..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background
                       focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {allCategories.length > 1 && (
          <select
            name="category"
            defaultValue={category ?? ""}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-background
                       focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Semua Kategori</option>
            {allCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg
                     hover:bg-primary/90 transition-colors shrink-0"
        >
          Cari
        </button>
      </form>

      {/* Kosong */}
      {rows.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {q ? `Tidak ada dokumen yang cocok dengan "${q}"` : "Belum ada dokumen publik."}
          </p>
          {q && (
            <a href={`${baseUrl}/dokumen`} className="mt-2 inline-block text-xs text-primary underline">
              Tampilkan semua
            </a>
          )}
        </div>
      )}

      {/* List per kategori */}
      <div className="space-y-10">
        {Object.entries(grouped).map(([catId, { catName, docs }]) => (
          <section key={catId}>
            <div className="flex items-center gap-2 mb-4">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-base">{catName}</h2>
              <span className="text-xs text-muted-foreground">({docs.length})</span>
            </div>
            <DokumenGrid docs={docs} slug={slug} />
          </section>
        ))}

        {/* Tanpa kategori */}
        {uncategorized.length > 0 && (
          <section>
            {Object.keys(grouped).length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-base">Lainnya</h2>
              </div>
            )}
            <DokumenGrid docs={uncategorized} slug={slug} />
          </section>
        )}
      </div>
    </div>
  );
}

// ─── DokumenGrid ──────────────────────────────────────────────────────────────

type DocRow = {
  id:            string;
  title:         string;
  description:   string | null;
  tags:          string[];
  updatedAt:     Date | null;
  fileName:      string | null;
  fileSize:      number | null;
  mimeType:      string | null;
  versionNumber: number | null;
};

function DokumenGrid({ docs, slug }: { docs: DocRow[]; slug: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {docs.map((doc) => {
        const fileUrl  = `/api/documents/${doc.id}/file?slug=${slug}`;
        const detailUrl = `/${slug}/dokumen/view/${doc.id}`;
        const sizeStr  = formatBytes(doc.fileSize);
        const dateStr  = formatDate(doc.updatedAt);

        return (
          <div
            key={doc.id}
            className="group flex flex-col rounded-xl border border-border bg-card
                       hover:border-primary/40 hover:shadow-sm transition-all p-5 gap-3"
          >
            {/* Icon + judul */}
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                  {doc.title}
                </h3>
                {doc.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {doc.description}
                  </p>
                )}
              </div>
            </div>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">PDF</span>
              {sizeStr && <span>{sizeStr}</span>}
              {doc.versionNumber && doc.versionNumber > 1 && (
                <span>v{doc.versionNumber}</span>
              )}
              {dateStr && <span className="ml-auto">{dateStr}</span>}
            </div>

            {/* Tags */}
            {doc.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {doc.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Aksi */}
            <div className="flex gap-2 mt-auto pt-1">
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium
                           border border-border rounded-lg px-3 py-2
                           hover:bg-muted/50 transition-colors"
              >
                <Eye className="h-3.5 w-3.5" />
                Buka PDF
              </a>
              <a
                href={`${detailUrl}`}
                className="flex items-center justify-center gap-1.5 text-xs font-medium
                           bg-primary text-primary-foreground rounded-lg px-3 py-2
                           hover:bg-primary/90 transition-colors"
              >
                <FileDown className="h-3.5 w-3.5" />
                Detail
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
