// Tinjauan Pengajuan Produsen (sisi PENGURUS) — docs/arsitektur-pengajuan-produsen.md § 10, § 11, § 14.
//
// Izin: lihat = hasReadAccess(anggota), setujui/tolak = hasFullAccess(anggota) (Owner/Ketua/Sekretaris pada matriks yang ada; tanpa role baru).
// Pemanggil WAJIB sudah menjalankan getTenantAccess(slug) + cek izin; fungsi di sini menerima `access` yang sudah tervalidasi sesi.
//
// SETUJUI (atomik dengan satu celah lintas-schema yang dikompensasi):
//   tenant TX { kunci per pengajuan → muat pengajuan (harus pending) → pemohon masih anggota sah + punya akun terklaim + sumber masih
//               milik pemohon & aktif + belum jadi produsen → INSERT producers → UPDATE pengajuan pending→approved (compare-and-set) →
//               INSERT public.producer_logins (TERAKHIR) }
//   Login ada di schema `public` (client terpisah → bukan bagian TX). Karena disisipkan paling akhir, kegagalannya me-rollback TX penuh
//   (produsen + status ikut batal). Satu-satunya celah: commit TX gagal SETELAH login tersisip → login dihapus di blok catch.
import "server-only";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import {
  db as publicDb, createTenantDb, members, contacts, producerLogins, refRegencies,
  memberBusinesses, memberOwnedPesantren, memberProfessionals,
  type ProducerApplication,
} from "@jalajogja/db";
import type { TenantAccessResult } from "@/lib/tenant";
import { isTenantMember } from "@/lib/tenant-membership.server";
import { resolveProducers } from "@/lib/producer.server";
import { verifySource } from "@/lib/producer-application.server";
import { notifyApplicationDecision } from "@/lib/producer-application-notify.server";
import { pgErrorCode } from "@/lib/pg-error";
import { isValidUuid } from "@/lib/is-uuid";
import { DEFAULT_PRODUCER_PRODUCT_LIMIT, parseSharePercent } from "@/lib/producer-application";

type TenantDb = ReturnType<typeof createTenantDb>;
export type ReviewStatus = "pending" | "approved" | "rejected" | "cancelled";
export const REVIEW_STATUSES: readonly ReviewStatus[] = ["pending", "approved", "rejected", "cancelled"];

export class ReviewError extends Error {}

// ── Daftar ──────────────────────────────────────────────────────────────────────────────────────────────
export type ReviewRow = {
  id: string; status: ReviewStatus; brandName: string; memberName: string; memberNumber: string | null;
  offeredSharePercent: string | null; submittedAt: string | null; reviewedAt: string | null;
};

/** Jumlah pengajuan menunggu. Tabel belum ada (migration 0092 belum jalan, 42P01) → 0, bukan galat. */
export async function countPendingApplications(tc: TenantDb): Promise<number> {
  try {
    const [r] = await tc.db.select({ n: sql<number>`COUNT(*)::int` }).from(tc.schema.producerApplications)
      .where(eq(tc.schema.producerApplications.status, "pending"));
    return r?.n ?? 0;
  } catch (e) {
    if (pgErrorCode(e) === "42P01") return 0;
    throw e;
  }
}

const escapeLike = (v: string) => v.replace(/[\\%_]/g, "\\$&");

/** Untuk lencana/dashboard/digest: tidak boleh menjatuhkan halaman, tetapi galat selain "tabel belum ada" DICATAT (bukan ditelan). */
export async function countPendingApplicationsSafe(tc: TenantDb): Promise<number> {
  try { return await countPendingApplications(tc); }
  catch (e) { console.error("[countPendingApplications]", pgErrorCode(e) ?? (e instanceof Error ? e.message : "unknown")); return 0; }
}

export async function listApplications(
  tc: TenantDb, opts: { status: ReviewStatus; q: string; page: number; pageSize: number },
): Promise<{ rows: ReviewRow[]; total: number }> {
  const T = tc.schema.producerApplications;
  const needle = escapeLike(opts.q.trim().slice(0, 100));
  // Pencarian nama pemohon: cari id anggota di public.members dulu, lalu saring di tenant (tanpa menarik semua baris ke memori)
  let memberIds: string[] = [];
  if (needle) {
    // Cari nama HANYA di antara anggota yang memang punya pengajuan berstatus ini (bukan seluruh public.members + LIMIT sembarang)
    const candidates = (await tc.db.selectDistinct({ m: T.memberId }).from(T).where(eq(T.status, opts.status)).limit(5000).catch((e) => {
      if (pgErrorCode(e) === "42P01") return [] as { m: string }[];
      throw e;
    })).map((r) => r.m);
    memberIds = candidates.length
      ? (await publicDb.select({ id: members.id }).from(members).where(and(inArray(members.id, candidates), ilike(members.name, `%${needle}%`)))).map((r) => r.id)
      : [];
  }
  const where = and(
    eq(T.status, opts.status),
    needle ? or(ilike(T.brandName, `%${needle}%`), memberIds.length ? inArray(T.memberId, memberIds) : undefined) : undefined,
  );
  const page = Math.min(1000, Math.max(1, Math.floor(opts.page) || 1));      // batas atas: OFFSET tak boleh meluap
  let list: { id: string; status: string; brandName: string | null; memberId: string; share: string | null; submittedAt: Date | null; reviewedAt: Date | null }[];
  let total: number;
  try {
    [list, [{ n: total }]] = await Promise.all([
      tc.db.select({
        id: T.id, status: T.status, brandName: T.brandName, memberId: T.memberId, share: T.offeredSharePercent,
        submittedAt: T.submittedAt, reviewedAt: T.reviewedAt,                                   // kolom ringan: tanpa JSONB berkas
      }).from(T).where(where).orderBy(desc(T.submittedAt), desc(T.createdAt)).limit(opts.pageSize).offset((page - 1) * opts.pageSize),
      tc.db.select({ n: sql<number>`COUNT(*)::int` }).from(T).where(where),
    ]);
  } catch (e) {
    if (pgErrorCode(e) === "42P01") return { rows: [], total: 0 };
    throw e;
  }
  const ids = [...new Set(list.map((r) => r.memberId))];
  const ms = ids.length
    ? await publicDb.select({ id: members.id, name: members.name, memberNumber: members.memberNumber }).from(members).where(inArray(members.id, ids))
    : [];
  const mm = new Map(ms.map((m) => [m.id, m]));
  return {
    total,
    rows: list.map((r): ReviewRow => ({
      id: r.id, status: r.status as ReviewStatus, brandName: r.brandName ?? "—",
      memberName: mm.get(r.memberId)?.name ?? "—", memberNumber: mm.get(r.memberId)?.memberNumber ?? null,
      offeredSharePercent: r.share != null ? String(Number(r.share)) : null,
      submittedAt: r.submittedAt?.toISOString() ?? null, reviewedAt: r.reviewedAt?.toISOString() ?? null,
    })),
  };
}

// ── Detail ──────────────────────────────────────────────────────────────────────────────────────────────
export type ReviewDetail = {
  app: ProducerApplication;
  member: { id: string; name: string; memberNumber: string | null; stambukNumber: string | null; email: string | null; phone: string | null; whatsapp: string | null; hasAccount: boolean };
  isActiveMember: boolean;
  sourceLabel: string | null;
  regencyName: string | null;
  isOwnApplication: boolean;   // peninjau = pemohon (konflik kepentingan — diberi peringatan & ditandai pada catatan internal)
};

export async function getApplicationDetail(
  tc: TenantDb, tenant: { id: string; tenantType: string | null }, id: string, viewerMemberId: string | null = null,
): Promise<ReviewDetail | null> {
  if (!isValidUuid(id)) return null;
  const T = tc.schema.producerApplications;
  const [app] = await tc.db.select().from(T).where(eq(T.id, id)).limit(1);
  if (!app || app.status === "draft") return null;   // draf adalah milik pemohon sampai ia mengirimnya

  const [m] = await publicDb.select({
    id: members.id, name: members.name, memberNumber: members.memberNumber, stambukNumber: members.stambukNumber,
    contactId: members.contactId, acc: members.betterAuthUserId,
  }).from(members).where(eq(members.id, app.memberId)).limit(1);
  if (!m) return null;
  const [c] = m.contactId
    ? await publicDb.select({ email: contacts.email, phone: contacts.phone, whatsapp: contacts.whatsapp }).from(contacts).where(eq(contacts.id, m.contactId)).limit(1)
    : [];

  let sourceLabel: string | null = null;
  if (app.sourceType && app.sourceId) {
    if (app.sourceType === "usaha") {
      const [r] = await publicDb.select({ name: memberBusinesses.name, brand: memberBusinesses.brand, sector: memberBusinesses.sector }).from(memberBusinesses).where(eq(memberBusinesses.id, app.sourceId)).limit(1);
      sourceLabel = r ? `Usaha — ${r.brand?.trim() || r.name}${r.sector ? ` (${r.sector})` : ""}` : "Usaha (data sudah dihapus)";
    } else if (app.sourceType === "pesantren") {
      const [r] = await publicDb.select({ name: memberOwnedPesantren.name }).from(memberOwnedPesantren).where(eq(memberOwnedPesantren.id, app.sourceId)).limit(1);
      sourceLabel = r ? `Pesantren — ${r.name}` : "Pesantren (data sudah dihapus)";
    } else {
      const [r] = await publicDb.select({ title: memberProfessionals.title }).from(memberProfessionals).where(eq(memberProfessionals.id, app.sourceId)).limit(1);
      sourceLabel = r ? `Profesional — ${r.title ?? ""}` : "Profesional (data sudah dihapus)";
    }
  }
  let regencyName: string | null = null;
  if (app.originRegencyId) {
    const [rg] = await publicDb.select({ name: refRegencies.name }).from(refRegencies).where(eq(refRegencies.id, app.originRegencyId)).limit(1);
    regencyName = rg?.name ?? null;
  }
  return {
    app, sourceLabel, regencyName, isActiveMember: await isTenantMember(m.id, tenant), isOwnApplication: !!viewerMemberId && viewerMemberId === app.memberId,
    member: { id: m.id, name: m.name, memberNumber: m.memberNumber ?? null, stambukNumber: m.stambukNumber ?? null, email: c?.email ?? null, phone: c?.phone ?? null, whatsapp: c?.whatsapp ?? null, hasAccount: !!m.acc },
  };
}

// ── Setujui ─────────────────────────────────────────────────────────────────────────────────────────────
export type ApproveInput = { sharePercent: unknown; note: unknown };
type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

const SELF_MARK = "[Diputuskan oleh pemohon sendiri] ";
const withSelfMark = (note: string | null, self: boolean): string | null => (self ? (SELF_MARK + (note ?? "")).trim().slice(0, 1000) : note);

const cleanNote = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/\r/g, "").trim();
  return t ? t.slice(0, max) : null;
};

export async function approveApplication(access: TenantAccessResult, id: string, input: ApproveInput): Promise<Result<{ producerId: string }>> {
  if (!isValidUuid(id)) return { ok: false, error: "Pengajuan tidak ditemukan." };
  const sp = parseSharePercent(input.sharePercent);                       // angka yang DISEPAKATI penyetuju (bawaan form = tawaran pemohon)
  if (!sp.ok) return { ok: false, error: sp.error };
  const note = cleanNote(input.note, 1000);

  const tc = createTenantDb(access.tenant.slug);
  const { db: tdb, schema } = tc;
  const T = schema.producerApplications, P = schema.producers;
  const tenantRef = { id: access.tenant.id, tenantType: access.tenant.tenantType };
  let loginId: string | null = null;

  try {
    const out = await tdb.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"prodapp-review:" + id}))`);   // dua penyetuju bersamaan → berurutan
      const [app] = await tx.select().from(T).where(eq(T.id, id)).limit(1);
      if (!app) throw new ReviewError("Pengajuan tidak ditemukan.");
      if (app.status !== "pending") throw new ReviewError("Pengajuan sudah diproses.");
      if (!app.sourceType || !app.sourceId) throw new ReviewError("Pengajuan tidak memiliki sumber usaha.");

      // Semua fakta dibaca ulang dari DB pada saat keputusan (bukan percaya keadaan saat pengajuan dikirim)
      const [m] = await publicDb.select({ id: members.id, acc: members.betterAuthUserId }).from(members).where(eq(members.id, app.memberId)).limit(1);
      if (!m) throw new ReviewError("Data anggota pemohon tidak ditemukan.");
      if (!m.acc) throw new ReviewError("Pemohon belum mengklaim akunnya, jadi akses login tidak bisa dibuat.");
      if (!(await isTenantMember(m.id, tenantRef))) throw new ReviewError("Pemohon bukan lagi anggota sah tenant ini.");
      const srcErr = await verifySource({ memberId: m.id, tenantClient: tc }, app.sourceType, app.sourceId);
      if (srcErr) throw new ReviewError(srcErr);
      const [already] = await tx.select({ id: P.id }).from(P).where(eq(P.memberId, m.id)).limit(1);
      if (already) throw new ReviewError("Pemohon sudah tercatat sebagai produsen di tenant ini.");

      // Login yatim (produsen sudah tidak ada) menghalangi UNIQUE(user_id, tenant_id): bersihkan; login yang sah → tolak dengan pesan jelas
      const [exLogin] = await publicDb.select({ id: producerLogins.id, producerId: producerLogins.producerId }).from(producerLogins)
        .where(and(eq(producerLogins.userId, m.acc), eq(producerLogins.tenantId, access.tenant.id))).limit(1);
      if (exLogin) {
        const [live] = await tx.select({ id: P.id }).from(P).where(eq(P.id, exLogin.producerId)).limit(1);
        if (live) throw new ReviewError("Akun pemohon sudah terdaftar sebagai produsen lain di tenant ini.");
        await publicDb.delete(producerLogins).where(eq(producerLogins.id, exLogin.id));
      }

      const [prod] = await tx.insert(P).values({
        type: "member", sourceType: app.sourceType, sourceId: app.sourceId, memberId: m.id,
        brandName: app.brandName, productLimit: DEFAULT_PRODUCER_PRODUCT_LIMIT, revenueSharePercent: sp.value,
        applicationId: app.id, isActive: true, createdBy: access.tenantUser.id,
      }).returning({ id: P.id });

      const now = new Date();
      const upd = await tx.update(T).set({
        status: "approved", reviewedAt: now, reviewedBy: access.tenantUser.id, reviewNote: withSelfMark(note, !!access.tenantUser.memberId && access.tenantUser.memberId === app.memberId), producerId: prod.id, updatedAt: now,
      }).where(and(eq(T.id, id), eq(T.status, "pending"))).returning({ id: T.id });              // compare-and-set (pemohon bisa membatalkan kapan saja)
      if (upd.length === 0) throw new ReviewError("Pengajuan baru saja dibatalkan pemohon.");

      // PALING AKHIR: kegagalan di sini me-rollback produsen + status di atas
      const [lg] = await publicDb.insert(producerLogins).values({
        userId: m.acc, tenantId: access.tenant.id, producerId: prod.id, grantedBy: access.tenantUser.id,
      }).returning({ id: producerLogins.id });
      loginId = lg.id;
      return { producerId: prod.id, memberId: m.id, brand: app.brandName ?? "" };
    });

    // Cadangan nama (dipakai bila baris sumber kelak dihapus) — upaya terbaik, tidak membatalkan persetujuan
    try {
      const view = (await resolveProducers(tc, { id: access.tenant.id, name: access.tenant.name, tenantType: access.tenant.tenantType }, [out.producerId])).get(out.producerId);
      if (view?.name) await tdb.update(P).set({ nameCache: view.name }).where(eq(P.id, out.producerId));
    } catch (e) { console.error("[approveApplication] nameCache:", e); }
    void notifyApplicationDecision({ slug: access.tenant.slug, tenantClient: tc, memberId: out.memberId, brand: out.brand, kind: "approved", sharePercent: sp.value });
    return { ok: true, data: { producerId: out.producerId } };
  } catch (e) {
    // Commit TX gagal setelah login tersisip → hapus login (kompensasi). Login yatim tanpa produsen = akses tanpa pemilik.
    if (loginId) await publicDb.delete(producerLogins).where(eq(producerLogins.id, loginId)).catch((err) => console.error("[approveApplication] KOMPENSASI login gagal, hapus manual:", loginId, err));
    if (e instanceof ReviewError) return { ok: false, error: e.message };
    if (pgErrorCode(e) === "23505") return { ok: false, error: "Data produsen bentrok dengan data yang sudah ada. Muat ulang halaman lalu periksa daftar produsen." };
    console.error("[approveApplication]", pgErrorCode(e) ?? "unknown", e instanceof Error ? e.message : "");
    return { ok: false, error: "Gagal menyetujui pengajuan." };
  }
}

// ── Tolak ───────────────────────────────────────────────────────────────────────────────────────────────
export type RejectInput = { reason: unknown; note: unknown };

export async function rejectApplication(access: TenantAccessResult, id: string, input: RejectInput): Promise<Result> {
  if (!isValidUuid(id)) return { ok: false, error: "Pengajuan tidak ditemukan." };
  const reason = cleanNote(input.reason, 500);
  if (!reason || reason.length < 10) return { ok: false, error: "Alasan penolakan wajib diisi (minimal 10 karakter); pemohon akan membacanya." };
  const note = cleanNote(input.note, 1000);
  const tc = createTenantDb(access.tenant.slug);
  const T = tc.schema.producerApplications;
  try {
    const [cur] = await tc.db.select({ memberId: T.memberId, brandName: T.brandName }).from(T).where(eq(T.id, id)).limit(1);
    const self = !!cur && !!access.tenantUser.memberId && access.tenantUser.memberId === cur.memberId;
    const now = new Date();
    const upd = await tc.db.update(T).set({
      status: "rejected", rejectionReason: reason, reviewNote: withSelfMark(note, self), reviewedAt: now, reviewedBy: access.tenantUser.id, updatedAt: now,
    }).where(and(eq(T.id, id), eq(T.status, "pending"))).returning({ id: T.id });                  // compare-and-set
    if (!upd.length) return { ok: false, error: "Pengajuan sudah diproses atau dibatalkan pemohon." };
    if (cur) void notifyApplicationDecision({ slug: access.tenant.slug, tenantClient: tc, memberId: cur.memberId, brand: cur.brandName ?? "", kind: "rejected", reason });
    return { ok: true, data: undefined };
  } catch (e) {
    console.error("[rejectApplication]", pgErrorCode(e) ?? "unknown");
    return { ok: false, error: "Gagal menolak pengajuan." };
  }
}
