"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInviteAction, registerAndAcceptAction } from "./actions";

type Props = {
  slug:           string;
  token:          string;
  isLoggedIn:     boolean;
  loggedInName:   string | null;
  loggedInEmail:  string | null;
  prefillName:    string | null;
  prefillEmail:   string | null;
};

export function InviteAcceptClient({
  slug,
  token,
  isLoggedIn,
  loggedInName,
  loggedInEmail,
  prefillName,
  prefillEmail,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Form state untuk registrasi
  const [name, setName]         = useState(prefillName ?? "");
  const [email, setEmail]       = useState(prefillEmail ?? "");
  const [password, setPassword] = useState("");
  const [mode, setMode]         = useState<"register" | "login_redirect">("register");

  function handleAccept() {
    setError("");
    startTransition(async () => {
      const res = await acceptInviteAction(slug, token);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => router.push(`/${res.slug}/dashboard`), 1500);
      } else {
        setError(res.error);
      }
    });
  }

  function handleRegisterAndAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Nama wajib diisi."); return; }
    if (!email.trim()) { setError("Email wajib diisi."); return; }
    if (password.length < 8) { setError("Password minimal 8 karakter."); return; }
    setError("");

    startTransition(async () => {
      const res = await registerAndAcceptAction(slug, token, name, email, password);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => router.push(`/${res.slug}/dashboard`), 1500);
      } else {
        setError(res.error);
      }
    });
  }

  if (success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center space-y-1">
        <p className="font-semibold text-green-800 text-sm">Berhasil bergabung!</p>
        <p className="text-xs text-green-700">Mengalihkan ke dashboard...</p>
      </div>
    );
  }

  // ── User sudah login — tampilkan tombol terima langsung ──
  if (isLoggedIn) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm">
          <p className="text-muted-foreground text-xs mb-0.5">Login sebagai</p>
          <p className="font-medium">{loggedInName}</p>
          <p className="text-xs text-muted-foreground">{loggedInEmail}</p>
        </div>

        {error && (
          <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={handleAccept}
          disabled={isPending}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium
                     text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Memproses..." : "Terima Undangan & Masuk Dashboard"}
        </button>

        <p className="text-xs text-center text-muted-foreground">
          Bukan Anda?{" "}
          <a href="/login" className="underline text-primary">
            Login dengan akun lain
          </a>
        </p>
      </div>
    );
  }

  // ── User belum login — tampilkan form daftar akun ──
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-5">
        <h2 className="text-sm font-semibold mb-4">
          Buat akun untuk menerima undangan
        </h2>

        <form onSubmit={handleRegisterAndAccept} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Nama Lengkap</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Nama lengkap Anda"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Minimal 8 karakter"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium
                       text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Memproses..." : "Daftar & Terima Undangan"}
          </button>
        </form>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Sudah punya akun?{" "}
        <a href={`/login?next=/${slug}/invite?token=${token}`} className="underline text-primary">
          Login terlebih dahulu
        </a>
      </p>
    </div>
  );
}
