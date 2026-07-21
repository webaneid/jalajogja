type Props = {
  href:       string;
  label?:     string;
  className?: string;
};

// Tombol "Lihat Semua" bordered-pill — dipakai bersama oleh PostsSectionTitle (Post/Produk/
// Campaign/Event) dan SectionTitleBlock (Keunggulan/Tentang Kami/Galeri). BUKAN turunan dari
// `.btn-ghost` (Public Button System) — nama sama tapi visual berbeda (`.btn-ghost` = link tipis
// tanpa border, dipakai sistem tombol publik lain); komponen ini berdiri sendiri agar tidak
// menimpa `.btn-ghost` yang sudah dipakai luas. Warna ikut branding tenant otomatis via
// hover:border-primary/hover:text-primary (CSS var --primary per-tenant).
export function SectionSeeAllLink({ href, label = "Lihat Semua", className }: Props) {
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-[7px] shrink-0 rounded-md border-[1.5px] border-border bg-background px-[1.4rem] py-[0.72rem] text-[0.95rem] font-medium text-muted-foreground shadow-sm transition-all duration-200 hover:border-primary hover:text-primary ${className ?? ""}`}
    >
      {label}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </a>
  );
}
