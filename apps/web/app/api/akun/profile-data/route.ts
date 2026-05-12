import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, profiles } from "@jalajogja/db";
import { headers } from "next/headers";
import { normalizePhone } from "@/lib/phone";

// GET — ambil data profil publik
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile] = await db
    .select({
      id:            profiles.id,
      name:          profiles.name,
      email:         profiles.email,
      phone:         profiles.phone,
      whatsapp:      profiles.whatsapp,
      addressDetail: profiles.addressDetail,
      provinceId:    profiles.provinceId,
      regencyId:     profiles.regencyId,
      districtId:    profiles.districtId,
      villageId:     profiles.villageId,
      waliSantri:    profiles.waliSantri,
    })
    .from(profiles)
    .where(eq(profiles.betterAuthUserId, session.user.id))
    .limit(1);

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  return NextResponse.json(profile);
}

// PATCH — update data profil publik
export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.betterAuthUserId, session.user.id))
    .limit(1);

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const body = await req.json() as {
    name?:          string;
    phone?:         string;
    whatsapp?:      string | null;
    addressDetail?: string | null;
    provinceId?:    string | null;
    regencyId?:     string | null;
    districtId?:    string | null;
    villageId?:     string | null;
    waliSantri?:    string | null;
  };

  await db
    .update(profiles)
    .set({
      ...(body.name          !== undefined && { name: body.name.trim() }),
      ...(body.phone         !== undefined && { phone: normalizePhone(body.phone) ?? body.phone }),
      ...(body.whatsapp      !== undefined && { whatsapp: normalizePhone(body.whatsapp) }),
      ...(body.addressDetail !== undefined && { addressDetail: body.addressDetail || null }),
      ...(body.provinceId    !== undefined && { provinceId: body.provinceId || null }),
      ...(body.regencyId     !== undefined && { regencyId: body.regencyId || null }),
      ...(body.districtId    !== undefined && { districtId: body.districtId || null }),
      ...(body.villageId     !== undefined && { villageId: body.villageId || null }),
      ...(body.waliSantri    !== undefined && { waliSantri: (body.waliSantri as "gontor" | "alumni" | "lain" | "bukan" | null) || null }),
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, profile.id));

  return NextResponse.json({ success: true });
}
