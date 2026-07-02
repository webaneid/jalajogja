"use client";

import { useState, useTransition, useRef } from "react";
import { authClient }              from "@/lib/auth-client";
import { useRouter }               from "next/navigation";
import { Button }          from "@/components/ui/button";
import { Input }           from "@/components/ui/input";
import { Label }           from "@/components/ui/label";
import { PasswordInput }   from "@/components/ui/password-input";
import { PhoneInput }      from "@/components/ui/phone-input";
import { MessageCircle, Loader2, Mail } from "lucide-react";

type LoginMode = "email" | "whatsapp";
type WaStep    = "phone" | "otp";

export function LoginForm({ slug, redirectTo }: { slug: string; redirectTo?: string }) {
  const router = useRouter();
  const dest   = redirectTo || `/${slug}/akun`;

  const [mode,     setMode]     = useState<LoginMode>("email");
  const [error,    setError]    = useState<string | null>(null);

  // ── Email/password state ──────────────────────────────────────────────────
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [isPending, start]      = useTransition();

  // ── WhatsApp OTP state ────────────────────────────────────────────────────
  const [waStep,     setWaStep]     = useState<WaStep>("phone");
  const [phone,      setPhone]      = useState("");
  const [otp,        setOtp]        = useState("");
  const [sending,    setSending]    = useState(false);
  const [waPending,  waStart]       = useTransition();
  const [countdown,  setCountdown]  = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Email submit ──────────────────────────────────────────────────────────
  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await authClient.signIn.email({ email, password });
      if (res.error) {
        setError("Email atau password salah. Silakan coba lagi.");
      } else {
        // Full reload agar server component baca cookie sesi terbaru (sama seperti WA OTP)
        window.location.href = dest;
      }
    });
  }

  // ── WA: kirim OTP ────────────────────────────────────────────────────────
  function startCountdown() {
    setCountdown(60);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(countdownRef.current!); countdownRef.current = null; return 0; }
        return c - 1;
      });
    }, 1000);
  }

  async function sendOtp(ph: string): Promise<boolean> {
    setSending(true);
    setError(null);
    try {
      const res  = await fetch("/api/akun/send-otp", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone: ph, type: "login", slug }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) { setError(data.error ?? "Gagal mengirim OTP."); return false; }
      startCountdown();
      return true;
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
      return false;
    } finally {
      setSending(false);
    }
  }

  function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    waStart(async () => {
      const ok = await sendOtp(phone);
      if (ok) setWaStep("otp");
    });
  }

  function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (otp.trim().length !== 6) { setError("Masukkan 6 digit kode OTP."); return; }

    waStart(async () => {
      try {
        const res  = await fetch("/api/akun/login-via-otp", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ phone, code: otp.trim(), slug }),
        });
        const data = await res.json() as { ok?: boolean; redirectTo?: string; error?: string };
        if (!res.ok || !data.ok) {
          setError(data.error ?? "Kode tidak valid.");
          return;
        }
        // Full reload — pastikan cookie baru terbaca oleh server component
        window.location.href = dest;
      } catch {
        setError("Terjadi kesalahan. Coba lagi.");
      }
    });
  }

  function switchMode(m: LoginMode) {
    setMode(m);
    setError(null);
    setWaStep("phone");
    setOtp("");
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

        {/* ── Tab toggle ────────────────────────────────────────────────────── */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => switchMode("email")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
              mode === "email"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            Email & Password
          </button>
          <button
            type="button"
            onClick={() => switchMode("whatsapp")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
              mode === "whatsapp"
                ? "bg-green-600 text-white"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp OTP
          </button>
        </div>

        {/* ── Email / Password ──────────────────────────────────────────────── */}
        {mode === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
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
                <a href={`/${slug}/forgot-password`} className="text-xs text-primary hover:underline">
                  Lupa password?
                </a>
              </div>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Memproses...</> : "Masuk"}
            </Button>
          </form>
        )}

        {/* ── WhatsApp OTP — step phone ─────────────────────────────────────── */}
        {mode === "whatsapp" && waStep === "phone" && (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <PhoneInput
                label="Nomor WhatsApp"
                value={phone}
                onChange={setPhone}
                required
              />
              <p className="text-xs text-muted-foreground">
                Kode OTP 6 digit akan dikirim ke WhatsApp Anda.
              </p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={waPending || sending}>
              {(waPending || sending)
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Mengirim...</>
                : "Kirim Kode OTP"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              <a href={`/${slug}/forgot-password`} className="text-primary hover:underline">
                Lupa password?
              </a>
            </p>
          </form>
        )}

        {/* ── WhatsApp OTP — step kode ──────────────────────────────────────── */}
        {mode === "whatsapp" && waStep === "otp" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800">
              Kode OTP 6 digit telah dikirim ke WhatsApp <span className="font-medium">{phone}</span>. Berlaku 5 menit.
            </div>
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="otp">Kode OTP</Label>
                <Input
                  id="otp"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={waPending || otp.length !== 6}>
                {waPending
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Memverifikasi...</>
                  : "Masuk"}
              </Button>
            </form>
            <div className="text-center text-sm text-muted-foreground">
              Tidak menerima?{" "}
              {countdown > 0 ? (
                <span>Kirim ulang dalam {countdown}d</span>
              ) : (
                <button
                  onClick={() => void sendOtp(phone)}
                  disabled={sending}
                  className="text-primary hover:underline font-medium disabled:opacity-50"
                >
                  {sending ? "Mengirim..." : "Kirim ulang"}
                </button>
              )}{" "}·{" "}
              <button
                onClick={() => { setWaStep("phone"); setOtp(""); setError(null); }}
                className="text-muted-foreground hover:text-foreground"
              >
                Ubah nomor
              </button>
            </div>
          </div>
        )}

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
