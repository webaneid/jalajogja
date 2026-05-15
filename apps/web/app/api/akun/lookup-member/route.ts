export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { eq, or }                    from "drizzle-orm";
import { db, contacts, members }     from "@jalajogja/db";
import { rateLimitGuard }            from "@/lib/rate-limit";

// GET /api/akun/lookup-member?stambuk=  |  ?email=  |  ?phone=
// Response: { found: true, name, memberId, hasAccount } | { found: false }

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

    if (stambuk) {
      member = await db.query.members.findFirst({
        where: eq(members.stambukNumber, stambuk),
        columns: { id: true, name: true, betterAuthUserId: true },
      });
    } else if (email) {
      const contact = await db.query.contacts.findFirst({ where: eq(contacts.email, email) });
      if (contact) {
        member = await db.query.members.findFirst({
          where: eq(members.contactId, contact.id),
          columns: { id: true, name: true, betterAuthUserId: true },
        });
      }
    } else if (phone) {
      const contact = await db.query.contacts.findFirst({
        where: or(eq(contacts.phone, phone), eq(contacts.whatsapp, phone)),
      });
      if (contact) {
        member = await db.query.members.findFirst({
          where: eq(members.contactId, contact.id),
          columns: { id: true, name: true, betterAuthUserId: true },
        });
      }
    }

    if (member) {
      return NextResponse.json({
        found:      true,
        name:       member.name,
        memberId:   member.id,
        hasAccount: !!member.betterAuthUserId,
      });
    }

    return NextResponse.json({ found: false });

  } catch (err) {
    console.error("[GET /api/akun/lookup-member]", err);
    return NextResponse.json({ found: false });
  }
}
