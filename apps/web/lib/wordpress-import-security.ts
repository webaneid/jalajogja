// Modul keamanan untuk fitur Import WordPress — mitigasi SSRF (Server-Side Request Forgery).
// SEMUA fetch eksternal yang dipicu input admin (URL situs WP lama § 2.2, URL gambar
// featured/inline § 7.1/§ 7.2) WAJIB lewat safeFetch()/assertSafeExternalUrl() di sini —
// satu gerbang validasi, bukan tiap titik fetch menulis validasi sendiri-sendiri.
//
// Arsitektur: docs/arsitektur-import-export-post-wordpress.md § 11

import { promises as dns } from "node:dns";

export type SafeUrlResult = { ok: true; url: URL } | { ok: false; reason: string };

const MAX_REDIRECT_HOPS = 3;
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Validasi SATU URL: skema http/https, DNS resolve, tolak kalau salah satu IP hasil resolve
 * adalah alamat privat/reserved. TIDAK mengikuti redirect — itu tanggung jawab safeFetch().
 */
export async function assertSafeExternalUrl(rawUrl: string): Promise<SafeUrlResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "URL tidak valid." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Hanya URL http/https yang diizinkan." };
  }

  // url.hostname mempertahankan tanda kurung untuk literal IPv6 (mis. "[::1]") — dns.lookup()
  // TIDAK memahami notasi kurung, harus dilucuti dulu atau setiap URL ber-IPv6-literal akan
  // gagal resolve (dan secara tidak sengaja "tertolak" untuk alasan yang salah, bukan karena
  // memang privat/reserved).
  const hostnameForDns = url.hostname.replace(/^\[|\]$/g, "");

  let addresses: string[];
  try {
    addresses = (await dns.lookup(hostnameForDns, { all: true })).map((a) => a.address);
  } catch {
    return { ok: false, reason: "Domain tidak bisa di-resolve." };
  }

  if (addresses.length === 0) {
    return { ok: false, reason: "Domain tidak bisa di-resolve." };
  }

  for (const ip of addresses) {
    if (isPrivateOrReservedIp(ip)) {
      return { ok: false, reason: "URL menunjuk ke alamat internal/privat — tidak diizinkan." };
    }
  }

  return { ok: true, url };
}

/**
 * fetch() yang aman dari SSRF-via-redirect: redirect TIDAK diikuti otomatis, tiap hop
 * (termasuk hop pertama) divalidasi ulang lewat assertSafeExternalUrl() sebelum benar-benar
 * di-fetch, maksimal 3 hop. Ini SATU-SATUNYA cara fetch eksternal yang boleh dipakai fitur
 * import WordPress — jangan panggil fetch() langsung di tempat lain untuk fitur ini.
 */
export async function safeFetch(rawUrl: string, init?: RequestInit): Promise<Response> {
  let currentUrl = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    const check = await assertSafeExternalUrl(currentUrl);
    if (!check.ok) {
      throw new Error(`URL tidak aman (hop ${hop}): ${check.reason}`);
    }

    const res = await fetch(check.url, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    const isRedirect = res.status >= 300 && res.status < 400;
    if (!isRedirect) return res;

    if (hop === MAX_REDIRECT_HOPS) {
      throw new Error(`Terlalu banyak redirect (maksimal ${MAX_REDIRECT_HOPS} hop).`);
    }

    const location = res.headers.get("location");
    if (!location) {
      throw new Error("Respons redirect tanpa header Location.");
    }
    currentUrl = new URL(location, check.url).toString();
  }

  // Tidak pernah tercapai (loop selalu return atau throw di dalam), tapi TypeScript butuh ini.
  throw new Error(`Terlalu banyak redirect (maksimal ${MAX_REDIRECT_HOPS} hop).`);
}

// ── Cek IP privat/reserved ──────────────────────────────────────────────────────────────────
// Daftar range PERSIS sesuai dokumen arsitektur § 11 — tidak ditambah di luar yang
// didokumentasikan, kecuali dicatat eksplisit sebagai temuan terpisah (lihat catatan di bawah).

function isPrivateOrReservedIp(ip: string): boolean {
  return ip.includes(":") ? isPrivateOrReservedIpv6(ip) : isPrivateOrReservedIpv4(ip);
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return true; // format tak dikenal → fail closed (anggap tidak aman)

  const octets = parts.map(Number);
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;

  const [a, b] = octets;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 127) return true; // 127.0.0.0/8 (loopback)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local, termasuk cloud metadata)
  if (a === 0) return true; // 0.0.0.0/8
  return false;
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const lower = normalizeEmbeddedIpv4(ip.toLowerCase());
  const groups = expandIpv6Groups(lower);
  if (!groups) return true; // gagal parse → fail closed (anggap tidak aman)

  // ::1 — loopback
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true;

  // ::ffff:0:0/96 — IPv4-mapped. PENTING: `new URL(...)` MENORMALISASI notasi dotted-quad
  // (mis. "::ffff:127.0.0.1") jadi hex groups murni ("::ffff:7f00:1") SEBELUM kode ini sempat
  // melihat string aslinya — dikonfirmasi lewat pengujian nyata, BUKAN diasumsikan. Cek string
  // "mengandung titik" TIDAK BISA diandalkan karena titiknya sudah hilang duluan. Solusi:
  // deteksi prefix ::ffff:0:0/96 secara NUMERIK dari grup yang sudah di-expand, lalu
  // rekonstruksi octet IPv4 dari 2 grup 16-bit terakhir untuk dicek pakai aturan IPv4 di atas.
  // TIDAK ada di daftar eksplisit dokumen § 11 — bypass SSRF klasik (AAAA record berisi alamat
  // IPv4-mapped) yang ditambahkan saat implementasi, dicatat eksplisit sebagai temuan baru.
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    const embeddedIPv4 = [
      (groups[6] >> 8) & 0xff, groups[6] & 0xff,
      (groups[7] >> 8) & 0xff, groups[7] & 0xff,
    ].join(".");
    if (isPrivateOrReservedIpv4(embeddedIPv4)) return true;
  }

  const first = groups[0];
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 (unique local)
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 (link-local)
  return false;
}

// Ganti bagian IPv4 dotted-quad (kalau ADA — kasus defensif, sejauh ini `new URL()` selalu
// sudah menormalisasi ke hex groups murni duluan) di akhir alamat IPv6 jadi 2 grup hex, supaya
// expandIpv6Groups() bisa memproses seluruh alamat secara seragam.
function normalizeEmbeddedIpv4(ip: string): string {
  if (!ip.includes(".")) return ip;
  const lastColon = ip.lastIndexOf(":");
  const maybeIPv4 = ip.slice(lastColon + 1);
  const octets = maybeIPv4.split(".").map(Number);
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return ip;
  }
  const hex1 = ((octets[0] << 8) | octets[1]).toString(16);
  const hex2 = ((octets[2] << 8) | octets[3]).toString(16);
  return ip.slice(0, lastColon + 1) + hex1 + ":" + hex2;
}

// Ekspansi alamat IPv6 (yang mungkin dipadatkan via "::") jadi 8 grup 16-bit — cukup untuk
// cek prefix (fc00::/7, fe80::/10), bukan validator IPv6 lengkap.
function expandIpv6Groups(ip: string): number[] | null {
  const sections = ip.split("::");
  if (sections.length > 2) return null; // lebih dari satu "::" — tidak valid

  const head = sections[0] ? sections[0].split(":").filter(Boolean) : [];
  const tail = sections.length === 2 && sections[1] ? sections[1].split(":").filter(Boolean) : [];

  let allGroups: string[];
  if (sections.length === 2) {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    allGroups = [...head, ...Array(missing).fill("0"), ...tail];
  } else {
    allGroups = head;
  }

  if (allGroups.length !== 8) return null;

  const parsed = allGroups.map((g) => parseInt(g, 16));
  if (parsed.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return null;
  return parsed;
}
