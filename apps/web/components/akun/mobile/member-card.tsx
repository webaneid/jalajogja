// Kartu identitas anggota — inspirasi visual dari design-refs/akun/design-mobile-akun.jpg
// (kartu bank pada mockup fintech), TAPI warna diambil dari tema tenant (--primary CSS var,
// via bg-primary/text-primary-foreground — TIDAK hardcode warna mockup), bukan ditiru literal.
// Server component murni — semua data sudah di-resolve di page.tsx pemanggilnya.
type Props = {
  type:         "member" | "public";
  name:         string;
  photoUrl:     string | null;
  memberNumber: string | null;
  stambuk:      string | null;
  logoUrl:      string | null;
  siteName:     string;
};

export function MemberCard({
  type, name, memberNumber, stambuk, logoUrl, siteName,
}: Props) {
  const isMember = type === "member";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg">
      {/* Aksen dekoratif — lingkaran transparan, murni visual */}
      <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary-foreground/10" />
      <div className="pointer-events-none absolute -bottom-10 -right-2 h-24 w-24 rounded-full bg-primary-foreground/10" />

      <div className="relative flex items-center">
        {logoUrl ? (
          // brightness-0 invert — paksa logo (apa pun warna aslinya) jadi putih solid,
          // konsisten di atas background bg-primary manapun warna tenantnya. Tanpa bingkai
          // (bg/padding/rounded) — logo tampil polos. Lebar calc(var(--spacing)*17) = w-17
          // di Tailwind v4 (utility dinamis, setara persis nilai yang diminta).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={siteName} className="h-10 w-17 shrink-0 object-contain brightness-0 invert" />
        ) : (
          <div className="flex h-10 w-17 shrink-0 items-center justify-center rounded-md bg-primary-foreground/15 text-xs font-bold text-white">
            {siteName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="relative mt-6">
        <p className="text-lg font-bold leading-tight">{name}</p>
        {isMember && memberNumber && (
          <p className="mt-1 font-mono text-xl tracking-[0.15em] text-primary-foreground/90">
            {memberNumber}
          </p>
        )}
        {isMember && !memberNumber && stambuk && (
          <p className="mt-1 font-mono text-xl tracking-[0.15em] text-primary-foreground/90">
            Stambuk {stambuk}
          </p>
        )}
      </div>

      {/* Baris bawah — nama SUDAH tampil besar di tengah, jadi bagian ini bukan echo nama lagi
          (dulu begitu, tapi jadi pengulangan) — sekarang identitas organisasi IKPM secara
          statis ("Ikatan Keluarga" / "Pondok Modern Gontor", nama lengkap IKPM), + badge nama
          tenant generik (bukan hardcode "PC IKPM {cabang}", supaya cocok untuk tenant tipe apa
          pun: cabang, marhalah, forum, dst — mis. "Visikita"). */}
      <div className="relative mt-5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-primary-foreground/60">
            Ikatan Keluarga
          </p>
          <p className="truncate text-xs font-medium">Pondok Modern Gontor</p>
        </div>
        <span className="shrink-0 rounded-full bg-primary-foreground/15 px-2.5 py-1 text-[10px] font-medium">
          {siteName}
        </span>
      </div>
    </div>
  );
}
