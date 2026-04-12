"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveNotificationSettingsAction } from "@/app/(dashboard)/[tenant]/settings/actions";

type DefaultValues = {
  emailNewMember:        boolean;
  emailPaymentIn:        boolean;
  emailPaymentConfirmed: boolean;
  whatsappEnabled:       boolean;
};

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
  badge,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/30 select-none">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {label}
          {badge}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
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
        <span
          className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export function NotificationsSettingsForm({
  slug,
  defaultValues,
}: {
  slug: string;
  defaultValues: DefaultValues;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [values, setValues]   = React.useState<DefaultValues>(defaultValues);

  const set = (key: keyof DefaultValues) => (v: boolean) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await saveNotificationSettingsAction(slug, values);
      if (result.error) toast.error(result.error);
      else { toast.success("Pengaturan notifikasi disimpan."); router.refresh(); }
    } finally { setPending(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Email */}
      <fieldset className="space-y-3">
        <legend className="w-full border-b pb-1.5 text-sm font-semibold text-foreground">
          Notifikasi Email
        </legend>
        <p className="text-xs text-muted-foreground">
          Email dikirim ke alamat admin yang dikonfigurasi di pengaturan SMTP.
        </p>

        <Toggle
          label="Anggota Baru Terdaftar"
          description="Kirim email ke admin saat ada anggota baru berhasil didaftarkan."
          checked={values.emailNewMember}
          onChange={set("emailNewMember")}
          disabled={pending}
        />
        <Toggle
          label="Pembayaran Masuk"
          description="Kirim email ke admin saat pembayaran baru disubmit oleh anggota."
          checked={values.emailPaymentIn}
          onChange={set("emailPaymentIn")}
          disabled={pending}
        />
        <Toggle
          label="Pembayaran Dikonfirmasi"
          description="Kirim email ke anggota saat pembayaran mereka dikonfirmasi admin."
          checked={values.emailPaymentConfirmed}
          onChange={set("emailPaymentConfirmed")}
          disabled={pending}
        />
      </fieldset>

      {/* WhatsApp */}
      <fieldset className="space-y-3">
        <legend className="w-full border-b pb-1.5 text-sm font-semibold text-foreground">
          Notifikasi WhatsApp
        </legend>

        <Toggle
          label="Aktifkan WhatsApp"
          description="Notifikasi via WhatsApp membutuhkan add-on WhatsApp aktif."
          checked={values.whatsappEnabled}
          onChange={set("whatsappEnabled")}
          disabled={pending}
          badge={
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              Butuh add-on
            </span>
          }
        />
        {values.whatsappEnabled && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Pastikan add-on WhatsApp sudah diinstall dan terhubung di halaman Add-on.
          </p>
        )}
      </fieldset>

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan"}
      </Button>
    </form>
  );
}
