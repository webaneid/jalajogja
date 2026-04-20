"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitContactFormAction } from "@/app/(public)/[tenant]/[pageSlug]/actions";
import type { ContactBody } from "@/lib/page-templates";

type ContactSettings = {
  contact_email?:   string;
  contact_phone?:   string;
  contact_address?: { detail?: string };
  socials?:         Record<string, string>;
};

type Props = {
  tenantSlug: string;
  pageId:     string;
  title:      string;
  body:       ContactBody;
  settings:   ContactSettings;
};

export function ContactTemplate({ tenantSlug, pageId, title, body, settings }: Props) {
  const [pending,  setPending]  = useState(false);
  const [result,   setResult]   = useState<{ success: boolean; message: string } | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", message: "" });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData();
    fd.set("name",    formData.name);
    fd.set("email",   formData.email);
    fd.set("phone",   formData.phone);
    fd.set("message", formData.message);
    const res = await submitContactFormAction(tenantSlug, pageId, fd);
    if (res.success) {
      setResult({ success: true, message: body.successMsg ?? res.message });
      setFormData({ name: "", email: "", phone: "", message: "" });
    } else {
      setResult({ success: false, message: res.error });
    }
    setPending(false);
  }

  const email   = settings.contact_email;
  const phone   = settings.contact_phone;
  const address = settings.contact_address;
  const socials = settings.socials;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-10">{body.customTitle || title}</h1>

      <div className="grid md:grid-cols-2 gap-10">
        {/* Info kontak */}
        <div className="space-y-5">
          <h2 className="text-lg font-semibold">Informasi Kontak</h2>
          {email   && <div className="text-sm">📧 <a href={`mailto:${email}`} className="text-primary underline">{email}</a></div>}
          {phone   && <div className="text-sm">📞 <a href={`tel:${phone}`}   className="text-primary underline">{phone}</a></div>}
          {address?.detail && <div className="text-sm">📍 {address.detail}</div>}

          {socials && Object.entries(socials).filter(([, url]) => url).length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {Object.entries(socials)
                .filter(([, url]) => url)
                .map(([platform, url]) => (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 border border-border rounded-full hover:border-primary hover:text-primary transition-colors capitalize"
                  >
                    {platform}
                  </a>
                ))}
            </div>
          )}
        </div>

        {/* Form */}
        {body.showForm && (
          <div>
            <h2 className="text-lg font-semibold mb-5">Kirim Pesan</h2>
            {result ? (
              <div className={`rounded-lg p-4 text-sm ${result.success ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
                {result.message}
                {result.success && (
                  <button onClick={() => setResult(null)} className="block mt-2 text-xs underline">
                    Kirim pesan lain
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nama <span className="text-destructive">*</span></Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Nama lengkap"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                      placeholder="email@..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>No. HP</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="08xx..."
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Pesan <span className="text-destructive">*</span></Label>
                  <Textarea
                    value={formData.message}
                    onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
                    placeholder="Tulis pesan Anda..."
                    rows={5}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? "Mengirim..." : "Kirim Pesan"}
                </Button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Google Maps embed */}
      {body.showMap && body.mapEmbedUrl && (
        <div className="mt-10 rounded-xl overflow-hidden border border-border">
          <iframe
            src={body.mapEmbedUrl}
            width="100%"
            height="400"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}
    </div>
  );
}
