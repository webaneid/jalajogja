import { redirect } from "next/navigation";
import { headers }  from "next/headers";
import { auth }     from "@/lib/auth";
import { AkunErrorClient } from "@/components/akun/akun-error-client";

type Params = Promise<{ tenant: string }>;

// Halaman yang ditampilkan saat user punya session tapi tidak punya identity
// (members.better_auth_user_id dan profiles.better_auth_user_id keduanya null).
// Harus di LUAR route /akun/* agar tidak terkena layout check yang menyebabkan loop.

export default async function AkunErrorPage({ params }: { params: Params }) {
  const { tenant: slug } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect(`/${slug}/login`);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6 text-center">

        <div className="space-y-2">
          <h1 className="text-xl font-bold">Akun Belum Terhubung</h1>
          <p className="text-sm text-muted-foreground">
            Anda sudah login, tetapi akun Anda belum terhubung ke data keanggotaan.
            Ini bisa terjadi jika data Anda diinput oleh admin sebelum Anda mendaftar sendiri.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-left space-y-1">
          <p className="font-medium">Langkah yang disarankan:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Klik &ldquo;Keluar&rdquo; di bawah</li>
            <li>Daftar ulang sebagai Anggota IKPM menggunakan email atau nomor HP yang sama</li>
            <li>Sistem akan otomatis menghubungkan akun Anda</li>
          </ol>
        </div>

        <p className="text-xs text-muted-foreground">
          Login sebagai: <span className="font-medium">{session.user.email}</span>
        </p>

        <AkunErrorClient slug={slug} />

      </div>
    </div>
  );
}
