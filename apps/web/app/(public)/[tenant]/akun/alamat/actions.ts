"use server";

// Aksi tulis buku alamat. Pemilik SELALU dari sesi (resolveAddressOwner) — tidak pernah dari input. Doc: docs/arsitektur-alamat.md § 16.
import { checkRateLimit } from "@/lib/rate-limit";
import { parseAddressInput, isUuid, type AddressDTO } from "@/lib/address-book";
import { resolveAddressOwner, saveAddress, deleteAddress, setDefaultAddress } from "@/lib/address-book.server";

type Result = { success: true; addresses: AddressDTO[]; savedId?: string } | { success: false; error: string };

async function guard() {
  const owner = await resolveAddressOwner();
  if (!owner) return { owner: null, error: "Anda harus login terlebih dahulu." } as const;
  // Pembatas laju per pengguna (bukan per IP): 40 perubahan / 10 menit
  if (!checkRateLimit(`address-book:${owner.id}`, 40, 10 * 60_000).allowed) {
    return { owner: null, error: "Terlalu banyak perubahan. Coba lagi beberapa menit lagi." } as const;
  }
  return { owner, error: null } as const;
}

export async function saveAddressAction(_slug: string, input: unknown): Promise<Result> {
  const g = await guard();
  if (!g.owner) return { success: false, error: g.error };
  const parsed = parseAddressInput(input);
  if (!parsed.ok) return { success: false, error: parsed.error };
  try {
    const r = await saveAddress(g.owner, parsed.value);
    return r.ok ? { success: true, addresses: r.addresses, savedId: r.savedId } : { success: false, error: r.error };
  } catch (e) {
    console.error("[saveAddressAction]", e);
    return { success: false, error: "Gagal menyimpan alamat." };
  }
}

export async function deleteAddressAction(_slug: string, id: string): Promise<Result> {
  const g = await guard();
  if (!g.owner) return { success: false, error: g.error };
  if (!isUuid(id)) return { success: false, error: "Alamat tidak ditemukan." };
  try {
    const r = await deleteAddress(g.owner, id);
    return r.ok ? { success: true, addresses: r.addresses } : { success: false, error: r.error };
  } catch (e) {
    console.error("[deleteAddressAction]", e);
    return { success: false, error: "Gagal menghapus alamat." };
  }
}

export async function setDefaultAddressAction(_slug: string, id: string): Promise<Result> {
  const g = await guard();
  if (!g.owner) return { success: false, error: g.error };
  if (!isUuid(id)) return { success: false, error: "Alamat tidak ditemukan." };
  try {
    const r = await setDefaultAddress(g.owner, id);
    return r.ok ? { success: true, addresses: r.addresses } : { success: false, error: r.error };
  } catch (e) {
    console.error("[setDefaultAddressAction]", e);
    return { success: false, error: "Gagal mengubah alamat utama." };
  }
}
