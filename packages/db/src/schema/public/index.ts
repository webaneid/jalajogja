export * from "./auth";
export * from "./tenants";

// ── Reference tables (seed data, Kemendagri + BPS) ────────────────────────────
export * from "./ref-provinces";
export * from "./ref-regencies";
export * from "./ref-districts";
export * from "./ref-villages";
export * from "./ref-professions";

// ── Helper tables (reusable FK-based) ─────────────────────────────────────────
export * from "./addresses";
export * from "./contacts";
export * from "./social-medias";

// ── Member tables ──────────────────────────────────────────────────────────────
export * from "./members";
export * from "./member-educations";
export * from "./member-businesses";
export * from "./member-domicile-requests";
export * from "./tenant-memberships";
