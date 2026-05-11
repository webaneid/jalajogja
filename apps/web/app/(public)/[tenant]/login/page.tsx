import { redirect }   from "next/navigation";
import { headers }    from "next/headers";
import { auth }       from "@/lib/auth";
import { LoginForm }  from "./login-form";

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

  // Jika sudah login → langsung ke akun (atau URL tujuan)
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    redirect(dest ?? `/${slug}/akun`);
  }

  return <LoginForm slug={slug} redirectTo={dest} />;
}
