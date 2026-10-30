import { redirect } from "next/navigation";
import { getCurrentSession, getTenantAccess } from "@/lib/tenant";
import { getProducerAccess } from "@/lib/producer-access.server";
import { listUserContexts } from "@/lib/user-contexts.server";
import { isActiveTenant } from "@/lib/tenant-active";

// Server component — tidak ada UI, hanya logic redirect. Doc: docs/arsitektur-portal-produsen.md § 16.
//   ?tenant=<slug>  → tujuan eksplisit: pengurus di tenant itu → dashboard; produsen di tenant itu → portal.
//                     Tidak punya akses di sana → jatuh ke logika umum (JANGAN diam-diam menganggap berhasil).
//   tanpa tujuan    → 0 konteks: /no-tenant-access · 1 konteks: langsung masuk · >1: halaman "Pilih tujuan"
//                     (sebelumnya memilih satu tenant secara tidak deterministik).
// Tidak ada loop: setiap tujuan redirect di sini sudah terverifikasi lolos guard halaman tujuannya.
export default async function DashboardRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const session = await getCurrentSession();

  // Tidak ada session — kembali ke login admin
  if (!session?.user) {
    redirect("/app/login");
  }

  const { tenant: wanted } = await searchParams;
  let denied: string | null = null;
  if (wanted && /^[a-z0-9-]{3,20}$/.test(wanted) && (await isActiveTenant(wanted))) {
    if (await getTenantAccess(wanted))   redirect(`/app/${wanted}/dashboard`);
    if (await getProducerAccess(wanted)) redirect(`/app/${wanted}/portal-produsen`);
    denied = wanted;
  }

  const contexts = await listUserContexts();

  if (contexts.length === 1 && !denied) redirect(contexts[0].href);
  if (contexts.length >= 1) redirect(denied ? `/pilih-tujuan?ditolak=${encodeURIComponent(denied)}` : "/pilih-tujuan");

  // Sesi valid tapi tidak punya akses (pengurus maupun produsen) di manapun — BUKAN kasus "pendaftaran
  // tenant belum lengkap" (pendaftaran tenant baru sudah dinonaktifkan permanen, lihat
  // REGISTRATION_OPEN=false di (auth)/register/page.tsx), jadi TIDAK diarahkan ke /register
  // lagi. Lihat komentar lengkap di app/no-tenant-access/page.tsx soal kenapa halaman ini, bukan /app/login.
  redirect("/no-tenant-access");
}
