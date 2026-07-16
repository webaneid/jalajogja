import type { ReactNode } from "react";

// Render teks dengan sintaks `*aksen*` (asterisk) sebagai <em> — dipakai di CTA section
// dan hero section untuk menandai frasa yang ingin ditonjolkan tanpa perlu field data terpisah.
// Contoh: "Bangun *Kota* Bersama Kami" → "Bangun " + <em>Kota</em> + " Bersama Kami"
export function renderAccentTitle(text: string): ReactNode[] {
  const parts = text.split(/\*([^*]+)\*/);
  return parts.map((part, i) => (i % 2 === 1 ? <em key={i}>{part}</em> : <span key={i}>{part}</span>));
}
