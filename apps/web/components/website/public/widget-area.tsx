import { fetchWidgetArea, fetchSidebarPosts } from "@/lib/widget-areas";
import { PostCardList } from "@/components/website/public/post-cards/post-card-list";
import type { TenantDb } from "@jalajogja/db";

type Props = {
  id:           string;
  tenantClient: TenantDb;
  tenantSlug:   string;
};

export async function WidgetArea({ id, tenantClient, tenantSlug }: Props) {
  const sections = await fetchWidgetArea(id, tenantClient);
  if (!sections) return null;

  return (
    <aside className="flex flex-col gap-6">
      {sections.map(section => (
        <SidebarSection
          key={section.id}
          section={{ id: section.id, type: section.type, label: section.label, filter: section.filter, limit: section.limit }}
          tenantClient={tenantClient}
          tenantSlug={tenantSlug}
        />
      ))}
    </aside>
  );
}

async function SidebarSection({
  section,
  tenantClient,
  tenantSlug,
}: {
  section:      Parameters<typeof fetchSidebarPosts>[1];
  tenantClient: TenantDb;
  tenantSlug:   string;
}) {
  const posts = await fetchSidebarPosts(tenantClient, section, tenantSlug);
  if (!posts.length) return null;

  return (
    <div>
      <h2 className="font-bold text-base mb-3 pb-2 border-b border-border">
        {section.label}
      </h2>
      <div>
        {posts.map(post => (
          <PostCardList key={post.id} post={post} tenantSlug={tenantSlug} />
        ))}
      </div>
    </div>
  );
}
