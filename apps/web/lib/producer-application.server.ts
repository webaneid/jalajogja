// Logika server Pengajuan Produsen — docs/arsitektur-pengajuan-produsen.md (§ 5 alur, § 6 syarat, § 13 berkas, § 14 keamanan).
//
// Aturan inti (semua dijaga DI SINI, bukan di UI):
//  - memberId SELALU dari sesi (members.better_auth_user_id), tidak pernah dari input.
//  - Pemohon WAJIB anggota sah tenant itu (isTenantMember); slug divalidasi isActiveTenant SEBELUM createTenantDb.
//  - Satu pengajuan terbuka (draft|pending) per anggota: unique index parsial + kunci advisory per anggota.
//  - Sumber (usaha/pesantren/profesional) dibaca ulang dari `public.*` dan harus milik pemohon; id mentah klien tidak dipercaya.
//  - Berkas hanya dirujuk lewat id yang tercatat di JSON pengajuan itu; `key` MinIO tidak pernah ke klien.
import "server-only";
import { randomUUID } from "crypto";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import {
  db as publicDb, createTenantDb, members, tenants, memberBusinesses, memberOwnedPesantren, memberProfessionals, refRegencies,
  type ProducerApplication, type ProducerApplicationDocument, type ProducerApplicationFile, type ProducerApplicationSample,
} from "@jalajogja/db";
import { getCurrentSession } from "@/lib/tenant";
import { isActiveTenant } from "@/lib/tenant-active";
import { isTenantMember } from "@/lib/tenant-membership.server";
import { getTokoSettings } from "@/lib/toko-settings";
import { deletePrivate } from "@/lib/minio";
import { pgErrorCode } from "@/lib/pg-error";
import {
  APP_MAX_DOCUMENTS, APP_MAX_FILES, APP_MAX_PROCESS, APP_MAX_SAMPLES, APP_DOC_KINDS, APP_FIELD_LIMITS,
  toDraftView, validateForSubmit, type DraftView, type ParsedDraft,
} from "@/lib/producer-application";

type TenantDb = ReturnType<typeof createTenantDb>;

export type Applicant = {
  member:       { id: string; name: string };
  tenant:       { id: string; slug: string; name: string; tenantType: string | null };
  userId:       string;
  email:        string;
  tenantClient: TenantDb;
  enabled:      boolean;   // saklar Pengaturan Toko
  hasProducer:  boolean;   // sudah ada baris produsen untuk anggota ini di tenant ini (aktif atau nonaktif)
};
export type ApplicantResult = { ok: true; a: Applicant } | { ok: false; error: string; status: 401 | 403 | 404 };

export async function resolveApplicant(slug: string): Promise<ApplicantResult> {
  if (!/^[a-z0-9-]{3,30}$/.test(slug) || !(await isActiveTenant(slug))) return { ok: false, error: "Tenant tidak ditemukan.", status: 404 };

  const session = await getCurrentSession();
  const userId  = session?.user?.id ?? null;
  if (!userId) return { ok: false, error: "Login diperlukan.", status: 401 };

  const [member] = await publicDb.select({ id: members.id, name: members.name }).from(members)
    .where(eq(members.betterAuthUserId, userId)).limit(1);
  if (!member) return { ok: false, error: "Hanya anggota yang dapat mengajukan.", status: 403 };

  const [tenant] = await publicDb.select({ id: tenants.id, slug: tenants.slug, name: tenants.name, tenantType: tenants.tenantType })
    .from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenant) return { ok: false, error: "Tenant tidak ditemukan.", status: 404 };

  // Pemohon HARUS anggota sah tenant yang dituju (K4) — anggota tenant lain ditolak.
  if (!(await isTenantMember(member.id, { id: tenant.id, tenantType: tenant.tenantType }))) {
    return { ok: false, error: "Pengajuan hanya untuk anggota tenant ini.", status: 403 };
  }

  const tenantClient = createTenantDb(tenant.slug);
  const [settings, existing] = await Promise.all([
    getTokoSettings(tenant.slug),
    tenantClient.db.select({ id: tenantClient.schema.producers.id }).from(tenantClient.schema.producers)
      .where(eq(tenantClient.schema.producers.memberId, member.id)).limit(1),
  ]);
  return { ok: true, a: {
    member, tenant, userId, email: session!.user.email, tenantClient,
    enabled: settings.producerApplicationsEnabled, hasProducer: existing.length > 0,
  } };
}

// ── Pembacaan ───────────────────────────────────────────────────────────────────────────────────────────
async function getOpen(tc: TenantDb, memberId: string): Promise<ProducerApplication | null> {
  const t = tc.schema.producerApplications;
  const [row] = await tc.db.select().from(t).where(and(eq(t.memberId, memberId), inArray(t.status, ["draft", "pending"]))).limit(1);
  return row ?? null;
}

export type SourceOption = { type: "usaha" | "pesantren" | "profesional"; id: string; label: string; taken: boolean };

export async function listSourceOptions(a: Applicant): Promise<SourceOption[]> {
  const [biz, pes, pro, used] = await Promise.all([
    publicDb.select({ id: memberBusinesses.id, name: memberBusinesses.name, brand: memberBusinesses.brand }).from(memberBusinesses)
      .where(and(eq(memberBusinesses.memberId, a.member.id), eq(memberBusinesses.isActive, true))),
    publicDb.select({ id: memberOwnedPesantren.id, name: memberOwnedPesantren.name }).from(memberOwnedPesantren)
      .where(eq(memberOwnedPesantren.memberId, a.member.id)),
    publicDb.select({ id: memberProfessionals.id, title: memberProfessionals.title }).from(memberProfessionals)
      .where(and(eq(memberProfessionals.memberId, a.member.id), eq(memberProfessionals.isActive, true))),
    a.tenantClient.db.select({ t: a.tenantClient.schema.producers.sourceType, i: a.tenantClient.schema.producers.sourceId })
      .from(a.tenantClient.schema.producers).where(isNotNull(a.tenantClient.schema.producers.sourceId)),
  ]);
  const taken = new Set(used.map((u) => `${u.t}:${u.i}`));
  return [
    ...biz.map((b): SourceOption => ({ type: "usaha", id: b.id, label: b.brand?.trim() || b.name, taken: taken.has(`usaha:${b.id}`) })),
    ...pes.map((p): SourceOption => ({ type: "pesantren", id: p.id, label: p.name, taken: taken.has(`pesantren:${p.id}`) })),
    ...pro.map((p): SourceOption => ({ type: "profesional", id: p.id, label: p.title ?? "Profesional", taken: taken.has(`profesional:${p.id}`) })),
  ];
}

export type PageData = {
  enabled: boolean; hasProducer: boolean;
  open: DraftView | null;         // draft atau pending
  originRegencyName: string | null; // nama kota asal pada pengajuan terbuka (untuk combobox)
  last: DraftView | null;         // pengajuan final terbaru (rejected/approved/cancelled) — untuk menampilkan alasan
  sources: SourceOption[];
};

export async function loadPageData(a: Applicant): Promise<PageData> {
  const t = a.tenantClient.schema.producerApplications;
  const [open, [last], sources] = await Promise.all([
    getOpen(a.tenantClient, a.member.id),
    a.tenantClient.db.select().from(t)
      .where(and(eq(t.memberId, a.member.id), inArray(t.status, ["approved", "rejected", "cancelled"])))
      .orderBy(desc(t.createdAt)).limit(1),
    listSourceOptions(a),
  ]);
  let originRegencyName: string | null = null;
  if (open?.originRegencyId) {
    const [rg] = await publicDb.select({ name: refRegencies.name }).from(refRegencies).where(eq(refRegencies.id, open.originRegencyId)).limit(1);
    originRegencyName = rg?.name ?? null;
  }
  return {
    enabled: a.enabled, hasProducer: a.hasProducer, sources, originRegencyName,
    open: open ? toDraftView(open, a.tenant.slug) : null,
    last: last ? toDraftView(last, a.tenant.slug) : null,
  };
}

// ── Verifikasi data rujukan (selalu dari DB) ───────────────────────────────────────────────────────────
async function verifySource(a: Applicant, type: "usaha" | "pesantren" | "profesional", id: string): Promise<string | null> {
  let owned = false;
  if (type === "usaha") {
    const [r] = await publicDb.select({ id: memberBusinesses.id }).from(memberBusinesses)
      .where(and(eq(memberBusinesses.id, id), eq(memberBusinesses.memberId, a.member.id), eq(memberBusinesses.isActive, true))).limit(1);
    owned = !!r;
  } else if (type === "pesantren") {
    const [r] = await publicDb.select({ id: memberOwnedPesantren.id }).from(memberOwnedPesantren)
      .where(and(eq(memberOwnedPesantren.id, id), eq(memberOwnedPesantren.memberId, a.member.id))).limit(1);
    owned = !!r;
  } else {
    const [r] = await publicDb.select({ id: memberProfessionals.id }).from(memberProfessionals)
      .where(and(eq(memberProfessionals.id, id), eq(memberProfessionals.memberId, a.member.id), eq(memberProfessionals.isActive, true))).limit(1);
    owned = !!r;
  }
  if (!owned) return "Data usaha tidak valid atau bukan milik Anda.";
  const P = a.tenantClient.schema.producers;
  const [dup] = await a.tenantClient.db.select({ id: P.id }).from(P).where(and(eq(P.sourceType, type), eq(P.sourceId, id))).limit(1);
  return dup ? "Sumber ini sudah terdaftar sebagai produsen." : null;
}

async function verifyRegency(id: number): Promise<string | null> {
  const [r] = await publicDb.select({ id: refRegencies.id }).from(refRegencies).where(eq(refRegencies.id, id)).limit(1);
  return r ? null : "Kota/kabupaten asal tidak ditemukan.";
}

/** Hapus objek privat; kegagalan hanya dicatat (cron pembersihan menjadi jaring pengaman). */
export async function deleteKeys(slug: string, keys: string[]): Promise<void> {
  for (const k of keys) await deletePrivate(slug, k).catch((e) => console.error("[producer-application] hapus berkas gagal:", k, e));
}

const lockApp = (memberId: string) => sql`SELECT pg_advisory_xact_lock(hashtext(${"prodapp:" + memberId}))`;

function allFiles(app: Pick<ProducerApplication, "sampleProducts" | "processMedia" | "documentMedia">): ProducerApplicationFile[] {
  return [
    ...(app.sampleProducts ?? []).flatMap((s) => (s.file ? [s.file] : [])),
    ...(app.processMedia ?? []),
    ...(app.documentMedia ?? []).map((d) => d.file),
  ];
}

type R = { ok: true; view: DraftView } | { ok: false; error: string };

const closedGuard = (a: Applicant): string | null =>
  !a.enabled ? "Pengajuan produsen sedang ditutup."
  : a.hasProducer ? "Anda sudah terdaftar sebagai produsen di tenant ini. Hubungi pengurus bila ada kendala."
  : null;

// ── Draf: ambil/buat ───────────────────────────────────────────────────────────────────────────────────
export async function getOrCreateDraft(a: Applicant): Promise<{ ok: true; app: ProducerApplication } | { ok: false; error: string }> {
  const g = closedGuard(a);
  if (g) return { ok: false, error: g };
  const t = a.tenantClient.schema.producerApplications;
  const open = await getOpen(a.tenantClient, a.member.id);
  if (open) return open.status === "draft" ? { ok: true, app: open } : { ok: false, error: "Pengajuan Anda sedang ditinjau pengurus." };
  try {
    const [row] = await a.tenantClient.db.insert(t).values({ memberId: a.member.id, status: "draft" }).returning();
    return { ok: true, app: row };
  } catch (e) {
    if (pgErrorCode(e) !== "23505") throw e;                      // dua permintaan bersamaan → pakai yang sudah ada
    const again = await getOpen(a.tenantClient, a.member.id);
    return again?.status === "draft" ? { ok: true, app: again } : { ok: false, error: "Pengajuan Anda sedang ditinjau pengurus." };
  }
}

// ── Draf: simpan isian (BUKAN berkas) ───────────────────────────────────────────────────────────────────
export async function saveDraftFields(a: Applicant, v: ParsedDraft): Promise<R> {
  const g = closedGuard(a);
  if (g) return { ok: false, error: g };
  if (v.sourceType && v.sourceId) { const e = await verifySource(a, v.sourceType, v.sourceId); if (e) return { ok: false, error: e }; }
  if (v.originRegencyId) { const e = await verifyRegency(v.originRegencyId); if (e) return { ok: false, error: e }; }

  const created = await getOrCreateDraft(a);
  if (!created.ok) return created;
  const t = a.tenantClient.schema.producerApplications;
  const orphanKeys: string[] = [];

  const row = await a.tenantClient.db.transaction(async (tx) => {
    await tx.execute(lockApp(a.member.id));
    const [cur] = await tx.select().from(t).where(and(eq(t.id, created.app.id), eq(t.memberId, a.member.id), eq(t.status, "draft"))).limit(1);
    if (!cur) return null;
    // Contoh produk: gabung per ID yang dikenal server (BUKAN posisi). Berkas selalu milik server — klien tidak bisa menyuntik
    // rujukan berkas. Contoh yang ada di DB tetapi tidak ada di kiriman klien (klien basi/dua tab) DIPERTAHANKAN: penghapusan hanya
    // lewat removeDraftItem, jadi autosave basi tidak bisa menghapus foto yang baru diunggah.
    const existing = cur.sampleProducts ?? [];
    const byId = new Map(existing.map((e) => [e.id, e]));
    const seen = new Set<string>();
    const samples: ProducerApplicationSample[] = [];
    for (const s of v.samples) {
      const hit = s.id && !seen.has(s.id) ? byId.get(s.id) : undefined;
      if (hit) seen.add(hit.id);
      samples.push({ id: hit?.id ?? randomUUID(), name: s.name, estPriceUmum: s.estPriceUmum, estPriceAnggota: s.estPriceAnggota, file: hit?.file ?? null });
    }
    for (const e of existing) if (!seen.has(e.id)) samples.push(e);
    if (samples.length > APP_MAX_SAMPLES) samples.length = APP_MAX_SAMPLES;
    for (const e of existing) if (!samples.some((x) => x.id === e.id) && e.file) orphanKeys.push(e.file.key);   // hanya bila batas 4 terlampaui
    const [upd] = await tx.update(t).set({
      sourceType: v.sourceType, sourceId: v.sourceId, brandName: v.brandName, productCategories: v.productCategories,
      description: v.description, ownProductDeclared: v.ownProductDeclared, offeredSharePercent: v.offeredSharePercent,
      opsName: v.opsName, opsWhatsapp: v.opsWhatsapp, teamSize: v.teamSize, processDays: v.processDays,
      originRegencyId: v.originRegencyId, links: v.links, sampleProducts: samples, updatedAt: new Date(),
    }).where(eq(t.id, cur.id)).returning();
    return upd;
  });
  if (!row) return { ok: false, error: "Draf tidak ditemukan atau sudah dikirim." };
  await deleteKeys(a.tenant.slug, orphanKeys);
  return { ok: true, view: toDraftView(row, a.tenant.slug) };
}

// ── Berkas: lampirkan hasil unggah (objek sudah ada di bucket privat; dipanggil route unggah) ─────────────
export type AttachSpec =
  | { slot: "sample"; sampleId: string; file: ProducerApplicationFile }
  | { slot: "process"; file: ProducerApplicationFile }
  | { slot: "document"; kind: string; note: string | null; file: ProducerApplicationFile };

export async function attachFile(a: Applicant, appId: string, spec: AttachSpec): Promise<R & { replacedKey?: string }> {
  const t = a.tenantClient.schema.producerApplications;
  let replacedKey: string | undefined;
  const row = await a.tenantClient.db.transaction(async (tx) => {
    await tx.execute(lockApp(a.member.id));
    const [cur] = await tx.select().from(t).where(and(eq(t.id, appId), eq(t.memberId, a.member.id), eq(t.status, "draft"))).limit(1);
    if (!cur) return { error: "Draf tidak ditemukan atau sudah dikirim." as const };
    const targetSample = spec.slot === "sample" ? (cur.sampleProducts ?? []).find((x) => x.id === spec.sampleId) : undefined;
    if (allFiles(cur).length >= APP_MAX_FILES && !targetSample?.file) {
      return { error: `Maksimal ${APP_MAX_FILES} berkas per pengajuan.` as const };
    }
    const set: Partial<typeof t.$inferInsert> = { updatedAt: new Date() };
    if (spec.slot === "sample") {
      if (!targetSample) return { error: "Contoh produk tidak ditemukan. Simpan draf lalu coba lagi." as const };
      replacedKey = targetSample.file?.key;
      set.sampleProducts = (cur.sampleProducts ?? []).map((x) => (x.id === targetSample.id ? { ...x, file: spec.file } : x));
    } else if (spec.slot === "process") {
      if ((cur.processMedia ?? []).length >= APP_MAX_PROCESS) return { error: `Maksimal ${APP_MAX_PROCESS} foto proses produksi.` as const };
      set.processMedia = [...(cur.processMedia ?? []), spec.file];
    } else {
      if ((cur.documentMedia ?? []).length >= APP_MAX_DOCUMENTS) return { error: `Maksimal ${APP_MAX_DOCUMENTS} dokumen.` as const };
      if (!(APP_DOC_KINDS as readonly string[]).includes(spec.kind)) return { error: "Jenis dokumen tidak valid." as const };
      const doc: ProducerApplicationDocument = { id: randomUUID(), kind: spec.kind, note: spec.note, file: spec.file };
      set.documentMedia = [...(cur.documentMedia ?? []), doc];
    }
    const [upd] = await tx.update(t).set(set).where(eq(t.id, cur.id)).returning();
    return { row: upd };
  });
  if ("error" in row) return { ok: false, error: row.error ?? "Gagal menyimpan berkas." };
  return { ok: true, view: toDraftView(row.row, a.tenant.slug), replacedKey };
}

export const docNoteLimit = APP_FIELD_LIMITS.docNote;

// ── Berkas/entri: hapus satu item dari draf ──────────────────────────────────────────────────────────────
export async function removeDraftItem(a: Applicant, item: { type: "sample" | "process" | "document"; id: string }): Promise<R> {
  const t = a.tenantClient.schema.producerApplications;
  const dead: string[] = [];
  const row = await a.tenantClient.db.transaction(async (tx) => {
    await tx.execute(lockApp(a.member.id));
    const [cur] = await tx.select().from(t).where(and(eq(t.memberId, a.member.id), eq(t.status, "draft"))).limit(1);
    if (!cur) return null;
    const set: Partial<typeof t.$inferInsert> = { updatedAt: new Date() };
    if (item.type === "sample") {
      const hit = (cur.sampleProducts ?? []).find((s) => s.id === item.id);
      if (hit?.file) dead.push(hit.file.key);
      set.sampleProducts = (cur.sampleProducts ?? []).filter((s) => s.id !== item.id);
    } else if (item.type === "process") {
      const hit = (cur.processMedia ?? []).find((f) => f.id === item.id);
      if (hit) dead.push(hit.key);
      set.processMedia = (cur.processMedia ?? []).filter((f) => f.id !== item.id);
    } else {
      const hit = (cur.documentMedia ?? []).find((d) => d.id === item.id);
      if (hit) dead.push(hit.file.key);
      set.documentMedia = (cur.documentMedia ?? []).filter((d) => d.id !== item.id);
    }
    const [upd] = await tx.update(t).set(set).where(eq(t.id, cur.id)).returning();
    return upd;
  });
  if (!row) return { ok: false, error: "Draf tidak ditemukan atau sudah dikirim." };
  await deleteKeys(a.tenant.slug, dead);
  return { ok: true, view: toDraftView(row, a.tenant.slug) };
}

// ── Kirim ──────────────────────────────────────────────────────────────────────────────────────────────
export async function submitApplication(a: Applicant): Promise<R> {
  const g = closedGuard(a);
  if (g) return { ok: false, error: g };
  const t = a.tenantClient.schema.producerApplications;

  const out = await a.tenantClient.db.transaction(async (tx) => {
    await tx.execute(lockApp(a.member.id));
    const [cur] = await tx.select().from(t).where(and(eq(t.memberId, a.member.id), eq(t.status, "draft"))).limit(1);
    if (!cur) return { error: "Draf tidak ditemukan atau sudah dikirim." };
    const invalid = validateForSubmit(cur);                       // atas data TERSIMPAN di DB, bukan kiriman klien
    if (invalid) return { error: invalid };
    const srcErr = await verifySource(a, cur.sourceType!, cur.sourceId!);
    if (srcErr) return { error: srcErr };
    const regErr = await verifyRegency(cur.originRegencyId!);
    if (regErr) return { error: regErr };
    const now = new Date();
    const [upd] = await tx.update(t).set({ status: "pending", submittedAt: now, updatedAt: now })
      .where(and(eq(t.id, cur.id), eq(t.status, "draft"))).returning();    // compare-and-set
    return upd ? { row: upd } : { error: "Draf tidak ditemukan atau sudah dikirim." };
  });
  if ("error" in out) return { ok: false, error: out.error ?? "Gagal mengirim." };
  return { ok: true, view: toDraftView(out.row, a.tenant.slug) };
}

// ── Batalkan (pending) / buang (draft) ─────────────────────────────────────────────────────────────────────
export async function cancelPending(a: Applicant): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = a.tenantClient.schema.producerApplications;
  const upd = await a.tenantClient.db.update(t).set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(t.memberId, a.member.id), eq(t.status, "pending"))).returning({ id: t.id });
  return upd.length ? { ok: true } : { ok: false, error: "Tidak ada pengajuan yang bisa dibatalkan." };
}

export async function discardDraft(a: Applicant): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = a.tenantClient.schema.producerApplications;
  const keys: string[] = [];
  const done = await a.tenantClient.db.transaction(async (tx) => {
    await tx.execute(lockApp(a.member.id));
    const [cur] = await tx.select().from(t).where(and(eq(t.memberId, a.member.id), eq(t.status, "draft"))).limit(1);
    if (!cur) return false;
    keys.push(...allFiles(cur).map((f) => f.key));
    await tx.delete(t).where(eq(t.id, cur.id));
    return true;
  });
  if (!done) return { ok: false, error: "Tidak ada draf untuk dibuang." };
  await deleteKeys(a.tenant.slug, keys);
  return { ok: true };
}
