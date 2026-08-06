import "server-only";
import { eq, and, inArray, sql } from "drizzle-orm";
import {
  db, members, tenantMemberships,
  addresses, refRegencies, refProfessions,
  memberBusinesses, memberOwnedPesantren, memberProfessionals,
} from "@jalajogja/db";

// Ekstraksi MURNI dari app/(public)/[tenant]/statistik/page.tsx (2026-08-07) — query logic
// dipindah apa adanya, zero perubahan behavior. Dipakai bersama oleh halaman publik per-tenant
// itu DAN menu admin "Ringkasan Tenant" (khusus tenant tipe "pusat") — lihat
// docs/arsitektur-backbone-ikpm.md § "E. Statistik detail — REUSE penuh dari /{slug}/statistik".
//
// SENGAJA tidak menerima parameter enabledModules — query di sini menghitung SEMUA breakdown
// terlepas toggle modul ekosistem tenant (persis perilaku lama); gating tampilan section
// Pesantren/Usaha/Profesional dilakukan di layer render (<StatistikSections>), bukan di sini.
export async function computeMemberStatistics(tenantId: string) {
  const scopeClause = and(
    eq(tenantMemberships.tenantId, tenantId),
    inArray(tenantMemberships.status, ["active", "alumni"]),
  );

  // ── Stats Anggota ──────────────────────────────────────────────────────────

  const activeRows = await db
    .select({ total: sql<number>`count(*)` })
    .from(tenantMemberships)
    .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.status, "active")));

  const alumniRows = await db
    .select({ total: sql<number>`count(*)` })
    .from(tenantMemberships)
    .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.status, "alumni")));

  const activeTotal  = Number(activeRows[0]?.total ?? 0);
  const alumniTotal  = Number(alumniRows[0]?.total ?? 0);
  const totalAnggota = activeTotal + alumniTotal;

  // Gender
  const genderRows = await db
    .select({ gender: members.gender, total: sql<number>`count(*)` })
    .from(members)
    .innerJoin(tenantMemberships, and(
      eq(tenantMemberships.memberId, members.id),
      scopeClause,
    ))
    .groupBy(members.gender)
    .orderBy(sql`count(*) desc`);

  // Kabupaten domisili (top 10)
  const kabupatenAnggotaRows = await db
    .select({ regency: refRegencies.name, total: sql<number>`count(*)` })
    .from(members)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, members.id), scopeClause))
    .leftJoin(addresses,    eq(addresses.id,    members.homeAddressId))
    .leftJoin(refRegencies, eq(refRegencies.id, addresses.regencyId))
    .where(sql`${refRegencies.id} IS NOT NULL`)
    .groupBy(refRegencies.name)
    .orderBy(sql`count(*) desc`)
    .limit(10);

  // Status domisili
  const domisiliRows = await db
    .select({ status: members.domicileStatus, total: sql<number>`count(*)` })
    .from(members)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, members.id), scopeClause))
    .where(sql`${members.domicileStatus} IS NOT NULL`)
    .groupBy(members.domicileStatus)
    .orderBy(sql`count(*) desc`);

  // Angkatan (top 10) — group by year + period agar 1999 Awal/Akhir terpisah
  const angkatanRows = await db
    .select({ year: members.graduationYear, period: members.graduationPeriod, total: sql<number>`count(*)` })
    .from(members)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, members.id), scopeClause))
    .where(sql`${members.graduationYear} IS NOT NULL`)
    .groupBy(members.graduationYear, members.graduationPeriod)
    .orderBy(sql`count(*) desc`)
    .limit(10);

  // Kategori profesi
  const profesiRows = await db
    .select({ category: refProfessions.category, total: sql<number>`count(*)` })
    .from(members)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, members.id), scopeClause))
    .innerJoin(refProfessions, eq(refProfessions.id, members.professionId))
    .groupBy(refProfessions.category)
    .orderBy(sql`count(*) desc`);

  // Wali santri
  const waliSantriRows = await db
    .select({ wali: members.waliSantri, total: sql<number>`count(*)` })
    .from(members)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, members.id), scopeClause))
    .where(sql`${members.waliSantri} IS NOT NULL`)
    .groupBy(members.waliSantri)
    .orderBy(sql`count(*) desc`);

  // Punya usaha
  const punyaUsahaRows = await db
    .select({ total: sql<number>`count(distinct ${memberBusinesses.memberId})` })
    .from(memberBusinesses)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberBusinesses.memberId), scopeClause))
    .where(eq(memberBusinesses.isActive, true));

  // Punya pesantren
  const punyaPesantrenRows = await db
    .select({ total: sql<number>`count(distinct ${memberOwnedPesantren.memberId})` })
    .from(memberOwnedPesantren)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberOwnedPesantren.memberId), scopeClause));

  // Punya data profesional
  const punyaProfesionalRows = await db
    .select({ total: sql<number>`count(distinct ${memberProfessionals.memberId})` })
    .from(memberProfessionals)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberProfessionals.memberId), scopeClause))
    .where(eq(memberProfessionals.isActive, true));

  const punyaUsahaTotal       = Number(punyaUsahaRows[0]?.total       ?? 0);
  const punyaPesantrenTotal   = Number(punyaPesantrenRows[0]?.total   ?? 0);
  const punyaProfesionalTotal = Number(punyaProfesionalRows[0]?.total ?? 0);

  // ── Stats Pesantren ────────────────────────────────────────────────────────

  const totalPesantrenRows = await db
    .select({ total: sql<number>`count(*)` })
    .from(memberOwnedPesantren)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberOwnedPesantren.memberId), scopeClause));

  const totalPesantren = Number(totalPesantrenRows[0]?.total ?? 0);

  const sumSantriRows = await db
    .select({
      putra:     sql<string>`coalesce(sum(${memberOwnedPesantren.santriPutra}),0)`,
      putri:     sql<string>`coalesce(sum(${memberOwnedPesantren.santriPutri}),0)`,
      asatidz:   sql<string>`coalesce(sum(${memberOwnedPesantren.asatidz}),0)`,
      asatidzah: sql<string>`coalesce(sum(${memberOwnedPesantren.asatidzah}),0)`,
    })
    .from(memberOwnedPesantren)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberOwnedPesantren.memberId), scopeClause));

  const sumSantri = sumSantriRows[0] ?? { putra: "0", putri: "0", asatidz: "0", asatidzah: "0" };

  const kurikulumRows = await db
    .select({ kurikulum: memberOwnedPesantren.kurikulum, total: sql<number>`count(*)` })
    .from(memberOwnedPesantren)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberOwnedPesantren.memberId), scopeClause))
    .where(sql`${memberOwnedPesantren.kurikulum} IS NOT NULL`)
    .groupBy(memberOwnedPesantren.kurikulum)
    .orderBy(sql`count(*) desc`);

  const kategoriSantriRows = await db
    .select({ kategori: memberOwnedPesantren.kategoriSantri, total: sql<number>`count(*)` })
    .from(memberOwnedPesantren)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberOwnedPesantren.memberId), scopeClause))
    .where(sql`${memberOwnedPesantren.kategoriSantri} IS NOT NULL`)
    .groupBy(memberOwnedPesantren.kategoriSantri)
    .orderBy(sql`count(*) desc`);

  const modelPendidikanRows = await db
    .select({ model: memberOwnedPesantren.modelPendidikan, total: sql<number>`count(*)` })
    .from(memberOwnedPesantren)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberOwnedPesantren.memberId), scopeClause))
    .where(sql`${memberOwnedPesantren.modelPendidikan} IS NOT NULL`)
    .groupBy(memberOwnedPesantren.modelPendidikan)
    .orderBy(sql`count(*) desc`);

  const jenisPondokRows = await db
    .select({ jenis: memberOwnedPesantren.jenisPondok, total: sql<number>`count(*)` })
    .from(memberOwnedPesantren)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberOwnedPesantren.memberId), scopeClause))
    .where(sql`${memberOwnedPesantren.jenisPondok} IS NOT NULL`)
    .groupBy(memberOwnedPesantren.jenisPondok)
    .orderBy(sql`count(*) desc`);

  // ── Stats Usaha ────────────────────────────────────────────────────────────

  const totalUsahaRows = await db
    .select({ total: sql<number>`count(*)` })
    .from(memberBusinesses)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberBusinesses.memberId), scopeClause))
    .where(eq(memberBusinesses.isActive, true));

  const totalUsaha = Number(totalUsahaRows[0]?.total ?? 0);

  const sektorRows = await db
    .select({ sector: memberBusinesses.sector, total: sql<number>`count(*)` })
    .from(memberBusinesses)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberBusinesses.memberId), scopeClause))
    .where(and(eq(memberBusinesses.isActive, true), sql`${memberBusinesses.sector} IS NOT NULL`))
    .groupBy(memberBusinesses.sector)
    .orderBy(sql`count(*) desc`);

  const kategoriUsahaRows = await db
    .select({ category: memberBusinesses.category, total: sql<number>`count(*)` })
    .from(memberBusinesses)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberBusinesses.memberId), scopeClause))
    .where(and(eq(memberBusinesses.isActive, true), sql`${memberBusinesses.category} IS NOT NULL`))
    .groupBy(memberBusinesses.category)
    .orderBy(sql`count(*) desc`);

  const legalitasRows = await db
    .select({ legality: memberBusinesses.legality, total: sql<number>`count(*)` })
    .from(memberBusinesses)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberBusinesses.memberId), scopeClause))
    .where(and(eq(memberBusinesses.isActive, true), sql`${memberBusinesses.legality} IS NOT NULL`))
    .groupBy(memberBusinesses.legality)
    .orderBy(sql`count(*) desc`);

  const karyawanRows = await db
    .select({ employees: memberBusinesses.employees, total: sql<number>`count(*)` })
    .from(memberBusinesses)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberBusinesses.memberId), scopeClause))
    .where(and(eq(memberBusinesses.isActive, true), sql`${memberBusinesses.employees} IS NOT NULL`))
    .groupBy(memberBusinesses.employees)
    .orderBy(sql`count(*) desc`);

  const cabangUsahaRows = await db
    .select({ branches: memberBusinesses.branches, total: sql<number>`count(*)` })
    .from(memberBusinesses)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberBusinesses.memberId), scopeClause))
    .where(and(eq(memberBusinesses.isActive, true), sql`${memberBusinesses.branches} IS NOT NULL`))
    .groupBy(memberBusinesses.branches)
    .orderBy(sql`count(*) desc`);

  const kabupatenUsahaRows = await db
    .select({ regency: refRegencies.name, total: sql<number>`count(*)` })
    .from(memberBusinesses)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberBusinesses.memberId), scopeClause))
    .leftJoin(addresses,    eq(addresses.id,    memberBusinesses.addressId))
    .leftJoin(refRegencies, eq(refRegencies.id, addresses.regencyId))
    .where(and(eq(memberBusinesses.isActive, true), sql`${refRegencies.id} IS NOT NULL`))
    .groupBy(refRegencies.name)
    .orderBy(sql`count(*) desc`)
    .limit(10);

  // ── Stats Profesional ──────────────────────────────────────────────────────

  const totalProfesionalRows = await db
    .select({ total: sql<number>`count(*)` })
    .from(memberProfessionals)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberProfessionals.memberId), scopeClause))
    .where(eq(memberProfessionals.isActive, true));

  const totalProfesional = Number(totalProfesionalRows[0]?.total ?? 0);

  const kategoriProfesionalRows = await db
    .select({ category: memberProfessionals.professionCategory, total: sql<number>`count(*)` })
    .from(memberProfessionals)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberProfessionals.memberId), scopeClause))
    .where(eq(memberProfessionals.isActive, true))
    .groupBy(memberProfessionals.professionCategory)
    .orderBy(sql`count(*) desc`);

  const jenisProfesionalRows = await db
    .select({ type: memberProfessionals.professionType, total: sql<number>`count(*)` })
    .from(memberProfessionals)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberProfessionals.memberId), scopeClause))
    .where(eq(memberProfessionals.isActive, true))
    .groupBy(memberProfessionals.professionType)
    .orderBy(sql`count(*) desc`)
    .limit(10);

  const kabupatenProfesionalRows = await db
    .select({ regency: refRegencies.name, total: sql<number>`count(*)` })
    .from(memberProfessionals)
    .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, memberProfessionals.memberId), scopeClause))
    .leftJoin(addresses,    eq(addresses.id,    memberProfessionals.addressId))
    .leftJoin(refRegencies, eq(refRegencies.id, addresses.regencyId))
    .where(and(eq(memberProfessionals.isActive, true), sql`${refRegencies.id} IS NOT NULL`))
    .groupBy(refRegencies.name)
    .orderBy(sql`count(*) desc`)
    .limit(10);

  return {
    // Anggota
    totalAnggota, activeTotal, alumniTotal,
    punyaUsahaTotal, punyaPesantrenTotal, punyaProfesionalTotal,
    genderRows, kabupatenAnggotaRows, domisiliRows, angkatanRows, profesiRows, waliSantriRows,
    // Pesantren
    totalPesantren, sumSantri, kurikulumRows, kategoriSantriRows, modelPendidikanRows, jenisPondokRows,
    // Usaha
    totalUsaha, sektorRows, kategoriUsahaRows, legalitasRows, karyawanRows, cabangUsahaRows, kabupatenUsahaRows,
    // Profesional
    totalProfesional, kategoriProfesionalRows, jenisProfesionalRows, kabupatenProfesionalRows,
  };
}

export type MemberStatisticsData = Awaited<ReturnType<typeof computeMemberStatistics>>;
