export const dynamic = "force-dynamic";
// GET /api/ref/producer-sources?slug=&type=usaha|pesantren|profesional&q=
// Picker sumber produsen ANGGOTA — ADMIN-ONLY (getTenantAccess + hasFullAccess toko). Tidak ada versi publik.
//
// ISOLASI TENANT (Critical): tabel sumber ada di schema `public`, jadi WAJIB INNER JOIN tenant_memberships
// dengan aturan keanggotaan bersama (lib/tenant-membership.server.ts) untuk tenant milik slug yang
// DIVALIDASI session — hanya anggota tenant ini yang bisa muncul. Response sengaja HANYA berisi id + nama +
// nama pemilik + penanda "ada kontak" — nomor/alamat TIDAK dikirim ke picker (dibaca nanti oleh pemuat
// produsen saat produsen sudah dipilih). Doc: docs/arsitektur-produsen.md § 8.

import { NextRequest, NextResponse } from "next/server";
import { and, eq, ilike, or, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  db, members, contacts, tenantMemberships,
  memberBusinesses, memberOwnedPesantren, memberProfessionals,
} from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { tenantMembershipConditions } from "@/lib/tenant-membership.server";
import { composeProducerName, type ProducerSourceKind } from "@/lib/producer-resolve";

const LIMIT = 20;
const TYPES: readonly ProducerSourceKind[] = ["usaha", "pesantren", "profesional"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") ?? "";
  const type = searchParams.get("type") ?? "";
  const q    = (searchParams.get("q") ?? "").trim().slice(0, 80);

  if (!slug) return NextResponse.json({ error: "slug diperlukan" }, { status: 400 });
  if (!TYPES.includes(type as ProducerSourceKind)) return NextResponse.json({ error: "type tidak valid" }, { status: 400 });

  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasFullAccess(access.tenantUser, "toko")) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const tenant = { id: access.tenant.id, tenantType: access.tenant.tenantType };
  const memberOk = and(eq(tenantMemberships.memberId, members.id), ...tenantMembershipConditions(tenant.id, tenant.tenantType));

  const srcContact   = alias(contacts, "src_contact");
  const ownerContact = alias(contacts, "owner_contact");
  const like = q ? `%${q}%` : null;

  try {
    if (type === "usaha") {
      const rows = await db
        .select({
          id: memberBusinesses.id, name: memberBusinesses.name, brand: memberBusinesses.brand,
          memberId: members.id, ownerName: members.name,
          srcWa: srcContact.whatsapp, srcPhone: srcContact.phone, ownerWa: ownerContact.whatsapp,
        })
        .from(memberBusinesses)
        .innerJoin(members, eq(members.id, memberBusinesses.memberId))
        .innerJoin(tenantMemberships, memberOk)
        .leftJoin(srcContact, eq(srcContact.id, memberBusinesses.contactId))
        .leftJoin(ownerContact, eq(ownerContact.id, members.contactId))
        .where(like ? or(ilike(memberBusinesses.name, like), ilike(memberBusinesses.brand, like), ilike(members.name, like)) : undefined)
        .orderBy(desc(memberBusinesses.createdAt))
        .limit(LIMIT);
      return NextResponse.json({ items: rows.map((r) => ({
        id: r.id, memberId: r.memberId, ownerName: r.ownerName,
        name: composeProducerName("usaha", { name: r.name, brand: r.brand }),
        hasContact: !!(r.srcWa?.trim() || r.srcPhone?.trim() || r.ownerWa?.trim()),
      })) });
    }

    if (type === "pesantren") {
      const rows = await db
        .select({
          id: memberOwnedPesantren.id, name: memberOwnedPesantren.name,
          memberId: members.id, ownerName: members.name,
          srcWa: srcContact.whatsapp, srcPhone: srcContact.phone, ownerWa: ownerContact.whatsapp,
        })
        .from(memberOwnedPesantren)
        .innerJoin(members, eq(members.id, memberOwnedPesantren.memberId))
        .innerJoin(tenantMemberships, memberOk)
        .leftJoin(srcContact, eq(srcContact.id, memberOwnedPesantren.contactId))
        .leftJoin(ownerContact, eq(ownerContact.id, members.contactId))
        .where(like ? or(ilike(memberOwnedPesantren.name, like), ilike(members.name, like)) : undefined)
        .orderBy(desc(memberOwnedPesantren.createdAt))
        .limit(LIMIT);
      return NextResponse.json({ items: rows.map((r) => ({
        id: r.id, memberId: r.memberId, ownerName: r.ownerName,
        name: composeProducerName("pesantren", { name: r.name }),
        hasContact: !!(r.srcWa?.trim() || r.srcPhone?.trim() || r.ownerWa?.trim()),
      })) });
    }

    // profesional — nama = gelar + nama anggota
    const rows = await db
      .select({
        id: memberProfessionals.id, title: memberProfessionals.title, professionType: memberProfessionals.professionType,
        institution: memberProfessionals.institution,
        memberId: members.id, ownerName: members.name,
        srcWa: srcContact.whatsapp, srcPhone: srcContact.phone, ownerWa: ownerContact.whatsapp,
      })
      .from(memberProfessionals)
      .innerJoin(members, eq(members.id, memberProfessionals.memberId))
      .innerJoin(tenantMemberships, memberOk)
      .leftJoin(srcContact, eq(srcContact.id, memberProfessionals.contactId))
      .leftJoin(ownerContact, eq(ownerContact.id, members.contactId))
      .where(and(
        eq(memberProfessionals.isActive, true),
        like ? or(ilike(members.name, like), ilike(memberProfessionals.professionType, like), ilike(memberProfessionals.institution, like)) : undefined,
      ))
      .orderBy(desc(memberProfessionals.createdAt))
      .limit(LIMIT);
    return NextResponse.json({ items: rows.map((r) => ({
      id: r.id, memberId: r.memberId, ownerName: r.ownerName,
      name: `${composeProducerName("profesional", { title: r.title, ownerName: r.ownerName })} — ${r.professionType}`,
      hasContact: !!(r.srcWa?.trim() || r.srcPhone?.trim() || r.ownerWa?.trim()),
    })) });
  } catch (err) {
    console.error("[producer-sources]", err);
    return NextResponse.json({ error: "Gagal memuat sumber produsen." }, { status: 500 });
  }
}
