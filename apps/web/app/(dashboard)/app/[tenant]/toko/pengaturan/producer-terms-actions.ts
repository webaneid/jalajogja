"use server";
// Server Actions Syarat & Ketentuan Produsen (sisi PENGURUS) — docs/arsitektur-portal-produsen.md § 28.
// Setiap action: getTenantAccess(slug) + hasFullAccess(toko). Versi TERBIT tidak pernah diubah/dihapus (bukti).
// Terbit versi baru → semua produsen wajib tanda tangan ulang (gerbang di lib/producer-access.server.ts, T3).
import { revalidatePath } from "next/cache";
import { eq, sql, max } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { isValidUuid } from "@/lib/is-uuid";
import { pgErrorCode } from "@/lib/pg-error";
import { validateTermInput } from "@/lib/producer-terms";

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

async function guard(slug: string) {
  const access = await getTenantAccess(slug);
  if (!access || !hasFullAccess(access.tenantUser, "toko")) return null;
  return access;
}

function refresh(slug: string) {
  revalidatePath(`/app/${slug}/toko/pengaturan`);
}

// ─── Simpan draf (buat baru bila belum ada draf; paling banyak SATU draf per tenant) ──────────────
export async function saveProducerTermDraftAction(
  slug: string,
  input: { title: string; body: string },
): Promise<ActionResult<{ id: string }>> {
  const access = await guard(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const title = String(input.title ?? "");
  const body  = String(input.body ?? "");
  const invalid = validateTermInput(title, body);
  if (invalid) return { success: false, error: invalid };

  try {
    const { db: tdb, schema } = createTenantDb(slug);
    const id = await tdb.transaction(async (tx) => {
      // Kunci serial per tenant (draf tunggal) — cegah dua draf dari dua klik bersamaan
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"producer_terms:" + slug}))`);
      const [draft] = await tx.select({ id: schema.producerTerms.id }).from(schema.producerTerms)
        .where(eq(schema.producerTerms.status, "draft")).limit(1);
      if (draft) {
        await tx.update(schema.producerTerms)
          .set({ title: title.trim(), body, updatedAt: new Date() })
          .where(eq(schema.producerTerms.id, draft.id));
        return draft.id;
      }
      const [row] = await tx.insert(schema.producerTerms)
        .values({ title: title.trim(), body, status: "draft", createdBy: access.tenantUser.id })
        .returning({ id: schema.producerTerms.id });
      return row.id;
    });
    refresh(slug);
    return { success: true, data: { id } };
  } catch (e) {
    console.error("[saveProducerTermDraft]", pgErrorCode(e) ?? "unknown");
    return { success: false, error: "Gagal menyimpan draf." };
  }
}

// ─── Buang draf (hanya draf; versi terbit tidak bisa dihapus) ─────────────────────────────────────
export async function discardProducerTermDraftAction(slug: string, termId: string): Promise<ActionResult> {
  const access = await guard(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!isValidUuid(termId)) return { success: false, error: "Draf tidak valid." };
  try {
    const { db: tdb, schema } = createTenantDb(slug);
    const del = await tdb.delete(schema.producerTerms)
      .where(sql`${schema.producerTerms.id} = ${termId} AND ${schema.producerTerms.status} = 'draft'`)
      .returning({ id: schema.producerTerms.id });
    if (del.length === 0) return { success: false, error: "Draf tidak ditemukan." };
    refresh(slug);
    return { success: true, data: undefined };
  } catch (e) {
    console.error("[discardProducerTermDraft]", pgErrorCode(e) ?? "unknown");
    return { success: false, error: "Gagal membuang draf." };
  }
}

// ─── Terbitkan draf: beri nomor versi berikutnya; semua produsen terkunci sampai tanda tangan ulang ─
export async function publishProducerTermAction(slug: string, termId: string): Promise<ActionResult<{ version: number }>> {
  const access = await guard(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!isValidUuid(termId)) return { success: false, error: "Draf tidak valid." };

  try {
    const { db: tdb, schema } = createTenantDb(slug);
    const version = await tdb.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"producer_terms:" + slug}))`);
      const [draft] = await tx.select().from(schema.producerTerms)
        .where(eq(schema.producerTerms.id, termId)).limit(1);
      if (!draft || draft.status !== "draft") throw new Error("DRAFT_GONE");
      // Validasi ulang dari DB (bukan percaya klien): isi harus tetap layak terbit
      if (validateTermInput(draft.title, draft.body)) throw new Error("DRAFT_INVALID");

      const [m] = await tx.select({ v: max(schema.producerTerms.version) }).from(schema.producerTerms);
      const next = (m?.v ?? 0) + 1;
      await tx.update(schema.producerTerms)
        .set({ status: "published", version: next, publishedAt: new Date(), publishedBy: access.tenantUser.id, updatedAt: new Date() })
        .where(eq(schema.producerTerms.id, draft.id));
      return next;
    });
    refresh(slug);
    return { success: true, data: { version } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "DRAFT_GONE")    return { success: false, error: "Draf tidak ditemukan atau sudah diterbitkan." };
    if (msg === "DRAFT_INVALID") return { success: false, error: "Isi draf belum layak diterbitkan." };
    console.error("[publishProducerTerm]", pgErrorCode(e) ?? "unknown");
    return { success: false, error: "Gagal menerbitkan syarat." };
  }
}
