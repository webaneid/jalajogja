"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";
import { registerAction } from "./actions";

// Generate slug dari nama organisasi
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")         // spasi → dash
    .replace(/[^a-z0-9-]/g, "")  // hapus karakter selain huruf, angka, dash
    .replace(/-+/g, "-")          // multiple dash → satu dash
    .slice(0, 20);
}

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // UI state
  const [error, setError] = useState(
    searchParams.get("error") === "no-tenant"
      ? "Pendaftaran sebelumnya tidak lengkap. Silakan daftar ulang."
      : ""
  );
  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");

  // Auto-generate slug dari nama organisasi (kecuali sudah diedit manual)
  useEffect(() => {
    if (!slugManuallyEdited && orgName) {
      setSlug(generateSlug(orgName));
    }
  }, [orgName, slugManuallyEdited]);

  // Cek ketersediaan slug — debounced 500ms
  useEffect(() => {
    if (!slug || slug.length < 3) {
      setSlugStatus("idle");
      return;
    }

    // Validasi format lokal sebelum hit API
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) || slug.length > 20) {
      setSlugStatus("invalid");
      return;
    }

    setSlugStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tenant/check-slug?slug=${slug}`);
        const data = await res.json();
        setSlugStatus(data.available ? "available" : "taken");
      } catch {
        setSlugStatus("idle");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (slugStatus !== "available") {
      setError("Periksa slug organisasi sebelum melanjutkan.");
      return;
    }

    startTransition(async () => {
      // Langkah 1: Buat akun via Better Auth client
      const { error: signUpError } = await signUp.email({ name, email, password });

      if (signUpError) {
        setError(signUpError.message ?? "Gagal membuat akun.");
        return;
      }

      // Langkah 2: Buat tenant + schema via Server Action
      // userId diambil dari session server-side di dalam action — tidak perlu dikirim
      const result = await registerAction({ orgName, slug });

      if (!result.success) {
        setError(result.error ?? "Gagal membuat organisasi. Silakan coba lagi.");
        return;
      }

      router.push(`/${slug}/dashboard`);
    });
  }

  const slugStatusMessage = {
    idle: "",
    checking: "Memeriksa ketersediaan...",
    available: "✓ Slug tersedia",
    taken: "✗ Slug sudah digunakan",
    invalid: "✗ Format tidak valid (3–20 karakter, huruf kecil, angka, dash)",
  };

  const slugStatusColor = {
    idle: "",
    checking: "text-muted-foreground",
    available: "text-green-600",
    taken: "text-destructive",
    invalid: "text-destructive",
  };

  return (
    <div className="rounded-xl border bg-card p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Daftar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buat akun dan organisasi Anda
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── Data Akun ── */}
        <div className="space-y-4 rounded-lg border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Data Akun
          </p>

          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
              Nama Lengkap
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Ahmad Fauzi"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="ahmad@ikpm.or.id"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Minimal 8 karakter"
            />
          </div>
        </div>

        {/* ── Data Organisasi ── */}
        <div className="space-y-4 rounded-lg border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Data Organisasi
          </p>

          <div>
            <label htmlFor="orgName" className="mb-1.5 block text-sm font-medium">
              Nama Organisasi
            </label>
            <input
              id="orgName"
              type="text"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="IKPM Cabang Jakarta"
            />
          </div>

          <div>
            <label htmlFor="slug" className="mb-1.5 block text-sm font-medium">
              Slug Organisasi
              <span className="ml-1 font-normal text-muted-foreground">
                (URL: jalajogja.com/
                <span className="font-medium text-foreground">{slug || "..."}</span>
                )
              </span>
            </label>
            <input
              id="slug"
              type="text"
              required
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase());
                setSlugManuallyEdited(true);
              }}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="ikpm-jakarta"
            />
            {slugStatus !== "idle" && (
              <p className={`mt-1 text-xs ${slugStatusColor[slugStatus]}`}>
                {slugStatusMessage[slugStatus]}
              </p>
            )}
          </div>
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending || slugStatus !== "available"}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm
                     font-medium text-primary-foreground transition-opacity
                     hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Memproses..." : "Buat Akun & Organisasi"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Masuk di sini
        </Link>
      </p>
    </div>
  );
}
