import { redirect }  from "next/navigation";
import { headers }   from "next/headers";
import { createHash } from "crypto";
import { auth }       from "@/lib/auth";
import { getAkunIdentity } from "@/lib/akun-identity";
import { AkunNav }    from "@/components/akun/akun-nav";
import { BadgeCheck } from "lucide-react";

type Props = {
  children: React.ReactNode;
  params:   Promise<{ tenant: string }>;
};

function gravatar(email: string) {
  const hash = createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?s=80&d=mp`;
}

export default async function AkunLayout({ children, params }: Props) {
  const { tenant: slug } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect(`/${slug}/login?redirect=/${slug}/akun`);

  const identity = await getAkunIdentity(session.user.id);
  if (!identity) redirect(`/app/${slug}/dashboard`);

  const isMember    = identity.type === "member";
  const displayEmail = identity.email || session.user.email;
  const avatarUrl    = identity.photoUrl ?? gravatar(displayEmail);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex gap-8 items-start">

        {/* ── Sidebar ── */}
        <aside className="hidden md:flex flex-col w-56 shrink-0 gap-4 sticky top-6">
          {/* Avatar + nama */}
          <div className="flex flex-col items-center gap-2 px-2 py-4 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt={identity.name}
              width={56}
              height={56}
              className="w-14 h-14 rounded-full ring-2 ring-border object-cover"
            />
            <div className="min-w-0 w-full">
              <p className="font-semibold text-sm truncate">{identity.name}</p>
              <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
            </div>
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
              isMember
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}>
              {isMember && <BadgeCheck className="h-3 w-3" />}
              {isMember ? "Anggota IKPM" : "Akun Publik"}
            </span>
          </div>

          {/* Nav */}
          <AkunNav slug={slug} isMember={isMember} />
        </aside>

        {/* ── Konten ── */}
        <div className="flex-1 min-w-0">
          {/* Mobile: nama user di atas konten */}
          <div className="flex items-center gap-3 mb-6 md:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt={identity.name} className="w-10 h-10 rounded-full ring-2 ring-border" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{identity.name}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                isMember ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {isMember ? "Anggota IKPM" : "Akun Publik"}
              </span>
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
