"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveEmailChannelSettingsAction } from "@/app/(dashboard)/app/[tenant]/settings/actions";
import {
  EMAIL_EVENT_GROUPS, CHANNEL_MODES, type ChannelMode, type EmailEventKey,
} from "@/lib/email-notify";

// Pengaturan kanal notifikasi pelanggan: mode (email/WA) + sakelar email per event.
// docs/arsitektur-notifikasi-email.md § 3.3–3.4. Sakelar WhatsApp per event tetap di kartu WhatsApp Gateway.

const MODE_INFO: Record<ChannelMode, { label: string; desc: string }> = {
  email_first: {
    label: "Email dulu (disarankan)",
    desc:  "Kirim email. WhatsApp hanya dipakai kalau penerima tidak punya email atau email gagal terkirim — menekan jumlah pesan WhatsApp.",
  },
  both:       { label: "Email dan WhatsApp", desc: "Kirim lewat keduanya (WhatsApp tetap perlu aktif dan toggle-nya menyala)." },
  email_only: { label: "Hanya email",        desc: "Tidak ada notifikasi pelanggan lewat WhatsApp." },
  wa_only:    { label: "Hanya WhatsApp",     desc: "Perilaku lama — email notifikasi pelanggan dimatikan." },
};

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-primary" : "bg-input"}`}
    >
      <span className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

export function NotificationsSettingsForm({
  slug, defaultMode, defaultToggles,
}: {
  slug:           string;
  defaultMode:    ChannelMode;
  defaultToggles: Record<EmailEventKey, boolean>;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [mode, setMode]       = React.useState<ChannelMode>(defaultMode);
  const [toggles, setToggles] = React.useState(defaultToggles);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await saveEmailChannelSettingsAction(slug, { mode, toggles });
      if (result.error) toast.error(result.error);
      else { toast.success("Pengaturan notifikasi disimpan."); router.refresh(); }
    } finally { setPending(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="w-full border-b pb-1.5 text-sm font-semibold text-foreground">Kanal notifikasi pelanggan</legend>
        {CHANNEL_MODES.map((m) => (
          <label key={m} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-accent/30">
            <input
              type="radio" name="channel-mode" className="mt-1"
              checked={mode === m} onChange={() => setMode(m)} disabled={pending}
            />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">{MODE_INFO[m].label}</span>
              <span className="block text-xs text-muted-foreground">{MODE_INFO[m].desc}</span>
            </span>
          </label>
        ))}
        <p className="text-xs text-muted-foreground">
          Email dikirim dari SMTP milik organisasi bila sudah diisi di Pengaturan → Email; kalau belum, dikirim lewat
          email platform atas nama organisasi Anda.
        </p>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="w-full border-b pb-1.5 text-sm font-semibold text-foreground">Email per kejadian</legend>
        {EMAIL_EVENT_GROUPS.map((g) => (
          <div key={g.label} className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
            {g.items.map((it) => (
              <div key={it.key} className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2">
                <span className="text-sm">{it.label}</span>
                <Switch
                  checked={toggles[it.key]} disabled={pending || mode === "wa_only"}
                  onChange={(v) => setToggles((t) => ({ ...t, [it.key]: v }))}
                />
              </div>
            ))}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Isi email memakai teks yang sama dengan notifikasi WhatsApp — ubah teksnya lewat tombol &quot;Edit Teks&quot; di kartu WhatsApp di bawah.
          Pemberitahuan ke pengurus (ringkasan harian, verifikasi bendahara) diatur di bagian Penanggung Jawab.
        </p>
      </fieldset>

      <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan"}</Button>
    </form>
  );
}
