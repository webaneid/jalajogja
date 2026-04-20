"use server";

import { createTenantDb, db, tenants } from "@jalajogja/db";
import { eq } from "drizzle-orm";

export type ContactFormResult =
  | { success: true;  message: string }
  | { success: false; error: string };

export async function submitContactFormAction(
  tenantSlug: string,
  pageId:     string,
  formData:   FormData
): Promise<ContactFormResult> {
  const name    = (formData.get("name")    as string | null)?.trim() ?? "";
  const email   = (formData.get("email")   as string | null)?.trim() ?? "";
  const phone   = (formData.get("phone")   as string | null)?.trim() ?? "";
  const message = (formData.get("message") as string | null)?.trim() ?? "";

  if (!name)    return { success: false, error: "Nama wajib diisi." };
  if (!message) return { success: false, error: "Pesan wajib diisi." };

  // Verifikasi tenant valid
  const [tenant] = await db
    .select({ id: tenants.id, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  if (!tenant?.isActive) return { success: false, error: "Organisasi tidak ditemukan." };

  const { db: tenantDb, schema } = createTenantDb(tenantSlug);

  await tenantDb.insert(schema.contactSubmissions).values({
    pageId,
    name,
    email:   email   || null,
    phone:   phone   || null,
    message,
    isRead:  false,
  });

  return { success: true, message: "Pesan Anda telah kami terima. Terima kasih!" };
}
