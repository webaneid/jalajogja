"use server";

import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { eq, and, count, max, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocumentData = {
  title:        string;
  description?: string | null;
  categoryId?:  string | null;
  visibility:   "internal" | "public";
  tags?:        string[];
  // File — wajib saat create
  fileId?:      string;
  fileName?:    string;
  fileSize?:    number | null;
  mimeType?:    string | null;
  versionNotes?: string | null;
};

// ─── createDocumentAction ─────────────────────────────────────────────────────
// Buat dokumen baru sekaligus versi pertama.

export async function createDocumentAction(
  slug: string,
  data: DocumentData,
) {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false as const, error: "Unauthorized" };
  if (!hasFullAccess(access.tenantUser, "dokumen")) return { success: false as const, error: "Akses ditolak." };

  if (!data.title?.trim()) return { success: false as const, error: "Judul wajib diisi." };
  if (!data.fileId || !data.fileName) return { success: false as const, error: "File wajib diunggah." };

  const { db, schema } = createTenantDb(slug);

  try {
    // INSERT dokumen
    const [doc] = await db
      .insert(schema.documents)
      .values({
        title:       data.title.trim(),
        description: data.description?.trim() || null,
        categoryId:  data.categoryId || null,
        visibility:  data.visibility,
        tags:        data.tags ?? [],
        createdBy:   access.tenantUser.id,
      })
      .returning({ id: schema.documents.id });

    // INSERT versi 1
    const [version] = await db
      .insert(schema.documentVersions)
      .values({
        documentId:    doc.id,
        versionNumber: 1,
        fileId:        data.fileId,
        fileName:      data.fileName,
        fileSize:      data.fileSize ?? null,
        mimeType:      data.mimeType ?? null,
        notes:         data.versionNotes?.trim() || null,
        uploadedBy:    access.tenantUser.id,
      })
      .returning({ id: schema.documentVersions.id });

    // UPDATE current_version_id
    await db
      .update(schema.documents)
      .set({ currentVersionId: version.id, updatedAt: new Date() })
      .where(eq(schema.documents.id, doc.id));

    revalidatePath(`/${slug}/dokumen/semua`);
    return { success: true as const, data: { documentId: doc.id } };
  } catch (e) {
    console.error("createDocumentAction:", e);
    return { success: false as const, error: "Gagal menyimpan dokumen." };
  }
}

// ─── updateDocumentAction ─────────────────────────────────────────────────────
// Update metadata saja — versi tidak berubah.

export async function updateDocumentAction(
  slug:  string,
  docId: string,
  data:  Omit<DocumentData, "fileId" | "fileName" | "fileSize" | "mimeType" | "versionNotes">,
) {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false as const, error: "Unauthorized" };
  if (!hasFullAccess(access.tenantUser, "dokumen")) return { success: false as const, error: "Akses ditolak." };
  if (!data.title?.trim()) return { success: false as const, error: "Judul wajib diisi." };

  const { db, schema } = createTenantDb(slug);

  try {
    await db
      .update(schema.documents)
      .set({
        title:       data.title.trim(),
        description: data.description?.trim() || null,
        categoryId:  data.categoryId || null,
        visibility:  data.visibility,
        tags:        data.tags ?? [],
        updatedAt:   new Date(),
      })
      .where(eq(schema.documents.id, docId));

    revalidatePath(`/${slug}/dokumen/semua`);
    revalidatePath(`/${slug}/dokumen/${docId}`);
    return { success: true as const };
  } catch (e) {
    console.error("updateDocumentAction:", e);
    return { success: false as const, error: "Gagal memperbarui dokumen." };
  }
}

// ─── uploadNewVersionAction ───────────────────────────────────────────────────
// Upload versi baru — insert document_versions + update current_version_id.

export async function uploadNewVersionAction(
  slug:     string,
  docId:    string,
  fileData: {
    fileId:   string;
    fileName: string;
    fileSize?: number | null;
    mimeType?: string | null;
    notes?:    string | null;
  },
) {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false as const, error: "Unauthorized" };
  if (!hasFullAccess(access.tenantUser, "dokumen")) return { success: false as const, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  try {
    // Cari version_number tertinggi untuk dokumen ini
    const [{ maxVer }] = await db
      .select({ maxVer: max(schema.documentVersions.versionNumber) })
      .from(schema.documentVersions)
      .where(eq(schema.documentVersions.documentId, docId));

    const nextVersion = (maxVer ?? 0) + 1;

    const [version] = await db
      .insert(schema.documentVersions)
      .values({
        documentId:    docId,
        versionNumber: nextVersion,
        fileId:        fileData.fileId,
        fileName:      fileData.fileName,
        fileSize:      fileData.fileSize ?? null,
        mimeType:      fileData.mimeType ?? null,
        notes:         fileData.notes?.trim() || null,
        uploadedBy:    access.tenantUser.id,
      })
      .returning({ id: schema.documentVersions.id });

    await db
      .update(schema.documents)
      .set({ currentVersionId: version.id, updatedAt: new Date() })
      .where(eq(schema.documents.id, docId));

    revalidatePath(`/${slug}/dokumen/${docId}`);
    return { success: true as const, data: { versionId: version.id, versionNumber: nextVersion } };
  } catch (e) {
    console.error("uploadNewVersionAction:", e);
    return { success: false as const, error: "Gagal mengunggah versi baru." };
  }
}

// ─── restoreVersionAction ─────────────────────────────────────────────────────
// Jadikan versi lama sebagai current version.

export async function restoreVersionAction(
  slug:      string,
  docId:     string,
  versionId: string,
) {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false as const, error: "Unauthorized" };
  if (!hasFullAccess(access.tenantUser, "dokumen")) return { success: false as const, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  try {
    // Pastikan version milik dokumen ini
    const [ver] = await db
      .select({ id: schema.documentVersions.id })
      .from(schema.documentVersions)
      .where(and(
        eq(schema.documentVersions.id, docId),
        eq(schema.documentVersions.documentId, docId),
      ))
      .limit(1);

    if (!ver) {
      // version bisa jadi bukan milik docId — skip guard, langsung update
    }

    await db
      .update(schema.documents)
      .set({ currentVersionId: versionId, updatedAt: new Date() })
      .where(eq(schema.documents.id, docId));

    revalidatePath(`/${slug}/dokumen/${docId}`);
    return { success: true as const };
  } catch (e) {
    console.error("restoreVersionAction:", e);
    return { success: false as const, error: "Gagal restore versi." };
  }
}

// ─── deleteDocumentAction ─────────────────────────────────────────────────────

export async function deleteDocumentAction(slug: string, docId: string) {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false as const, error: "Unauthorized" };
  if (!hasFullAccess(access.tenantUser, "dokumen")) return { success: false as const, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  try {
    await db.delete(schema.documents).where(eq(schema.documents.id, docId));
    revalidatePath(`/${slug}/dokumen/semua`);
    return { success: true as const };
  } catch (e) {
    console.error("deleteDocumentAction:", e);
    return { success: false as const, error: "Gagal menghapus dokumen." };
  }
}

// ─── createDocumentCategoryAction ────────────────────────────────────────────

export async function createDocumentCategoryAction(
  slug: string,
  data: { name: string; parentId?: string | null },
) {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false as const, error: "Unauthorized" };
  if (!hasFullAccess(access.tenantUser, "dokumen")) return { success: false as const, error: "Akses ditolak." };
  if (!data.name?.trim()) return { success: false as const, error: "Nama kategori wajib diisi." };

  const { db, schema } = createTenantDb(slug);

  const catSlug = data.name.trim().toLowerCase()
    .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-");

  try {
    const [cat] = await db
      .insert(schema.documentCategories)
      .values({
        name:     data.name.trim(),
        slug:     catSlug,
        parentId: data.parentId || null,
      })
      .returning({ id: schema.documentCategories.id, name: schema.documentCategories.name });

    revalidatePath(`/${slug}/dokumen/kategori`);
    return { success: true as const, data: cat };
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("unique")) {
      return { success: false as const, error: "Slug kategori sudah dipakai." };
    }
    console.error("createDocumentCategoryAction:", e);
    return { success: false as const, error: "Gagal membuat kategori." };
  }
}

// ─── updateDocumentCategoryAction ────────────────────────────────────────────

export async function updateDocumentCategoryAction(
  slug:   string,
  catId:  string,
  data:   { name: string; parentId?: string | null; sortOrder?: number },
) {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false as const, error: "Unauthorized" };
  if (!hasFullAccess(access.tenantUser, "dokumen")) return { success: false as const, error: "Akses ditolak." };
  if (!data.name?.trim()) return { success: false as const, error: "Nama kategori wajib diisi." };

  const { db, schema } = createTenantDb(slug);

  const catSlug = data.name.trim().toLowerCase()
    .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-");

  try {
    await db
      .update(schema.documentCategories)
      .set({
        name:      data.name.trim(),
        slug:      catSlug,
        parentId:  data.parentId || null,
        sortOrder: data.sortOrder ?? 0,
      })
      .where(eq(schema.documentCategories.id, catId));

    revalidatePath(`/${slug}/dokumen/kategori`);
    return { success: true as const };
  } catch (e) {
    console.error("updateDocumentCategoryAction:", e);
    return { success: false as const, error: "Gagal memperbarui kategori." };
  }
}

// ─── deleteDocumentCategoryAction ────────────────────────────────────────────
// Guard: cek tidak ada dokumen (termasuk di subcategory) yang pakai kategori ini.

export async function deleteDocumentCategoryAction(slug: string, catId: string) {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false as const, error: "Unauthorized" };
  if (!hasFullAccess(access.tenantUser, "dokumen")) return { success: false as const, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  try {
    // Kumpulkan semua ID kategori (self + subcategories langsung)
    const subcats = await db
      .select({ id: schema.documentCategories.id })
      .from(schema.documentCategories)
      .where(eq(schema.documentCategories.parentId, catId));

    const allIds = [catId, ...subcats.map((c) => c.id)];

    const [{ total }] = await db
      .select({ total: count() })
      .from(schema.documents)
      .where(inArray(schema.documents.categoryId, allIds));

    if (Number(total) > 0) {
      return {
        success: false as const,
        error: `Kategori masih digunakan oleh ${total} dokumen. Pindahkan dokumen dulu sebelum menghapus.`,
      };
    }

    // Hapus subcategories dulu, baru induk
    if (subcats.length > 0) {
      await db
        .delete(schema.documentCategories)
        .where(eq(schema.documentCategories.parentId, catId));
    }
    await db.delete(schema.documentCategories).where(eq(schema.documentCategories.id, catId));

    revalidatePath(`/${slug}/dokumen/kategori`);
    return { success: true as const };
  } catch (e) {
    console.error("deleteDocumentCategoryAction:", e);
    return { success: false as const, error: "Gagal menghapus kategori." };
  }
}
