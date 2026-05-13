import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const COOKIE_NAME = "platform_session";
const SECRET      = new TextEncoder().encode(
  process.env.PLATFORM_JWT_SECRET ?? "platform-secret-change-in-production",
);
const EXPIRES_IN  = 60 * 60 * 8; // 8 jam

export type PlatformSessionPayload = {
  userId: string;
  email:  string;
  name:   string;
  role:   "owner" | "admin" | "staff";
};

export async function signPlatformToken(payload: PlatformSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRES_IN}s`)
    .sign(SECRET);
}

export async function verifyPlatformToken(token: string): Promise<PlatformSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as PlatformSessionPayload;
  } catch {
    return null;
  }
}

export async function getPlatformSession(): Promise<PlatformSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyPlatformToken(token);
}

export async function getPlatformSessionFromRequest(req: NextRequest): Promise<PlatformSessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyPlatformToken(token);
}

export async function setPlatformSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   EXPIRES_IN,
    path:     "/platform",
  });
}

export async function clearPlatformSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
