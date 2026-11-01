// Buku alamat per orang — penyimpanan (CRUD) terikat PEMILIK. Pemilik berasal dari sesi (resolveAddressOwner di address-book.server.ts), TIDAK pernah dari input;
// setiap query menyertakan kolom pemilik (anti-IDOR). Doc: docs/arsitektur-alamat.md § 16.
import "server-only";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db, addressBook, roDestinations } from "@jalajogja/db";
import { MAX_ADDRESSES_PER_OWNER, type AddressDTO, type ParsedAddressInput } from "@/lib/address-book";

export type AddressOwner = { kind: "member" | "profile"; id: string };

const ownerCol = (o: AddressOwner) => (o.kind === "member" ? addressBook.memberId : addressBook.profileId);
const ownerEq = (o: AddressOwner) => eq(ownerCol(o), o.id);

const selectDto = () => db.select({
  id: addressBook.id, label: addressBook.label, recipientName: addressBook.recipientName, phone: addressBook.phone,
  detail: addressBook.detail, isDefault: addressBook.isDefault,
  dId: roDestinations.id, dLabel: roDestinations.label, dCity: roDestinations.cityName, dDistrict: roDestinations.districtName,
  dSub: roDestinations.subdistrictName, dProv: roDestinations.provinceName, dZip: roDestinations.zipCode,
}).from(addressBook).innerJoin(roDestinations, eq(roDestinations.id, addressBook.destinationId));

type Row = Awaited<ReturnType<ReturnType<typeof selectDto>["limit"]>>[number];
const toDto = (r: Row): AddressDTO => ({
  id: r.id, label: r.label, recipientName: r.recipientName, phone: r.phone, detail: r.detail, isDefault: r.isDefault,
  destination: { id: r.dId, label: r.dLabel, cityName: r.dCity, districtName: r.dDistrict, subdistrictName: r.dSub, provinceName: r.dProv, zipCode: r.dZip },
});

export async function listAddresses(owner: AddressOwner): Promise<AddressDTO[]> {
  const rows = await selectDto().where(ownerEq(owner)).orderBy(desc(addressBook.isDefault), desc(addressBook.createdAt));
  return rows.map(toDto);
}

export type AddressResult = { ok: true; addresses: AddressDTO[] } | { ok: false; error: string };

export async function saveAddress(owner: AddressOwner, input: ParsedAddressInput): Promise<AddressResult> {
  // Tujuan harus ADA di tabel lokal (hasil pencarian kita) — nol panggilan API
  const [dest] = await db.select({ id: roDestinations.id }).from(roDestinations).where(eq(roDestinations.id, input.destinationId)).limit(1);
  if (!dest) return { ok: false, error: "Lokasi tidak ditemukan. Cari dan pilih ulang lokasi dari daftar." };

  const error = await db.transaction(async (tx): Promise<string | null> => {
    // Kunci baris pemilik agar penghitungan batas & pergantian "utama" tidak berlomba (dua tab bersamaan)
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"address_book:" + owner.id}))`);
    const existing = await tx.select({ id: addressBook.id, isDefault: addressBook.isDefault }).from(addressBook).where(ownerEq(owner));

    if (input.id) {
      if (!existing.some((e) => e.id === input.id)) return "Alamat tidak ditemukan.";
    } else if (existing.length >= MAX_ADDRESSES_PER_OWNER) {
      return `Maksimal ${MAX_ADDRESSES_PER_OWNER} alamat. Hapus salah satu dulu.`;
    }

    // Alamat pertama otomatis utama; alamat utama yang sedang diubah tidak boleh "dicabut" lewat form (ganti lewat Jadikan Utama)
    const wasDefault = !!input.id && existing.find((e) => e.id === input.id)?.isDefault === true;
    const makeDefault = input.isDefault || existing.length === 0 || wasDefault;
    if (makeDefault) await tx.update(addressBook).set({ isDefault: false }).where(and(ownerEq(owner), input.id ? ne(addressBook.id, input.id) : undefined));

    const values = {
      label: input.label, recipientName: input.recipientName, phone: input.phone,
      destinationId: input.destinationId, detail: input.detail, isDefault: makeDefault,
    };
    if (input.id) {
      await tx.update(addressBook).set({ ...values, updatedAt: new Date() }).where(and(eq(addressBook.id, input.id), ownerEq(owner)));
    } else {
      await tx.insert(addressBook).values({ ...values, ...(owner.kind === "member" ? { memberId: owner.id } : { profileId: owner.id }) });
    }
    return null;
  });
  if (error) return { ok: false, error };
  return { ok: true, addresses: await listAddresses(owner) };
}

export async function deleteAddress(owner: AddressOwner, id: string): Promise<AddressResult> {
  const error = await db.transaction(async (tx): Promise<string | null> => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"address_book:" + owner.id}))`);
    const deleted = await tx.delete(addressBook).where(and(eq(addressBook.id, id), ownerEq(owner))).returning({ wasDefault: addressBook.isDefault });
    if (deleted.length === 0) return "Alamat tidak ditemukan.";
    if (deleted[0].wasDefault) {
      // Yang utama dihapus → alamat terbaru berikutnya jadi utama
      const [next] = await tx.select({ id: addressBook.id }).from(addressBook).where(ownerEq(owner)).orderBy(desc(addressBook.createdAt)).limit(1);
      if (next) await tx.update(addressBook).set({ isDefault: true }).where(and(eq(addressBook.id, next.id), ownerEq(owner)));
    }
    return null;
  });
  if (error) return { ok: false, error };
  return { ok: true, addresses: await listAddresses(owner) };
}

export async function setDefaultAddress(owner: AddressOwner, id: string): Promise<AddressResult> {
  const error = await db.transaction(async (tx): Promise<string | null> => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"address_book:" + owner.id}))`);
    const [target] = await tx.select({ id: addressBook.id }).from(addressBook).where(and(eq(addressBook.id, id), ownerEq(owner))).limit(1);
    if (!target) return "Alamat tidak ditemukan.";
    await tx.update(addressBook).set({ isDefault: false }).where(ownerEq(owner));
    await tx.update(addressBook).set({ isDefault: true, updatedAt: new Date() }).where(and(eq(addressBook.id, id), ownerEq(owner)));
    return null;
  });
  if (error) return { ok: false, error };
  return { ok: true, addresses: await listAddresses(owner) };
}
