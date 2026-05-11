import { redirect }      from "next/navigation";
import { headers }       from "next/headers";
import { auth }          from "@/lib/auth";
import { RegisterForm }  from "./register-form";

type Params = Promise<{ tenant: string }>;

export default async function RegisterPage({ params }: { params: Params }) {
  const { tenant: slug } = await params;

  // Jika sudah login → langsung ke akun
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    redirect(`/${slug}/akun`);
  }

  return <RegisterForm slug={slug} />;
}
