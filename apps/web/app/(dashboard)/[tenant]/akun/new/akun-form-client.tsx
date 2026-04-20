"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { WilayahSelect, type WilayahValue } from "@/components/ui/wilayah-select";
import { createProfileAction } from "../actions";

export function AkunFormClient({ slug }: { slug: string }) {
  const router = useRouter();

  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [showPwd,  setShowPwd]  = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [wilayah,  setWilayah]  = useState<WilayahValue>({});

  // ── Overseas toggle ────────────────────────────────────────────────────────
  const [isOverseas, setIsOverseas] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd       = new FormData(e.currentTarget);
    const password = (fd.get("password") as string)?.trim();
    const confirm  = (fd.get("confirmPassword") as string)?.trim();

    if (password && password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }
    if (password && password !== confirm) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    setLoading(true);
    const result = await createProfileAction(slug, {
      name:          (fd.get("name")          as string)?.trim(),
      email:         (fd.get("email")         as string)?.trim(),
      phone:         (fd.get("phone")         as string)?.trim(),
      password:      password || undefined,
      addressDetail: (fd.get("addressDetail") as string)?.trim() || undefined,
      provinceId:    isOverseas ? undefined : wilayah.provinceId?.toString(),
      regencyId:     isOverseas ? undefined : wilayah.regencyId?.toString(),
      districtId:    isOverseas ? undefined : wilayah.districtId?.toString(),
      villageId:     isOverseas ? undefined : wilayah.villageId?.toString(),
      country:       isOverseas ? (fd.get("country") as string)?.trim() : "Indonesia",
    });
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push(`/${slug}/akun/${result.profileId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Identitas ─────────────────────────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Identitas
        </legend>

        <div className="space-y-1.5">
          <label htmlFor="name" className="block text-sm font-medium">
            Nama Lengkap <span className="text-destructive">*</span>
          </label>
          <input
            id="name" name="name" type="text" required autoComplete="off"
            placeholder="Nama lengkap"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium">
            Email <span className="text-destructive">*</span>
          </label>
          <input
            id="email" name="email" type="email" required autoComplete="off"
            placeholder="contoh@email.com"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="phone" className="block text-sm font-medium">
            Nomor HP / WhatsApp <span className="text-destructive">*</span>
          </label>
          <input
            id="phone" name="phone" type="tel" required autoComplete="off"
            placeholder="628xxxxxxxxxx"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </fieldset>

      {/* ── Alamat ────────────────────────────────────────────────────────── */}
      <fieldset className="space-y-4">
        <div className="flex items-center justify-between">
          <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Alamat <span className="normal-case font-normal">(opsional)</span>
          </legend>
          {/* Toggle Indonesia / Luar Negeri */}
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setIsOverseas(false)}
              className={`px-2.5 py-1 transition-colors ${!isOverseas ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/40"}`}
            >
              Indonesia
            </button>
            <button
              type="button"
              onClick={() => setIsOverseas(true)}
              className={`px-2.5 py-1 transition-colors ${isOverseas ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/40"}`}
            >
              Luar Negeri
            </button>
          </div>
        </div>

        {isOverseas ? (
          <div className="space-y-1.5">
            <label htmlFor="country" className="block text-sm font-medium">Negara</label>
            <input
              id="country" name="country" type="text" autoComplete="off"
              placeholder="Contoh: Malaysia"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        ) : (
          <WilayahSelect onChange={setWilayah} />
        )}

        <div className="space-y-1.5">
          <label htmlFor="addressDetail" className="block text-sm font-medium">
            Detail Alamat
          </label>
          <textarea
            id="addressDetail" name="addressDetail" rows={2}
            placeholder="Nama jalan, nomor rumah, RT/RW..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>
      </fieldset>

      {/* ── Password (opsional) ───────────────────────────────────────────── */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
          Akses Login <span className="normal-case font-normal">(opsional)</span>
        </legend>
        <p className="text-xs text-muted-foreground -mt-2">
          Isi password jika ingin akun ini bisa login ke website publik. Kosongkan jika tidak perlu.
        </p>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <div className="relative">
            <input
              id="password" name="password"
              type={showPwd ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Minimal 8 karakter"
              className="w-full rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="block text-sm font-medium">Konfirmasi Password</label>
          <div className="relative">
            <input
              id="confirmPassword" name="confirmPassword"
              type={showPwd2 ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Ulangi password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => setShowPwd2(!showPwd2)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showPwd2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </fieldset>

      {/* ── Error + Submit ─────────────────────────────────────────────────── */}
      {error && (
        <p className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Simpan Akun
        </button>
        <a
          href={`/${slug}/akun`}
          className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Batal
        </a>
      </div>
    </form>
  );
}
