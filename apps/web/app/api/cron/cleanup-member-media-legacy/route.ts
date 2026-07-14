export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  db, createTenantDb, tenants,
  members, memberBusinesses, memberProfessionals, memberOwnedPesantren,
} from "@jalajogja/db";
import { deleteFile, publicUrl } from "@/lib/minio";
import { eq, inArray } from "drizzle-orm";

// Hapus row legacy tenant_{slug}.media (module='akun') yang sudah dimigrasi ke
// public.member_media (migration 0028) dan sudah tidak dipakai di manapun.
//
// Cutoff: 30 hari setelah migration 0028 dijalankan di VPS pada 2026-07-14.
// Hard safety gate — cron TIDAK PERNAH hapus apapun sebelum tanggal ini, meski
// crontab VPS memicu endpoint ini lebih awal. Lihat docs/arsitektur-medialibrary.md § 3.
const CLEANUP_CUTOFF = new Date("2026-08-13T00:00:00Z");

export async function GET(request: NextRequest) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (new Date() < CLEANUP_CUTOFF) {
    return NextResponse.json({
      skipped: true,
      reason: `Belum waktunya — cutoff ${CLEANUP_CUTOFF.toISOString().slice(0, 10)}`,
    });
  }

  const activeTenants = await db
    .select({ slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.isActive, true));

  let deleted = 0;
  let skippedInUse = 0;

  for (const tenant of activeTenants) {
    const { db: tenantDb, schema } = createTenantDb(tenant.slug);

    // Row lama hasil upload member (module='akun') — kandidat cleanup
    const legacyRows = await tenantDb
      .select({
        id:       schema.media.id,
        memberId: schema.media.memberId,
        path:     schema.media.path,
        variants: schema.media.variants,
      })
      .from(schema.media)
      .where(eq(schema.media.module, "akun"));

    const memberIds = [...new Set(
      legacyRows.map(r => r.memberId).filter((id): id is string => !!id),
    )];
    if (memberIds.length === 0) continue;

    // Batch-fetch semua referensi cover/photo untuk member-member ini sekaligus
    // (satu member bisa punya banyak entry usaha/profesional/pesantren)
    const [memberRows, businessRows, professionalRows, pesantrenRows] = await Promise.all([
      db.select({ id: members.id, photoUrl: members.photoUrl })
        .from(members).where(inArray(members.id, memberIds)),
      db.select({ memberId: memberBusinesses.memberId, coverUrl: memberBusinesses.coverUrl })
        .from(memberBusinesses).where(inArray(memberBusinesses.memberId, memberIds)),
      db.select({ memberId: memberProfessionals.memberId, coverUrl: memberProfessionals.coverUrl })
        .from(memberProfessionals).where(inArray(memberProfessionals.memberId, memberIds)),
      db.select({ memberId: memberOwnedPesantren.memberId, coverUrl: memberOwnedPesantren.coverUrl })
        .from(memberOwnedPesantren).where(inArray(memberOwnedPesantren.memberId, memberIds)),
    ]);

    // Kumpulkan semua URL yang MASIH dipakai, per member
    const referencedByMember = new Map<string, Set<string>>();
    const addRef = (memberId: string | null, url: string | null) => {
      if (!memberId || !url) return;
      if (!referencedByMember.has(memberId)) referencedByMember.set(memberId, new Set());
      referencedByMember.get(memberId)!.add(url);
    };
    for (const m of memberRows)       addRef(m.id, m.photoUrl);
    for (const b of businessRows)     addRef(b.memberId, b.coverUrl);
    for (const p of professionalRows) addRef(p.memberId, p.coverUrl);
    for (const pe of pesantrenRows)   addRef(pe.memberId, pe.coverUrl);

    for (const row of legacyRows) {
      if (!row.memberId) continue;

      // Kumpulkan semua kemungkinan URL file ini (path utama + tiap variant)
      const candidateUrls = [publicUrl(tenant.slug, row.path)];
      if (row.variants) {
        for (const v of Object.values(row.variants)) {
          if (v) candidateUrls.push(publicUrl(tenant.slug, v as string));
        }
      }

      const referenced = referencedByMember.get(row.memberId);
      const isInUse = referenced ? candidateUrls.some(u => referenced.has(u)) : false;

      if (isInUse) { skippedInUse++; continue; }

      const pathsToDelete = row.variants
        ? (Object.values(row.variants).filter(Boolean) as string[])
        : [row.path];
      await Promise.allSettled(pathsToDelete.map(p => deleteFile(tenant.slug, p)));
      await tenantDb.delete(schema.media).where(eq(schema.media.id, row.id));
      deleted++;
    }
  }

  return NextResponse.json({ deleted, skippedInUse });
}
