// Verifikasi ongkir di server — klien hanya memilih "kurir X layanan Y" + kota tujuan; SEMUA angka (berat, asal, harga, etd,
// diskon gratis-ongkir, nama tujuan) diturunkan server dan MENIMPA nilai klien. Dipanggil SEBELUM transaksi DB
// (panggilan jaringan tidak boleh di dalam transaksi). Doc: docs/arsitektur-portal-produsen.md § 26.
import "server-only";
import type { CheckoutShippingLine, SellerGroup } from "@/app/(public)/[tenant]/cart/actions";
import type { TokoSettings } from "@/lib/toko-settings";
import { buildSellerGroups, loadRajaOngkirConfig, type ShippingCartItem } from "@/lib/shipping-groups.server";
import { fetchDomesticCost, RajaOngkirError } from "@/lib/rajaongkir.server";
import { resolveDestination } from "@/lib/ro-destinations.server";
import { freeShippingRatio, applyFreeShipping } from "@/lib/free-shipping-match";
import { RAJAONGKIR_COURIER_CODES } from "@/lib/rajaongkir-couriers";

const MISMATCH = "Data pengiriman tidak sesuai isi keranjang. Muat ulang halaman checkout lalu coba lagi.";
const UNVERIFIABLE = "Ongkir tidak bisa diverifikasi saat ini. Silakan coba lagi sebentar lagi.";

const prefixOf = (g: { sellerType: string; sellerId?: string | null; producerId?: string | null }) =>
  `${g.sellerType}:${g.sellerId ?? "tenant"}:${g.producerId ?? "-"}`;

/** Sidik jari isi keranjang (id+qty terurut) — untuk memastikan keranjang tidak berubah antara verifikasi dan transaksi. */
export function cartFingerprint(items: { itemId: string | null; quantity: number }[]): string {
  return items.map((i) => `${i.itemId ?? ""}:${i.quantity}`).sort().join("|");
}

/** Baris ambil-sendiri: biaya 0 + identitas (jenis/id penjual, produsen, nama) dari kelompok server. */
function pickupLine(l: CheckoutShippingLine, leftByPrefix: Map<string, SellerGroup[]>): CheckoutShippingLine {
  const gs = leftByPrefix.get(prefixOf(l)) ?? [];
  const g = gs[0];
  // Lokasi ambil-sendiri dari server hanya bila SEMUA kelompok sisa prefix ini punya lokasi yang sama (tak ambigu); selain itu tetap kiriman klien
  const same = g && gs.every((x) => x.pickupLocationName === g.pickupLocationName && x.pickupAddress === g.pickupAddress && x.pickupMapsUrl === g.pickupMapsUrl);
  return {
    ...l, cost: 0, freeShippingDiscount: undefined,
    ...(g ? { sellerType: g.sellerType, sellerId: g.sellerId, producerId: g.producerId, sellerName: g.sellerName } : {}),
    ...(same ? { pickupLocationName: g.pickupLocationName ?? undefined, pickupAddress: g.pickupAddress ?? undefined, pickupMapsUrl: g.pickupMapsUrl ?? undefined } : {}),
  };
}

export type VerifyShippingResult =
  | { ok: true; cityName: string; lines: CheckoutShippingLine[] }
  | { ok: false; error: string };

export async function verifyShippingLines(a: {
  slug: string;
  tenantName: string;
  lines: CheckoutShippingLine[];
  cityId: number;
  /** Label tujuan dari klien — hanya petunjuk pencarian; nama otoritatif dari RajaOngkir. */
  cityHint: string;
  items: ShippingCartItem[];
  tokoSettings: TokoSettings;
  /**
   * true (checkout publik): keranjang berisi barang fisik berbobot dan ongkir aktif → baris pengiriman WAJIB ada untuk tiap kelompok.
   * Tanpa ini pembeli bisa memanggil aksi tanpa `shipping` dan membayar ongkir Rp0. false (pesanan manual admin): tanpa baris = admin
   * sengaja tidak menagih ongkir; verifikasi hanya berjalan bila baris dikirim.
   */
  requireLines: boolean;
}): Promise<VerifyShippingResult> {
  const { lines } = a;
  if (lines.length === 0 && !a.requireLines) return { ok: true, cityName: a.cityHint, lines };

  // Sama dengan halaman checkout: kelompok pengiriman hanya ada bila add-on aktif DAN punya daftar kurir
  const config = await loadRajaOngkirConfig(a.slug);
  const groups = config?.couriers?.length
    ? await buildSellerGroups({ slug: a.slug, tenantName: a.tenantName, cartItems: a.items, tokoSettings: a.tokoSettings, config })
    : [];
  if (groups.length === 0) return lines.length === 0 ? { ok: true, cityName: a.cityHint, lines } : { ok: false, error: MISMATCH };
  if (lines.length === 0) return { ok: false, error: MISMATCH }; // ada barang yang harus dikirim, tapi tak ada pilihan pengiriman

  // ── Cocokkan baris klien ↔ kelompok server (tiap kelompok tepat satu baris) ────────────────────────────────
  const byKey = new Map(groups.map((g) => [g.key, g]));
  const unused = new Map<string, SellerGroup[]>(); // prefix → kelompok yang belum terpakai
  for (const g of groups) unused.set(prefixOf(g), [...(unused.get(prefixOf(g)) ?? []), g]);
  const takeGroup = (g: SellerGroup) => unused.set(prefixOf(g), (unused.get(prefixOf(g)) ?? []).filter((x) => x !== g));

  const courierPairs: { line: CheckoutShippingLine; group: SellerGroup }[] = [];
  const pickupLines: CheckoutShippingLine[] = [];
  for (const line of lines) {
    // "tenant" / "-" hanyalah penanda internal untuk null di kunci kelompok — jangan pernah diterima sebagai id dari klien
    if (line.sellerId === "tenant" || line.producerId === "-") return { ok: false, error: MISMATCH };
    if (line.deliveryMethod === "pickup") { pickupLines.push(line); continue; }
    const g = byKey.get(`${prefixOf(line)}:${line.originCityId}`);
    if (!g || !(unused.get(prefixOf(g)) ?? []).includes(g)) return { ok: false, error: MISMATCH }; // tak dikenal / ganda
    takeGroup(g);
    courierPairs.push({ line, group: g });
  }
  // Sisa kelompok per prefix, dibekukan SEBELUM pengurangan — dipakai menormalisasi identitas baris ambil-sendiri
  const leftByPrefix = new Map([...unused].map(([k, v]) => [k, [...v]]));
  // Baris ambil-sendiri tidak membawa kota asal → cocokkan per prefix: jumlahnya harus sama dengan sisa kelompok, dan ambil-sendiri harus aktif
  const pickupByPrefix = new Map<string, number>();
  for (const l of pickupLines) pickupByPrefix.set(prefixOf(l), (pickupByPrefix.get(prefixOf(l)) ?? 0) + 1);
  for (const [prefix, left] of unused) {
    if ((pickupByPrefix.get(prefix) ?? 0) !== left.length) return { ok: false, error: MISMATCH }; // kelompok terbuang / baris berlebih
    if ((pickupByPrefix.get(prefix) ?? 0) > 0 && !left.every((g) => g.pickupEnabled)) return { ok: false, error: MISMATCH };
  }
  for (const prefix of pickupByPrefix.keys()) if (!unused.has(prefix)) return { ok: false, error: MISMATCH };

  if (courierPairs.length === 0) return { ok: true, cityName: a.cityHint.slice(0, 200), lines: lines.map((l) => pickupLine(l, leftByPrefix)) };

  // Kode kurir harus satu kode valid (tanpa ":" / daftar) SEBELUM menyentuh upstream
  if (courierPairs.some(({ line }) => !line.courier || !RAJAONGKIR_COURIER_CODES.includes(line.courier) || !line.service)) {
    return { ok: false, error: MISMATCH };
  }

  // ── Tujuan otoritatif ─────────────────────────────────────────────────────────────────────────────────────
  if (!Number.isInteger(a.cityId) || a.cityId <= 0) return { ok: false, error: "Pilih kota tujuan pengiriman." };
  let dest;
  try { dest = await resolveDestination(a.cityId, a.cityHint.slice(0, 100)); }
  catch (e) { if (e instanceof RajaOngkirError) return { ok: false, error: UNVERIFIABLE }; throw e; }
  if (!dest) return { ok: false, error: "Kota tujuan tidak valid. Pilih ulang kota tujuan." };

  // ── Hitung ulang tiap kelompok kurir (paralel) ───────────────────────────────────────────────────────────
  let verified: Map<CheckoutShippingLine, CheckoutShippingLine>;
  try {
    const results = await Promise.all(courierPairs.map(async ({ line, group }) => {
      if (!line.courier || !line.service) throw new RajaOngkirError(MISMATCH, 400);
      const options = await fetchDomesticCost({ origin: group.originCityId, destination: dest.id, weight: group.totalWeightGram, courier: line.courier, budget: "costverify" });
      const opt = options.find((o) => o.code === line.courier && o.service === line.service);
      if (!opt) throw new RajaOngkirError("Layanan pengiriman yang dipilih tidak tersedia. Pilih ulang kurir.", 400);
      const { cost, discount } = applyFreeShipping(opt.cost, freeShippingRatio(group, dest));
      const out: CheckoutShippingLine = {
        ...line,
        // Identitas baris dari kelompok server (bukan kiriman klien)
        sellerType: group.sellerType,
        sellerId: group.sellerId,
        producerId: group.producerId,
        sellerName: group.sellerName,
        originCityId: group.originCityId,
        originCityName: group.originCityName,
        courier: opt.code,
        service: opt.service,
        serviceDesc: opt.description,
        etd: opt.etd || "—",
        weightGram: group.totalWeightGram,
        cost,
        freeShippingDiscount: discount > 0 ? discount : undefined,
      };
      return [line, out] as const;
    }));
    verified = new Map(results);
  } catch (e) {
    if (e instanceof RajaOngkirError) return { ok: false, error: e.status >= 500 || e.status === 502 ? UNVERIFIABLE : e.message };
    throw e;
  }

  // Baris ambil-sendiri: biaya selalu 0 (server menimpa)
  return {
    ok: true,
    cityName: dest.label,
    lines: lines.map((l) => verified.get(l) ?? pickupLine(l, leftByPrefix)),
  };
}
