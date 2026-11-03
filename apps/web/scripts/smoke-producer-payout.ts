// Regresi data-nyata "Pencairan produsen (C1b–C5)" — docs/arsitektur-pencairan-produsen.md § 13.
// Menjalankan fungsi NYATA terhadap DB LOKAL lalu membersihkan semua baris buatannya.
//   cd apps/web && SMOKE_I_KNOW=1 bun run --preload ./scripts/stub-server-only.ts scripts/smoke-producer-payout.ts
import { randomBytes, randomUUID } from "crypto";
import { and, eq, gte, inArray, like, or, sql } from "drizzle-orm";
import {
  createTenantDb, completeProducerShipment, computeEligible, requestPayout, cancelPayoutByProducer, approvePayout, rejectPayout, markPayoutPaid,
  getBankAccounts, setProducerBankAccount, validateBankInput, getPayoutSettings, savePayoutSettings, sanitizePayoutSettings, suggestTransferFee,
  recordProducerRefund, recordDebtRepayment, getProducerDebt, setShipmentHold, getPayoutWithLines, DEFAULT_PAYOUT_SETTINGS, guessBankCode, systemActorUserId,
} from "@jalajogja/db";

const isLocalHost = (h: string) => ["localhost", "127.0.0.1", "[::1]", "::1"].includes(h);
let dbHost = ""; try { dbHost = new URL(process.env.DATABASE_URL ?? "").hostname; } catch { /* ditolak */ }
if (!isLocalHost(dbHost) || process.env.SMOKE_I_KNOW !== "1") { console.error(`DITOLAK: butuh DATABASE_URL localhost (terbaca: '${dbHost}') dan SMOKE_I_KNOW=1.`); process.exit(2); }
if (!process.env.MEMBER_PII_ENCRYPTION_KEY) process.env.MEMBER_PII_ENCRYPTION_KEY = randomBytes(32).toString("base64");   // kunci uji acak, tidak disimpan
const SLUG = process.env.SMOKE_TENANT ?? "pc-ikpm-jogjakarta";
let fails = 0;
const ok = (n: string, v: boolean, x = "") => { console.log((v ? "PASS " : "FAIL ") + n + (x ? "  " + x : "")); if (!v) fails++; };

// ── Murni ──
ok("bank: kode tak dikenal ditolak", !validateBankInput({ bankCode: "xx", accountNumber: "1234567", holder: "Budi Santoso" }).ok);
ok("bank: nomor huruf / terlalu pendek ditolak", !validateBankInput({ bankCode: "bca", accountNumber: "12ab", holder: "Budi Santoso" }).ok && !validateBankInput({ bankCode: "bca", accountNumber: "123", holder: "Budi Santoso" }).ok);
ok("bank: nama pemilik kosong ditolak", !validateBankInput({ bankCode: "bca", accountNumber: "1234567", holder: " " }).ok);
ok("bank: nomor berspasi/tanda hubung dinormalkan", (() => { const r = validateBankInput({ bankCode: "bri", accountNumber: "1234-5678 90", holder: "Budi" + "\u0007" + " Santoso" }); return r.ok && r.number === "1234567890" && r.holder === "Budi Santoso"; })());
ok("pengaturan: bawaan Rp200.000 / sesama 0 / beda 7.500 / 3 hari", JSON.stringify(sanitizePayoutSettings(null)) === JSON.stringify(DEFAULT_PAYOUT_SETTINGS));
ok("pengaturan: nilai di luar batas kembali ke bawaan", sanitizePayoutSettings({ minAmount: 5, feeOtherBank: 999999, slaDays: 99 }).minAmount === 200000 && sanitizePayoutSettings({ feeOtherBank: 999999 }).feeOtherBank === 7500);
ok("biaya transfer: sesama bank 0, beda bank 7.500, tak dikenal = beda bank", suggestTransferFee(DEFAULT_PAYOUT_SETTINGS, "bri", "bri") === 0 && suggestTransferFee(DEFAULT_PAYOUT_SETTINGS, "bri", "bca") === 7500 && suggestTransferFee(DEFAULT_PAYOUT_SETTINGS, "bri", null) === 7500);
ok("tebak bank: 'Bank Rakyat Indonesia (BRI)' → bri, 'BSI' → bsi, ngawur → null", guessBankCode("Bank Rakyat Indonesia (BRI)") === "bri" && guessBankCode("BSI") === "bsi" && guessBankCode("xyz") === null);

// ── DB nyata ──
const tc = createTenantDb(SLUG); const { db, schema: s } = tc;
const startedAt = new Date(Date.now() - 2000);
const tag = `SMOKE-${randomUUID().slice(0, 6)}`;
const made = { producers: [] as string[], invoices: [] as string[] };
const [prevSettings] = await db.select().from(s.settings).where(and(eq(s.settings.key, "producer_payout"), eq(s.settings.group, "payment")));
const actorUser = await systemActorUserId(db, s);
if (!actorUser) { console.error("Tenant uji tak punya pengguna"); process.exit(2); }
const bendahara = { userId: actorUser, memberId: randomUUID() };

try {
  const mkProducer = async (name: string, memberId: string | null = null) => { const [r] = await db.insert(s.producers).values({ type: "custom", customName: `${tag} ${name}`, revenueSharePercent: "10", memberId }).returning({ id: s.producers.id }); made.producers.push(r.id); return r.id; };
  const selfMember = randomUUID();
  const pA = await mkProducer("A", selfMember), pB = await mkProducer("B"), pSmall = await mkProducer("Kecil");

  // satu pengiriman lunas yang SUDAH selesai (kredit + jurnal terbit); unit price → bagian produsen = 90% × unit + ongkir
  let seq = 0;
  const mkCompleted = async (producerId: string, unit: number, shipCost: number) => {
    const [inv] = await db.insert(s.invoices).values({ invoiceNumber: `${tag}-${seq++}`, sourceType: "cart", customerName: tag, subtotal: "1", total: "1", status: "paid" }).returning({ id: s.invoices.id });
    made.invoices.push(inv.id);
    await db.insert(s.invoiceItems).values({ invoiceId: inv.id, itemType: "product", name: `${tag} item`, unitPrice: String(unit), quantity: 1, total: String(unit), producerId, producerSharePercent: "10", discountAmount: "0" });
    const [sl] = await db.insert(s.invoiceShippingLines).values({ invoiceId: inv.id, sellerType: "tenant", producerId, sellerName: tag, cost: String(shipCost), status: "shipped", shippedAt: new Date() }).returning({ id: s.invoiceShippingLines.id });
    const r = await completeProducerShipment(tc, sl.id, "buyer");
    if (!r.ok) throw new Error("penyelesaian gagal: " + r.reason);
    return sl.id;
  };
  const sl1 = await mkCompleted(pA, 100000, 10000);   // 90.000 + 10.000 = 100.000
  const sl2 = await mkCompleted(pA, 150000, 15000);   // 135.000 + 15.000 = 150.000  → subtotal 250.000

  // ── Rekening ──
  ok("rekening: belum ada → null", (await getBankAccounts(tc, pA)).active === null);
  const t0 = new Date();
  const b1 = await setProducerBankAccount(tc, pA, { bankCode: "bri", accountNumber: "0123456789", holder: `${tag} Holder` }, t0);
  ok("rekening: pertama langsung berlaku", b1.ok && b1.immediate);
  const g1 = await getBankAccounts(tc, pA, new Date(t0.getTime() + 1000));
  ok("rekening: aktif tampil 4 digit terakhir saja (nomor utuh tidak dikembalikan, tersimpan terenkripsi)", g1.active?.accountLast4 === "6789" && !JSON.stringify(g1.active).includes("0123456789") && !g1.activeFull?.accountNumberEnc.includes("0123456789"));
  const t1 = new Date(t0.getTime() + 60_000);
  const b2 = await setProducerBankAccount(tc, pA, { bankCode: "bca", accountNumber: "9876543210", holder: `${tag} Holder` }, t1);
  ok("rekening: penggantian berlaku SETELAH 24 jam (bukan segera)", b2.ok && !b2.immediate && b2.effectiveAt.getTime() - t1.getTime() === 24 * 3_600_000);
  const g2 = await getBankAccounts(tc, pA, new Date(t1.getTime() + 3_600_000));
  ok("rekening: 1 jam kemudian rekening LAMA masih aktif, yang baru menunggu", g2.active?.bankCode === "bri" && g2.pending?.bankCode === "bca");
  const g3 = await getBankAccounts(tc, pA, new Date(t1.getTime() + 25 * 3_600_000));
  ok("rekening: setelah 24 jam rekening baru aktif", g3.active?.bankCode === "bca" && g3.pending === null);
  await setProducerBankAccount(tc, pA, { bankCode: "bni", accountNumber: "1111222233", holder: `${tag} Holder` }, new Date(t1.getTime() + 120_000));
  const g4 = await getBankAccounts(tc, pA, new Date(t1.getTime() + 3_600_000));
  ok("rekening: pengajuan ganti kedua menggantikan yang menunggu (hanya satu menunggu)", g4.pending?.bankCode === "bni" && g4.active?.bankCode === "bri");
  // kembalikan ke satu rekening aktif sederhana untuk pengajuan: hapus semua lalu buat ulang efektif lampau
  await db.delete(s.producerBankAccounts).where(eq(s.producerBankAccounts.producerId, pA));
  await db.insert(s.producerBankAccounts).values({ producerId: pA, bankCode: "bri", bankName: "BRI", accountNumberEnc: "x", accountLast4: "6789", accountHolder: `${tag} Holder`, effectiveAt: new Date(Date.now() - 86_400_000) });
  const realEnc = (await setProducerBankAccount(tc, pB, { bankCode: "bca", accountNumber: "5550001112", holder: `${tag} Bu B` }, new Date(Date.now() - 86_400_000)));
  ok("rekening B tersimpan (aktif)", realEnc.ok);

  // ── Pengajuan ──
  const el0 = await computeEligible({ db, schema: s }, pA);
  ok("eligible: 2 pengiriman, produk 225.000 + ongkir 25.000 = 250.000", el0.lines.length === 2 && el0.creditsTotal === 250000 && el0.subtotal === 250000, JSON.stringify({ c: el0.creditsTotal, s: el0.subtotal }));
  const noBank = await requestPayout(tc, pSmall);
  ok("ajukan: tanpa rekening ditolak", !noBank.ok && /rekening/i.test(noBank.error));
  await db.insert(s.producerBankAccounts).values({ producerId: pSmall, bankCode: "bca", bankName: "BCA", accountNumberEnc: "x", accountLast4: "0001", accountHolder: `${tag} Kecil`, effectiveAt: new Date(Date.now() - 86_400_000) });
  await mkCompleted(pSmall, 100000, 0);   // 90.000 < minimum 200.000
  const tooSmall = await requestPayout(tc, pSmall);
  ok("ajukan: di bawah minimum Rp200.000 ditolak dengan pesan jelas", !tooSmall.ok && /minimum/i.test(tooSmall.error), tooSmall.ok ? "" : tooSmall.error);

  const race = await Promise.all(Array.from({ length: 5 }, () => requestPayout(tc, pA)));
  ok("ajukan: 5 permintaan serentak → tepat 1 berhasil (satu pengajuan aktif)", race.filter((r) => r.ok).length === 1, `ok=${race.filter((r) => r.ok).length}`);
  const rq = race.find((r) => r.ok && "payoutId" in r) as { ok: true; payoutId: string; number: string; subtotal: number };
  ok("ajukan: nomor PRC-YYYYMM-NNNN + subtotal 250.000", /^PRC-\d{6}-\d{4}$/.test(rq.number) && rq.subtotal === 250000);
  const detail = await getPayoutWithLines(tc, rq.payoutId, pA);
  ok("rincian: 2 baris pengiriman memuat produk, ongkir, total; snapshot rekening", !!detail && detail.lines.length === 2 && detail.lines.some((l) => Number(l.productAmount) === 90000 && Number(l.shippingAmount) === 10000 && Number(l.total) === 100000) && detail.payout.accountLast4 === "6789");
  ok("rincian: produsen lain tidak bisa membaca (isolasi)", (await getPayoutWithLines(tc, rq.payoutId, pB)) === null);
  const reserved = await db.select().from(s.producerLedgerEntries).where(and(eq(s.producerLedgerEntries.payoutId, rq.payoutId), eq(s.producerLedgerEntries.status, "reserved")));
  ok("ajukan: entri ledger dicadangkan (reserved) — tak bisa diajukan dua kali", reserved.length === 4 && (await computeEligible({ db, schema: s }, pA)).subtotal === 0);

  // ── Batalkan (produsen) & ajukan ulang ──
  ok("batal: produsen lain tidak bisa membatalkan", !(await cancelPayoutByProducer(tc, pB, rq.payoutId)).ok);
  ok("batal: pemilik bisa membatalkan saat 'diajukan'; saldo kembali", (await cancelPayoutByProducer(tc, pA, rq.payoutId)).ok && (await computeEligible({ db, schema: s }, pA)).subtotal === 250000);
  const rq2 = await requestPayout(tc, pA) as { ok: true; payoutId: string; number: string };
  ok("ajukan ulang sesudah batal berhasil", rq2.ok);

  // ── Setujui / tolak ──
  ok("setujui: pemilik sendiri (member sama dengan produsen) ditolak", !(await approvePayout(tc, rq2.payoutId, { userId: actorUser, memberId: selfMember })).ok);
  ok("tolak: alasan terlalu pendek ditolak", !(await rejectPayout(tc, rq2.payoutId, bendahara, "x")).ok);
  ok("tolak: dengan alasan → ditolak, saldo kembali", (await rejectPayout(tc, rq2.payoutId, bendahara, "Data rekening tidak sesuai")).ok && (await computeEligible({ db, schema: s }, pA)).subtotal === 250000);
  const [rej] = await db.select().from(s.producerPayouts).where(eq(s.producerPayouts.id, rq2.payoutId));
  ok("tolak: status rejected + alasan tersimpan (dibaca produsen)", rej.status === "rejected" && rej.rejectedReason === "Data rekening tidak sesuai");
  const rq3 = await requestPayout(tc, pA) as { ok: true; payoutId: string; number: string };
  ok("tolak lalu ajukan lagi diperbolehkan", rq3.ok);
  ok("bayar sebelum disetujui ditolak", !(await markPayoutPaid(tc, rq3.payoutId, bendahara, { transferFee: 0, proofMediaId: randomUUID(), proofUrl: "https://x/y.png" })).ok);
  ok("setujui: berhasil", (await approvePayout(tc, rq3.payoutId, bendahara)).ok);
  ok("setujui dua kali ditolak", !(await approvePayout(tc, rq3.payoutId, bendahara)).ok);

  // ── Bayar: bukti WAJIB ──
  const noProof = await markPayoutPaid(tc, rq3.payoutId, bendahara, { transferFee: 7500, proofMediaId: "", proofUrl: "" });
  ok("bayar: TANPA bukti transfer ditolak", !noProof.ok && /bukti/i.test(noProof.error));
  ok("bayar: bukti id bukan uuid ditolak", !(await markPayoutPaid(tc, rq3.payoutId, bendahara, { transferFee: 7500, proofMediaId: "abc", proofUrl: "https://x/y.png" })).ok);
  ok("bayar: biaya transfer melebihi batas ditolak", !(await markPayoutPaid(tc, rq3.payoutId, bendahara, { transferFee: 60000, proofMediaId: randomUUID(), proofUrl: "https://x/y.png" })).ok);
  ok("bayar: biaya transfer negatif ditolak", !(await markPayoutPaid(tc, rq3.payoutId, bendahara, { transferFee: -1, proofMediaId: randomUUID(), proofUrl: "https://x/y.png" })).ok);
  ok("bayar: pemilik sendiri ditolak", !(await markPayoutPaid(tc, rq3.payoutId, { userId: actorUser, memberId: selfMember }, { transferFee: 7500, proofMediaId: randomUUID(), proofUrl: "https://x/y.png" })).ok);
  ok("bayar: biaya transfer di luar pengaturan TANPA catatan ditolak", await (async () => { const r = await markPayoutPaid(tc, rq3.payoutId, bendahara, { transferFee: 1234, proofMediaId: randomUUID(), proofUrl: "https://x/y.png" }); return !r.ok && /catatan/i.test(r.error); })());
  const proofId = randomUUID();
  const paid = await markPayoutPaid(tc, rq3.payoutId, bendahara, { transferFee: 7500, proofMediaId: proofId, proofUrl: "https://example.test/bukti.png", sourceBankLabel: "BCA 123", note: "lunas" });
  ok("bayar: sukses, net = 250.000 − 7.500 = 242.500", paid.ok && paid.netAmount === 242500, paid.ok ? "" : paid.error);
  const [pp] = await db.select().from(s.producerPayouts).where(eq(s.producerPayouts.id, rq3.payoutId));
  ok("bayar: status paid, biaya transfer & bukti & jurnal tersimpan", pp.status === "paid" && Number(pp.transferFee) === 7500 && Number(pp.netAmount) === 242500 && pp.proofMediaId === proofId && !!pp.transactionId && !!pp.paidAt);
  const pj = await db.select().from(s.transactionEntries).where(eq(s.transactionEntries.transactionId, pp.transactionId!));
  ok("jurnal pencairan: Dr Hutang Produsen = Cr Kas/Bank = 250.000 (berimbang)", pj.length === 2 && pj.filter((e) => e.type === "debit").reduce((a, e) => a + Number(e.amount), 0) === 250000 && pj.filter((e) => e.type === "credit").reduce((a, e) => a + Number(e.amount), 0) === 250000);
  ok("bayar: entri ledger → paid; saldo bisa dicairkan 0", (await db.select().from(s.producerLedgerEntries).where(and(eq(s.producerLedgerEntries.payoutId, rq3.payoutId), eq(s.producerLedgerEntries.status, "paid")))).length === 4 && (await computeEligible({ db, schema: s }, pA)).subtotal === 0);
  ok("bayar dua kali ditolak (tidak ada jurnal ganda)", !(await markPayoutPaid(tc, rq3.payoutId, bendahara, { transferFee: 0, proofMediaId: randomUUID(), proofUrl: "https://x/y.png" })).ok);

  // ── Refund → hutang, dipotong dari pencairan berikutnya ──
  ok("refund: alasan pendek ditolak", !(await recordProducerRefund(tc, { shippingLineId: sl1, amount: 10000, reason: "x", actorUserId: actorUser })).ok);
  ok("refund: melebihi hak pengiriman ditolak", !(await recordProducerRefund(tc, { shippingLineId: sl1, amount: 100001, reason: `${tag} barang rusak`, actorUserId: actorUser })).ok);
  ok("refund: nominal 0/negatif ditolak", !(await recordProducerRefund(tc, { shippingLineId: sl1, amount: 0, reason: `${tag} barang rusak`, actorUserId: actorUser })).ok);
  const r1 = await recordProducerRefund(tc, { shippingLineId: sl1, amount: 30000, reason: `${tag} barang rusak`, actorUserId: actorUser });
  ok("refund: dicatat 30.000", r1.ok);
  ok("refund: parsial kedua (60.000) masih ≤ sisa 70.000 → boleh", (await recordProducerRefund(tc, { shippingLineId: sl1, amount: 60000, reason: `${tag} sisa barang`, actorUserId: actorUser })).ok);
  ok("refund: melebihi sisa setelah refund sebelumnya ditolak", !(await recordProducerRefund(tc, { shippingLineId: sl1, amount: 20000, reason: `${tag} lagi`, actorUserId: actorUser })).ok);
  ok("hutang produsen = 90.000", (await getProducerDebt({ db, schema: s }, pA)) === 90000);
  const rj = await db.select().from(s.transactions).where(like(s.transactions.description, `Refund dibebankan ke produsen — ${tag}%`));
  ok("refund: 2 jurnal (Dr Hutang / Cr Pendapatan) tercatat", rj.length === 2);

  // ── Pelunasan hutang via transfer ──
  ok("pelunasan: tanpa bukti ditolak", !(await recordDebtRepayment(tc, { producerId: pA, amount: 10000, proofMediaId: "", proofUrl: "", actorUserId: actorUser })).ok);
  ok("pelunasan: melebihi hutang ditolak", !(await recordDebtRepayment(tc, { producerId: pA, amount: 90001, proofMediaId: randomUUID(), proofUrl: "https://x/y.png", actorUserId: actorUser })).ok);
  ok("pelunasan: 40.000 dicatat → hutang 50.000", (await recordDebtRepayment(tc, { producerId: pA, amount: 40000, proofMediaId: randomUUID(), proofUrl: "https://x/y.png", note: tag, actorUserId: actorUser })).ok && (await getProducerDebt({ db, schema: s }, pA)) === 50000);

  // ── Dipotong otomatis dari pencairan berikutnya (hutang 50.000) ──
  const sl3 = await mkCompleted(pA, 300000, 20000);   // 270.000 + 20.000 = 290.000
  const el3 = await computeEligible({ db, schema: s }, pA);
  ok("netting: hak baru 290.000 − hutang refund 90.000 + pelunasan 40.000 = 240.000", el3.creditsTotal === 290000 && el3.debtTotal === 90000 && el3.adjustmentTotal === 40000 && el3.subtotal === 240000, JSON.stringify({ c: el3.creditsTotal, d: el3.debtTotal, a: el3.adjustmentTotal, s: el3.subtotal }));
  ok("netting: baris potongan & pelunasan tampil terpisah di rincian", el3.lines.some((l) => /refund/i.test(l.label) && l.adjustmentAmount < 0) && el3.lines.some((l) => /Pelunasan/i.test(l.label) && l.adjustmentAmount > 0));

  // ── Tahan (sengketa) ──
  ok("tahan: alasan pendek ditolak", !(await setShipmentHold(tc, sl3, actorUser, "x")).ok);
  ok("tahan: berhasil → pengiriman keluar dari hak yang bisa diajukan, hutang tetap ikut", (await setShipmentHold(tc, sl3, actorUser, "Dugaan resi palsu, menunggu bukti")).ok);
  const elH = await computeEligible({ db, schema: s }, pA);
  ok("tahan: 290.000 tertahan; subtotal = −90.000 + 40.000 = −50.000 (tak bisa diajukan)", elH.heldCount === 1 && elH.heldAmount === 290000 && elH.creditsTotal === 0 && elH.subtotal === -50000, JSON.stringify(elH));
  ok("tahan: pengajuan ditolak (di bawah minimum)", !(await requestPayout(tc, pA)).ok);
  ok("lepas tahan: kembali ke hak yang bisa diajukan", (await setShipmentHold(tc, sl3, actorUser, "")).ok && (await computeEligible({ db, schema: s }, pA)).subtotal === 240000);
  ok("tahan: pengiriman yang sudah dibayar ditolak", !(await setShipmentHold(tc, sl2, actorUser, "Terlambat menahan")).ok);

  // ── Pengaturan tenant mengubah minimum ──
  await savePayoutSettings({ db, schema: s }, { minAmount: 300000, feeSameBank: 1000, feeOtherBank: 5000, slaDays: 5 });
  const st = await getPayoutSettings({ db, schema: s });
  ok("pengaturan tersimpan (min 300.000 / sama 1.000 / beda 5.000 / 5 hari)", st.minAmount === 300000 && st.feeOtherBank === 5000 && st.slaDays === 5);
  const blocked = await requestPayout(tc, pA);
  ok("minimum baru berlaku: 240.000 < 300.000 ditolak", !blocked.ok && /300\.000/.test(blocked.error), blocked.ok ? "" : blocked.error);
  await savePayoutSettings({ db, schema: s }, { minAmount: 200000, feeSameBank: 0, feeOtherBank: 7500, slaDays: 3 });
  const final = await requestPayout(tc, pA);
  ok("setelah minimum kembali 200.000: 240.000 bisa diajukan", final.ok);
  ok("pelunasan: hutang yang sudah masuk pengajuan berjalan TIDAK bisa dilunasi lagi (tak bayar dua kali)", !(await recordDebtRepayment(tc, { producerId: pA, amount: 1000, proofMediaId: randomUUID(), proofUrl: "https://x/y.png", actorUserId: actorUser })).ok);
  ok("pengaman DB: status 'paid' tanpa bukti ditolak oleh CHECK database", await (async () => { try { await db.update(s.producerPayouts).set({ status: "paid" }).where(eq(s.producerPayouts.id, (final as { payoutId: string }).payoutId)); return false; } catch { return true; } })());
  ok("pengaman DB: subtotal ≤ 0 ditolak", await (async () => { try { await db.update(s.producerPayouts).set({ subtotal: "0" }).where(eq(s.producerPayouts.id, (final as { payoutId: string }).payoutId)); return false; } catch { return true; } })());
} finally {
  const cleanup = async (label: string, fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { console.error("cleanup", label, e instanceof Error ? e.message : e); fails++; } };
  const P = made.producers;
  await cleanup("payouts", () => P.length ? db.delete(s.producerPayouts).where(inArray(s.producerPayouts.producerId, P)) : Promise.resolve());
  await cleanup("jurnal", () => db.delete(s.transactions).where(and(gte(s.transactions.createdAt, startedAt), or(like(s.transactions.description, "Pengakuan hutang produsen%"), like(s.transactions.description, "Pencairan produsen PRC-%"), like(s.transactions.description, "Refund dibebankan ke produsen%"), like(s.transactions.description, "Pelunasan hutang refund%")))));
  await cleanup("ledger", () => P.length ? db.delete(s.producerLedgerEntries).where(inArray(s.producerLedgerEntries.producerId, P)) : Promise.resolve());
  await cleanup("rekening", () => P.length ? db.delete(s.producerBankAccounts).where(inArray(s.producerBankAccounts.producerId, P)) : Promise.resolve());
  await cleanup("shipping", () => made.invoices.length ? db.delete(s.invoiceShippingLines).where(inArray(s.invoiceShippingLines.invoiceId, made.invoices)) : Promise.resolve());
  await cleanup("items", () => made.invoices.length ? db.delete(s.invoiceItems).where(inArray(s.invoiceItems.invoiceId, made.invoices)) : Promise.resolve());
  await cleanup("invoices", () => made.invoices.length ? db.delete(s.invoices).where(inArray(s.invoices.id, made.invoices)) : Promise.resolve());
  await cleanup("producers", () => P.length ? db.delete(s.producers).where(inArray(s.producers.id, P)) : Promise.resolve());
  await cleanup("settings", async () => {
    if (prevSettings) await db.update(s.settings).set({ value: prevSettings.value }).where(eq(s.settings.id, prevSettings.id));
    else await db.delete(s.settings).where(and(eq(s.settings.key, "producer_payout"), eq(s.settings.group, "payment")));
  });
}
console.log(fails ? `\n${fails} GAGAL` : "\nSEMUA LULUS");
process.exit(fails ? 1 : 0);
