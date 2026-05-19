"use server";

import { getTenantAccess } from "@/lib/tenant";
import { createTenantDb } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function markSubmissionReadAction(slug: string, id: string) {
  const access = await getTenantAccess(slug);
  if (!access) return;

  const { db, schema } = createTenantDb(slug);
  await db
    .update(schema.contactSubmissions)
    .set({ isRead: true })
    .where(eq(schema.contactSubmissions.id, id));

  revalidatePath(`/${slug}/website/pesan`);
}
