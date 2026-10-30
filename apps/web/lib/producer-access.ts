// Keputusan akses Portal Produsen — MURNI (tanpa DB/sesi) supaya bisa diuji. Fakta dikumpulkan oleh
// lib/producer-access.server.ts. Aturan: SEMUA syarat harus terpenuhi; satu saja gagal → tolak (fail-closed).
// Doc: docs/arsitektur-portal-produsen.md § 5.

export type ProducerAccessFacts = {
  hasSession:        boolean;  // sesi Better Auth ada
  tenantFound:       boolean;  // slug ada di public.tenants
  tenantActive:      boolean;  // tenants.is_active
  loginFound:        boolean;  // ada baris public.producer_logins (user ini + tenant ini)
  producerFound:     boolean;  // baris tenant_{slug}.producers yang dirujuk login masih ada
  producerActive:    boolean;  // producers.is_active
  producerIsMember:  boolean;  // producers.type = 'member' (produsen custom belum boleh login — keputusan D2)
  ownerAccountMatch: boolean;  // members.better_auth_user_id pemilik produsen = akun yang login
  ownerIsTenantMember: boolean; // pemilik masih anggota sah tenant (lib/tenant-membership.server.ts)
};

export type ProducerAccessDenial =
  | "no-session" | "tenant-not-found" | "tenant-inactive" | "not-producer" | "producer-missing"
  | "producer-inactive" | "not-member-producer" | "account-mismatch" | "left-membership";

export function decideProducerAccess(f: ProducerAccessFacts): { allow: true } | { allow: false; reason: ProducerAccessDenial } {
  if (!f.hasSession)           return { allow: false, reason: "no-session" };
  if (!f.tenantFound)          return { allow: false, reason: "tenant-not-found" };
  if (!f.tenantActive)         return { allow: false, reason: "tenant-inactive" };
  if (!f.loginFound)           return { allow: false, reason: "not-producer" };
  if (!f.producerFound)        return { allow: false, reason: "producer-missing" };
  if (!f.producerActive)       return { allow: false, reason: "producer-inactive" };
  if (!f.producerIsMember)     return { allow: false, reason: "not-member-producer" };
  if (!f.ownerAccountMatch)    return { allow: false, reason: "account-mismatch" };
  if (!f.ownerIsTenantMember)  return { allow: false, reason: "left-membership" };
  return { allow: true };
}
