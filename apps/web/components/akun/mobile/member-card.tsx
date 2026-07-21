import { BadgeCheck } from "lucide-react";

// Kartu identitas anggota — inspirasi visual dari design-refs/akun/design-mobile-akun.jpg
// (kartu bank pada mockup fintech), TAPI warna diambil dari tema tenant (--primary CSS var,
// via bg-primary/text-primary-foreground — TIDAK hardcode warna mockup), bukan ditiru literal.
// Server component murni — semua data sudah di-resolve di page.tsx pemanggilnya.
type Props = {
  type:              "member" | "public";
  name:              string;
  photoUrl:          string | null;
  memberNumber:      string | null;
  stambuk:           string | null;
  primaryCabangNama: string | null;
  orgLabel:          string;
  logoUrl:           string | null;
  siteName:          string;
};

export function MemberCard({
  type, name, memberNumber, stambuk, primaryCabangNama, orgLabel, logoUrl, siteName,
}: Props) {
  const isMember = type === "member";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg">
      {/* Aksen dekoratif — lingkaran transparan, murni visual */}
      <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary-foreground/10" />
      <div className="pointer-events-none absolute -bottom-10 -right-2 h-24 w-24 rounded-full bg-primary-foreground/10" />

      <div className="relative flex items-center justify-between">
        {logoUrl ? (
          // brightness-0 invert — paksa logo (apa pun warna aslinya) jadi putih solid,
          // konsisten di atas background bg-primary manapun warna tenantnya. Tanpa bingkai
          // (bg/padding/rounded) — logo tampil polos, ukuran diperbesar supaya tetap terlihat.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={siteName} className="h-10 w-10 shrink-0 object-contain brightness-0 invert" />
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-foreground/15 text-xs font-bold text-white">
            {siteName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="shrink-0 rounded-full bg-primary-foreground/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide">
          {isMember ? "Kartu Anggota" : "Akun Publik"}
        </span>
      </div>

      <div className="relative mt-6">
        <p className="text-lg font-bold leading-tight">{name}</p>
        {isMember && memberNumber && (
          <p className="mt-1 font-mono text-sm tracking-[0.15em] text-primary-foreground/90">
            {memberNumber}
          </p>
        )}
        {isMember && !memberNumber && stambuk && (
          <p className="mt-1 font-mono text-sm tracking-[0.15em] text-primary-foreground/90">
            Stambuk {stambuk}
          </p>
        )}
      </div>

      <div className="relative mt-5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-primary-foreground/60">
            {isMember ? "PC IKPM" : "Status"}
          </p>
          <p className="truncate text-xs font-medium">
            {isMember ? (primaryCabangNama ?? "Belum dipilih") : orgLabel}
          </p>
        </div>
        {isMember && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary-foreground/15 px-2 py-1 text-[10px] font-medium">
            <BadgeCheck className="h-3 w-3" />
            Aktif
          </span>
        )}
      </div>
    </div>
  );
}
