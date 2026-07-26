import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/tenant";
import { SignOutButton } from "./sign-out-button";

// Tujuan redirect BARU dari /dashboard-redirect (menggantikan /register?error=no-tenant) —
// khusus untuk sesi yang VALID tapi tidak punya akses tenant.users di manapun. SENGAJA route
// TERPISAH dari /app/login, bukan /app/login?error=... — middleware punya aturan "kalau masih
// ada session cookie dan buka /app/login → redirect balik ke /dashboard-redirect" (mencegah
// user yang sudah login melihat form login lagi). Kalau /dashboard-redirect mengarah balik ke
// /app/login untuk kasus ini, terjadi LOOP TAK HENTI (dashboard-redirect → app/login →
// dashboard-redirect → ...). Halaman ini di luar path /app/* sehingga tidak kena aturan itu.
export default async function NoTenantAccessPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/app/login");

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm text-center space-y-4">
        <h1 className="text-xl font-bold">Tidak Ada Akses Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Akun <span className="font-medium text-foreground">{session.user.email}</span> belum
          terdaftar sebagai pengurus di tenant mana pun. Hubungi admin platform atau owner
          tenant Anda untuk ditambahkan sebagai pengurus, atau masuk dengan akun lain.
        </p>
        <SignOutButton />
      </div>
    </div>
  );
}
