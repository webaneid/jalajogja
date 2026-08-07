import { redirect } from "next/navigation";
import { getTenantAccess } from "@/lib/tenant";
import { EkosistemNav } from "@/components/ekosistem/ekosistem-nav";

// Shell modul Ekosistem — menaungi SEMUA pengaturan form/direktori Usaha/Pesantren/Profesional
// (docs/arsitektur-ekosistem.md § 7). Akses HANYA `getTenantAccess()` (pola sama /settings/*,
// BUKAN sistem 10-modul `hasReadAccess()` seperti Toko/Event/Surat) — modul ini pada dasarnya
// bersifat KONFIGURASI, bukan modul operasional CRUD. Keputusan sengaja: menambah "ekosistem"
// sebagai modul ke-11 di `lib/permissions.ts` akan memaksa update SYSTEM_PERMISSIONS untuk 4
// role sistem SEKALIGUS diam-diam mengunci akses semua custom role existing (JSONB permission
// tidak punya key ini) sampai admin manual meng-grant — jauh lebih berat dari yang dibutuhkan
// untuk halaman pengaturan.
export default async function EkosistemLayout({
  params,
  children,
}: {
  params: Promise<{ tenant: string }>;
  children: React.ReactNode;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  return (
    <div className="flex h-full">
      <EkosistemNav slug={slug} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
