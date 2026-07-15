import { headers } from "next/headers";
import { isOwnHost } from "./is-own-host";

// Satu sumber kebenaran untuk baseUrl di server component publik — dulu dihitung ulang
// independen di ~16 file (`isOwnHost(host) ? "/${slug}" : ""`), risiko struktural yang
// berulang kali jadi sumber bug custom domain. Lihat docs/arsitektur-domain.md § 5.2/8.3.
//
// x-forwarded-host dicek duluan (proxy-aware) — sebelumnya cuma dilakukan di login/page.tsx,
// sekarang berlaku universal karena secara teknis lebih benar di semua tempat, bukan cuma satu.
export async function resolveBaseUrl(slug: string): Promise<string> {
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  return isOwnHost(host) ? `/${slug}` : "";
}
