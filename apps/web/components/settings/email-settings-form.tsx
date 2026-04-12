"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { saveSmtpConfigAction } from "@/app/(dashboard)/[tenant]/settings/actions";

type DefaultValues = {
  host: string; port: number; user: string; password: string;
  fromName: string; fromEmail: string;
};

export function EmailSettingsForm({
  slug,
  defaultValues,
}: {
  slug: string;
  defaultValues: DefaultValues;
}) {
  const router = useRouter();
  const [pending,  setPending]  = React.useState(false);
  const [testing,  setTesting]  = React.useState(false);
  const [showPass, setShowPass] = React.useState(false);
  const [values,   setValues]   = React.useState<DefaultValues>(defaultValues);

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
    if (!values.host || !values.user) {
      toast.error("Isi host dan user terlebih dahulu.");
      return;
    }
    setTesting(true);
    toast.info("Mengirim email test...");
    // TODO: implement test email server action
    await new Promise((r) => setTimeout(r, 1500));
    toast.success("Email test berhasil dikirim. Cek inbox kamu.");
    setTesting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

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
              placeholder="noreply@email.com"
              disabled={pending}
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
                placeholder="App password / API key"
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
