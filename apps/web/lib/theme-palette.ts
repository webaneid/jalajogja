// Konversi hex → RGB
function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

// Relative luminance (WCAG)
function luminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Warna teks (hitam/putih) untuk latar warna tertentu — kontras ≥ 4.5:1
export function foregroundFor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#ffffff";
  const lum = luminance(...rgb);
  // Kontras putih vs hitam: pilih yang lebih kontras
  return lum > 0.35 ? "#111111" : "#ffffff";
}

// Mix hex dengan putih sebesar ratio (0–1) → tint
function tint(hex: string, ratio: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const mix = (c: number) => Math.round(c + (255 - c) * ratio);
  return "#" + rgb.map(mix).map(n => n.toString(16).padStart(2, "0")).join("");
}

// Mix hex dengan hitam sebesar ratio → shade
function shade(hex: string, ratio: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const mix = (c: number) => Math.round(c * (1 - ratio));
  return "#" + rgb.map(mix).map(n => n.toString(16).padStart(2, "0")).join("");
}

// Font families yang perlu Google Fonts
const GOOGLE_FONT_SPEC: Record<string, string> = {
  "Poppins":           "Poppins:wght@400;500;600;700",
  "Philosopher":       "Philosopher:ital,wght@0,400;0,700;1,400",
  "Plus Jakarta Sans": "Plus+Jakarta+Sans:wght@400;500;600;700",
  "DM Sans":           "DM+Sans:wght@400;500;600",
  "Nunito":            "Nunito:wght@400;600;700",
  "Albert Sans":       "Albert+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400",
};

export function getGoogleFontsUrl(fonts: string[]): string | null {
  const specs = [...new Set(fonts)]
    .filter(f => GOOGLE_FONT_SPEC[f])
    .map(f => GOOGLE_FONT_SPEC[f]);
  if (specs.length === 0) return null;
  return `https://fonts.googleapis.com/css2?family=${specs.join("&family=")}&display=swap`;
}

export function fontStack(name: string): string {
  return `"${name}", system-ui, sans-serif`;
}

// CSS string yang di-inject ke <style> di PublicLayout
export function buildTenantThemeCss(opts: {
  primaryColor:   string;
  secondaryColor: string;
  bodyFont:       string;
  headingFont:    string;
}): string {
  const { primaryColor, secondaryColor, bodyFont, headingFont } = opts;

  const primaryFg      = foregroundFor(primaryColor);
  const secondaryFg    = foregroundFor(secondaryColor);

  // Palet primer: tints untuk bg-primary/10, bg-primary/20, dll
  const primaryLight10 = tint(primaryColor, 0.90);
  const primaryLight20 = tint(primaryColor, 0.80);
  const primaryLight   = tint(primaryColor, 0.60);
  const primaryDark    = shade(primaryColor, 0.15);

  // Palet sekunder
  const secondaryLight = tint(secondaryColor, 0.85);
  const secondaryDark  = shade(secondaryColor, 0.15);

  return `
/* ── Tema tenant — di-generate dari settings/display ── */
.public-layout {
  /* Override variabel Tailwind v4 untuk warna primer */
  --primary:             ${primaryColor};
  --primary-foreground:  ${primaryFg};
  --primary-light-10:    ${primaryLight10};
  --primary-light-20:    ${primaryLight20};
  --primary-light:       ${primaryLight};
  --primary-dark:        ${primaryDark};

  /* Override variabel Tailwind v4 untuk warna sekunder */
  --secondary:           ${secondaryColor};
  --secondary-foreground: ${secondaryFg};
  --secondary-light:     ${secondaryLight};
  --secondary-dark:      ${secondaryDark};

  /* Ring (focus) pakai warna primer */
  --ring: ${primaryColor};

  /* Font body — berlaku ke semua elemen turunan */
  font-family: ${fontStack(bodyFont)};
}

/* Font judul — h1–h4 di seluruh area publik */
.public-layout h1,
.public-layout h2,
.public-layout h3,
.public-layout h4 {
  font-family: ${fontStack(headingFont)};
}
`.trim();
}
