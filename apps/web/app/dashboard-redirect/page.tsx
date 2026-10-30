import { redirect } from "next/navigation";
import { getFirstTenantForUser, getCurrentSession } from "@/lib/tenant";
import { findProducerPortalSlug } from "@/lib/producer-access.server";

// Server component — tidak ada UI, hanya logic redirect
export default async function DashboardRedirectPage() {
  const session = await getCurrentSession();

  // Tidak ada session — kembali ke login admin
  if (!session?.user) {
    redirect("/app/login");
  }

  const slug = await getFirstTenantForUser();

  // User punya tenant — masuk dashboard
  if (slug) {
    redirect(`/app/${slug}/dashboard`);
  }

  // Bukan pengurus di tenant manapun → mungkin PRODUSEN (status pada akun, bukan baris tenant.users):
  // arahkan ke Portal Produsen hanya bila aksesnya benar-benar lolos (hindari loop). Pengurus yang
  // juga produsen tetap masuk dashboard admin di atas. Doc: docs/arsitektur-portal-produsen.md § 6.
  const producerSlug = await findProducerPortalSlug();
  if (producerSlug) {
    redirect(`/app/${producerSlug}/portal-produsen`);
  }

  // Sesi valid tapi tidak punya akses tenant.users di manapun — BUKAN kasus "pendaftaran
  // tenant belum lengkap" (pendaftaran tenant baru sudah dinonaktifkan permanen, lihat
  // REGISTRATION_OPEN=false di (auth)/register/page.tsx), jadi TIDAK diarahkan ke /register
  // lagi (pesan "Pendaftaran Ditutup" menyesatkan untuk kasus ini). Lihat komentar lengkap
  // di app/no-tenant-access/page.tsx soal kenapa halaman ini, bukan /app/login.
  redirect("/no-tenant-access");
}
