export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { eq }                        from "drizzle-orm";
import { db, members, memberEducations, contacts, createTenantDb } from "@jalajogja/db";
import { auth }                      from "@/lib/auth";
import { notifyWa, waAppUrl }        from "@/lib/wa-notify";

async function getSessionMember(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return { error: "Login diperlukan.", status: 401 as const, member: null };
  const member = await db.query.members.findFirst({
    where: eq(members.betterAuthUserId, session.user.id),
    columns: { id: true },
  });
  if (!member) return { error: "Bukan anggota IKPM.", status: 403 as const, member: null };
  return { error: null, status: 200 as const, member };
}

// ── GET /api/akun/member-education ───────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { error, status, member } = await getSessionMember(req);
  if (error || !member) return NextResponse.json({ error }, { status });

  const rows = await db
    .select({
      id:              memberEducations.id,
      level:           memberEducations.level,
      institutionName: memberEducations.institutionName,
      major:           memberEducations.major,
      startYear:       memberEducations.startYear,
      endYear:         memberEducations.endYear,
      isGontor:        memberEducations.isGontor,
      gontorCampus:    memberEducations.gontorCampus,
    })
    .from(memberEducations)
    .where(eq(memberEducations.memberId, member.id))
    .orderBy(memberEducations.startYear);

  return NextResponse.json({ success: true, data: rows });
}

// ── POST /api/akun/member-education — replace-all ─────────────────────────────
export async function POST(req: NextRequest) {
  const { error, status, member } = await getSessionMember(req);
  if (error || !member) return NextResponse.json({ error }, { status });

  const body = await req.json() as {
    slug?:    string;   // tenant tempat wizard diisi — untuk WA gateway member_welcome
    entries: {
      level:           string;
      institutionName: string;
      major?:          string | null;
      startYear?:      number | null;
      endYear?:        number | null;
      isGontor:        boolean;
      gontorCampus?:   string | null;
    }[];
  };

  const valid = (body.entries ?? []).filter(e => e.institutionName?.trim());

  try {
    await db.delete(memberEducations).where(eq(memberEducations.memberId, member.id));

    if (valid.length > 0) {
      await db.insert(memberEducations).values(
        valid.map(e => ({
          memberId:        member.id,
          level:           e.level as "TK"|"SD"|"SMP"|"SMA"|"D3"|"S1"|"S2"|"S3"|"Non-Formal",
          institutionName: e.institutionName.trim(),
          major:           e.major?.trim()  || null,
          startYear:       e.startYear      ?? null,
          endYear:         e.endYear        ?? null,
          isGontor:     e.isGontor,
          gontorCampus: (e.isGontor ? (e.gontorCampus || null) : null) as
            "Gontor 1 (Putra)"|"Gontor 2 (Putra)"|"Gontor 3 (Putra)"|"Gontor 4 (Putra)"|
            "Gontor 5 (Putra)"|"Gontor 6 (Putra)"|"Gontor 7 (Putra)"|"Gontor 8 (Putra)"|
            "Gontor Putri 1"|"Gontor Putri 2"|"Gontor Putri 3"|
            "Gontor Putri 4"|"Gontor Putri 5"|"Gontor Putri 6"|null,
        }))
      );
    }

    // Kirim WA "Selamat Datang" — sekali seumur hidup, saat wizard 3-step /akun/lengkapi
    // pertama kali selesai (step ini adalah step terakhir). Idempotent via welcomeSentAt.
    if (body.slug) {
      const [memberRow] = await db
        .select({
          name:          members.name,
          memberNumber:  members.memberNumber,
          contactId:     members.contactId,
          welcomeSentAt: members.welcomeSentAt,
        })
        .from(members)
        .where(eq(members.id, member.id))
        .limit(1);

      if (memberRow && !memberRow.welcomeSentAt && memberRow.contactId) {
        const [contact] = await db
          .select({ phone: contacts.phone, whatsapp: contacts.whatsapp })
          .from(contacts)
          .where(eq(contacts.id, memberRow.contactId))
          .limit(1);
        const phone = contact?.whatsapp || contact?.phone || null;

        if (phone) {
          const tenantDb = createTenantDb(body.slug);
          void notifyWa({
            slug: body.slug, tenantDb, event: "member_welcome",
            phone,
            vars: {
              name:         memberRow.name,
              memberNumber: memberRow.memberNumber ?? "-",
              profileUrl:   waAppUrl(body.slug, "/akun"),
            },
          });
          await db.update(members)
            .set({ welcomeSentAt: new Date(), welcomeSentTenantSlug: body.slug })
            .where(eq(members.id, member.id));
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/akun/member-education]", err);
    return NextResponse.json({ error: "Gagal menyimpan." }, { status: 500 });
  }
}
