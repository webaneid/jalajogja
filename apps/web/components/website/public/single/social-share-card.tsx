"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { FaWhatsapp, FaFacebook, FaXTwitter } from "react-icons/fa6";

type Props = {
  url:   string;   // URL absolut halaman (termasuk domain)
  title: string;
};

// Card share sosial media di shell mobile halaman single — WhatsApp/Facebook/X/Copy Link.
// Reuse pola CopyButton dari invoice-public-client.tsx (state "copied" 2 detik).
export function SocialShareCard({ url, title }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const encodedUrl   = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const links = [
    { label: "WhatsApp", icon: FaWhatsapp, href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`, className: "bg-[#25D366] text-white" },
    { label: "Facebook", icon: FaFacebook, href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, className: "bg-[#1877F2] text-white" },
    { label: "X",        icon: FaXTwitter, href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`, className: "bg-black text-white" },
  ];

  return (
    <div className="rounded-xl border border-border p-3 flex items-center gap-3">
      <span className="text-sm font-medium text-muted-foreground shrink-0">Bagikan</span>
      <div className="flex items-center gap-2">
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Bagikan ke ${l.label}`}
            className={`flex items-center justify-center h-8 w-8 rounded-full ${l.className}`}
          >
            <l.icon size={15} />
          </a>
        ))}
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Salin link"
          className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check size={15} className="text-green-600" /> : <Link2 size={15} />}
        </button>
      </div>
    </div>
  );
}
