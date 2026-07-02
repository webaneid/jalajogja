"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { use }           from "react";
import { useRouter }     from "next/navigation";
import { Button }        from "@/components/ui/button";
import { Input }         from "@/components/ui/input";
import { Label }         from "@/components/ui/label";
import { CheckCircle2, MessageCircle, Mail, Loader2 } from "lucide-react";
import { PhoneInput }    from "@/components/ui/phone-input";

type Params = Promise<{ tenant: string }>;
type WaAvail = { available: boolean; resetOtp: boolean };
type FpStep  = "email" | "wa_phone" | "wa_otp";

export default function ForgotPasswordPage({ params }: { params: Params }) {
  const { tenant: slug } = use(params);
  const router = useRouter();

  // ── Tab aktif dan WA availability ────────────────────────────────────────
  const [activeTab,  setActiveTab]  = useState<"email" | "wa">("email");
  const [waAvail,    setWaAvail]    = useState<WaAvail | null>(null);

  useEffect(() => {
    fetch(`/api/wa/available?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then((d: WaAvail) => setWaAvail(d))
      .catch(() => setWaAvail({ available: false, resetOtp: false }));
  }, [slug]);

  const waEnabled = waAvail?.resetOtp === true;

  // ── State email tab ───────────────────────────────────────────────────────
  const [email,      setEmail]      = useState("");
  const [emailSent,  setEmailSent]  = useState(false);
  const [emailErr,   setEmailErr]   = useState<string | null>(null);
  const [emailPend,  startEmail]    = useTransition();

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailErr(null);
    startEmail(async () => {
      const res = await fetch("/api/auth/request-password-reset", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, redirectTo: `/${slug}/reset-password` }),
      });
      if (!res.ok) setEmailErr("Gagal mengirim email. Pastikan email Anda benar.");
      else         setEmailSent(true);
    });
  }

  // ── State WA tab ──────────────────────────────────────────────────────────
  const [waStep,    setWaStep]    = useState<FpStep>("wa_phone");
  const [phone,     setPhone]     = useState("");
  const [otp,       setOtp]       = useState("");
  const [waErr,     setWaErr]     = useState<string | null>(null);
  const [waPend,    startWa]      = useTransition();
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

  async function sendOtp(ph: string) {
    setSending(true);
    setWaErr(null);
    try {
      const res  = await fetch("/api/akun/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: ph, type: "reset_password", slug }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) { setWaErr(data.error ?? "Gagal mengirim OTP."); return false; }
      startCountdown();
      return true;
    } catch {
      setWaErr("Terjadi kesalahan. Coba lagi.");
      return false;
    } finally {
      setSending(false);
    }
  }

  function handleWaPhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    setWaErr(null);
    startWa(async () => {
      const ok = await sendOtp(phone);
      if (ok) setWaStep("wa_otp");
    });
  }

  function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setWaErr(null);
    if (otp.trim().length !== 6) { setWaErr("Masukkan 6 digit kode OTP."); return; }
    startWa(async () => {
      try {
        const res  = await fetch("/api/akun/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, code: otp.trim(), type: "reset_password", slug }),
        });
        const data = await res.json() as { valid?: boolean; token?: string; error?: string };
        if (!res.ok || !data.valid || !data.token) {
          setWaErr(data.error ?? "Kode tidak valid.");
          return;
        }
        router.push(`/${slug}/reset-password?token=${encodeURIComponent(data.token)}`);
      } catch {
        setWaErr("Terjadi kesalahan. Coba lagi.");
      }
    });
  }

  // ── Email sent confirmation ───────────────────────────────────────────────
  if (emailSent) {
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
            Pilih metode untuk mereset password Anda.
          </p>
        </div>

        {/* Tab selector — hanya tampil jika WA tersedia */}
        {waEnabled && (
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => { setActiveTab("email"); setEmailErr(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
                activeTab === "email"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              Via Email
            </button>
            <button
              onClick={() => { setActiveTab("wa"); setWaErr(null); setWaStep("wa_phone"); setOtp(""); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
                activeTab === "wa"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Via WhatsApp
            </button>
          </div>
        )}

        {/* ── Tab Email ───────────────────────────────────────────────────── */}
        {activeTab === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {!waEnabled && (
              <p className="text-sm text-muted-foreground">
                Masukkan email Anda dan kami akan kirimkan link untuk reset password.
              </p>
            )}
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
            {emailErr && <p className="text-sm text-destructive">{emailErr}</p>}
            <Button type="submit" className="w-full" disabled={emailPend}>
              {emailPend ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Mengirim...</> : "Kirim Link Reset"}
            </Button>
          </form>
        )}

        {/* ── Tab WhatsApp — input nomor ──────────────────────────────────── */}
        {activeTab === "wa" && waStep === "wa_phone" && (
          <form onSubmit={handleWaPhoneSubmit} className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800">
              Masukkan nomor WhatsApp yang terdaftar di akun Anda. Kami akan kirimkan kode OTP.
            </div>
            <div className="space-y-1.5">
              <PhoneInput
                label="Nomor WhatsApp"
                value={phone}
                onChange={setPhone}
                required
              />
            </div>
            {waErr && <p className="text-sm text-destructive">{waErr}</p>}
            <Button type="submit" className="w-full" disabled={waPend || sending}>
              {(waPend || sending)
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Mengirim OTP...</>
                : "Kirim Kode OTP"}
            </Button>
          </form>
        )}

        {/* ── Tab WhatsApp — input OTP ────────────────────────────────────── */}
        {activeTab === "wa" && waStep === "wa_otp" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <MessageCircle className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Kode dikirim ke {phone}</p>
                <button
                  onClick={() => { setWaStep("wa_phone"); setOtp(""); setWaErr(null); }}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Ubah nomor
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800">
              Kode OTP 6 digit telah dikirim. Berlaku 5 menit.
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
              {waErr && <p className="text-sm text-destructive">{waErr}</p>}
              <Button type="submit" className="w-full" disabled={waPend || otp.length !== 6}>
                {waPend
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
                  onClick={() => sendOtp(phone)}
                  disabled={sending}
                  className="text-primary hover:underline font-medium disabled:opacity-50"
                >
                  {sending ? "Mengirim..." : "Kirim ulang"}
                </button>
              )}
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
