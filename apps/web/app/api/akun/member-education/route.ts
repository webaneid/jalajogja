import { NextRequest, NextResponse } from "next/server";
import { eq }                        from "drizzle-orm";
import { db, members, memberEducations } from "@jalajogja/db";
import { auth }                      from "@/lib/auth";

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

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/akun/member-education]", err);
    return NextResponse.json({ error: "Gagal menyimpan." }, { status: 500 });
  }
}
