"use client";

import { useState, useTransition } from "react";
import { use }                     from "react";
import { authClient }              from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { Button }                  from "@/components/ui/button";
import { Input }          from "@/components/ui/input";
import { Label }          from "@/components/ui/label";
import { PasswordInput }  from "@/components/ui/password-input";
import { Suspense }                from "react";

type Params = Promise<{ tenant: string }>;

function ResetForm({ slug }: { slug: string }) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [isPending, start]      = useTransition();

  if (!token) {
    return (
      <div className="text-center space-y-3">
        <p className="text-destructive font-medium">Link tidak valid atau sudah kadaluarsa.</p>
        <a href={`/${slug}/forgot-password`} className="text-sm text-primary hover:underline">
          Minta link baru
        </a>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Konfirmasi password tidak cocok."); return; }
    if (password.length < 8)  { setError("Password minimal 8 karakter."); return; }

    start(async () => {
      const res = await authClient.resetPassword({ newPassword: password, token });
      if (res.error) {
        setError("Link sudah kadaluarsa atau tidak valid. Minta link baru.");
      } else {
        router.push(`/${slug}/login?reset=1`);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PasswordInput
        id="password"
        label="Password Baru"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Min. 8 karakter"
        required
        autoComplete="new-password"
      />

      <PasswordInput
        id="confirm"
        label="Konfirmasi Password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Ulangi password baru"
        required
        autoComplete="new-password"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Memproses..." : "Simpan Password Baru"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage({ params }: { params: Params }) {
  const { tenant: slug } = use(params);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Buat Password Baru</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Masukkan password baru untuk akun Anda.
          </p>
        </div>
        <Suspense fallback={<p className="text-sm text-center text-muted-foreground">Memuat...</p>}>
          <ResetForm slug={slug} />
        </Suspense>
        <p className="text-center text-sm text-muted-foreground">
          <a href={`/${slug}/login`} className="text-primary hover:underline">
            Kembali ke halaman masuk
          </a>
        </p>
      </div>
    </div>
  );
}
