"use client";

import { useState, useTransition, useRef } from "react";
import { use }           from "react";
import { useRouter }     from "next/navigation";
import { Button }        from "@/components/ui/button";
import { Input }         from "@/components/ui/input";
import { Label }         from "@/components/ui/label";
import { MessageCircle, Loader2 } from "lucide-react";
import { PhoneInput }    from "@/components/ui/phone-input";

type Params = Promise<{ tenant: string }>;
type Step   = "phone" | "otp";

export default function ForgotPasswordPage({ params }: { params: Params }) {
  const { tenant: slug } = use(params);
  const router = useRouter();

  const [step,      setStep]      = useState<Step>("phone");
  const [phone,     setPhone]     = useState("");
  const [otp,       setOtp]       = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [notRegistered, setNotRegistered] = useState(false);
  const [pending,   start]        = useTransition();
  const [sending,   setSending]   = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    setNotRegistered(false);
    try {
      const res  = await fetch("/api/akun/send-otp", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone: ph, type: "reset_password", slug }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        if (res.status === 404) {
          // notRegistered menampilkan blok dengan tautan /register (step "phone"); error jadi
          // fallback teks polos kalau ini terpicu dari tombol "Kirim ulang" di step "otp".
          setNotRegistered(true);
          setError("Nomor Anda belum terdaftar.");
          return false;
        }
        setError(data.error ?? "Gagal mengirim OTP.");
        return false;
      }
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
    start(async () => {
      const ok = await sendOtp(phone);
      if (ok) setStep("otp");
    });
  }

  function handlePhoneInputChange(val: string) {
    setPhone(val);
    setNotRegistered(false);
    setError(null);
  }

  function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (otp.trim().length !== 6) { setError("Masukkan 6 digit kode OTP."); return; }
    start(async () => {
      try {
        const res  = await fetch("/api/akun/verify-otp", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ phone, code: otp.trim(), type: "reset_password", slug }),
        });
        const data = await res.json() as { valid?: boolean; token?: string; error?: string };
        if (!res.ok || !data.valid || !data.token) {
          setError(data.error ?? "Kode tidak valid.");
          return;
        }
        router.push(`/${slug}/reset-password?token=${encodeURIComponent(data.token)}`);
      } catch {
        setError("Terjadi kesalahan. Coba lagi.");
      }
    });
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">

        <div className="text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mx-auto mb-3">
            <MessageCircle className="h-6 w-6 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">Lupa Password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "phone"
              ? "Masukkan nomor WhatsApp Anda untuk menerima kode verifikasi."
              : `Kode OTP telah dikirim ke ${phone}`}
          </p>
        </div>

        {/* ── Step 1: Input nomor WA ──────────────────────────────────────── */}
        {step === "phone" && (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <PhoneInput
                label="Nomor WhatsApp"
                value={phone}
                onChange={handlePhoneInputChange}
                required
              />
            </div>
            {notRegistered && (
              <p className="text-sm text-destructive">
                Nomor Anda belum terdaftar, silakan mendaftar melalui{" "}
                <a href={`/${slug}/register`} className="underline font-medium">tautan ini</a>.
              </p>
            )}
            {!notRegistered && error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={pending || sending}>
              {(pending || sending)
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Mengirim OTP...</>
                : "Kirim Kode OTP"}
            </Button>
          </form>
        )}

        {/* ── Step 2: Input kode OTP ──────────────────────────────────────── */}
        {step === "otp" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800">
              Kode OTP 6 digit telah dikirim ke WhatsApp Anda. Berlaku 5 menit.
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
              <Button type="submit" className="w-full" disabled={pending || otp.length !== 6}>
                {pending
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Memverifikasi...</>
                  : "Verifikasi & Reset Password"}
              </Button>
            </form>

            <div className="text-center text-sm text-muted-foreground">
              Tidak menerima kode?{" "}
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
              )}{" "}
              ·{" "}
              <button
                onClick={() => { setStep("phone"); setOtp(""); setError(null); setNotRegistered(false); }}
                className="text-muted-foreground hover:text-foreground"
              >
                Ubah nomor
              </button>
            </div>
          </div>
        )}

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
