// Buku alamat — alamat kirim tersimpan per orang (anggota ATAU akun publik), dipakai saat checkout. Doc: docs/arsitektur-alamat.md § 16.
import { redirect } from "next/navigation";
import { resolveBaseUrl } from "@/lib/resolve-base-url";
import { resolveAddressOwnerState, listAddresses } from "@/lib/address-book.server";
import { AlamatClient } from "./alamat-client";

export default async function AlamatPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const baseUrl = await resolveBaseUrl(slug);

  // Layout & page dirender paralel — guard layout tidak melindungi page, jadi periksa sesi di sini juga
  const { authenticated, owner } = await resolveAddressOwnerState();
  if (!authenticated) redirect(`${baseUrl}/login?redirect=${baseUrl}/akun/alamat`);
  // Sudah login tapi tanpa identitas anggota/akun publik: JANGAN ke login (halaman login akan memantulkan balik = loop); layout /akun
  // menangani kasus ini (menautkan pengurus atau menampilkan halaman galat).
  if (!owner) redirect(`${baseUrl}/akun`);

  const addresses = await listAddresses(owner);
  return <AlamatClient slug={slug} initial={addresses} />;
}
