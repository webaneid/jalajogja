"use client";

import { useState, useTransition } from "react";
import { use }                     from "react";
import { Button }                  from "@/components/ui/button";
import { Input }                   from "@/components/ui/input";
import { Label }                   from "@/components/ui/label";
import { CheckCircle2 }            from "lucide-react";

type Params = Promise<{ tenant: string }>;

export default function ForgotPasswordPage({ params }: { params: Params }) {
  const { tenant: slug } = use(params);

  const [email,     setEmail]     = useState("");
  const [sent,      setSent]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [isPending, start]        = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await fetch("/api/auth/request-password-reset", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, redirectTo: `/${slug}/reset-password` }),
      });
      if (!res.ok) {
        setError("Gagal mengirim email. Pastikan email Anda benar.");
      } else {
        setSent(true);
      }
    });
  }

  if (sent) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-xl font-bold">Email Terkirim</h1>
          <p className="text-sm text-muted-foreground">
            Kami telah mengirim link reset password ke{" "}
            <span className="font-medium text-foreground">{email}</span>.
            Silakan cek kotak masuk (atau folder spam) Anda.
          </p>
          <a href={`/${slug}/login`} className="text-sm text-primary hover:underline block">
            Kembali ke halaman masuk
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Lupa Password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Masukkan email Anda dan kami akan kirimkan link untuk reset password.
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Mengirim..." : "Kirim Link Reset"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Ingat password Anda?{" "}
          <a href={`/${slug}/login`} className="text-primary hover:underline font-medium">
            Kembali masuk
          </a>
        </p>
      </div>
    </div>
  );
}
