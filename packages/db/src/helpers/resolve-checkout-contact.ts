import { eq, desc } from "drizzle-orm";
import type { PublicDb } from "../client";
import type { TenantDb } from "../tenant-client";
import { members, contacts, profiles, addresses, refProvinces, refRegencies, refDistricts, refVillages } from "../schema/public";

// ─── resolveCheckoutContact ─────────────────────────────────────────────────
// Auto-isi Nama/Email/Alamat Detail di checkout saat nomor HP cocok dengan data yang SUDAH ADA
// — murni kemudahan transaksi, BUKAN alur klaim keanggotaan (tidak menyentuh
// members.betterAuthUserId, tidak membuat akun). WAJIB dipanggil di belakang gate OTP (lihat
// docs/arsitektur-billing.md § 16) — jangan pernah expose hasil fungsi ini ke client tanpa
// verifikasi kepemilikan nomor terlebih dulu.
//
// 3 sumber, dicek berurutan, digabung PER FIELD (bukan all-or-nothing per sumber — kalau
// sumber prioritas tinggi tidak punya suatu field, field itu dicoba dari sumber berikutnya):
//   1. public.members  (anggota IKPM, lintas SEMUA tenant)
//   2. public.profiles (akun publik non-anggota, lintas SEMUA tenant)
//   3. invoices TENANT INI SAJA (riwayat tamu murni yang pernah checkout di toko ini —
//      TIDAK lintas-tenant, riwayat beli di toko lain kurang relevan buat alamat kirim toko
//      ini, dan scan lintas-tenant di tiap pengecekan nomor HP tidak scalable)
//
// Matching by `contacts.phone`/`profiles.phone` — SENGAJA sama persis kondisi yang dipakai
// resolveIdentity() (bukan tambah contacts.whatsapp) supaya "ketemu untuk auto-isi" dan
// "ke-link ke invoice" (resolveIdentity, sudah jalan sejak lama) selalu konsisten satu sama
// lain untuk nomor yang sama.

export type CheckoutContactMatch = {
  found:    boolean;
  name?:    string;
  email?:   string;
  address?: string;
};

// Diekspor (bukan cuma internal resolveCheckoutContact) — dipakai ulang oleh
// resolveProductBuyers() (apps/web/lib/product-buyers.server.ts) untuk fallback "Alamat
// Lengkap" di Daftar Pembeli/export produk saat invoice.shippingAddress kosong. Lihat
// docs/arsitektur-product.md § "Susulan — Alamat Lengkap + Kode Pos + Ongkos Kirim".
export async function composeAddress(publicDb: PublicDb, addressId: string): Promise<string | undefined> {
  const addr = await publicDb.query.addresses.findFirst({ where: eq(addresses.id, addressId) });
  if (!addr) return undefined;

  const [prov, reg, dist, vil] = await Promise.all([
    addr.provinceId ? publicDb.query.refProvinces.findFirst({ where: eq(refProvinces.id, addr.provinceId), columns: { name: true } }) : null,
    addr.regencyId  ? publicDb.query.refRegencies.findFirst({ where: eq(refRegencies.id, addr.regencyId),  columns: { name: true } }) : null,
    addr.districtId ? publicDb.query.refDistricts.findFirst({ where: eq(refDistricts.id, addr.districtId), columns: { name: true } }) : null,
    addr.villageId  ? publicDb.query.refVillages.findFirst({ where: eq(refVillages.id, addr.villageId),   columns: { name: true } }) : null,
  ]);

  // Urutan display: detail → desa → kec → kab → prov → kodepos (konsisten dengan pola tampilan
  // wilayah lain di project ini).
  const parts = [
    addr.detail,
    vil?.name,
    dist?.name,
    reg?.name,
    prov?.name,
    addr.postalCode,
  ].filter((p): p is string => !!p?.trim());

  return parts.length > 0 ? parts.join(", ") : undefined;
}

export async function resolveCheckoutContact(
  publicDb: PublicDb,
  tenantDb: TenantDb["db"],
  schema:   TenantDb["schema"],
  phone:    string,
): Promise<CheckoutContactMatch> {
  let name:    string | undefined;
  let email:   string | undefined;
  let address: string | undefined;

  // ── 1. public.members (lintas semua tenant) ─────────────────────────────────
  const memberRow = await publicDb
    .select({
      name:      members.name,
      email:     contacts.email,
      addressId: members.homeAddressId,
    })
    .from(members)
    .innerJoin(contacts, eq(contacts.id, members.contactId))
    .where(eq(contacts.phone, phone))
    .limit(1)
    .then((r) => r[0]);

  if (memberRow) {
    name  = name  ?? memberRow.name       ?? undefined;
    email = email ?? memberRow.email      ?? undefined;
    if (!address && memberRow.addressId) {
      address = await composeAddress(publicDb, memberRow.addressId);
    }
  }

  // ── 2. public.profiles (lintas semua tenant) ────────────────────────────────
  if (!name || !email || !address) {
    const profileRow = await publicDb.query.profiles.findFirst({
      where:   eq(profiles.phone, phone),
      columns: { name: true, email: true, addressDetail: true, deletedAt: true },
    });
    if (profileRow && !profileRow.deletedAt) {
      name    = name    ?? profileRow.name          ?? undefined;
      email   = email   ?? profileRow.email          ?? undefined;
      address = address ?? profileRow.addressDetail  ?? undefined;
    }
  }

  // ── 3. invoices tenant ini saja (riwayat tamu murni) ────────────────────────
  if (!name || !email || !address) {
    const invoiceRow = await tenantDb
      .select({
        name:    schema.invoices.customerName,
        email:   schema.invoices.customerEmail,
        address: schema.invoices.shippingAddress,
      })
      .from(schema.invoices)
      .where(eq(schema.invoices.customerPhone, phone))
      .orderBy(desc(schema.invoices.createdAt))
      .limit(1)
      .then((r) => r[0]);

    if (invoiceRow) {
      name    = name    ?? invoiceRow.name    ?? undefined;
      email   = email   ?? invoiceRow.email   ?? undefined;
      address = address ?? invoiceRow.address ?? undefined;
    }
  }

  return { found: !!(name || email || address), name, email, address };
}
