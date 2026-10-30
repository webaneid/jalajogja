"use client";

import { useState, useTransition } from "react";
import { setTenantMailSenderAction } from "../../actions";

interface Props {
  slug:           string;
  current:        string;
  verifiedDomains: string[];
}

// Alamat From email notifikasi untuk tenant ini (dikirim lewat SMTP platform). Kosong = alamat bawaan platform.
// Domain harus sudah diverifikasi di penyedia SMTP & terdaftar di env SMTP_VERIFIED_DOMAINS.
export function MailSenderClient({ slug, current, verifiedDomains }: Props) {
  const [value, setValue]   = useState(current);
  const [pending, start]    = useTransition();
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState("");
  const changed = value.trim().toLowerCase() !== current;

  function handleSave() {
    setError(""); setSaved(false);
    start(async () => {
      const res = await setTenantMailSenderAction(slug, value);
      if ("error" in res) { setError(res.error); return; }
      setSaved(true);
    });
  }

  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="email"
          value={value}
          onChange={(e) => { setValue(e.target.value); setSaved(false); }}
          placeholder="noreply@domain-tenant.or.id (kosong = bawaan platform)"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={handleSave}
          disabled={pending || !changed}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {pending ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Domain terverifikasi:{" "}
        {verifiedDomains.length > 0
          ? <span className="font-mono">{verifiedDomains.join(", ")}</span>
          : <span className="text-amber-700">belum ada — isi env SMTP_VERIFIED_DOMAINS di server setelah domain diverifikasi di penyedia SMTP.</span>}
      </p>
      {saved && <p className="text-xs text-green-600">Tersimpan.</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
