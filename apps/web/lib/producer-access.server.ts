// Pintu masuk Portal Produsen — SATU-SATUNYA cara halaman portal mengenali pengguna. Produsen adalah STATUS
// pada akun (public.producer_logins), BUKAN baris tenant_{slug}.users, jadi getTenantAccess() untuk akun ini
// tetap null dan seluruh rute admin otomatis menolak (fail-closed). Doc: docs/arsitektur-portal-produsen.md.
//
// WAJIB dipanggil di AWAL setiap page/generateMetadata portal (bukan hanya layout — layout, page, dan
// generateMetadata dirender paralel; guard layout tidak melindungi page). Portal tidak punya Server Action.
import "server-only";
import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db, createTenantDb, tenants, producerLogins, members } from "@jalajogja/db";
import { getCurrentSession } from "@/lib/tenant";
import { isTenantMember } from "@/lib/tenant-membership.server";
import { listProducerOptions } from "@/lib/producer.server";
import { decideProducerAccess } from "@/lib/producer-access";

export type ProducerAccessResult = {
  tenant:   { id: string; slug: string; name: string; tenantType: string | null };
  producer: { id: string; memberId: string; displayName: string };
  userId:   string;
};

// cache() = satu pemeriksaan per request walau dipanggil layout + page + generateMetadata.
export const getProducerAccess = cache(async (slug: string): Promise<ProducerAccessResult | null> => {
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

  return {
    tenant:   { id: tenant.id, slug: tenant.slug, name: tenant.name, tenantType: tenant.tenantType },
    producer: { id: producer.id, memberId: producer.memberId, displayName: opt?.name ?? "Produsen" },
    userId,
  };
});
