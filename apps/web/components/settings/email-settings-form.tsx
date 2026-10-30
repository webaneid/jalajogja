"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { saveSmtpConfigAction, sendTestEmailAction } from "@/app/(dashboard)/app/[tenant]/settings/actions";

type DefaultValues = {
  host: string; port: number; user: string; password: string;
  fromName: string; fromEmail: string;
};

// Preset penyedia SMTP — docs/arsitektur-notifikasi-email.md § 3.5. Hanya mengisi host/port (dan user bila
// baku); tidak ada kode kirim khusus — semuanya lewat SMTP biasa.
type Preset = {
  id:        string;
  label:     string;
  host:      string;
  port:      number;
  fixedUser?: string;
  userHint:  string;
  passHint:  string;
  notes:     string[];
};

const PRESETS: Preset[] = [
  {
    id: "gmail", label: "Gmail / Google Workspace", host: "smtp.gmail.com", port: 587,
    userHint: "alamat-anda@gmail.com", passHint: "App Password 16 karakter",
    notes: [
      "Wajib memakai App Password, bukan password Gmail biasa. Aktifkan Verifikasi 2 Langkah di akun Google, lalu buat di myaccount.google.com/apppasswords.",
      "Email pengirim akan selalu sama dengan akun Gmail ini. Isi Email Pengirim dengan alamat yang sama.",
      "Batas kirim: sekitar 500 email/hari (Gmail biasa) atau 2.000/hari (Workspace). Cocok untuk volume kecil.",
    ],
  },
  {
    id: "resend", label: "Resend", host: "smtp.resend.com", port: 465, fixedUser: "resend",
    userHint: "resend", passHint: "API key (diawali re_)",
    notes: [
      "Username selalu \"resend\"; password adalah API key dari dashboard Resend.",
      "Email Pengirim harus memakai domain yang sudah diverifikasi di resend.com/domains (tambah record DNS SPF/DKIM), mis. noreply@domain-anda.or.id.",
      "Paket gratis: sekitar 100 email/hari. Disarankan untuk organisasi dengan domain sendiri.",
    ],
  },
  {
    id: "brevo", label: "Brevo (Sendinblue)", host: "smtp-relay.brevo.com", port: 587,
    userHint: "login SMTP dari akun Brevo", passHint: "SMTP key",
    notes: [
      "Username dan SMTP key ada di Brevo → SMTP & API. Verifikasi alamat/domain pengirim di Brevo lebih dulu.",
      "Paket gratis: sekitar 300 email/hari.",
    ],
  },
  {
    id: "custom", label: "Lainnya (isi manual)", host: "", port: 587,
    userHint: "noreply@email.com", passHint: "Password SMTP / API key",
    notes: ["Isi host, port, dan kredensial dari penyedia email Anda (Mailgun, Amazon SES, Zoho, dll.)."],
  },
];

function detectPreset(host: string): string {
  const h = host.trim().toLowerCase();
  return PRESETS.find((p) => p.host && p.host === h)?.id ?? (h ? "custom" : "");
}

export function EmailSettingsForm({
  slug,
  defaultValues,
  hasPassword,
}: {
  slug: string;
  defaultValues: DefaultValues;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const [pending,  setPending]  = React.useState(false);
  const [testing,  setTesting]  = React.useState(false);
  const [showPass, setShowPass] = React.useState(false);
  const [values,   setValues]   = React.useState<DefaultValues>(defaultValues);
  const [provider, setProvider] = React.useState<string>(detectPreset(defaultValues.host));
  const preset = PRESETS.find((p) => p.id === provider) ?? null;

  function applyPreset(id: string) {
    setProvider(id);
    const p = PRESETS.find((x) => x.id === id);
    if (!p || id === "custom") return;
    setValues((v) => ({ ...v, host: p.host, port: p.port, user: p.fixedUser ?? v.user }));
  }

  const set = (key: keyof DefaultValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [key]: key === "port" ? Number(e.target.value) : e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await saveSmtpConfigAction(slug, values);
      if (result.error) toast.error(result.error);
      else { toast.success("Konfigurasi SMTP disimpan."); router.refresh(); }
    } finally { setPending(false); }
  }

  async function handleTest() {
    if (!values.host || !values.user || (!values.password && !hasPassword)) {
      toast.error("Isi host, user, dan password terlebih dahulu.");
      return;
    }
    setTesting(true);
    toast.info("Mengirim email test...");
    try {
      const result = await sendTestEmailAction(slug, values);
      if (result.error) toast.error(result.error);
      else toast.success("Email test berhasil dikirim. Cek inbox kamu.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Penyedia */}
      <fieldset className="space-y-3">
        <legend className="w-full border-b pb-1.5 text-sm font-semibold text-foreground">
          Penyedia Email
        </legend>
        <div className="space-y-2">
          <Label>Pilih penyedia</Label>
          <Combobox
            options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
            value={provider}
            onValueChange={applyPreset}
            placeholder="Pilih penyedia email..."
            searchPlaceholder="Cari penyedia..."
            disabled={pending}
          />
        </div>
        {preset && (
          <ul className="list-disc space-y-1 rounded-lg bg-muted/50 py-3 pl-8 pr-3 text-xs text-muted-foreground">
            {preset.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Belum mengisi? Tidak masalah — notifikasi tetap terkirim lewat email platform atas nama organisasi Anda.
          Isi bagian ini bila ingin email keluar dari alamat organisasi sendiri.
        </p>
      </fieldset>

      {/* Server */}
      <fieldset className="space-y-4">
        <legend className="w-full border-b pb-1.5 text-sm font-semibold text-foreground">
          Server SMTP
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
          <div className="space-y-2">
            <Label htmlFor="smtpHost">Host</Label>
            <Input
              id="smtpHost"
              value={values.host}
              onChange={set("host")}
              placeholder="smtp.gmail.com"
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpPort">Port</Label>
            <Input
              id="smtpPort"
              type="number"
              value={values.port}
              onChange={set("port")}
              placeholder="587"
              min={1}
              max={65535}
              disabled={pending}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="smtpUser">Username</Label>
            <Input
              id="smtpUser"
              value={values.user}
              onChange={set("user")}
              placeholder={preset?.userHint ?? "noreply@email.com"}
              disabled={pending || !!preset?.fixedUser}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpPass">Password</Label>
            <div className="relative">
              <Input
                id="smtpPass"
                type={showPass ? "text" : "password"}
                value={values.password}
                onChange={set("password")}
                placeholder={hasPassword ? "Tersimpan — kosongkan untuk mempertahankan" : (preset?.passHint ?? "Password SMTP / API key")}
                className="pr-9"
                disabled={pending}
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </fieldset>

      {/* Pengirim */}
      <fieldset className="space-y-4">
        <legend className="w-full border-b pb-1.5 text-sm font-semibold text-foreground">
          Identitas Pengirim
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fromName">Nama Pengirim</Label>
            <Input
              id="fromName"
              value={values.fromName}
              onChange={set("fromName")}
              placeholder="IKPM Yogyakarta"
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fromEmail">Email Pengirim</Label>
            <Input
              id="fromEmail"
              type="email"
              value={values.fromEmail}
              onChange={set("fromEmail")}
              placeholder="noreply@ikpm.or.id"
              disabled={pending}
            />
          </div>
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={testing || pending}
          onClick={handleTest}
        >
          <Send className="mr-2 h-3.5 w-3.5" />
          {testing ? "Mengirim..." : "Kirim Test Email"}
        </Button>
      </div>
    </form>
  );
}
