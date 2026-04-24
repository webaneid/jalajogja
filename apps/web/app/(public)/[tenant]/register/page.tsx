"use client";

import { useState, useTransition } from "react";
import { useRouter }               from "next/navigation";
import { Button }                  from "@/components/ui/button";
import { Input }                   from "@/components/ui/input";
import { Label }                   from "@/components/ui/label";
import { use }                     from "react";

type Params = Promise<{ tenant: string }>;

export default function RegisterPage({ params }: { params: Params }) {
  const { tenant: slug } = use(params);

  const router                  = useRouter();
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [phone,    setPhone]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [isPending, start]      = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        const res = await fetch("/api/akun/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, phone, password, tenantSlug: slug }),
        });
        const data = await res.json() as { error?: string; profileId?: string };
        if (!res.ok || data.error) {
          setError(data.error ?? "Pendaftaran gagal. Coba lagi.");
          return;
        }
        // Langsung ke halaman login setelah daftar
        router.push(`/${slug}/login`);
      } catch {
        setError("Terjadi kesalahan. Coba lagi.");
      }
    });
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Daftar Akun</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Buat akun untuk mengakses layanan.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama Lengkap</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama Anda"
              required
              autoComplete="name"
            />
          </div>

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
            <Label htmlFor="phone">No. HP</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              autoComplete="tel"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 karakter"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Memproses..." : "Daftar"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Sudah punya akun?{" "}
          <a href={`/${slug}/login`} className="text-primary hover:underline font-medium">
            Masuk di sini
          </a>
        </p>
      </div>
    </div>
  );
}
