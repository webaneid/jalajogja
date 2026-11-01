// Pemilik buku alamat dari SESI + re-ekspor penyimpanan. Pemilik TIDAK pernah dari input. Doc: docs/arsitektur-alamat.md § 16.
import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getAkunIdentity } from "@/lib/akun-identity";
import type { AddressOwner } from "@/lib/address-book-store.server";

export * from "@/lib/address-book-store.server";

export type AddressOwnerState = { authenticated: boolean; owner: AddressOwner | null };

/**
 * Pemilik buku alamat dari SESI login. Membedakan "belum login" (arahkan ke login) dari "sudah login tapi tak punya identitas
 * anggota/akun publik" (mis. pengurus murni) — dua keadaan itu TIDAK boleh sama, kalau tidak halaman login mengembalikan ke halaman ini (loop).
 */
export async function resolveAddressOwnerState(): Promise<AddressOwnerState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { authenticated: false, owner: null };
  const identity = await getAkunIdentity(session.user.id);
  if (identity?.type === "member" && identity.memberId) return { authenticated: true, owner: { kind: "member", id: identity.memberId } };
  if (identity?.type === "public" && identity.profileId) return { authenticated: true, owner: { kind: "profile", id: identity.profileId } };
  return { authenticated: true, owner: null };
}

export async function resolveAddressOwner(): Promise<AddressOwner | null> {
  return (await resolveAddressOwnerState()).owner;
}
