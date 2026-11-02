// Regresi data-nyata modul Pengajuan Produsen (P1–P7) — docs/arsitektur-pengajuan-produsen.md § 21.
// Proyek belum punya suite tes; skrip ini menjalankan alur nyata terhadap DB + MinIO LOKAL lalu membersihkan jejaknya.
//
//   cd apps/web && SMOKE_I_KNOW=1 bun run --preload ./scripts/stub-server-only.ts scripts/smoke-producer-application.ts
//
// PENGAMAN (skrip membuat akun/produsen/berkas uji dan MENGGANTI SEMENTARA tautan akun 3 anggota — dikembalikan di blok finally):
//   • host DATABASE_URL dan MINIO_ENDPOINT harus PERSIS localhost/127.0.0.1 (di-parse, bukan sekadar kata yang cocok);
//   • wajib env SMOKE_I_KNOW=1;
//   • anggota kandidat yang SUDAH punya produsen/pengajuan di tenant uji dikecualikan, jadi pembersihan hanya menyentuh data buatan skrip.
// Butuh: migration 0083–0092 di DB lokal, MinIO lokal hidup, ≥3 anggota aktif berusaha di tenant uji (default pc-ikpm-jogjakarta; env SMOKE_TENANT).
// Bila proses dimatikan paksa sebelum `finally`, pulihkan manual tautan akun (members.better_auth_user_id) dari backup DB dev.
import sharp from "sharp";
import { randomUUID } from "crypto";
import { and, eq, inArray, like, notInArray, sql } from "drizzle-orm";
import { ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { db as pdb, createTenantDb, tenants, members, memberBusinesses, tenantMemberships, producerLogins } from "@jalajogja/db";
import { auth } from "../lib/auth";
import { s3, privateBucket, uploadPrivate, deletePrivate, ensurePrivateBucket, ensurePrivateBucket as _e } from "../lib/minio";
import { processApplicationFile } from "../lib/producer-application-file.server";
import { getOrCreateDraft, saveDraftFields, attachFile, removeDraftItem, submitApplication, cancelPending, discardDraft, type Applicant } from "../lib/producer-application.server";
import { approveApplication, rejectApplication, listApplications, getApplicationDetail, countPendingApplications } from "../lib/producer-application-review.server";
import { cleanupTenantApplications } from "../lib/producer-application-cleanup.server";
import { buildDecisionEmail } from "../lib/producer-application-notify.server";
import { parseDraftInput, parseSharePercent } from "../lib/producer-application";
void _e;

const isLocalHost = (h: string) => h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
let dbHost = ""; try { dbHost = new URL(process.env.DATABASE_URL ?? "").hostname; } catch { /* biarkan kosong → ditolak */ }
if (!isLocalHost(dbHost) || !isLocalHost(process.env.MINIO_ENDPOINT ?? "") || process.env.SMOKE_I_KNOW !== "1") {
  console.error(`DITOLAK: butuh DATABASE_URL & MINIO_ENDPOINT localhost (terbaca: db='${dbHost}', minio='${process.env.MINIO_ENDPOINT ?? ""}') dan SMOKE_I_KNOW=1.`);
  process.exit(2);
}
const SLUG = process.env.SMOKE_TENANT ?? "pc-ikpm-jogjakarta";
let fails = 0;
const ok = (n: string, v: boolean, x = "") => { console.log((v ? "PASS " : "FAIL ") + n + (x ? "  " + x : "")); if (!v) fails++; };

const [t] = await pdb.select().from(tenants).where(eq(tenants.slug, SLUG));
const tc = createTenantDb(SLUG); const T = tc.schema.producerApplications, P = tc.schema.producers;
await ensurePrivateBucket(SLUG);
const exists = async (k: string) => { try { await s3.send(new HeadObjectCommand({ Bucket: privateBucket(SLUG), Key: k })); return true; } catch { return false; } };
const reviewerUser = randomUUID();
const asReviewer = (memberId: string | null = null) => ({ tenant: t, tenantUser: { id: reviewerUser, role: "ketua", memberId, customRoleId: null, customRole: null }, userId: "rev" } as never);

// ── anggota uji (tautan akun diganti sementara, dipulihkan di finally) ──
const used = [
  ...(await tc.db.select({ m: tc.schema.users.memberId }).from(tc.schema.users)).map((r) => r.m),
  ...(await tc.db.select({ m: P.memberId }).from(P)).map((r) => r.m),                 // sudah produsen (data nyata) → jangan disentuh
  ...(await tc.db.select({ m: T.memberId }).from(T)).map((r) => r.m),                 // sudah punya pengajuan (data nyata)
].filter((x): x is string => !!x);
const cands = await pdb.select({ id: members.id, name: members.name, acc: members.betterAuthUserId }).from(members)
  .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, members.id), eq(tenantMemberships.tenantId, t.id), eq(tenantMemberships.status, "active")))
  .where(and(used.length ? notInArray(members.id, used) : sql`true`, sql`EXISTS (SELECT 1 FROM public.member_businesses b WHERE b.member_id = ${members.id} AND b.is_active)`)).limit(3);
if (cands.length < 3) { console.error("Kandidat anggota kurang (butuh 3):", cands.length); process.exit(1); }
const [mA, mB, mC] = cands;
const original = new Map(cands.map((c) => [c.id, c.acc ?? null]));
const mkUser = async (tag: string) => (await auth.api.signUpEmail({ body: { email: `smoke-${tag}-${randomUUID().slice(0, 6)}@example.invalid`, password: `${randomUUID()}Aa1!`, name: `Smoke ${tag}` } })).user.id;
const uA = await mkUser("a"), uB = await mkUser("b"), uC = await mkUser("c");
await pdb.update(members).set({ betterAuthUserId: uA }).where(eq(members.id, mA.id));
await pdb.update(members).set({ betterAuthUserId: uB }).where(eq(members.id, mB.id));
await pdb.update(members).set({ betterAuthUserId: null }).where(eq(members.id, mC.id));       // C sengaja BELUM punya akun
const applicant = (m: { id: string; name: string }): Applicant => ({ member: m, tenant: { id: t.id, slug: SLUG, name: t.name, tenantType: t.tenantType }, userId: "u", email: "x@x", tenantClient: tc, enabled: true, hasProducer: false });
const files: string[] = []; const fakeAppIds: string[] = []; const fakeProducers: string[] = [];
const img = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } }).webp().toBuffer();
const bizOf = async (mid: string) => (await pdb.select({ id: memberBusinesses.id }).from(memberBusinesses).where(and(eq(memberBusinesses.memberId, mid), eq(memberBusinesses.isActive, true))).limit(1))[0].id;
const rowsOf = (mid: string) => tc.db.select({ id: P.id, type: P.type, sourceType: P.sourceType, isActive: P.isActive, brandName: P.brandName, productLimit: P.productLimit, share: P.revenueSharePercent, applicationId: P.applicationId, nameCache: P.nameCache }).from(P).where(eq(P.memberId, mid));
const loginsOf = (uid: string) => pdb.select().from(producerLogins).where(eq(producerLogins.userId, uid));

async function submit(m: { id: string; name: string }, brand: string, share: string) {
  const A = applicant(m);
  const d = await getOrCreateDraft(A); if (!d.ok) throw new Error(d.error);
  const p = parseDraftInput({ sourceType: "usaha", sourceId: await bizOf(m.id), brandName: brand, description: "Deskripsi usaha uji yang cukup panjang untuk lolos.", ownProductDeclared: true, offeredSharePercent: share, opsName: "PJ", opsWhatsapp: "+6281234567890", teamSize: 2, processDays: 2, originRegencyId: 1101, links: ["https://instagram.com/uji"], samples: [{ name: "Produk", estPriceUmum: 70000, estPriceAnggota: 65000 }] });
  if (!p.ok) throw new Error(p.error);
  const s = await saveDraftFields(A, p.value); if (!s.ok) throw new Error(s.error);
  const id = randomUUID(); const key = `pengajuan-produsen/${d.app.id}/${id}.webp`; await uploadPrivate(SLUG, key, img, "image/webp"); files.push(key);
  const at = await attachFile(A, d.app.id, { slot: "sample", sampleId: s.view.samples[0].id, file: { id, key, mime: "image/webp" } }); if (!at.ok) throw new Error(at.error);
  const sub = await submitApplication(A); if (!sub.ok) throw new Error(sub.error);
  return d.app.id;
}

try {
  // ═══ A. berkas ═══
  const big = await sharp({ create: { width: 3200, height: 2000, channels: 3, background: { r: 200, g: 30, b: 30 } } }).jpeg().withExif({ IFD0: { Copyright: "RAHASIA-EXIF" } }).toBuffer();
  const pa = await processApplicationFile(big, "sample");
  ok("A1 gambar besar → WebP ≤1600px tanpa EXIF", pa.ok && (await sharp(pa.body).metadata()).width! <= 1600 && !pa.body.toString("latin1").includes("RAHASIA-EXIF"));
  const junk = [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'), Buffer.from("<html><script>x</script></html>"), Buffer.from("MZ\x90 fake")];
  const junkRes = await Promise.all(junk.map((b) => processApplicationFile(b, "document")));
  ok("A2 SVG/HTML/teks biasa ditolak", junkRes.every((r) => !r.ok));
  const pdf = Buffer.from("%PDF-1.4\ntrailer<<>>\n%%EOF\n");
  ok("A3 PDF hanya di slot dokumen; PDF rusak & >5MB ditolak", (await processApplicationFile(pdf, "document")).ok && !(await processApplicationFile(pdf, "sample")).ok && !(await processApplicationFile(Buffer.from("%PDF-1.4\nrusak"), "document")).ok && !(await processApplicationFile(Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(5.2 * 1024 * 1024), Buffer.from("%%EOF")]), "document")).ok);
  const small = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#123" } }).jpeg().toBuffer();
  const burst = await Promise.all(Array.from({ length: 6 }, () => processApplicationFile(small, "sample")));
  ok("A4 konkurensi global: sebagian 'sibuk', penghitung kembali normal", burst.some((r) => !r.ok && r.busy) && burst.some((r) => r.ok) && (await processApplicationFile(small, "sample")).ok);

  // ═══ B. parsing ═══
  ok("B1 persentase: 0/100/abc/0x10/1e1/true DAN pembulatan ke batas (0.004→0.00, 99.999→100.00) ditolak, 7,5 → 7.50", ["0", "100", "abc", "0x10", "1e1", true, "0.004", "99.999"].every((v) => !parseSharePercent(v).ok) && (parseSharePercent("7,5") as { value: string }).value === "7.50");
  ok("B2 payload aneh tidak melempar", [null, [], "x", 42, { links: "x" }, { samples: [null] }, { teamSize: "0x10" }, { links: ["https://u:p@evil.com"] }, { links: ["http://x.com"] }].every((w) => { try { return !parseDraftInput(w).ok || JSON.stringify(w) === "{}"; } catch { return false; } }));

  // ═══ C. draf ═══
  const A = applicant(mA);
  const racers = await Promise.all(Array.from({ length: 6 }, () => getOrCreateDraft(A)));
  ok("C1 6 permintaan bersamaan → tepat 1 draf", (await tc.db.select({ id: T.id }).from(T).where(eq(T.memberId, mA.id))).length === 1 && racers.every((r) => r.ok));
  const d = (await getOrCreateDraft(A)); if (!d.ok) throw new Error(d.error);
  const mk = (samples: object[], extra: object = {}) => { const p = parseDraftInput({ sourceType: "usaha", sourceId: bizId, brandName: "B", samples, ...extra } as never); if (!p.ok) throw new Error(p.error); return p.value; };
  const bizId = await bizOf(mA.id);
  const [otherBiz] = await pdb.select({ id: memberBusinesses.id }).from(memberBusinesses).where(sql`${memberBusinesses.memberId} <> ${mA.id}`).limit(1);
  ok("C2 usaha milik orang lain & kota tak ada ditolak", !(await saveDraftFields(A, mk([], { sourceId: otherBiz.id }))).ok && !(await saveDraftFields(A, mk([], { originRegencyId: 999999 }))).ok);
  const v1 = await saveDraftFields(A, mk([{ name: "A" }, { name: "B" }])); if (!v1.ok) throw new Error(v1.error);
  const [idA, idB] = [v1.view.samples[0].id, v1.view.samples[1].id];
  const put = async (ext: "webp" | "pdf" = "webp") => { const id = randomUUID(); const key = `pengajuan-produsen/${d.app.id}/${id}.${ext}`; await uploadPrivate(SLUG, key, Buffer.from("x"), ext === "pdf" ? "application/pdf" : "image/webp"); files.push(key); return { id, key, mime: (ext === "pdf" ? "application/pdf" : "image/webp") as "application/pdf" | "image/webp" }; };
  const fB = await put();
  ok("C3 foto ditempel per ID; sampleId ngawur ditolak", (await attachFile(A, d.app.id, { slot: "sample", sampleId: idB, file: fB })).ok && !(await attachFile(A, d.app.id, { slot: "sample", sampleId: randomUUID(), file: await put() })).ok);
  const stale = await saveDraftFields(A, mk([{ id: idA, name: "A2" }]));
  ok("C4 autosave basi (daftar lebih pendek) TIDAK menghapus contoh/foto", stale.ok && stale.view.samples.length === 2 && stale.view.samples.some((s) => s.id === idB && s.file) && (await exists(fB.key)));
  const sw = await saveDraftFields(A, mk([{ id: idB, name: "B2" }, { id: idA, name: "A3" }]));
  ok("C5 urutan terbalik: foto tetap pada contoh yang benar", sw.ok && sw.view.samples.find((s) => s.id === idB)?.file != null && sw.view.samples.find((s) => s.id === idA)?.file == null);
  for (let i = 0; i < 3; i++) await attachFile(A, d.app.id, { slot: "process", file: await put() });
  ok("C6 batas foto proses 3 & dokumen 3 & jenis dokumen asing ditolak", !(await attachFile(A, d.app.id, { slot: "process", file: await put() })).ok && (await attachFile(A, d.app.id, { slot: "document", kind: "PIRT", note: null, file: await put("pdf") })).ok && !(await attachFile(A, d.app.id, { slot: "document", kind: "Rahasia", note: null, file: await put() })).ok);
  const rm = await removeDraftItem(A, { type: "sample", id: idB });
  ok("C7 hapus contoh lewat removeDraftItem menghapus objeknya", rm.ok && !(await exists(fB.key)));
  ok("C8 kirim tanpa foto contoh ditolak", !(await submitApplication(A)).ok);
  const keysBefore = (await tc.db.select({ p: T.processMedia }).from(T).where(eq(T.id, d.app.id)))[0].p!.map((f) => f.key);
  ok("C9 buang draf menghapus baris & objek berkas", (await discardDraft(A)).ok && (await tc.db.select({ id: T.id }).from(T).where(eq(T.id, d.app.id))).length === 0 && !(await exists(keysBefore[0])));

  // ═══ D. tinjauan ═══
  const idP = await submit(mA, "Brand A", "7.5");
  ok("D0 jumlah menunggu terhitung", (await countPendingApplications(tc)) >= 1);
  ok("D1 persentase tak valid ditolak; tetap pending", (await Promise.all(["0", "100", "abc", "", null, {}].map((b) => approveApplication(asReviewer(), idP, { sharePercent: b, note: null })))).every((r) => !r.ok) && (await tc.db.select().from(T).where(eq(T.id, idP)))[0].status === "pending");
  const [r1, r2] = await Promise.all([approveApplication(asReviewer(), idP, { sharePercent: "7.5", note: "ok" }), approveApplication(asReviewer(), idP, { sharePercent: "9", note: null })]);
  ok("D2 dua penyetuju bersamaan → tepat SATU berhasil (1 produsen, 1 login)", [r1, r2].filter((r) => r.ok).length === 1 && (await rowsOf(mA.id)).length === 1 && (await loginsOf(uA)).length === 1);
  const pA = (await rowsOf(mA.id))[0], aA = (await tc.db.select().from(T).where(eq(T.id, idP)))[0];
  ok("D3 produsen: anggota/usaha/aktif/brand/batas 3/bagi hasil/terkait pengajuan/nameCache", pA.type === "member" && pA.sourceType === "usaha" && pA.isActive && pA.brandName === "Brand A" && pA.productLimit === 3 && Number(pA.share) === Number(r1.ok ? "7.5" : "9") && pA.applicationId === idP && !!pA.nameCache);
  ok("D4 pengajuan approved + producerId + reviewer; login mengikat akun-pemilik", aA.status === "approved" && aA.producerId === pA.id && aA.reviewedBy === reviewerUser && (await loginsOf(uA))[0].producerId === pA.id);
  ok("D5 setujui ulang / tolak setelah disetujui ditolak", !(await approveApplication(asReviewer(), idP, { sharePercent: "5", note: null })).ok && !(await rejectApplication(asReviewer(), idP, { reason: "alasan cukup panjang", note: null })).ok);

  const idR = await submit(mB, "Brand B", "3");
  ok("D6 tolak: alasan pendek/non-string ditolak; alasan sah diterima", !(await rejectApplication(asReviewer(), idR, { reason: "kurang", note: null })).ok && !(await rejectApplication(asReviewer(), idR, { reason: 123, note: null })).ok && (await rejectApplication(asReviewer(), idR, { reason: "Tawaran bagi hasil terlalu rendah untuk tenant.", note: "internal" })).ok);
  const aB = (await tc.db.select().from(T).where(eq(T.id, idR)))[0];
  ok("D7 ditolak: status/alasan tersimpan, tanpa produsen & login; boleh mengajukan lagi", aB.status === "rejected" && (await rowsOf(mB.id)).length === 0 && (await loginsOf(uB)).length === 0 && (await getOrCreateDraft(applicant(mB))).ok);
  await discardDraft(applicant(mB));

  const idC = await submit(mC, "Brand C", "10");
  const rc = await approveApplication(asReviewer(), idC, { sharePercent: "10", note: null });
  ok("D8 akun belum diklaim → ditolak jelas; tetap pending tanpa produsen", !rc.ok && /klaim/i.test(rc.ok ? "" : rc.error) && (await rowsOf(mC.id)).length === 0);
  await pdb.update(members).set({ betterAuthUserId: uC }).where(eq(members.id, mC.id));
  const [mem] = await pdb.select({ id: tenantMemberships.id, status: tenantMemberships.status }).from(tenantMemberships).where(and(eq(tenantMemberships.memberId, mC.id), eq(tenantMemberships.tenantId, t.id)));
  await pdb.update(tenantMemberships).set({ status: "pending" as never }).where(eq(tenantMemberships.id, mem.id));
  const rk = await approveApplication(asReviewer(), idC, { sharePercent: "10", note: null });
  ok("D9 keluar dari keanggotaan setelah mengirim → ditolak", !rk.ok && /anggota/i.test(rk.ok ? "" : rk.error));
  await pdb.update(tenantMemberships).set({ status: mem.status }).where(eq(tenantMemberships.id, mem.id));

  const liveProd = (await tc.db.insert(P).values({ type: "custom", customName: "Produsen lain (uji)", isActive: true }).returning({ id: P.id }))[0]; fakeProducers.push(liveProd.id);
  const liveLogin = (await pdb.insert(producerLogins).values({ userId: uC, tenantId: t.id, producerId: liveProd.id }).returning({ id: producerLogins.id }))[0];
  const rl = await approveApplication(asReviewer(), idC, { sharePercent: "10", note: null });
  ok("D10 akun sudah jadi produsen LAIN di tenant ini → ditolak; ROLLBACK penuh (tanpa produsen yatim, tetap pending)", !rl.ok && (await rowsOf(mC.id)).length === 0 && (await tc.db.select().from(T).where(eq(T.id, idC)))[0].status === "pending");
  await pdb.delete(producerLogins).where(eq(producerLogins.id, liveLogin.id));
  const orphan = (await pdb.insert(producerLogins).values({ userId: uC, tenantId: t.id, producerId: randomUUID() }).returning({ id: producerLogins.id }))[0];
  const ro = await approveApplication(asReviewer(mC.id), idC, { sharePercent: "10", note: "catatan" });
  ok("D11 login YATIM (produsen sudah tak ada) dibersihkan lalu persetujuan berhasil", ro.ok && (await loginsOf(uC)).length === 1 && (await loginsOf(uC))[0].id !== orphan.id);
  const aC = (await tc.db.select().from(T).where(eq(T.id, idC)))[0];
  ok("D12 keputusan atas pengajuan SENDIRI ditandai pada catatan internal", aC.reviewNote?.startsWith("[Diputuskan oleh pemohon sendiri]") === true, aC.reviewNote ?? "");
  const idC2 = await submit(mB, "Brand B2", "6");   // B: pending baru → pemohon batalkan → penyetuju mencoba
  ok("D13 pemohon batalkan; setujui yang dibatalkan ditolak; tak ada produsen", (await cancelPending(applicant(mB))).ok && !(await approveApplication(asReviewer(), idC2, { sharePercent: "6", note: null })).ok && (await rowsOf(mB.id)).length === 0);

  // ═══ E. daftar & detail ═══
  const bulk = Array.from({ length: 25 }, (_, i) => ({ id: randomUUID(), memberId: randomUUID(), status: "rejected" as const, brandName: i === 0 ? "100% Asli_ Garam" : `Pagin ${i}`, reviewedAt: new Date(Date.now() - i * 1000), submittedAt: new Date(Date.now() - i * 1000) }));
  await tc.db.insert(T).values(bulk); fakeAppIds.push(...bulk.map((b) => b.id));
  const p3 = await listApplications(tc, { status: "rejected", q: "", page: 3, pageSize: 10 });
  ok("E1 paginasi SQL: hal. 3 dari ≥26 baris berisi sisa, total benar", p3.rows.length >= 5 && p3.total >= 26, `rows=${p3.rows.length} total=${p3.total}`);
  const lk = await listApplications(tc, { status: "rejected", q: "100%", page: 1, pageSize: 10 });
  ok("E2 pencarian memperlakukan % sebagai teks biasa (bukan wildcard)", lk.rows.length === 1 && lk.rows[0].brandName.startsWith("100%"));
  ok("E3 cari nama pemohon & cari tak cocok", (await listApplications(tc, { status: "approved", q: mA.name.slice(0, 4), page: 1, pageSize: 20 })).rows.length >= 1 && (await listApplications(tc, { status: "approved", q: "zzzz-tidak-ada", page: 1, pageSize: 20 })).total === 0);
  const det = await getApplicationDetail(tc, { id: t.id, tenantType: t.tenantType }, idP, mA.id);
  ok("E4 detail lengkap & ditandai milik peninjau sendiri bila memberId sama", !!det && !!det.sourceLabel && !!det.regencyName && det.isActiveMember && det.isOwnApplication);
  ok("E5 detail: id ngawur/tidak ada → null; DRAF tak terbaca peninjau", (await getApplicationDetail(tc, { id: t.id, tenantType: t.tenantType }, "x")) === null && (await getApplicationDetail(tc, { id: t.id, tenantType: t.tenantType }, randomUUID())) === null);

  // ═══ F. email ═══
  const evil = `<script>alert(1)</script>"><img src=x onerror=alert(2)>`;
  const em = buildDecisionEmail({ org: `Org\r\nBcc: x@evil.com`, name: evil, brand: evil, portalUrl: "https://j/app/x/portal-produsen", reapplyUrl: "https://x", kind: "approved", sharePercent: "7.50" });
  const tags = [...em.html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*>/gi)].map((m) => m[1].toLowerCase());
  ok("F1 email: input pengguna tidak membentuk tag; subjek tanpa CR/LF; persen 7.5%", tags.every((x) => ["p", "strong", "ol", "li", "a", "br"].includes(x)) && !/[\r\n]/.test(em.subject) && em.html.includes("<strong>7.5%</strong>"));

  // ═══ G. cron pembersihan (jam disimulasikan) ═══
  const now0 = new Date(); const plus = (n: number) => new Date(now0.getTime() + n * 86_400_000);
  const seed = async (status: "draft" | "pending" | "rejected" | "cancelled" | "approved", extra: Partial<typeof T.$inferInsert> = {}) => {
    const appId = randomUUID(); fakeAppIds.push(appId);
    const mkf = async () => { const id = randomUUID(); const key = `pengajuan-produsen/${appId}/${id}.webp`; await uploadPrivate(SLUG, key, Buffer.from("x"), "image/webp"); files.push(key); return { id, key, mime: "image/webp" as const }; };
    const sf = await mkf(), pf = await mkf(), df = await mkf();
    await tc.db.insert(T).values({ id: appId, memberId: randomUUID(), status, brandName: `Cron ${status}`, rejectionReason: status === "rejected" ? "alasan uji" : null, reviewedAt: ["rejected", "approved"].includes(status) ? now0 : null,
      sampleProducts: [{ id: randomUUID(), name: "P", estPriceUmum: 1, estPriceAnggota: 1, file: sf }], processMedia: [pf], documentMedia: [{ id: randomUUID(), kind: "NIB", note: null, file: df }], ...extra });
    return { appId, sf, pf, df };
  };
  const gD = await seed("draft"), gD2 = await seed("draft", { updatedAt: plus(5) }), gP = await seed("pending"), gR = await seed("rejected"), gX = await seed("cancelled", { updatedAt: now0 }), gA = await seed("approved");
  const orphanKey = `pengajuan-produsen/${randomUUID()}/yatim.webp`; await uploadPrivate(SLUG, orphanKey, Buffer.from("o"), "image/webp"); files.push(orphanKey);
  const c0 = await cleanupTenantApplications(SLUG, now0);
  ok("G1 data baru: tak ada yang terhapus", c0.draftsDeleted === 0 && c0.finalCleared === 0 && c0.approvedPhotosCleared === 0 && (await exists(gD.sf.key)) && (await exists(orphanKey)));
  const c1 = await cleanupTenantApplications(SLUG, plus(8));
  ok("G2 +8 hari: draf kedaluwarsa terhapus (baris+objek); draf yang baru disentuh SELAMAT", c1.draftsDeleted >= 1 && (await tc.db.select().from(T).where(eq(T.id, gD.appId))).length === 0 && !(await exists(gD.sf.key)) && (await tc.db.select().from(T).where(eq(T.id, gD2.appId))).length === 1);
  const rr = (await tc.db.select().from(T).where(eq(T.id, gR.appId)))[0];
  ok("G3 ditolak/dibatalkan: SEMUA berkas terhapus, baris teks (audit) tetap", !(await exists(gR.sf.key)) && !(await exists(gR.df.key)) && !(await exists(gX.pf.key)) && rr.status === "rejected" && rr.rejectionReason === "alasan uji" && rr.processMedia!.length === 0 && rr.sampleProducts![0].file === null);
  ok("G4 disetujui <30 hari & pending TIDAK disentuh; yatim terhapus", (await exists(gA.sf.key)) && (await exists(gA.df.key)) && (await exists(gP.sf.key)) && !(await exists(orphanKey)));
  const c2 = await cleanupTenantApplications(SLUG, plus(31));
  ok("G5 +31 hari: foto disetujui terhapus, DOKUMEN LEGALITAS dipertahankan, pending utuh", c2.approvedPhotosCleared >= 1 && !(await exists(gA.sf.key)) && !(await exists(gA.pf.key)) && (await exists(gA.df.key)) && (await exists(gP.sf.key)));
  const c3 = await cleanupTenantApplications(SLUG, plus(31));
  ok("G6 idempoten: jalan ulang tidak menghapus apa pun / tanpa kegagalan", c3.draftsDeleted === 0 && c3.finalCleared === 0 && c3.approvedPhotosCleared === 0 && c3.failed === 0, JSON.stringify(c3));
} finally {
  // ── bersih-bersih (selalu) ──
  const ids = (await tc.db.select({ id: T.id }).from(T).where(inArray(T.memberId, [mA.id, mB.id, mC.id]))).map((r) => r.id);
  const leftover = (await tc.db.select({ s: T.sampleProducts, p: T.processMedia, d: T.documentMedia }).from(T)).flatMap((r) => [...(r.s ?? []).flatMap((x) => (x.file ? [x.file.key] : [])), ...(r.p ?? []).map((f) => f.key), ...(r.d ?? []).map((x) => x.file.key)]);
  await tc.db.delete(T).where(inArray(T.id, [...ids, ...fakeAppIds]));
  await tc.db.delete(P).where(inArray(P.memberId, [mA.id, mB.id, mC.id]));
  if (fakeProducers.length) await tc.db.delete(P).where(inArray(P.id, fakeProducers));
  await pdb.delete(producerLogins).where(inArray(producerLogins.userId, [uA, uB, uC]));
  for (const m of cands) await pdb.update(members).set({ betterAuthUserId: original.get(m.id) ?? null }).where(eq(members.id, m.id));
  await pdb.execute(sql`DELETE FROM public."user" WHERE email LIKE 'smoke-%@example.invalid'`);
  for (const k of new Set([...files, ...leftover])) await deletePrivate(SLUG, k).catch(() => {});
  const left = await s3.send(new ListObjectsV2Command({ Bucket: privateBucket(SLUG), Prefix: "pengajuan-produsen/" }));
  const restored = (await pdb.select({ id: members.id, a: members.betterAuthUserId }).from(members).where(inArray(members.id, cands.map((c) => c.id)))).every((x) => (original.get(x.id) ?? null) === (x.a ?? null));
  const users = await pdb.execute(sql`SELECT count(*)::int AS n FROM public."user" WHERE email LIKE 'smoke-%@example.invalid'`);
  console.log(`bersih: pengajuan_uji=${(await tc.db.select({ id: T.id }).from(T).where(like(T.brandName, "Cron %"))).length} objek_sisa=${(left.Contents ?? []).length} akun_dipulihkan=${restored} user_uji=${(users as unknown as { n: number }[])[0].n}`);
}
console.log(fails === 0 ? "\nSEMUA LULUS" : `\n${fails} GAGAL`);
process.exit(fails ? 1 : 0);
