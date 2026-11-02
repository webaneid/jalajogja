// Pintu masuk Portal Produsen — SATU-SATUNYA cara halaman portal mengenali pengguna. Produsen adalah STATUS
// pada akun (public.producer_logins), BUKAN baris tenant_{slug}.users, jadi getTenantAccess() untuk akun ini
// tetap null dan seluruh rute admin otomatis menolak (fail-closed). Doc: docs/arsitektur-portal-produsen.md.
//
// WAJIB dipanggil di AWAL setiap page/generateMetadata portal (bukan hanya layout — layout, page, dan
// generateMetadata dirender paralel; guard layout tidak melindungi page). Portal tidak punya Server Action.
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, createTenantDb, tenants, producerLogins, members } from "@jalajogja/db";
import { getCurrentSession } from "@/lib/tenant";
import { isTenantMember } from "@/lib/tenant-membership.server";
import { listProducerOptions } from "@/lib/producer.server";
import { decideProducerAccess } from "@/lib/producer-access";
import { getActiveProducerTerm } from "@/lib/producer-terms.server";
import { pgErrorCode } from "@/lib/pg-error";

export type ProducerAccessResult = {
  tenant:   { id: string; slug: string; name: string; tenantType: string | null };
  producer: { id: string; memberId: string; displayName: string };
  userId:   string;
  // Syarat & Ketentuan Produsen (§ 28). null = belum ada versi terbit (tidak ada penguncian).
  // pending = versi aktif belum ditandatangani produsen ini → akses ke portal DIKUNCI kecuali halaman Syarat.
  terms:    { termId: string; version: number; pending: boolean } | null;
};

// Versi AKTIF + status tanda tangan produsen ini. Tabel belum ada (migration 0090 belum jalan; SQLSTATE 42P01)
// = fitur belum aktif → tidak ada penguncian. Galat lain DILEMPAR (jangan fail-open pada galat tak dikenal).
async function resolveTermsStatus(
  tenantClient: ReturnType<typeof createTenantDb>, producerId: string,
): Promise<ProducerAccessResult["terms"]> {
  try {
    const active = await getActiveProducerTerm(tenantClient);
    if (!active) return null;
    const { db: tdb, schema } = tenantClient;
    const [row] = await tdb.select({ id: schema.producerTermAcceptances.id }).from(schema.producerTermAcceptances)
      .where(and(eq(schema.producerTermAcceptances.termId, active.id), eq(schema.producerTermAcceptances.producerId, producerId)))
      .limit(1);
    return { termId: active.id, version: active.version, pending: !row };
  } catch (e) {
    if (pgErrorCode(e) === "42P01") {
      console.warn("[producer-terms] tabel syarat belum ada (migration 0090 belum jalan) — gerbang tidak aktif");
      return null;
    }
    throw e;
  }
}

// cache() = satu pemeriksaan per request walau dipanggil layout + page + generateMetadata.
// "UNGATED" = identitas produsen lolos, TANPA menegakkan syarat. HANYA untuk: halaman Syarat itu sendiri, shell portal
// (layout), dan penentu tampil/arah tautan (akun, dashboard-redirect). Semua yang membaca/mengubah DATA pakai
// getProducerAccess / getProducerPageAccess di bawah.
export const getProducerAccessUngated = cache(async (slug: string): Promise<ProducerAccessResult | null> => {
  const session = await getCurrentSession();
  const userId  = session?.user?.id ?? null;
  if (!userId) return null;

  // 1) Tenant: HARUS lolos sebelum createTenantDb(slug) — slug mentah dari URL tidak boleh menyentuh schema
  const [tenant] = await db
    .select({ id: tenants.id, slug: tenants.slug, name: tenants.name, tenantType: tenants.tenantType, isActive: tenants.isActive })
    .from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenant || !tenant.isActive) return null;

  // 2) Status produsen akun ini DI TENANT INI (UNIQUE(user_id): satu akun hanya satu tenant)
  const [login] = await db
    .select({ producerId: producerLogins.producerId })
    .from(producerLogins)
    .where(and(eq(producerLogins.userId, userId), eq(producerLogins.tenantId, tenant.id)))
    .limit(1);
  if (!login) return null;

  // 3) Baris produsen di schema tenant (sumber kebenaran aktif/nonaktif + pemilik)
  const tenantClient = createTenantDb(tenant.slug);
  const { db: tdb, schema } = tenantClient;
  const [producer] = await tdb
    .select({ id: schema.producers.id, type: schema.producers.type, memberId: schema.producers.memberId, isActive: schema.producers.isActive })
    .from(schema.producers).where(eq(schema.producers.id, login.producerId)).limit(1);

  // 4) Akun yang login HARUS akun milik anggota pemilik produsen (cegah tautan basi bila anggota dikaitkan ulang)
  let ownerAccountMatch = false;
  let ownerIsTenantMember = false;
  if (producer?.memberId) {
    const [owner] = await db
      .select({ betterAuthUserId: members.betterAuthUserId })
      .from(members).where(eq(members.id, producer.memberId)).limit(1);
    ownerAccountMatch = !!owner?.betterAuthUserId && owner.betterAuthUserId === userId;
    // Keluar dari keanggotaan tenant → data tetap, akses hilang (keputusan user 2026-10-31)
    ownerIsTenantMember = ownerAccountMatch && await isTenantMember(producer.memberId, { id: tenant.id, tenantType: tenant.tenantType });
  }

  const decision = decideProducerAccess({
    hasSession: true, tenantFound: true, tenantActive: true, loginFound: true,
    producerFound: !!producer, producerActive: !!producer?.isActive, producerIsMember: producer?.type === "member",
    ownerAccountMatch, ownerIsTenantMember,
  });
  if (!decision.allow || !producer?.memberId) return null;

  // Nama tampilan (ringan: tanpa kontak/alamat)
  const [opt] = await listProducerOptions(tenantClient, { onlyId: producer.id });

  const terms = await resolveTermsStatus(tenantClient, producer.id);

  return {
    tenant:   { id: tenant.id, slug: tenant.slug, name: tenant.name, tenantType: tenant.tenantType },
    producer: { id: producer.id, memberId: producer.memberId, displayName: opt?.name ?? "Produsen" },
    userId,
    terms,
  };
});

// Penjaga DEFAULT (Server Action, route handler API, loader): produsen yang belum menandatangani syarat versi aktif
// = null (fail-closed, sama seperti bukan produsen). Caller baru otomatis aman.
export async function getProducerAccess(slug: string): Promise<ProducerAccessResult | null> {
  const access = await getProducerAccessUngated(slug);
  if (!access || access.terms?.pending) return null;
  return access;
}

// Penjaga HALAMAN portal: belum tanda tangan → arahkan ke halaman Syarat (bukan /no-tenant-access).
export async function getProducerPageAccess(slug: string): Promise<ProducerAccessResult | null> {
  const access = await getProducerAccessUngated(slug);
  if (access?.terms?.pending) redirect(`/app/${access.tenant.slug}/portal-produsen/syarat`);
  return access;
}

// Untuk /dashboard-redirect & pemilih tujuan: tenant tempat akun ini berstatus produsen, HANYA bila aksesnya
// benar-benar lolos (getProducerAccess penuh). Sengaja tidak cukup "baris producer_logins ada": produsen yang
// dinonaktifkan / keluar keanggotaan akan dialihkan ke portal lalu ditolak → loop. UNIQUE(user_id) = paling banyak
// satu tenant.
export async function findProducerPortal(): Promise<{ slug: string; name: string } | null> {
  const session = await getCurrentSession();
  const userId  = session?.user?.id ?? null;
  if (!userId) return null;
  const [row] = await db
    .select({ slug: tenants.slug, name: tenants.name })
    .from(producerLogins)
    .innerJoin(tenants, eq(tenants.id, producerLogins.tenantId))
    .where(and(eq(producerLogins.userId, userId), eq(tenants.isActive, true)))
    .limit(1);
  if (!row) return null;
  return (await getProducerAccessUngated(row.slug)) ? row : null;
}
