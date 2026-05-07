import { NextRequest, NextResponse } from "next/server";
import { eq }                        from "drizzle-orm";
import { db, members, memberPesantren, pesantren } from "@jalajogja/db";
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

// ── GET /api/akun/member-pesantren ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { error, status, member } = await getSessionMember(req);
  if (error || !member) return NextResponse.json({ error }, { status });

  const rows = await db
    .select({
      id:           memberPesantren.id,
      pesantrenId:  memberPesantren.pesantrenId,
      pesantrenName: pesantren.name,
      peran:        memberPesantren.peran,
      posisi:       memberPesantren.posisi,
      tahunMulai:   memberPesantren.tahunMulai,
      tahunSelesai: memberPesantren.tahunSelesai,
      catatan:      memberPesantren.catatan,
    })
    .from(memberPesantren)
    .innerJoin(pesantren, eq(pesantren.id, memberPesantren.pesantrenId))
    .where(eq(memberPesantren.memberId, member.id))
    .orderBy(memberPesantren.tahunMulai);

  return NextResponse.json({ success: true, data: rows });
}

// ── POST /api/akun/member-pesantren — replace-all ─────────────────────────────
export async function POST(req: NextRequest) {
  const { error, status, member } = await getSessionMember(req);
  if (error || !member) return NextResponse.json({ error }, { status });

  const body = await req.json() as {
    entries: {
      pesantrenId:  string;
      peran:        string;
      posisi?:      string | null;
      tahunMulai?:  number | null;
      tahunSelesai?: number | null;
      catatan?:     string | null;
    }[];
  };

  const valid = (body.entries ?? []).filter(e => e.pesantrenId?.trim() && e.peran?.trim());

  try {
    await db.delete(memberPesantren).where(eq(memberPesantren.memberId, member.id));

    if (valid.length > 0) {
      await db.insert(memberPesantren).values(
        valid.map(e => ({
          memberId:    member.id,
          pesantrenId: e.pesantrenId,
          peran:       e.peran as "alumni"|"pengasuh"|"pendiri"|"pengajar"|"pengurus"|"lainnya",
          posisi:      e.posisi?.trim()  || null,
          tahunMulai:  e.tahunMulai      ?? null,
          tahunSelesai: e.tahunSelesai   ?? null,
          isActive:    e.tahunSelesai == null,
          catatan:     e.catatan?.trim() || null,
        }))
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/akun/member-pesantren]", err);
    return NextResponse.json({ error: "Gagal menyimpan." }, { status: 500 });
  }
}
