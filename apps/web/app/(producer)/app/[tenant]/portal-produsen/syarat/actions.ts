"use server";
// Tanda tangan digital produsen atas Syarat & Ketentuan — docs/arsitektur-portal-produsen.md § 28.
// SATU-SATUNYA aksi portal yang boleh jalan sebelum syarat ditandatangani, makanya memakai getProducerAccessUngated.
// producerId + userId dari SESI (bukan input); versi yang ditandatangani HARUS = versi aktif saat ini; isi yang
// di-hash dibaca dari DB (bukan dari klien), jadi bukti mengikat ke teks yang benar-benar dibaca di server.
import { createHash } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getProducerAccessUngated } from "@/lib/producer-access.server";
import { getActiveProducerTerm } from "@/lib/producer-terms.server";
import { isValidUuid } from "@/lib/is-uuid";
import { pgErrorCode } from "@/lib/pg-error";

type Result = { success: true } | { success: false; error: string };

export async function signProducerTermAction(slug: string, input: { termId: string; agreed: boolean }): Promise<Result> {
  const access = await getProducerAccessUngated(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (input?.agreed !== true) return { success: false, error: "Centang pernyataan persetujuan terlebih dahulu." };
  if (typeof input.termId !== "string" || !isValidUuid(input.termId)) return { success: false, error: "Syarat tidak valid." };

  try {
    const tenantClient = createTenantDb(access.tenant.slug);
    const { db: tdb, schema } = tenantClient;
    const active = await getActiveProducerTerm(tenantClient);
    if (!active) return { success: false, error: "Belum ada syarat & ketentuan yang berlaku." };
    if (active.id !== input.termId) {
      return { success: false, error: "Syarat & ketentuan baru saja diperbarui. Muat ulang halaman, baca versi terbaru, lalu tanda tangani." };
    }

    // Sudah pernah menandatangani versi ini → idempotent (klik ganda / dua tab)
    const [existing] = await tdb.select({ id: schema.producerTermAcceptances.id }).from(schema.producerTermAcceptances)
      .where(and(eq(schema.producerTermAcceptances.termId, active.id), eq(schema.producerTermAcceptances.producerId, access.producer.id)))
      .limit(1);
    if (existing) return { success: true };

    const h = await headers();
    const ip = (h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "").slice(0, 64) || null; // informatif, bukan bukti identitas
    const ua = (h.get("user-agent") ?? "").slice(0, 300) || null;

    const signedAt   = new Date();
    const bodySha256 = createHash("sha256").update(active.body).digest("hex");
    const verificationHash = createHash("sha256")
      .update(`${active.id}:${access.producer.id}:${access.userId}:${signedAt.toISOString()}:${bodySha256}`)
      .digest("hex");

    try {
      await tdb.insert(schema.producerTermAcceptances).values({
        termId: active.id, producerId: access.producer.id, userId: access.userId,
        signedAt, bodySha256, verificationHash, ip, userAgent: ua,
      });
    } catch (e) {
      if (pgErrorCode(e) === "23505") return { success: true }; // balapan dua klik: yang kedua tak perlu gagal
      throw e;
    }

    revalidatePath(`/app/${access.tenant.slug}/portal-produsen`, "layout");
    revalidatePath(`/app/${access.tenant.slug}/toko/pengaturan`);
    return { success: true };
  } catch (e) {
    console.error("[signProducerTerm]", pgErrorCode(e) ?? "unknown");
    return { success: false, error: "Gagal menyimpan tanda tangan. Coba lagi." };
  }
}
