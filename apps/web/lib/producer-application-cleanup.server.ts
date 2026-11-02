// Pembersihan berkas Pengajuan Produsen — docs/arsitektur-pengajuan-produsen.md § 13 (K14). Dipanggil cron harian.
//
//   draft (tak disentuh > 7 hari)            → baris + semua berkas dihapus
//   rejected / cancelled (> 7 hari sejak keputusan)  → SEMUA berkas dihapus, baris teks tetap (jejak audit)
//   approved (> 30 hari sejak keputusan)     → foto contoh & foto proses dihapus; DOKUMEN LEGALITAS dipertahankan
//   objek yatim (tak dirujuk JSON pengajuan mana pun, umur > 1 jam) → dihapus (jaring pengaman unggahan gagal/hapus gagal)
//
// URUTAN AMAN: rujukan di database dihapus/dikosongkan DULU (dengan syarat usia di klausa WHERE → draf yang baru saja disentuh tidak
// ikut terhapus), baru objek di MinIO dihapus. Bila penghapusan objek gagal, tidak ada data yang masih dipakai ikut hilang — objek
// sisa tertangkap penyapu yatim pada jalan berikutnya. Kegagalan DILAPORKAN di respons (tidak senyap).
import "server-only";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createTenantDb } from "@jalajogja/db";
import { s3, privateBucket, deletePrivate } from "@/lib/minio";

export const DRAFT_TTL_DAYS = 7;
export const REJECTED_TTL_DAYS = 7;
export const APPROVED_PHOTO_TTL_DAYS = 30;
export const ORPHAN_MIN_AGE_MS = 60 * 60_000;
const BATCH = 200;
const PREFIX = "pengajuan-produsen/";
const DAY = 86_400_000;

export type CleanupReport = { draftsDeleted: number; finalCleared: number; approvedPhotosCleared: number; orphansDeleted: number; objectsDeleted: number; failed: number };
export const emptyReport = (): CleanupReport => ({ draftsDeleted: 0, finalCleared: 0, approvedPhotosCleared: 0, orphansDeleted: 0, objectsDeleted: 0, failed: 0 });

type FileRef = { key: string };
type Row = {
  sampleProducts: { file: FileRef | null }[] | null; processMedia: FileRef[] | null; documentMedia: { file: FileRef }[] | null;
};
const keysOf = (r: Row, opts: { documents: boolean }): string[] => [
  ...(r.sampleProducts ?? []).flatMap((s) => (s.file ? [s.file.key] : [])),
  ...(r.processMedia ?? []).map((f) => f.key),
  ...(opts.documents ? (r.documentMedia ?? []).map((d) => d.file.key) : []),
];

export async function cleanupTenantApplications(
  slug: string, now: Date = new Date(), opts: { orphanMinAgeMs?: number } = {},
): Promise<CleanupReport> {
  const tc = createTenantDb(slug);
  const T = tc.schema.producerApplications;
  const report = emptyReport();

  const removeObjects = async (keys: string[]) => {
    for (const k of keys) {
      try { await deletePrivate(slug, k); report.objectsDeleted++; }
      catch (e) { report.failed++; console.error("[cleanup-pengajuan] hapus objek gagal:", k, e instanceof Error ? e.message : "unknown"); }
    }
  };

  const hasSampleFiles = sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${T.sampleProducts}) e WHERE jsonb_typeof(e->'file') = 'object')`;
  const hasProcess = sql`jsonb_array_length(${T.processMedia}) > 0`;
  const hasDocs = sql`jsonb_array_length(${T.documentMedia}) > 0`;

  // 1) DRAF kedaluwarsa: hapus baris (RETURNING berkas) lalu objeknya
  const draftCutoff = new Date(now.getTime() - DRAFT_TTL_DAYS * DAY);
  const staleDrafts = await tc.db.select({ id: T.id }).from(T).where(and(eq(T.status, "draft"), lt(T.updatedAt, draftCutoff))).limit(BATCH);
  for (const d of staleDrafts) {
    const gone = await tc.db.delete(T).where(and(eq(T.id, d.id), eq(T.status, "draft"), lt(T.updatedAt, draftCutoff)))   // syarat usia diulang: draf yang baru disentuh selamat
      .returning({ sampleProducts: T.sampleProducts, processMedia: T.processMedia, documentMedia: T.documentMedia });
    if (gone[0]) { report.draftsDeleted++; await removeObjects(keysOf(gone[0] as Row, { documents: true })); }
  }

  // 2) DITOLAK / DIBATALKAN > 7 hari: kosongkan SEMUA rujukan berkas (baris teks tetap)
  const finalCutoff = new Date(now.getTime() - REJECTED_TTL_DAYS * DAY);
  const finals = await tc.db.select({ id: T.id, sampleProducts: T.sampleProducts, processMedia: T.processMedia, documentMedia: T.documentMedia })
    .from(T)
    .where(and(inArray(T.status, ["rejected", "cancelled"]), sql`coalesce(${T.reviewedAt}, ${T.updatedAt}) < ${finalCutoff.toISOString()}::timestamptz`, sql`(${hasSampleFiles} OR ${hasProcess} OR ${hasDocs})`))
    .limit(BATCH);
  for (const r of finals) {
    const upd = await tc.db.update(T).set({
      sampleProducts: (r.sampleProducts ?? []).map((s) => ({ ...s, file: null })), processMedia: [], documentMedia: [], updatedAt: now,
    }).where(and(eq(T.id, r.id), inArray(T.status, ["rejected", "cancelled"]))).returning({ id: T.id });
    if (upd[0]) { report.finalCleared++; await removeObjects(keysOf(r as Row, { documents: true })); }
  }

  // 3) DISETUJUI > 30 hari: foto contoh & foto proses dihapus; dokumen legalitas dipertahankan
  const approvedCutoff = new Date(now.getTime() - APPROVED_PHOTO_TTL_DAYS * DAY);
  const approved = await tc.db.select({ id: T.id, sampleProducts: T.sampleProducts, processMedia: T.processMedia, documentMedia: T.documentMedia })
    .from(T)
    .where(and(eq(T.status, "approved"), sql`${T.reviewedAt} < ${approvedCutoff.toISOString()}::timestamptz`, sql`(${hasSampleFiles} OR ${hasProcess})`))
    .limit(BATCH);
  for (const r of approved) {
    const upd = await tc.db.update(T).set({
      sampleProducts: (r.sampleProducts ?? []).map((s) => ({ ...s, file: null })), processMedia: [], updatedAt: now,
    }).where(and(eq(T.id, r.id), eq(T.status, "approved"))).returning({ id: T.id });
    if (upd[0]) { report.approvedPhotosCleared++; await removeObjects(keysOf(r as Row, { documents: false })); }
  }

  // 4) OBJEK YATIM: ada di bucket privat tetapi tidak dirujuk pengajuan mana pun, dan sudah cukup lama (hindari balapan dengan unggahan berjalan)
  const minAge = opts.orphanMinAgeMs ?? ORPHAN_MIN_AGE_MS;
  // Kunci yang MASIH dirujuk pengajuan mana pun — diambil lewat SQL (hanya string kunci, bukan seluruh JSONB tiap baris)
  const refRows = await tc.db.execute(sql`
    SELECT k FROM (
      SELECT e->'file'->>'key' AS k FROM ${T}, jsonb_array_elements(${T.sampleProducts}) e
      UNION ALL SELECT e->>'key' FROM ${T}, jsonb_array_elements(${T.processMedia}) e
      UNION ALL SELECT e->'file'->>'key' FROM ${T}, jsonb_array_elements(${T.documentMedia}) e
    ) x WHERE k IS NOT NULL`);
  const referenced = new Set((refRows as unknown as { k: string }[]).map((r) => r.k));
  const orphans: string[] = [];
  try {
    let token: string | undefined;
    for (let page = 0; page < 20; page++) {                                       // ≤ 20 halaman × 1000 objek per jalan
      const res = await s3.send(new ListObjectsV2Command({ Bucket: privateBucket(slug), Prefix: PREFIX, ContinuationToken: token }));
      for (const o of res.Contents ?? []) {
        if (o.Key && !referenced.has(o.Key) && o.LastModified && now.getTime() - o.LastModified.getTime() >= minAge) orphans.push(o.Key);
      }
      if (!res.IsTruncated) break;
      token = res.NextContinuationToken;
    }
  } catch (e) {
    if ((e as { name?: string }).name !== "NoSuchBucket") { report.failed++; console.error("[cleanup-pengajuan] daftar objek gagal:", e instanceof Error ? e.message : "unknown"); }
  }
  const before = report.objectsDeleted;
  await removeObjects(orphans);
  report.orphansDeleted = report.objectsDeleted - before;
  return report;
}
