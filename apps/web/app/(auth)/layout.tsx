import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/tenant";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();

  // Hard redirect jika sudah login — jangan tampilkan form login/register
  if (session?.user) {
    redirect("/dashboard-redirect");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <div className="w-full max-w-md px-4">
        {children}
      </div>
    </div>
  );
}
