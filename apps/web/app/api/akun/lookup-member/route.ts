export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { eq, or }                    from "drizzle-orm";
import { db, contacts, members, profiles } from "@jalajogja/db";
import { rateLimitGuard }            from "@/lib/rate-limit";
import { normalizePhone }            from "@/lib/phone";

// GET /api/akun/lookup-member?stambuk=  |  ?email=  |  ?phone=
// Response: { found: true, name, memberId?, hasAccount?, type } | { found: false }
// type: "member" | "profile"

export async function GET(req: NextRequest) {
  const blocked = rateLimitGuard(req, "lookup-member", 10, 60_000);
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const email   = searchParams.get("email")?.toLowerCase().trim();
  const phone   = searchParams.get("phone")?.trim();
  const stambuk = searchParams.get("stambuk")?.trim();

  if (!email && !phone && !stambuk)
    return NextResponse.json({ error: "Parameter email, phone, atau stambuk diperlukan." }, { status: 400 });

  try {
    let member: { id: string; name: string; betterAuthUserId: string | null } | undefined;
    let profileFound: { name: string } | undefined;

    if (stambuk) {
      member = await db.query.members.findFirst({
        where: eq(members.stambukNumber, stambuk),
        columns: { id: true, name: true, betterAuthUserId: true },
      });
    } else if (email) {
      // JOIN langsung ke members — JANGAN cari contact dulu lalu member terpisah.
      // Satu nomor/email bisa punya BEBERAPA baris contacts (member sendiri, usaha,
      // pesantren, profesional — masing-masing self-reported dengan contactId sendiri).
      // contacts.findFirst() tanpa JOIN bisa memilih baris yang TIDAK terhubung ke
      // members sama sekali → member tidak ketemu meski orangnya sungguh terdaftar.
      const [row] = await db
        .select({ id: members.id, name: members.name, betterAuthUserId: members.betterAuthUserId })
        .from(members)
        .innerJoin(contacts, eq(contacts.id, members.contactId))
        .where(eq(contacts.email, email))
        .limit(1);
      member = row;
    } else if (phone) {
      const normalized = normalizePhone(phone) ?? phone;
      // Coba juga format lokal 08xxx — data lama di DB mungkin belum E.164
      const localFmt = normalized.startsWith("+62") ? "0" + normalized.slice(3) : null;
      const phoneCond = localFmt
        ? or(
            eq(contacts.phone, normalized), eq(contacts.whatsapp, normalized),
            eq(contacts.phone, localFmt),   eq(contacts.whatsapp, localFmt),
          )
        : or(eq(contacts.phone, normalized), eq(contacts.whatsapp, normalized));

      // Cari paralel: members (JOIN contacts, sama alasan seperti jalur email di atas)
      // DAN profiles.phone (kolom langsung, tidak lewat contacts — aman tanpa JOIN)
      const [memberRows, profile] = await Promise.all([
        db.select({ id: members.id, name: members.name, betterAuthUserId: members.betterAuthUserId })
          .from(members)
          .innerJoin(contacts, eq(contacts.id, members.contactId))
          .where(phoneCond)
          .limit(1),
        db.query.profiles.findFirst({
          where: localFmt
            ? or(eq(profiles.phone, normalized), eq(profiles.phone, localFmt))
            : eq(profiles.phone, normalized),
          columns: { name: true },
        }),
      ]);

      member = memberRows[0];

      // Profiles sebagai fallback — hanya dipakai jika member tidak ditemukan
      if (!member && profile) profileFound = profile;
    }

    if (member) {
      return NextResponse.json({
        found:      true,
        name:       member.name,
        memberId:   member.id,
        hasAccount: !!member.betterAuthUserId,
        type:       "member",
      });
    }

    if (profileFound) {
      return NextResponse.json({
        found: true,
        name:  profileFound.name,
        type:  "profile",
        // Profil publik SELALU berarti akun sudah ada (beda dari `members`, yang bisa eksis
        // tanpa akun login) — tanpa ini, client's `isClaiming` (`!hasAccount`) salah anggap
        // nomor ini "bisa diklaim" padahal sudah terdaftar sebagai akun publik.
        hasAccount: true,
      });
    }

    return NextResponse.json({ found: false });

  } catch (err) {
    console.error("[GET /api/akun/lookup-member]", err);
    return NextResponse.json({ found: false });
  }
}
