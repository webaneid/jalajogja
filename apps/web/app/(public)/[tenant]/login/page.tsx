import { redirect }    from "next/navigation";
import { headers }     from "next/headers";
import { auth }        from "@/lib/auth";
import { isOwnHost }   from "@/lib/is-own-host";
import { LoginForm }   from "./login-form";

type Params       = Promise<{ tenant: string }>;
type SearchParams  = Promise<{ redirect?: string }>;

export default async function LoginPage({
  params,
  searchParams,
}: {
  params:       Params;
  searchParams: SearchParams;
}) {
  const { tenant: slug }   = await params;
  const { redirect: dest } = await searchParams;

  // Tentukan baseUrl: custom domain → "" (no prefix), jalakarta.com → "/{slug}"
  const reqHeaders  = await headers();
  const host        = (reqHeaders.get("x-forwarded-host") ?? reqHeaders.get("host") ?? "");
  const baseUrl     = isOwnHost(host) ? `/${slug}` : "";
  const defaultDest = `${baseUrl}/akun`;

  // Jika sudah login → langsung ke akun (atau URL tujuan)
  // Hindari redirect ke /akun jika dest adalah /login (loop guard)
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (session?.user) {
    const safe = dest && !dest.includes("/login") ? dest : defaultDest;
    redirect(safe);
  }

  return <LoginForm slug={slug} redirectTo={dest} baseUrl={baseUrl} />;
}
