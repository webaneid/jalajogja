"use client";

import { useState, useTransition } from "react";
import { authClient }              from "@/lib/auth-client";
import { useRouter }               from "next/navigation";
import { Button }                  from "@/components/ui/button";
import { Input }                   from "@/components/ui/input";
import { Label }                   from "@/components/ui/label";
import { PasswordInput }           from "@/components/ui/password-input";

export function SignLoginForm({
  slug,
  redirectTo,
}: {
  slug:       string;
  redirectTo: string;
}) {
  const router                  = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [isPending, start]      = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await authClient.signIn.email({ email, password });
      if (res.error) {
        setError("Email atau password salah. Silakan coba lagi.");
      } else {
        router.push(redirectTo);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="sign-email">Email</Label>
        <Input
          id="sign-email"
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
          <Label htmlFor="sign-password">Password</Label>
          <a
            href={`/${slug}/forgot-password`}
            className="text-xs text-primary hover:underline"
          >
            Lupa password?
          </a>
        </div>
        <PasswordInput
          id="sign-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="current-password"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Memproses..." : "Masuk & Lanjutkan"}
      </Button>
    </form>
  );
}
