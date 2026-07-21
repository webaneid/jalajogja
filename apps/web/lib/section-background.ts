// Standar background 5-opsi untuk section landing page — dikunci user 2026-07-22 sebagai pola
// BAKU untuk section BARU ke depan (dimulai dari section Tentang Kami). SENGAJA TIDAK
// diretrofit ke CTA (secondary/primary saja) atau Keunggulan/Layanan (light/primary/secondary/
// white) — keduanya baru selesai dan sudah dipakai, biarkan seperti sekarang (keputusan
// eksplisit user, lihat docs/arsitektur-tentang-kami-section.md § 5).

export const SECTION_BACKGROUND_IDS = ["none", "light", "primary", "secondary", "dark"] as const;
export type SectionBackground = typeof SECTION_BACKGROUND_IDS[number];

export const SECTION_BACKGROUND_LABELS: Record<SectionBackground, string> = {
  none:      "Tanpa Background",
  light:     "Terang",
  primary:   "Warna Utama",
  secondary: "Warna Sekunder",
  dark:      "Gelap",
};

export function resolveSectionBgClass(bg: SectionBackground): string {
  switch (bg) {
    case "primary":   return "bg-primary text-primary-foreground";
    case "secondary": return "bg-secondary text-secondary-foreground";
    case "dark":       return "bg-foreground text-background";
    case "light":      return "bg-muted/40";
    case "none":
    default:            return "";
  }
}

// Section dengan background berwarna (primary/secondary/dark) butuh variant tombol outline yang
// kontras otomatis (currentColor) — none/light pakai outline gelap biasa.
export function resolveOutlineButtonVariant(bg: SectionBackground): "outline-light" | "outline-dark" {
  return bg === "primary" || bg === "secondary" || bg === "dark" ? "outline-light" : "outline-dark";
}
