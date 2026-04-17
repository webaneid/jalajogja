import { redirect } from "next/navigation";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { canManageUsers } from "@/lib/permissions";
import { RolesManageClient } from "@/components/settings/roles-manage-client";

export default async function SettingsRolesPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  if (!canManageUsers(access.tenantUser)) {
    redirect(`/${slug}/settings/general`);
  }

  const { db: tenantDb, schema } = createTenantDb(slug);

  const customRoles = await tenantDb
    .select({
      id:          schema.customRoles.id,
      name:        schema.customRoles.name,
      description: schema.customRoles.description,
      permissions: schema.customRoles.permissions,
      isSystem:    schema.customRoles.isSystem,
      createdAt:   schema.customRoles.createdAt,
    })
    .from(schema.customRoles)
    .orderBy(schema.customRoles.name);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Role Kustom</h2>
        <p className="text-sm text-muted-foreground">
          Buat role dengan hak akses yang disesuaikan untuk divisi atau jabatan tertentu.
        </p>
      </div>

      <RolesManageClient
        slug={slug}
        customRoles={customRoles.map((r) => ({
          ...r,
          description: r.description ?? null,
          permissions: (r.permissions ?? {}) as Record<string, string>,
          createdAt:   r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
