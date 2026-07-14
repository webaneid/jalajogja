export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  db, createTenantDb, members, contacts,
  memberEducations, memberBusinesses, memberOwnedPesantren, memberProfessionals,
} from "@jalajogja/db";
import { eq, and, isNotNull, isNull, lte, inArray, sql } from "drizzle-orm";
import { notifyWa, waAppUrl } from "@/lib/wa-notify";

// Kirim pengingat WA SEKALI (bukan berulang), 14 hari setelah member_welcome terkirim,
// kalau profil masih dianggap kurang lengkap. Kondisi kirim (dikunci bersama user 2026-07-15):
//   riwayat pendidikan KOSONG  ATAU  (usaha DAN pesantren DAN profesional kosong SEMUA)
// Data member (pendidikan/usaha/pesantren/profesional) adalah GLOBAL (public schema) — cron
// ini TIDAK perlu loop per tenant seperti invoice-reminder/event-reminder. WA dikirim lewat
// tenant yang sama dengan saat member_welcome dulu terkirim (welcomeSentTenantSlug).
export async function GET(request: NextRequest) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  const candidates = await db
    .select({
      id:                     members.id,
      name:                   members.name,
      contactId:              members.contactId,
      welcomeSentTenantSlug:  members.welcomeSentTenantSlug,
    })
    .from(members)
    .where(and(
      isNotNull(members.welcomeSentAt),
      lte(members.welcomeSentAt, cutoff),
      isNull(members.profileReminderSentAt),
      isNotNull(members.welcomeSentTenantSlug),
    ));

  if (candidates.length === 0) return NextResponse.json({ notified: 0, checked: 0 });

  const memberIds = candidates.map((c) => c.id);

  const [eduRows, bizRows, pesantrenRows, profRows] = await Promise.all([
    db.select({ memberId: memberEducations.memberId, cnt: sql<number>`count(*)` })
      .from(memberEducations).where(inArray(memberEducations.memberId, memberIds))
      .groupBy(memberEducations.memberId),
    db.select({ memberId: memberBusinesses.memberId, cnt: sql<number>`count(*)` })
      .from(memberBusinesses).where(inArray(memberBusinesses.memberId, memberIds))
      .groupBy(memberBusinesses.memberId),
    db.select({ memberId: memberOwnedPesantren.memberId, cnt: sql<number>`count(*)` })
      .from(memberOwnedPesantren).where(inArray(memberOwnedPesantren.memberId, memberIds))
      .groupBy(memberOwnedPesantren.memberId),
    db.select({ memberId: memberProfessionals.memberId, cnt: sql<number>`count(*)` })
      .from(memberProfessionals).where(inArray(memberProfessionals.memberId, memberIds))
      .groupBy(memberProfessionals.memberId),
  ]);

  const eduCount       = new Map(eduRows.map((r) => [r.memberId, Number(r.cnt)]));
  const bizCount       = new Map(bizRows.map((r) => [r.memberId, Number(r.cnt)]));
  const pesantrenCount = new Map(pesantrenRows.map((r) => [r.memberId, Number(r.cnt)]));
  const profCount      = new Map(profRows.map((r) => [r.memberId, Number(r.cnt)]));

  let notified = 0;

  for (const m of candidates) {
    const edu       = eduCount.get(m.id) ?? 0;
    const biz       = bizCount.get(m.id) ?? 0;
    const pesantren = pesantrenCount.get(m.id) ?? 0;
    const prof      = profCount.get(m.id) ?? 0;

    const eligible = edu === 0 || (biz === 0 && pesantren === 0 && prof === 0);
    if (!eligible) continue;
    if (!m.contactId || !m.welcomeSentTenantSlug) continue;

    const [contact] = await db
      .select({ phone: contacts.phone, whatsapp: contacts.whatsapp })
      .from(contacts)
      .where(eq(contacts.id, m.contactId))
      .limit(1);
    const phone = contact?.whatsapp || contact?.phone || null;
    if (!phone) continue;

    const missing: string[] = [];
    if (edu === 0)       missing.push("- Riwayat Pendidikan");
    if (biz === 0)       missing.push("- Data Usaha");
    if (pesantren === 0) missing.push("- Data Pesantren");
    if (prof === 0)      missing.push("- Data Profesional");

    const slug      = m.welcomeSentTenantSlug;
    const tenantDb   = createTenantDb(slug);

    void notifyWa({
      slug, tenantDb, event: "profile_incomplete_reminder",
      phone,
      vars: {
        name:        m.name,
        missingList: missing.join("\n"),
        profileUrl:  waAppUrl(slug, "/akun"),
      },
    });

    await db.update(members)
      .set({ profileReminderSentAt: new Date() })
      .where(eq(members.id, m.id));

    notified++;
  }

  return NextResponse.json({ notified, checked: candidates.length });
}
