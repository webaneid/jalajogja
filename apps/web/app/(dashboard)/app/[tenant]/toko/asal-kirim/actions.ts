"use server";

// Aksi Asal Kirim ADMIN: kelola asal kirim toko (producerId null) dan atas nama produsen mana pun di tenant ini.
// Otorisasi: getTenantAccess + hasFullAccess(toko). producerId dari input hanya diterima bila produsen itu ADA di schema tenant sendiri.
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { parseOriginInput, type OriginDTO } from "@/lib/shipping-origins";
import { isUuid } from "@/lib/address-book";
import { saveOrigin, deleteOrigin, setDefaultOrigin, listOrigins, type OriginScope } from "@/lib/shipping-origins.server";
import { loadRajaOngkirConfig } from "@/lib/shipping-groups.server";

type OriginsResult = { success: true; origins: OriginDTO[] } | { success: false; error: string };

async function guard(slug: string, producerId: string | null): Promise<{ ok: true; tc: ReturnType<typeof createTenantDb>; scope: OriginScope } | { ok: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access || !hasFullAccess(access.tenantUser, "toko")) return { ok: false, error: "Akses ditolak." };
  const tc = createTenantDb(slug);
  if (producerId !== null) {
    if (!isUuid(producerId)) return { ok: false, error: "Produsen tidak ditemukan." };
    const [p] = await tc.db.select({ id: tc.schema.producers.id }).from(tc.schema.producers).where(eq(tc.schema.producers.id, producerId)).limit(1);
    if (!p) return { ok: false, error: "Produsen tidak ditemukan." };
  }
  return { ok: true, tc, scope: { producerId } };
}
const refresh = (slug: string) => { revalidatePath(`/app/${slug}/toko/asal-kirim`); revalidatePath(`/app/${slug}/toko/produk`); };

export async function adminSaveOriginAction(slug: string, producerId: string | null, input: unknown): Promise<OriginsResult> {
  const g = await guard(slug, producerId);
  if (!g.ok) return { success: false, error: g.error };
  const parsed = parseOriginInput(input);
  if (!parsed.ok) return { success: false, error: parsed.error };
  try {
    const r = await saveOrigin(g.tc, g.scope, parsed.value);
    if (r.ok) refresh(slug);
    return r.ok ? { success: true, origins: r.origins } : { success: false, error: r.error };
  } catch (e) { console.error("[adminSaveOriginAction]", e); return { success: false, error: "Gagal menyimpan asal kirim." }; }
}

export async function adminDeleteOriginAction(slug: string, producerId: string | null, id: string): Promise<OriginsResult> {
  const g = await guard(slug, producerId);
  if (!g.ok) return { success: false, error: g.error };
  if (!isUuid(id)) return { success: false, error: "Asal kirim tidak ditemukan." };
  try {
    // Asal toko TERAKHIR tidak boleh dihapus selama ongkir RajaOngkir aktif: produk toko tanpa asal tak punya paket pengiriman
    // → ongkirnya hilang diam-diam. Ganti dengan asal lain dulu.
    if (producerId === null) {
      const mine = await listOrigins(g.tc, g.scope);
      if (mine.length === 1 && mine[0].id === id && (await loadRajaOngkirConfig(slug))?.couriers?.length) {
        return { success: false, error: "Ini satu-satunya asal kirim toko dan ongkir RajaOngkir sedang aktif. Tambahkan asal kirim lain dulu sebelum menghapusnya." };
      }
    }
    const r = await deleteOrigin(g.tc, g.scope, id);
    if (r.ok) refresh(slug);
    return r.ok ? { success: true, origins: r.origins } : { success: false, error: r.error };
  } catch (e) { console.error("[adminDeleteOriginAction]", e); return { success: false, error: "Gagal menghapus asal kirim." }; }
}

export async function adminSetDefaultOriginAction(slug: string, producerId: string | null, id: string): Promise<OriginsResult> {
  const g = await guard(slug, producerId);
  if (!g.ok) return { success: false, error: g.error };
  if (!isUuid(id)) return { success: false, error: "Asal kirim tidak ditemukan." };
  try {
    const r = await setDefaultOrigin(g.tc, g.scope, id);
    if (r.ok) refresh(slug);
    return r.ok ? { success: true, origins: r.origins } : { success: false, error: r.error };
  } catch (e) { console.error("[adminSetDefaultOriginAction]", e); return { success: false, error: "Gagal mengubah asal kirim utama." }; }
}
