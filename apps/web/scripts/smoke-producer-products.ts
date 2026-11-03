// Regresi data-nyata "Produsen mengelola produk sendiri" — docs/arsitektur-produk-produsen.md § 12.
// Menjalankan fungsi server NYATA terhadap DB LOKAL lalu membersihkan semua baris buatannya.
//
//   cd apps/web && SMOKE_I_KNOW=1 bun run --preload ./scripts/stub-server-only.ts scripts/smoke-producer-products.ts
//
// PENGAMAN: host DATABASE_URL harus PERSIS localhost/127.0.0.1 (di-parse); wajib SMOKE_I_KNOW=1; semua data uji diberi penanda
// nama "SMOKE-" dan dihapus di blok finally. Tenant uji default pc-ikpm-jogjakarta (env SMOKE_TENANT).
import { randomUUID } from "crypto";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { db as pdb, createTenantDb, resolveProductCartItem, tenants, members, memberMedia, tenantMemberships } from "@jalajogja/db";
import { parseProductInput, computeBaseCost, buildProductSlug } from "../lib/producer-products";
import {
  getProducerCommercials, syncBaseCosts, createProducerProduct, updateProducerProduct, setProducerProductStatus, deleteProducerProduct, requireOwnedProduct, countOwnedProducts, hasPaidOrders, resolveProductImages, findMediaInUse, assertWithinLimit,
} from "../lib/producer-products.server";

const isLocalHost = (h: string) => h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
let dbHost = ""; try { dbHost = new URL(process.env.DATABASE_URL ?? "").hostname; } catch { /* kosong → ditolak */ }
if (!isLocalHost(dbHost) || process.env.SMOKE_I_KNOW !== "1") {
  console.error(`DITOLAK: butuh DATABASE_URL localhost (terbaca: '${dbHost}') dan SMOKE_I_KNOW=1.`); process.exit(2);
}
const SLUG = process.env.SMOKE_TENANT ?? "pc-ikpm-jogjakarta";
let fails = 0;
const ok = (n: string, v: boolean, x = "") => { console.log((v ? "PASS " : "FAIL ") + n + (x ? "  " + x : "")); if (!v) fails++; };

// ── Bagian MURNI ──
const EXTRA = { status: "active" as const, originId: null, productType: "simple" as const, attributeGroups: [] as never[], variations: [] as never[] };
const valid = { name: "Sajadah Uji", description: "", categoryId: null, images: [{ mediaId: randomUUID(), alt: "a" }], publicPrice: 100000, memberPrice: 90000, stock: 5, weightGram: 500 };
ok("parse: input sah", parseProductInput(valid).ok);
ok("parse: bukan objek ditolak", !parseProductInput(null).ok && !parseProductInput("x").ok && !parseProductInput([]).ok);
ok("parse: nama pendek", !parseProductInput({ ...valid, name: "ab" }).ok);
ok("parse: tanpa foto", !parseProductInput({ ...valid, images: [] }).ok);
ok("parse: >8 foto", !parseProductInput({ ...valid, images: Array.from({ length: 9 }, () => ({ mediaId: randomUUID(), alt: "" })) }).ok);
ok("parse: foto ganda", !parseProductInput({ ...valid, images: [valid.images[0], valid.images[0]] }).ok);
ok("parse: mediaId bukan uuid", !parseProductInput({ ...valid, images: [{ mediaId: "1 OR 1=1", alt: "" }] }).ok);
ok("parse: harga 0 / negatif / NaN", !parseProductInput({ ...valid, publicPrice: 0 }).ok && !parseProductInput({ ...valid, publicPrice: -5 }).ok && !parseProductInput({ ...valid, publicPrice: "abc" }).ok);
ok("parse: harga anggota > publik", !parseProductInput({ ...valid, memberPrice: 100001 }).ok);
ok("parse: harga anggota kosong = null", (() => { const r = parseProductInput({ ...valid, memberPrice: "" }); return r.ok && r.value.memberPrice === null; })());
ok("parse: stok desimal / negatif", !parseProductInput({ ...valid, stock: 1.5 }).ok && !parseProductInput({ ...valid, stock: -1 }).ok);
ok("parse: berat wajib", !parseProductInput({ ...valid, weightGram: 0 }).ok && !parseProductInput({ ...valid, weightGram: null }).ok);
ok("parse: deskripsi bukan Tiptap", !parseProductInput({ ...valid, description: "<script>x</script>" }).ok && !parseProductInput({ ...valid, description: '{"type":"paragraph"}' }).ok);
ok("parse: deskripsi Tiptap sah", parseProductInput({ ...valid, description: '{"type":"doc","content":[]}' }).ok);
ok("parse: field berbahaya diabaikan (producerId/price/mitraId)", (() => {
  const r = parseProductInput({ ...valid, producerId: randomUUID(), price: 1, mitraId: randomUUID() });
  return r.ok && !("producerId" in r.value) && !("price" in r.value) && !("mitraId" in r.value);
})());
ok("parse: status bawaan = draft (K32); draft/aktif/arsip diterima", (() => {
  const d = parseProductInput(valid);
  return d.ok && d.value.status === "draft" && (["draft", "active", "archived"] as const).every((st) => { const r = parseProductInput({ ...valid, status: st }); return r.ok && r.value.status === st; });
})());
ok("parse: status frozen / sembarang DITOLAK (hanya admin boleh membekukan)", !parseProductInput({ ...valid, status: "frozen" }).ok && !parseProductInput({ ...valid, status: "published" }).ok && !parseProductInput({ ...valid, status: 1 }).ok);
ok("parse: originId bukan uuid ditolak", !parseProductInput({ ...valid, originId: "1;DROP" }).ok);
const GROUPS = [{ name: "Ukuran", values: ["S", "M"] }];
const VAR = (extra: Record<string, unknown> = {}, size = "S") => ({ id: null, sku: "", publicPrice: "", memberPrice: "", stock: 3, weightGram: "", images: [], attributeCombo: { Ukuran: size }, isActive: true, ...extra });
const varIn = (vars: unknown[], groups: unknown = GROUPS) => ({ ...valid, productType: "variable", attributeGroups: groups, variations: vars });
ok("parse variasi: sah; harga kosong = null (ikut induk), stok produk utama diabaikan", (() => {
  const r = parseProductInput(varIn([VAR(), VAR({ publicPrice: 150000, weightGram: 300 }, "M")]));
  return r.ok && r.value.productType === "variable" && r.value.stock === 0 && r.value.variations[0].publicPrice === null && r.value.variations[1].publicPrice === 150000 && r.value.variations[1].weightGram === 300;
})());
ok("parse variasi: tanpa variasi / tanpa atribut ditolak", !parseProductInput(varIn([])).ok && !parseProductInput(varIn([VAR()], [])).ok);
ok("parse variasi: kombinasi di luar atribut / ganda / kurang ditolak", !parseProductInput(varIn([VAR({}, "XL")])).ok && !parseProductInput(varIn([VAR(), VAR()])).ok && !parseProductInput(varIn([VAR({ attributeCombo: {} })])).ok && !parseProductInput(varIn([VAR({ attributeCombo: { Ukuran: "S", Warna: "x" } })])).ok);
ok("parse variasi: harga anggota > harga jual efektif ditolak (milik sendiri & ikut induk)", !parseProductInput(varIn([VAR({ publicPrice: 1000, memberPrice: 2000 })])).ok && !parseProductInput(varIn([VAR({ memberPrice: 100001 })])).ok && parseProductInput(varIn([VAR({ memberPrice: 100000 })])).ok);
ok("parse variasi: stok negatif/desimal, harga 0, berat 0, id bukan uuid, foto bukan uuid ditolak", !parseProductInput(varIn([VAR({ stock: -1 })])).ok && !parseProductInput(varIn([VAR({ stock: 1.5 })])).ok && !parseProductInput(varIn([VAR({ publicPrice: 0 })])).ok && !parseProductInput(varIn([VAR({ weightGram: 0 })])).ok && !parseProductInput(varIn([VAR({ id: "x" })])).ok && !parseProductInput(varIn([VAR({ images: [{ mediaId: "x", alt: "" }] })])).ok);
ok("parse variasi: >3 atribut, >100 variasi, atribut kembar ditolak", !parseProductInput(varIn([VAR()], [1, 2, 3, 4].map((i) => ({ name: `A${i}`, values: ["x"] })))).ok && !parseProductInput(varIn(Array.from({ length: 101 }, (_, i) => VAR({}, "S")))).ok && !parseProductInput(varIn([VAR()], [{ name: "Ukuran", values: ["S"] }, { name: "ukuran", values: ["S"] }])).ok);
ok("deskripsi: node berbahaya dibuang (gambar/embed/galeri/script/tabel)", (() => {
  const bad = JSON.stringify({ type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: "halo", marks: [{ type: "bold" }, { type: "textStyle", attrs: { color: 'red" onmouseover="x' } }, { type: "link", attrs: { href: "javascript:alert(1)" } }] }] },
    { type: "image", attrs: { src: "javascript:1" } }, { type: "embedBlock", attrs: { html: "<script>x</script>" } }, { type: "galleryBlock", attrs: { items: [] } },
    { type: "table", content: [] }, { type: "codeBlock", content: [] }, { type: "heading", attrs: { level: "2><script>", textAlign: "center\" onclick=\"" }, content: [{ type: "text", text: "judul" }] },
  ] });
  const r = parseProductInput({ ...valid, description: bad });
  if (!r.ok) return false;
  const d = r.value.description;
  return d.includes("halo") && d.includes("judul") && d.includes("bold") && !/image|embed|gallery|table|codeBlock|textStyle|javascript|onmouseover|onclick|script/i.test(d);
})());
ok("deskripsi: link https dipertahankan, level heading di luar 2–4 dikoreksi", (() => {
  const r = parseProductInput({ ...valid, description: JSON.stringify({ type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "https://ok.id/a" } }] }] },
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "h" }] }] }) });
  return r.ok && r.value.description.includes("https://ok.id/a") && r.value.description.includes('"level":2');
})());
ok("deskripsi: dokumen sangat dalam / besar tidak membuat error", (() => {
  let n: Record<string, unknown> = { type: "paragraph", content: [{ type: "text", text: "d" }] };
  for (let i = 0; i < 200; i++) n = { type: "blockquote", content: [n] };
  return parseProductInput({ ...valid, description: JSON.stringify({ type: "doc", content: [n] }) }).ok;
})());
ok("harga dasar K24: 100.000 @10% = 90.000", computeBaseCost(100000, 10) === 90000);
ok("harga dasar K24: 99.999 @7,5% dibulatkan 2 desimal", computeBaseCost(99999, 7.5) === 92499.08);
ok("slug: bersih + akhiran", buildProductSlug("Sajadah  Gontor!! Premium", "ab12") === "sajadah-gontor-premium-ab12" && buildProductSlug("###", "x") === "produk-x");

// ── Bagian DB nyata ──
const [t] = await pdb.select().from(tenants).where(eq(tenants.slug, SLUG));
const tc = createTenantDb(SLUG); const { db, schema: s } = tc;
const [mem] = await pdb.select({ id: members.id }).from(members)
  .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, members.id), eq(tenantMemberships.tenantId, t.id), eq(tenantMemberships.status, "active"))).limit(1);
const [other] = await pdb.select({ id: members.id }).from(members)
  .innerJoin(tenantMemberships, and(eq(tenantMemberships.memberId, members.id), eq(tenantMemberships.tenantId, t.id))).where(and(eq(tenantMemberships.status, "active"))).limit(2)
  .then((r) => r.filter((x) => x.id !== mem.id));
const tag = `SMOKE-${randomUUID().slice(0, 6)}`;
const made = { producers: [] as string[], products: [] as string[], invoices: [] as string[], media: [] as string[], origins: [] as string[] };

try {
  const mkProducer = async (name: string, memberId: string | null, share: string | null, limit: number | null) => {
    const [r] = await db.insert(s.producers).values({ type: "custom", customName: `${tag} ${name}`, memberId, revenueSharePercent: share, productLimit: limit }).returning({ id: s.producers.id });
    made.producers.push(r.id); return r.id;
  };
  const pA = await mkProducer("A", mem.id, "10", null), pB = await mkProducer("B", null, "5", 2), pNo = await mkProducer("TanpaPersen", null, null, null);

  const c = await getProducerCommercials(tc, pA);
  ok("commercials: persen 10, batas default 3", c?.sharePercent === 10 && c.productLimit === 3 && c.isActive);
  ok("commercials: batas khusus 2", (await getProducerCommercials(tc, pB))?.productLimit === 2);
  ok("commercials: tanpa persen = null", (await getProducerCommercials(tc, pNo))?.sharePercent === null);
  ok("commercials: produsen tak ada = null", (await getProducerCommercials(tc, randomUUID())) === null);

  const mkProduct = async (producerId: string | null, name: string, status: string, mitra: string | null = null, images: unknown[] = []) => {
    const [r] = await db.insert(s.products).values({ slug: `${tag.toLowerCase()}-${made.products.length}`, name: `${tag} ${name}`, price: "1", publicPrice: "10", stock: 1, producerId, status: status as never, mitraId: mitra, images }).returning({ id: s.products.id });
    made.products.push(r.id); return r.id;
  };

  // media uji: milik mem, milik orang lain, bertujuan khusus
  const mkMedia = async (memberId: string, purpose: string | null = null, status = "done") => {
    const [r] = await pdb.insert(memberMedia).values({
      memberId, sourceTenantSlug: SLUG, filename: `${tag}.webp`, originalName: `${tag}.webp`, mimeType: "image/webp", size: 10,
      path: `akun/${tag}/orig.webp`, variants: { large: `akun/${tag}/large.webp`, square: `akun/${tag}/sq.webp` }, purpose, processingStatus: status,
    }).returning({ id: memberMedia.id });
    made.media.push(r.id); return r.id;
  };
  const m1 = await mkMedia(mem.id), m2 = await mkMedia(mem.id), m3 = await mkMedia(mem.id);
  const foreign = other ? await mkMedia(other.id) : null;
  const resi = await mkMedia(mem.id, "resi");
  const pending = await mkMedia(mem.id, null, "processing");

  // foto
  const imgs = await resolveProductImages(mem.id, [{ mediaId: m2, alt: "dua" }, { mediaId: m1, alt: "satu" }]);
  ok("foto: urutan mengikuti input + order 0..n", !!imgs && imgs[0].id === m2 && imgs[1].id === m1 && imgs[0].order === 0 && imgs[1].order === 1);
  ok("foto: url & varian ter-resolve dari DB (large dipakai untuk url)", !!imgs && imgs[0].url.includes("large.webp") && !!imgs[0].variants?.square?.includes("sq.webp"));
  ok("foto: milik anggota lain DITOLAK", foreign ? (await resolveProductImages(mem.id, [{ mediaId: foreign, alt: "" }])) === null : true, foreign ? "" : "(dilewati: hanya 1 anggota)");
  ok("foto: campuran (satu milik orang lain) ditolak seluruhnya", foreign ? (await resolveProductImages(mem.id, [{ mediaId: m1, alt: "" }, { mediaId: foreign, alt: "" }])) === null : true);
  ok("foto: media bertujuan khusus (resi) ditolak", (await resolveProductImages(mem.id, [{ mediaId: resi, alt: "" }])) === null);
  ok("foto: belum selesai diproses ditolak", (await resolveProductImages(mem.id, [{ mediaId: pending, alt: "" }])) === null);
  ok("foto: id tak dikenal ditolak", (await resolveProductImages(mem.id, [{ mediaId: randomUUID(), alt: "" }])) === null);

  // kepemilikan + hitungan (K26: arsip ikut dihitung)
  const a1 = await mkProduct(pA, "A1", "active", null, imgs ?? []);
  const a2 = await mkProduct(pA, "A2 arsip", "archived");
  const b1 = await mkProduct(pB, "B1", "draft");
  const internal = await mkProduct(null, "Internal", "active");
  const mitraP = await mkProduct(pA, "Mitra", "active", randomUUID());
  ok("milik: produk sendiri ditemukan", (await requireOwnedProduct(tc, pA, a1))?.id === a1);
  ok("milik: produk produsen lain = null", (await requireOwnedProduct(tc, pA, b1)) === null);
  ok("milik: produk internal = null", (await requireOwnedProduct(tc, pA, internal)) === null);
  ok("milik: produk mitra = null", (await requireOwnedProduct(tc, pA, mitraP)) === null);
  ok("milik: id bukan uuid = null", (await requireOwnedProduct(tc, pA, "' OR 1=1 --")) === null);
  ok("hitungan K26: aktif+arsip dihitung, mitra tidak (=2)", (await countOwnedProducts(tc, pA)) === 2);
  ok("batas: 2 < 3 boleh", (await assertWithinLimit(tc, pA, 3)) === null);
  await mkProduct(pA, "A3", "draft");
  ok("batas: 3 sudah penuh (draf ikut dihitung)", (await assertWithinLimit(tc, pA, 3)) !== null);
  ok("batas: slot dibebaskan HANYA oleh hapus", await (async () => { await db.delete(s.products).where(eq(s.products.id, a2)); made.products = made.products.filter((x) => x !== a2); return (await assertWithinLimit(tc, pA, 3)) === null; })());

  // pesanan lunas → hapus
  const [vr] = await db.insert(s.productVariations).values({ productId: a1, sku: `${tag}-v`, attributes: {}, stock: 1, images: [{ id: m3, url: "x", alt: "", order: 0 }] } as never).returning({ id: s.productVariations.id }).catch(() => [undefined as never]);
  const mkInvoice = async (status: string, itemId: string) => {
    const [inv] = await db.insert(s.invoices).values({ invoiceNumber: `${tag}-${made.invoices.length}`, sourceType: "cart", customerName: tag, subtotal: "10", total: "10", status: status as never }).returning({ id: s.invoices.id });
    made.invoices.push(inv.id);
    await db.insert(s.invoiceItems).values({ invoiceId: inv.id, itemType: "product", itemId, name: tag, unitPrice: "10", quantity: 1, total: "10" });
  };
  ok("hapus: tanpa pesanan = boleh", (await hasPaidOrders(tc, a1)) === false);
  await mkInvoice("pending", a1); await mkInvoice("cancelled", a1);
  ok("hapus: pesanan belum bayar / dibatalkan TIDAK menghalangi", (await hasPaidOrders(tc, a1)) === false);
  if (vr) { await mkInvoice("paid", vr.id); ok("hapus: pesanan lunas atas VARIASI menghalangi produk induk", (await hasPaidOrders(tc, a1)) === true); }
  const a3 = made.products[made.products.length - 1];
  await mkInvoice("paid", a3);
  ok("hapus: pesanan lunas atas produk menghalangi", (await hasPaidOrders(tc, a3)) === true);
  await mkInvoice("partial", internal);
  ok("hapus: invoice SEBAGIAN dibayar (uang sudah masuk) juga menghalangi", (await hasPaidOrders(tc, internal)) === true);
  ok("hapus: produk lain tidak terpengaruh", (await hasPaidOrders(tc, b1)) === false);

  // foto dipakai (dua arah)
  const used = await findMediaInUse(mem.id, [m1, m2, m3, resi]);
  ok("foto dipakai: m1+m2 (produk) terdeteksi", used.has(m1) && used.has(m2));
  ok("foto dipakai: m3 (variasi) terdeteksi", vr ? used.has(m3) : true, vr ? "" : "(dilewati: variasi uji gagal dibuat)");
  ok("foto dipakai: yang tak dipakai tidak terdeteksi", !used.has(resi));
  await db.update(s.products).set({ status: "archived" }).where(eq(s.products.id, a1));
  ok("foto dipakai: produk ARSIP tetap mengunci foto", (await findMediaInUse(mem.id, [m1])).has(m1));
  await db.update(s.products).set({ images: [] }).where(eq(s.products.id, a1));
  ok("foto dipakai: setelah DIGANTI langsung bebas (dua arah)", !(await findMediaInUse(mem.id, [m1, m2])).has(m1) && !(await findMediaInUse(mem.id, [m2])).has(m2));
  if (vr) {
    await db.delete(s.productVariations).where(eq(s.productVariations.id, vr.id)).catch(() => {});
  }
  ok("foto dipakai: tanpa variasi & tanpa foto produk → bebas", !(await findMediaInUse(mem.id, [m1, m2, m3])).size);
  ok("foto dipakai: id bukan uuid diabaikan", (await findMediaInUse(mem.id, ["x' OR '1'='1"])).size === 0);
  ok("foto dipakai: anggota lain tidak melihat milik kita", (await findMediaInUse(other?.id ?? randomUUID(), [m1])).size === 0);

  // ── P2: buat produk ──
  const pC = await mkProducer("Pembuat", mem.id, "10", 2);
  const baseIn = (images: { mediaId: string; alt: string }[]) => ({ ...EXTRA, name: "Produk Buatan Uji", description: "", categoryId: null, images, publicPrice: 100000, memberPrice: 90000, stock: 5, weightGram: 500 });
  const cr = await createProducerProduct({ tenant: { slug: SLUG }, producer: { id: pC } }, baseIn([{ mediaId: m1, alt: "x" }]));
  ok("buat: sukses", cr.ok);
  if (cr.ok) {
    made.products.push(cr.productId);
    const [row] = await db.select().from(s.products).where(eq(s.products.id, cr.productId));
    ok("buat: status sesuai pilihan + milik produsen sesi + produk sederhana", row.status === "active" && row.producerId === pC && row.productType === "simple" && row.mitraId === null);
    ok("buat: harga dasar otomatis K24 = 90.000", Number(row.price) === 90000 && Number(row.publicPrice) === 100000 && Number(row.memberPrice) === 90000);
    ok("buat: foto di-resolve server (id + urutan)", Array.isArray(row.images) && (row.images as Array<{ id: string }>)[0].id === m1);
    ok("buat: slug unik berformat", /^produk-buatan-uji-[a-z0-9]{8}$/.test(row.slug));
    ok("buat: tidak ada asal kirim / gratis ongkir / ambil sendiri (K27)", row.originId === null && row.freeShippingMode === "none" && row.pickupLocationName === null);
  }
  ok("buat: foto milik anggota lain ditolak", foreign ? !(await createProducerProduct({ tenant: { slug: SLUG }, producer: { id: pC } }, baseIn([{ mediaId: foreign, alt: "" }]))).ok : true);
  ok("buat: kategori tak ada ditolak", !(await createProducerProduct({ tenant: { slug: SLUG }, producer: { id: pC } }, { ...baseIn([{ mediaId: m1, alt: "" }]), categoryId: randomUUID() })).ok);
  ok("buat: persentase belum ditetapkan ditolak", !(await createProducerProduct({ tenant: { slug: SLUG }, producer: { id: pNo } }, baseIn([{ mediaId: m1, alt: "" }]))).ok);
  await db.update(s.producers).set({ isActive: false }).where(eq(s.producers.id, pB));
  ok("buat: produsen nonaktif ditolak", !(await createProducerProduct({ tenant: { slug: SLUG }, producer: { id: pB } }, baseIn([{ mediaId: m1, alt: "" }]))).ok);
  ok("buat: produsen tanpa anggota (pB) ditolak", !(await createProducerProduct({ tenant: { slug: SLUG }, producer: { id: pNo } }, baseIn([{ mediaId: m1, alt: "" }]))).ok);

  // balapan: batas 2, sudah terpakai 1 → 6 permintaan bersamaan, HANYA 1 lagi yang boleh lolos
  const race = await Promise.all(Array.from({ length: 6 }, (_, i) => createProducerProduct({ tenant: { slug: SLUG }, producer: { id: pC } }, { ...baseIn([{ mediaId: m1, alt: "" }]), name: `Balapan Uji ${i}` })));
  for (const r of race) if (r.ok) made.products.push(r.productId);
  ok("batas K26 atomik: 6 permintaan serentak → tepat 1 lolos", race.filter((r) => r.ok).length === 1, `lolos=${race.filter((r) => r.ok).length}`);
  ok("batas K26: total produsen = batas (2)", (await countOwnedProducts(tc, pC)) === 2);
  const over = race.find((r) => !r.ok);
  ok("batas K26: pesan jelas", !!over && !over.ok && /Batas produk tercapai/.test(over.error));

  // ── P3: ubah / status / hapus ──
  const accC = { tenant: { slug: SLUG }, producer: { id: pC } };
  // slot pC penuh (2/2): ubah & arsip tidak boleh terhalang batas
  const [mine] = await db.select().from(s.products).where(and(eq(s.products.producerId, pC), eq(s.products.status, "active"))).limit(1);
  const edit = { ...EXTRA, name: "Nama Diubah", description: "", categoryId: null, images: [{ mediaId: m2, alt: "baru" }, { mediaId: m1, alt: "lama" }], publicPrice: 200000, memberPrice: null, stock: 9, weightGram: 800 };
  ok("ubah: sukses walau slot penuh", (await updateProducerProduct(accC, mine.id, edit)).ok);
  const [after] = await db.select().from(s.products).where(eq(s.products.id, mine.id));
  ok("ubah: nama/harga/stok/berat/foto berubah", after.name === "Nama Diubah" && Number(after.publicPrice) === 200000 && after.stock === 9 && after.weightGram === 800 && (after.images as Array<{ id: string; alt: string }>)[0].id === m2 && (after.images as Array<{ alt: string }>)[1].alt === "lama");
  ok("ubah: harga anggota kosong → null", after.memberPrice === null);
  ok("ubah: harga dasar K24 = 180.000 (200.000 @10%)", Number(after.price) === 180000);
  ok("ubah: slug, status, produsen TIDAK berubah", after.slug === mine.slug && after.status === "active" && after.producerId === pC);
  await db.update(s.producers).set({ revenueSharePercent: "25" }).where(eq(s.producers.id, pC));
  await updateProducerProduct(accC, mine.id, edit);
  ok("ubah: persentase terkini dipakai (200.000 @25% = 150.000)", Number((await db.select().from(s.products).where(eq(s.products.id, mine.id)))[0].price) === 150000);
  await db.update(s.producers).set({ revenueSharePercent: "10" }).where(eq(s.producers.id, pC));
  ok("ubah: produk produsen lain ditolak", !(await updateProducerProduct(accC, b1, edit)).ok);
  ok("ubah: foto anggota lain ditolak", foreign ? !(await updateProducerProduct(accC, mine.id, { ...edit, images: [{ mediaId: foreign, alt: "" }] })).ok : true);
  ok("ubah: id bukan uuid ditolak", !(await updateProducerProduct(accC, "x", edit)).ok);
  // foto lama dari Media Library TENANT (dipasang admin) boleh dipertahankan; yang baru tetap harus milik anggota
  const tenantImg = randomUUID();
  await db.update(s.products).set({ images: [{ id: tenantImg, url: "http://x/y.webp", variants: null, alt: "admin", order: 0 }] }).where(eq(s.products.id, mine.id));
  ok("ubah: foto tenant (pasangan admin) dipertahankan + foto baru ditambah", (await updateProducerProduct(accC, mine.id, { ...edit, images: [{ mediaId: tenantImg, alt: "tetap" }, { mediaId: m3, alt: "baru" }] })).ok
    && ((await db.select().from(s.products).where(eq(s.products.id, mine.id)))[0].images as Array<{ id: string }>).map((i) => i.id).join() === [tenantImg, m3].join());
  ok("ubah: id foto acak yang BUKAN milik produk & bukan milik anggota ditolak", !(await updateProducerProduct(accC, mine.id, { ...edit, images: [{ mediaId: randomUUID(), alt: "" }] })).ok);
  const [varP] = await db.insert(s.products).values({ slug: `${tag.toLowerCase()}-var`, name: `${tag} Variabel`, price: "1", publicPrice: "10", stock: 0, producerId: pC, productType: "variable", status: "active" as never }).returning({ id: s.products.id });
  made.products.push(varP.id);


  // ── R1: variasi (K33), gudang (K31), status (K32) ──
  const varEdit = (vars: unknown[], extra: Record<string, unknown> = {}) => ({ ...edit, productType: "variable" as const, attributeGroups: GROUPS, variations: vars as never[], ...extra });
  const uv = (extra: Record<string, unknown> = {}, size = "S") => ({ id: null, sku: "", publicPrice: "", memberPrice: "", stock: 3, weightGram: "", images: [], attributeCombo: { Ukuran: size }, isActive: true, ...extra });
  const pv = (raw: unknown) => { const r = parseProductInput({ ...valid, memberPrice: null, ...(raw as object), images: [{ mediaId: m1, alt: "" }] }); if (!r.ok) throw new Error("parse: " + r.error); return r.value; };
  const r1 = await updateProducerProduct(accC, mine.id, pv(varEdit([uv({ publicPrice: 150000, stock: 4, images: [{ mediaId: m1, alt: "v" }] }), uv({ stock: 6 }, "M")], { publicPrice: 200000, memberPrice: null })));
  ok("variasi: ubah produk sederhana → bervariasi sukses", r1.ok, r1.ok ? "" : r1.error);
  const [vp] = await db.select().from(s.products).where(eq(s.products.id, mine.id));
  const vrows = await db.select().from(s.productVariations).where(eq(s.productVariations.productId, mine.id));
  const vS = vrows.find((v) => (v.attributeCombo as Record<string, string>).Ukuran === "S")!, vM = vrows.find((v) => (v.attributeCombo as Record<string, string>).Ukuran === "M")!;
  ok("variasi: tipe + atribut tersimpan, stok utama 0", vp.productType === "variable" && vrows.length === 2 && vp.stock === 0 && (vp.attributeGroups as Array<{ name: string }>)[0].name === "Ukuran");
  ok("variasi: harga dasar induk K24 = 180.000", Number(vp.price) === 180000);
  ok("variasi K33: punya harga jual sendiri → harga dasar = 150.000 × 90% = 135.000", Number(vS.publicPrice) === 150000 && Number(vS.price) === 135000);
  ok("variasi K33: harga kosong → null (ikut induk), bukan disalin", vM.publicPrice === null && vM.price === null && vM.memberPrice === null && vM.weightGram === null);
  ok("variasi: foto di-resolve server dari Media Library anggota", ((vS.images as Array<{ id: string }>)[0]?.id) === m1);
  ok("variasi: stok & aktif tersimpan", vS.stock === 4 && vM.stock === 6 && vS.isActive && vM.isActive);

  // simpan ulang membawa id → UUID dipertahankan (keranjang pembeli tidak yatim); satu variasi dibuang
  const r2 = await updateProducerProduct(accC, mine.id, pv(varEdit([uv({ id: vS.id, publicPrice: 100000, stock: 9 })], { publicPrice: 200000 })));
  const vrows2 = await db.select().from(s.productVariations).where(eq(s.productVariations.productId, mine.id));
  ok("variasi: simpan ulang mempertahankan UUID, yang tidak dikirim terhapus", r2.ok && vrows2.length === 1 && vrows2[0].id === vS.id && vrows2[0].stock === 9 && Number(vrows2[0].price) === 90000, r2.ok ? "" : r2.error);

  // id variasi milik produk LAIN tidak boleh disentuh
  const [otherP] = await db.insert(s.products).values({ slug: `${tag.toLowerCase()}-other`, name: `${tag} Lain`, price: "1", publicPrice: "10", stock: 0, producerId: pB, productType: "variable", status: "active" as never }).returning({ id: s.products.id });
  made.products.push(otherP.id);
  const [otherV] = await db.insert(s.productVariations).values({ productId: otherP.id, stock: 7, price: "5", publicPrice: "50", attributeCombo: { Ukuran: "S" } }).returning({ id: s.productVariations.id });
  const r3 = await updateProducerProduct(accC, mine.id, pv(varEdit([uv({ id: otherV.id, stock: 99, publicPrice: 1111 })], { publicPrice: 200000 })));
  const [otherAfter] = await db.select().from(s.productVariations).where(eq(s.productVariations.id, otherV.id));
  ok("variasi: id variasi PRODUK LAIN tidak disentuh (jadi variasi baru di produk ini)", r3.ok && otherAfter.stock === 7 && Number(otherAfter.publicPrice) === 50
    && (await db.select().from(s.productVariations).where(eq(s.productVariations.productId, mine.id))).every((v) => v.id !== otherV.id));
  ok("variasi: foto variasi milik anggota lain ditolak", foreign ? !(await updateProducerProduct(accC, mine.id, pv(varEdit([uv({ images: [{ mediaId: foreign, alt: "" }] })], { publicPrice: 200000 })))).ok : true);

  // variasi yang SUDAH dipesan dinonaktifkan, bukan dihapus (riwayat pesanan tidak yatim)
  const [usedInv] = await db.insert(s.invoices).values({ invoiceNumber: `${tag}-VAR`, sourceType: "cart", customerName: tag, subtotal: "10", total: "10", status: "pending" as never }).returning({ id: s.invoices.id });
  made.invoices.push(usedInv.id);
  const curVars = await db.select().from(s.productVariations).where(eq(s.productVariations.productId, mine.id));
  await db.insert(s.invoiceItems).values({ invoiceId: usedInv.id, itemType: "product", itemId: curVars[0].id, name: "x", quantity: 1, unitPrice: "10", total: "10" } as never);
  const r3b = await updateProducerProduct(accC, mine.id, pv(varEdit([uv({}, "M")], { publicPrice: 200000 })));   // variasi lama (S) tidak dikirim lagi
  const afterDrop = await db.select().from(s.productVariations).where(eq(s.productVariations.id, curVars[0].id));
  ok("variasi: yang sudah ada di pesanan DINONAKTIFKAN (tidak dihapus)", r3b.ok && afterDrop.length === 1 && afterDrop[0].isActive === false);

  // kembali ke produk sederhana → variasi dibersihkan
  const r4 = await updateProducerProduct(accC, mine.id, edit);
  ok("variasi: kembali ke produk sederhana membersihkan variasi (yang sudah dipesan hanya nonaktif)", r4.ok && (await db.select().from(s.productVariations).where(eq(s.productVariations.productId, mine.id))).every((v) => v.isActive === false) && (await db.select().from(s.products).where(eq(s.products.id, mine.id)))[0].attributeGroups === null);

  // admin mengubah persentase → harga dasar produk sederhana, induk bervariasi, dan variasi ber-harga-sendiri ikut dihitung ulang
  await updateProducerProduct(accC, mine.id, pv(varEdit([uv({ publicPrice: 150000 }), uv({}, "M")], { publicPrice: 200000 })));
  const nSync = await db.transaction((tx) => syncBaseCosts({ db: tx as never, schema: s }, pC, 20));
  const [sp] = await db.select().from(s.products).where(eq(s.products.id, mine.id));
  const svs = await db.select().from(s.productVariations).where(eq(s.productVariations.productId, mine.id));
  ok("sinkron persentase 20%: induk 160.000, variasi sendiri 120.000, variasi tanpa harga tetap null", nSync >= 1 && Number(sp.price) === 160000 && svs.some((v) => Number(v.price) === 120000) && svs.some((v) => v.price === null));
  ok("sinkron persentase: produk produsen LAIN tidak tersentuh", Number((await db.select().from(s.productVariations).where(eq(s.productVariations.id, otherV.id)))[0].price) === 5);
  await updateProducerProduct(accC, mine.id, edit);   // kembali sederhana untuk uji berikutnya

  // buat produk bervariasi langsung (produsen baru, slot cukup) + status bawaan draft
  const pV = await mkProducer("Variabel", mem.id, "20", 3);
  const accV = { tenant: { slug: SLUG }, producer: { id: pV } };
  const crv = await createProducerProduct(accV, pv({ productType: "variable", attributeGroups: GROUPS, variations: [uv({ publicPrice: 50000 }), uv({}, "M")], publicPrice: 80000 }));
  ok("variasi: buat produk bervariasi langsung sukses; status bawaan = draft", crv.ok);
  if (crv.ok) {
    made.products.push(crv.productId);
    const [row] = await db.select().from(s.products).where(eq(s.products.id, crv.productId));
    const vs = await db.select().from(s.productVariations).where(eq(s.productVariations.productId, crv.productId));
    ok("variasi: status draft, harga dasar induk 64.000 (80.000 @20%), variasi sendiri 40.000", row.status === "draft" && Number(row.price) === 64000 && vs.length === 2 && vs.some((v) => Number(v.price) === 40000) && vs.some((v) => v.price === null));
    ok("status: produsen menayangkan draft-nya sendiri via form (ubah status=active)", (await updateProducerProduct(accV, crv.productId, pv({ productType: "variable", attributeGroups: GROUPS, variations: vs.map((v) => uv({ id: v.id, publicPrice: v.publicPrice ? Number(v.publicPrice) : "", stock: v.stock }, (v.attributeCombo as Record<string, string>).Ukuran)), publicPrice: 80000, status: "active" }))).ok
      && (await db.select().from(s.products).where(eq(s.products.id, crv.productId)))[0].status === "active");
  }

  // gudang
  const [dest] = (await pdb.execute(sql`SELECT id FROM public.ro_destinations LIMIT 1`)) as unknown as Array<{ id: number }>;
  if (!dest) console.log("LEWATI uji gudang: public.ro_destinations kosong di DB lokal");
  else {
    const mkOrigin = async (producerId: string | null, label: string, isDefault = false) => {
      const [o] = await db.insert(s.shippingOrigins).values({ producerId, label: `${tag} ${label}`, detail: "Jl. Uji", destinationId: dest.id, isDefault }).returning({ id: s.shippingOrigins.id });
      made.origins.push(o.id); return o.id;
    };
    const o1 = await mkOrigin(pV, "G1", true), o2 = await mkOrigin(pV, "G2"), oOther = await mkOrigin(pC, "Asing");
    const withO = (originId: string | null) => pv({ originId, publicPrice: 80000 });
    ok("gudang: produsen >1 gudang & tidak memilih → ditolak dengan pesan", await (async () => { const r = await createProducerProduct(accV, withO(null)); return !r.ok && /gudang/i.test(r.error); })());
    ok("gudang: gudang milik produsen LAIN ditolak", !(await createProducerProduct(accV, withO(oOther))).ok);
    ok("gudang: id acak ditolak", !(await createProducerProduct(accV, withO(randomUUID()))).ok);
    const cro = await createProducerProduct(accV, withO(o2));
    ok("gudang: gudang milik sendiri diterima dan tersimpan", cro.ok && (cro.ok && (await db.select().from(s.products).where(eq(s.products.id, cro.productId)))[0].originId === o2));
    if (cro.ok) made.products.push(cro.productId);
    ok("gudang: produsen dengan SATU gudang boleh tanpa memilih", await (async () => { await db.update(s.products).set({ originId: null }).where(eq(s.products.originId, o2)); await db.delete(s.shippingOrigins).where(eq(s.shippingOrigins.id, o2)); made.origins = made.origins.filter((x) => x !== o2); void o1; const r = await createProducerProduct(accV, withO(null)); if (r.ok) made.products.push(r.productId); return r.ok; })());
  }

  // K30: produk beku tidak bisa dihapus produsen (hapus + buat ulang = melewati pembekuan)
  const [frz] = await db.insert(s.products).values({ slug: `${tag.toLowerCase()}-frz`, name: `${tag} Beku`, price: "1", publicPrice: "10", stock: 1, producerId: pC, status: "frozen" as never }).returning({ id: s.products.id });
  made.products.push(frz.id);
  ok("beku: produsen tidak bisa MENGHAPUS produk beku", await (async () => { const r = await deleteProducerProduct(accC, frz.id); return !r.ok && /dibekukan/i.test(r.error); })() && (await db.select().from(s.products).where(eq(s.products.id, frz.id))).length === 1);
  await db.delete(s.products).where(eq(s.products.id, frz.id)); made.products = made.products.filter((x) => x !== frz.id);   // jangan menggeser hitungan slot uji berikutnya

  // status
  ok("status: arsipkan", (await setProducerProductStatus(accC, mine.id, "archived")).ok && (await db.select().from(s.products).where(eq(s.products.id, mine.id)))[0].status === "archived");
  ok("status: arsip TETAP dihitung batas (K26)", (await countOwnedProducts(tc, pC)) === 3);   // mine + race + varP
  ok("status: aktifkan kembali tidak terhalang batas", (await setProducerProductStatus(accC, mine.id, "active")).ok);
  ok("status: produk produsen lain ditolak", !(await setProducerProductStatus(accC, b1, "archived")).ok && (await db.select().from(s.products).where(eq(s.products.id, b1)))[0].status === "draft");
  ok("status: produsen bisa menayangkan DRAFT miliknya sendiri (K32) dan mengembalikannya", await (async () => {
    const [d] = await db.insert(s.products).values({ slug: `${tag.toLowerCase()}-draft`, name: `${tag} Draft`, price: "1", publicPrice: "10", stock: 1, producerId: pC, status: "draft" as never }).returning({ id: s.products.id });
    made.products.push(d.id);
    const r1 = await setProducerProductStatus(accC, d.id, "active");
    const mid = (await db.select().from(s.products).where(eq(s.products.id, d.id)))[0].status;
    const r2 = await setProducerProductStatus(accC, d.id, "draft");
    const end = (await db.select().from(s.products).where(eq(s.products.id, d.id)))[0].status;
    await db.delete(s.products).where(eq(s.products.id, d.id)); made.products = made.products.filter((x) => x !== d.id);
    return r1.ok && mid === "active" && r2.ok && end === "draft";
  })());
  ok("status: klik ganda (sudah di status itu) idempoten", (await setProducerProductStatus(accC, mine.id, "active")).ok);
  ok("status: nilai di luar daftar (frozen/sembarang) ditolak", !(await setProducerProductStatus(accC, mine.id, "frozen" as never)).ok && !(await setProducerProductStatus(accC, mine.id, "x" as never)).ok);
  // K30: dibekukan admin — produsen tidak bisa membalikkan (aktif/arsip), tetap bisa mengubah isi; produk tidak tampil publik
  await db.update(s.products).set({ status: "frozen" }).where(eq(s.products.id, mine.id));
  ok("beku: produsen tidak bisa mengaktifkan", await (async () => { const r = await setProducerProductStatus(accC, mine.id, "active"); return !r.ok && /dibekukan/i.test(r.error); })());
  ok("beku: produsen tidak bisa mengarsipkan", !(await setProducerProductStatus(accC, mine.id, "archived")).ok);
  ok("beku: status tetap frozen", (await db.select().from(s.products).where(eq(s.products.id, mine.id)))[0].status === "frozen");
  ok("beku: ubah isi tetap boleh, status tidak ikut berubah", (await updateProducerProduct(accC, mine.id, edit)).ok && (await db.select().from(s.products).where(eq(s.products.id, mine.id)))[0].status === "frozen");
  ok("beku: tetap dihitung batas (K26)", (await countOwnedProducts(tc, pC)) === 3);
  ok("beku: tidak bisa dipesan (keranjang/checkout menolak)", (await resolveProductCartItem(db as never, s, mine.id))?.producerActive === false);
  await db.update(s.products).set({ status: "active" }).where(eq(s.products.id, mine.id));   // admin membuka pembekuan
  ok("beku: setelah dibuka, bisa dipesan lagi", (await resolveProductCartItem(db as never, s, mine.id))?.producerActive === true);
  ok("beku: setelah admin membuka, produsen bisa mengarsipkan lagi", (await setProducerProductStatus(accC, mine.id, "archived")).ok && (await setProducerProductStatus(accC, mine.id, "active")).ok);

  // hapus
  ok("hapus: produk lain ditolak & tetap ada", !(await deleteProducerProduct(accC, b1)).ok && (await db.select().from(s.products).where(eq(s.products.id, b1))).length === 1);
  ok("hapus: id bukan uuid ditolak", !(await deleteProducerProduct(accC, "' OR 1=1")).ok);
  await mkInvoice("paid", mine.id);
  ok("hapus: ada pesanan lunas → DITOLAK + pesan arsip", await (async () => { const r = await deleteProducerProduct(accC, mine.id); return !r.ok && /arsipkan/i.test(r.error); })());
  ok("hapus: produk tetap ada setelah ditolak", (await db.select().from(s.products).where(eq(s.products.id, mine.id))).length === 1);
  ok("hapus: pesanan belum bayar tidak menghalangi → terhapus", (await deleteProducerProduct(accC, varP.id)).ok && (await db.select().from(s.products).where(eq(s.products.id, varP.id))).length === 0);
  ok("hapus: slot dibebaskan (3→2)", (await countOwnedProducts(tc, pC)) === 2);
  ok("hapus: penuh (2/2) → buat baru ditolak", !(await createProducerProduct(accC, { ...edit, name: "Tak Muat Uji", images: [{ mediaId: m1, alt: "" }] })).ok);
  const [other2] = (await db.select({ id: s.products.id }).from(s.products).where(eq(s.products.producerId, pC))).filter((x) => x.id !== mine.id);
  ok("hapus: menghapus 1 produk membebaskan slot (2→1)", !!other2 && (await deleteProducerProduct(accC, other2.id)).ok && (await countOwnedProducts(tc, pC)) === 1);
  const slot = await createProducerProduct(accC, { ...edit, name: "Pengisi Slot Uji", images: [{ mediaId: m1, alt: "" }] });
  if (slot.ok) made.products.push(slot.productId);
  ok("hapus: slot bebas bisa dipakai membuat produk baru", slot.ok, slot.ok ? "" : slot.error);
} finally {
  const cleanup = async (label: string, fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { console.error("cleanup", label, e instanceof Error ? e.message : e); fails++; } };
  await cleanup("invoice_items", () => made.invoices.length ? db.delete(s.invoiceItems).where(inArray(s.invoiceItems.invoiceId, made.invoices)) : Promise.resolve());
  await cleanup("invoices", () => made.invoices.length ? db.delete(s.invoices).where(inArray(s.invoices.id, made.invoices)) : Promise.resolve());
  await cleanup("variations", () => made.products.length ? db.delete(s.productVariations).where(inArray(s.productVariations.productId, made.products)) : Promise.resolve());
  await cleanup("products", async () => {
    // Termasuk produk buatan createProducerProduct (nama tanpa penanda) → hapus juga menurut produsen uji, bukan hanya nama
    if (made.producers.length) await db.delete(s.productVariations).where(inArray(s.productVariations.productId, db.select({ id: s.products.id }).from(s.products).where(inArray(s.products.producerId, made.producers))));
    if (made.producers.length) await db.delete(s.products).where(inArray(s.products.producerId, made.producers));
    await db.delete(s.products).where(like(s.products.name, `${tag}%`));
  });
  await cleanup("origins", async () => { if (made.origins.length) await db.delete(s.shippingOrigins).where(inArray(s.shippingOrigins.id, made.origins)); if (made.producers.length) await db.delete(s.shippingOrigins).where(inArray(s.shippingOrigins.producerId, made.producers)); });
  await cleanup("producers", () => made.producers.length ? db.delete(s.producers).where(inArray(s.producers.id, made.producers)) : Promise.resolve());
  await cleanup("media", () => made.media.length ? pdb.delete(memberMedia).where(inArray(memberMedia.id, made.media)) : Promise.resolve());
}
console.log(fails ? `\n${fails} GAGAL` : "\nSEMUA LULUS");
process.exit(fails ? 1 : 0);
