"use client";

import { useState, useTransition } from "react";
import { authClient }              from "@/lib/auth-client";
import { useRouter }               from "next/navigation";
import { Button }                  from "@/components/ui/button";
import { Input }                   from "@/components/ui/input";
import { Label }                   from "@/components/ui/label";

export function LoginForm({ slug, redirectTo }: { slug: string; redirectTo?: string }) {
  const router                  = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [isPending, start]      = useTransition();

  const dest = redirectTo || `/${slug}/akun`;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await authClient.signIn.email({ email, password, callbackURL: dest });
      if (res.error) {
        setError("Email atau password salah. Silakan coba lagi.");
      } else {
        router.push(dest);
      }
    });
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Masuk</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Masuk ke akun Anda untuk melanjutkan.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <a
                href={`/${slug}/forgot-password`}
                className="text-xs text-primary hover:underline"
              >
                Lupa password?
              </a>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Memproses..." : "Masuk"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Belum punya akun?{" "}
          <a href={`/${slug}/register`} className="text-primary hover:underline font-medium">
            Daftar sekarang
          </a>
        </p>
      </div>
    </div>
  );
}
