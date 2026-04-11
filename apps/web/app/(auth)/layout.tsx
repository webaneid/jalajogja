import { redirect } from "next/navigation";
import { getCurrentSession, getFirstTenantForUser } from "@/lib/tenant";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();

  // Jika sudah login, cek apakah sudah punya tenant
  // Jika punya → langsung ke dashboard (tidak perlu lihat form auth)
  // Jika belum punya → biarkan akses /register untuk melengkapi pendaftaran
  if (session?.user) {
    const slug = await getFirstTenantForUser();
    if (slug) {
      redirect(`/${slug}/dashboard`);
    }
    // Belum punya tenant → lanjut render (tampilkan /register)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="w-full max-w-md px-4">
        {children}
      </div>
    </div>
  );
}
