import { Users, Globe, FileText, Wallet } from "lucide-react";
import { getTenantAccess } from "@/lib/tenant";

export default async function TenantDashboardPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);

  const stats = [
    { label: "Anggota",   icon: Users,    value: "—", href: `/${slug}/members`  },
    { label: "Halaman",   icon: Globe,    value: "—", href: `/${slug}/website`  },
    { label: "Surat",     icon: FileText, value: "—", href: `/${slug}/letters`  },
    { label: "Keuangan",  icon: Wallet,   value: "—", href: `/${slug}/finance`  },
  ];

  return (
    <div className="p-6">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{access!.tenant.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Selamat datang di dashboard organisasi Anda.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map(({ label, icon: Icon, value }) => (
          <div key={label} className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-bold">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder konten */}
      <div className="mt-8 rounded-xl border border-dashed bg-muted/30 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Pilih modul dari menu sidebar untuk mulai bekerja.
        </p>
      </div>
    </div>
  );
}
