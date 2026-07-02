"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  connectWhatsAppAction,
  confirmWaConnectionAction,
  deactivateWhatsAppAction,
  disconnectWhatsAppAction,
  saveWaNotificationSettingsAction,
} from "@/app/(dashboard)/app/[tenant]/settings/actions";
import type { WaNotifKey } from "@/lib/whatsapp";

// ── Tipe ──────────────────────────────────────────────────────────────────────

type WaConfig = {
  device_id:    string;
  phone_number: string | null;
  verified:     boolean;
  notifications: Partial<Record<WaNotifKey, boolean>>;
} | null;

type Props = {
  slug:   string;
  config: WaConfig;
};

// ── Daftar toggle notifikasi ─────────────────────────────────────────────────

const NOTIF_GROUPS: Array<{
  label: string;
  items: Array<{ key: WaNotifKey; label: string; desc: string }>;
}> = [
  {
    label: "Pembayaran",
    items: [
      { key: "payment_submitted",  label: "Bukti bayar diterima",   desc: "Kirim ke customer saat bukti pembayaran berhasil diupload." },
      { key: "payment_confirmed",  label: "Pembayaran dikonfirmasi", desc: "Kirim ke customer saat admin mengkonfirmasi pembayaran." },
      { key: "payment_rejected",   label: "Pembayaran ditolak",      desc: "Kirim ke customer saat bukti pembayaran ditolak admin." },
      { key: "invoice_reminder",   label: "Pengingat jatuh tempo",   desc: "Kirim ke customer H-1 sebelum invoice jatuh tempo." },
    ],
  },
  {
    label: "Toko & Pengiriman",
    items: [
      { key: "order_processing", label: "Pesanan diproses",  desc: "Kirim saat admin mulai memproses pesanan." },
      { key: "order_shipped",    label: "Pesanan dikirim",   desc: "Kirim ke customer saat pesanan dikirim + nomor resi." },
      { key: "order_delivered",  label: "Pesanan selesai",   desc: "Kirim saat pesanan diterima customer." },
    ],
  },
  {
    label: "Event",
    items: [
      { key: "event_registered",        label: "Pendaftaran event",     desc: "Konfirmasi pendaftaran event berhasil." },
      { key: "event_reminder",          label: "Pengingat event H-1",   desc: "Pengingat ke peserta sehari sebelum event." },
      { key: "event_certificate_ready", label: "Sertifikat siap",       desc: "Notifikasi saat sertifikat kehadiran siap diunduh." },
    ],
  },
  {
    label: "Donasi",
    items: [
      { key: "donation_received", label: "Donasi diterima", desc: "Ucapan terima kasih saat donasi berhasil disubmit." },
    ],
  },
  {
    label: "Anggota & Pengurus",
    items: [
      { key: "member_welcome", label: "Sambutan anggota baru", desc: "Kirim ke anggota baru saat berhasil didaftarkan." },
      { key: "officer_invite", label: "Undangan pengurus",     desc: "Kirim link aktivasi ke calon pengurus saat diundang." },
    ],
  },
  {
    label: "Surat",
    items: [
      { key: "letter_sign_request", label: "Permintaan tanda tangan", desc: "Kirim link TTD ke officer saat ada slot TTD baru." },
    ],
  },
  {
    label: "Verifikasi (OTP)",
    items: [
      { key: "otp_register",        label: "OTP Daftar Akun",     desc: "Kirim kode OTP 6 digit ke nomor HP saat pengguna mendaftar akun baru." },
      { key: "otp_reset_password",  label: "OTP Reset Password",  desc: "Kirim kode OTP saat pengguna minta reset password via WhatsApp." },
      { key: "otp_login",           label: "OTP Login via WA",    desc: "Izinkan pengguna masuk menggunakan kode OTP WhatsApp (tanpa password)." },
    ],
  },
];

// ── Toggle komponen ───────────────────────────────────────────────────────────

function Toggle({
  label, desc, checked, onChange, disabled,
}: {
  label: string; desc: string; checked: boolean;
  onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border p-3.5 transition-colors hover:bg-accent/30 select-none">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? "bg-primary" : "bg-input"
        }`}
      >
        <span className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

// ── Modal QR ──────────────────────────────────────────────────────────────────

function QrModal({
  slug,
  onConnected,
  onClose,
}: {
  slug: string;
  onConnected: (phone: string | null) => void;
  onClose: () => void;
}) {
  const [qrUrl, setQrUrl]           = React.useState<string | null>(null);
  const [qrError, setQrError]       = React.useState<string | null>(null);
  const [qrLoading, setQrLoading]   = React.useState(true);
  const [countdown, setCountdown]   = React.useState(30);
  const [connected, setConnected]   = React.useState(false);
  const pollRef                     = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef                = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQr = React.useCallback(async () => {
    setQrLoading(true);
    setQrError(null);
    try {
      const res = await fetch(`/api/wa/qr?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
      const data = await res.json() as { qrLink?: string; qrDuration?: number; error?: string };
      if (!res.ok || data.error) {
        setQrError(data.error ?? "Gagal memuat QR code.");
      } else {
        setQrUrl(data.qrLink ?? null);
        setCountdown(data.qrDuration ?? 30);
      }
    } catch {
      setQrError("Tidak dapat terhubung ke server.");
    } finally {
      setQrLoading(false);
    }
  }, [slug]);

  // Poll status koneksi setiap 3 detik
  React.useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/wa/status?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
        const data = await res.json() as { isLoggedIn?: boolean; phoneNumber?: string | null };
        if (data.isLoggedIn) {
          clearInterval(pollRef.current!);
          clearInterval(countdownRef.current!);
          setConnected(true);
          onConnected(data.phoneNumber ?? null);
        }
      } catch {
        // Abaikan error polling
      }
    }, 3000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [slug, onConnected]);

  // Countdown QR validity
  React.useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Refresh QR saat expired
          void fetchQr();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [fetchQr]);

  // Load QR pertama kali
  React.useEffect(() => { void fetchQr(); }, [fetchQr]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="relative w-full max-w-sm rounded-xl bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">✕</button>

        {connected ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">✅</div>
            <div>
              <p className="font-semibold text-green-700">WhatsApp Terhubung!</p>
              <p className="mt-1 text-sm text-muted-foreground">Halaman akan diperbarui.</p>
            </div>
          </div>
        ) : (
          <>
            <h3 className="mb-1 text-base font-semibold">Scan QR WhatsApp</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Buka WhatsApp di HP → Perangkat Tertaut → Tautkan Perangkat, lalu scan QR ini.
            </p>

            <div className="flex min-h-[260px] items-center justify-center rounded-lg border bg-muted/30">
              {qrLoading && <p className="text-sm text-muted-foreground">Memuat QR code...</p>}
              {qrError   && (
                <div className="text-center">
                  <p className="text-sm text-destructive">{qrError}</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={fetchQr}>Coba Lagi</Button>
                </div>
              )}
              {!qrLoading && !qrError && qrUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrUrl} alt="QR Code WhatsApp" className="h-56 w-56 object-contain" />
              )}
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>Berlaku: <strong>{countdown}s</strong></span>
              <button onClick={fetchQr} className="text-primary underline-offset-2 hover:underline">Refresh QR</button>
            </div>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Menunggu scan... (auto-deteksi)
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Komponen utama ────────────────────────────────────────────────────────────

export function WhatsAppSetupClient({ slug, config }: Props) {
  const router                  = useRouter();
  const [pending, setPending]   = React.useState(false);
  const [showQr, setShowQr]     = React.useState(false);
  const [notifs, setNotifs]     = React.useState<Partial<Record<WaNotifKey, boolean>>>(
    config?.notifications ?? {},
  );
  const [savingNotifs, setSavingNotifs] = React.useState(false);

  const isConfigured = !!config;
  const isVerified   = config?.verified === true;
  const phoneNumber  = config?.phone_number ?? null;

  // ── Aktifkan (buat device di GOWA, simpan config, TIDAK tampilkan QR) ────────

  async function handleActivate() {
    setPending(true);
    try {
      const result = await connectWhatsAppAction(slug);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("WhatsApp Gateway diaktifkan. Klik 'Scan QR' untuk menghubungkan nomor.");
      router.refresh();
    } finally { setPending(false); }
  }

  // ── Setelah QR di-scan ─────────────────────────────────────────────────────

  async function handleConnected(phone: string | null) {
    const result = await confirmWaConnectionAction(slug, phone);
    if (result.success) {
      toast.success("WhatsApp berhasil terhubung!");
      setShowQr(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  // ── Putuskan (dari state terhubung — reset ke "aktif tapi belum scan") ─────

  async function handleDisconnect() {
    if (!confirm("Putuskan koneksi WhatsApp? Notifikasi WA akan berhenti dikirim.")) return;
    setPending(true);
    try {
      const result = await disconnectWhatsAppAction(slug);
      if (!result.success) toast.error(result.error);
      else { toast.success("WhatsApp diputus."); router.refresh(); }
    } finally { setPending(false); }
  }

  // ── Nonaktifkan (dari state aktif-belum-scan — hapus config sepenuhnya) ───

  async function handleDeactivate() {
    if (!confirm("Nonaktifkan WhatsApp Gateway? Config akan dihapus.")) return;
    setPending(true);
    try {
      const result = await deactivateWhatsAppAction(slug);
      if (!result.success) toast.error(result.error);
      else { toast.success("WhatsApp Gateway dinonaktifkan."); router.refresh(); }
    } finally { setPending(false); }
  }

  // ── Simpan toggle notifikasi ───────────────────────────────────────────────

  async function handleSaveNotifs() {
    setSavingNotifs(true);
    try {
      const result = await saveWaNotificationSettingsAction(slug, notifs as Record<string, boolean>);
      if (result.error) toast.error(result.error);
      else toast.success("Pengaturan notifikasi disimpan.");
    } finally { setSavingNotifs(false); }
  }

  return (
    <div className="space-y-5">

      {/* ── Status koneksi ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 rounded-xl border p-5">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${
            isVerified ? "bg-green-100" : isConfigured ? "bg-amber-50" : "bg-muted"
          }`}>
            💬
          </div>
          <div>
            <p className="text-sm font-semibold">
              {isVerified
                ? "WhatsApp Terhubung"
                : isConfigured
                  ? "WhatsApp Diaktifkan — Belum Tersambung"
                  : "WhatsApp Belum Diaktifkan"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isVerified && phoneNumber
                ? `Nomor: ${phoneNumber}`
                : isConfigured
                  ? "Scan QR untuk menghubungkan nomor WhatsApp."
                  : "Aktifkan untuk mulai setup."}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {isVerified ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowQr(true)} disabled={pending}>
                Scan Ulang
              </Button>
              <Button size="sm" variant="destructive" onClick={handleDisconnect} disabled={pending}>
                {pending ? "..." : "Putuskan"}
              </Button>
            </>
          ) : isConfigured ? (
            <>
              <Button size="sm" onClick={() => setShowQr(true)} disabled={pending}>
                Scan QR
              </Button>
              <Button size="sm" variant="outline" onClick={handleDeactivate} disabled={pending}>
                {pending ? "..." : "Nonaktifkan"}
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={handleActivate} disabled={pending}>
              {pending ? "Mengaktifkan..." : "Aktifkan WhatsApp Gateway"}
            </Button>
          )}
        </div>
      </div>

      {/* ── Info jika belum ada env vars ────────────────────────────────── */}
      {!process.env.NEXT_PUBLIC_WA_CONFIGURED && !isConfigured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Pastikan env vars <code>WHATSAPP_SERVICE_URL</code>, <code>WHATSAPP_API_USER</code>,
          dan <code>WHATSAPP_API_PASS</code> sudah diset di server sebelum menghubungkan.
        </div>
      )}

      {/* ── Toggle notifikasi (tampil hanya jika sudah terhubung) ─────── */}
      {isVerified && (
        <div className="space-y-5">
          {NOTIF_GROUPS.map((group) => (
            <fieldset key={group.label} className="space-y-2">
              <legend className="w-full border-b pb-1.5 text-sm font-semibold text-foreground">
                {group.label}
              </legend>
              {group.items.map((item) => (
                <Toggle
                  key={item.key}
                  label={item.label}
                  desc={item.desc}
                  checked={notifs[item.key] ?? false}
                  onChange={(v) => setNotifs((prev) => ({ ...prev, [item.key]: v }))}
                  disabled={savingNotifs}
                />
              ))}
            </fieldset>
          ))}

          <Button onClick={handleSaveNotifs} disabled={savingNotifs}>
            {savingNotifs ? "Menyimpan..." : "Simpan Pengaturan Notifikasi"}
          </Button>
        </div>
      )}

      {/* ── Modal QR ───────────────────────────────────────────────────── */}
      {showQr && (
        <QrModal
          slug={slug}
          onConnected={handleConnected}
          onClose={() => setShowQr(false)}
        />
      )}
    </div>
  );
}
