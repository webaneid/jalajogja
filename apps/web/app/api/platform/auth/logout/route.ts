export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { clearPlatformSessionCookie } from "@/lib/platform-auth";

export async function POST() {
  await clearPlatformSessionCookie();
  return NextResponse.json({ ok: true });
}
