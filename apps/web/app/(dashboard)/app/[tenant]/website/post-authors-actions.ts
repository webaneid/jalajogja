"use server";

// Server actions untuk profil penulis/editor byline post (post_authors).
// Terpisah dari actions.ts (yang sudah besar, fokus CRUD posts/pages/kategori/tag) —
// lihat docs/arsitektur-penulis-post.md untuk arsitektur lengkap.

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createTenantDb, db as publicDb, members } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export type PostAuthorData = {
  id:        string;
  memberId:  string | null;
  name:      string;
  bio:       string | null;
  avatarUrl: string | null;
};

/**
 * Cari-atau-buat profil post_authors dari seorang anggota IKPM. Idempotent — kalau tenant ini
 * sudah pernah punya post_authors untuk member tsb, row lama dipakai ulang (tidak duplikat).
 * name/avatarUrl adalah SNAPSHOT saat pertama dipilih — tidak live-sync ke data member terbaru.
 */
export async function findOrCreatePostAuthorFromMemberAction(
  slug: string,
  memberId: string
): Promise<ActionResult<PostAuthorData>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "website")) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  try {
    const [existing] = await db
      .select()
      .from(schema.postAuthors)
      .where(eq(schema.postAuthors.memberId, memberId))
      .limit(1);

    if (existing) {
      return {
        success: true,
        data: {
          id: existing.id, memberId: existing.memberId, name: existing.name,
          bio: existing.bio, avatarUrl: existing.avatarUrl,
        },
      };
    }

    const [member] = await publicDb
      .select({ name: members.name, photoUrl: members.photoUrl })
      .from(members)
      .where(eq(members.id, memberId))
      .limit(1);

    if (!member) return { success: false, error: "Anggota tidak ditemukan." };

    const [created] = await db
      .insert(schema.postAuthors)
      .values({ memberId, name: member.name, avatarUrl: member.photoUrl ?? null })
      .returning();

    return {
      success: true,
      data: {
        id: created.id, memberId: created.memberId, name: created.name,
        bio: created.bio, avatarUrl: created.avatarUrl,
      },
    };
  } catch (err) {
    console.error("[findOrCreatePostAuthorFromMemberAction]", err);
    return { success: false, error: "Gagal memproses profil penulis." };
  }
}

/** Buat profil penulis tamu baru (bukan anggota IKPM) — memberId selalu null. */
export async function createGuestPostAuthorAction(
  slug: string,
  data: { name: string; bio?: string | null; avatarUrl?: string | null }
): Promise<ActionResult<PostAuthorData>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "website")) return { success: false, error: "Akses ditolak." };
  if (!data.name.trim()) return { success: false, error: "Nama penulis wajib diisi." };

  const { db, schema } = createTenantDb(slug);

  try {
    const [created] = await db
      .insert(schema.postAuthors)
      .values({
        memberId:  null,
        name:      data.name.trim(),
        bio:       data.bio?.trim() || null,
        avatarUrl: data.avatarUrl || null,
      })
      .returning();

    return {
      success: true,
      data: {
        id: created.id, memberId: created.memberId, name: created.name,
        bio: created.bio, avatarUrl: created.avatarUrl,
      },
    };
  } catch (err) {
    console.error("[createGuestPostAuthorAction]", err);
    return { success: false, error: "Gagal membuat profil penulis." };
  }
}

/**
 * Edit bio/foto/nama profil penulis yang sudah ada — SHARED row, perubahan berlaku ke SEMUA
 * post yang memakai penulis ini (prinsip "recall" yang diminta, bukan bug).
 */
export async function updatePostAuthorAction(
  slug: string,
  authorId: string,
  data: { name?: string; bio?: string | null; avatarUrl?: string | null }
): Promise<ActionResult<PostAuthorData>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "website")) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  try {
    const [existing] = await db
      .select({ id: schema.postAuthors.id })
      .from(schema.postAuthors)
      .where(eq(schema.postAuthors.id, authorId))
      .limit(1);
    if (!existing) return { success: false, error: "Profil penulis tidak ditemukan." };

    const [updated] = await db
      .update(schema.postAuthors)
      .set({
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.bio !== undefined ? { bio: data.bio?.trim() || null } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl || null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.postAuthors.id, authorId))
      .returning();

    revalidatePath(`/app/${slug}/website/posts`);
    return {
      success: true,
      data: {
        id: updated.id, memberId: updated.memberId, name: updated.name,
        bio: updated.bio, avatarUrl: updated.avatarUrl,
      },
    };
  } catch (err) {
    console.error("[updatePostAuthorAction]", err);
    return { success: false, error: "Gagal menyimpan profil penulis." };
  }
}

/** Ambil satu profil penulis by ID — dipakai form edit post untuk resolve display awal. */
export async function getPostAuthorAction(
  slug: string,
  authorId: string
): Promise<ActionResult<PostAuthorData | null>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const [row] = await db
    .select()
    .from(schema.postAuthors)
    .where(eq(schema.postAuthors.id, authorId))
    .limit(1);

  if (!row) return { success: true, data: null };
  return {
    success: true,
    data: { id: row.id, memberId: row.memberId, name: row.name, bio: row.bio, avatarUrl: row.avatarUrl },
  };
}
