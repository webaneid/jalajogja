import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { fetchWidgetArea } from "@/lib/widget-areas";
import { WidgetAreaBuilder } from "@/components/website/widget-area-builder";
import { saveWidgetAreaAction } from "@/app/(dashboard)/[tenant]/website/actions";
import type { SidebarSection } from "@/lib/widget-areas";

export default async function WebsitePengaturanPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const tenantClient = createTenantDb(slug);
  const { db, schema } = tenantClient;

  const [sidebarSections, categories, tags] = await Promise.all([
    fetchWidgetArea("default-sidebar", tenantClient),
    db.select({ id: schema.postCategories.id, name: schema.postCategories.name })
      .from(schema.postCategories)
      .orderBy(schema.postCategories.name),
    db.select({ id: schema.postTags.id, name: schema.postTags.name })
      .from(schema.postTags)
      .orderBy(schema.postTags.name),
  ]);

  async function handleSave(areaId: string, sections: SidebarSection[]) {
    "use server";
    await saveWidgetAreaAction(slug, areaId, sections);
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">Pengaturan Website</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Kelola widget yang tampil di sidebar halaman publik.
      </p>

      <div className="space-y-6">
        <div>
          <h2 className="text-base font-medium mb-1">Sidebar Default</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Ditampilkan di halaman arsip post dan halaman detail post.
          </p>
          <WidgetAreaBuilder
            areaId="default-sidebar"
            initial={sidebarSections ?? []}
            categories={categories}
            tags={tags}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
}
