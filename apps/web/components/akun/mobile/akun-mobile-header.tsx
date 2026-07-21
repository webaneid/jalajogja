import { Bell } from "lucide-react";

// Header "app mode" /akun di mobile — pengganti site header (disembunyikan via isAkunAppMode,
// lihat lib/mobile-route-checks.ts). Server component murni, tidak ada interaktivitas —
// ikon lonceng notifikasi SENGAJA tanpa onClick (sistem notifikasi in-app belum ada, keputusan
// user: tampil untuk kelengkapan visual, non-fungsi — docs terkait § arsitektur-akun.md).
type Props = {
  name:       string;
  avatarUrl:  string;
  badgeLabel: string;
};

export function AkunMobileHeader({ name, avatarUrl, badgeLabel }: Props) {
  return (
    // Gradasi secondary→putih (BUKAN primary→secondary — dikoreksi 2026-07-21) + padding-bottom
    // lebar SENGAJA (bukan tinggi wajar untuk konten header semata) — area ini "melebar" ke
    // bawah supaya MemberCard (akun/page.tsx, ditarik naik via -mt-16) tampak mengambang di atas
    // gradasi. text-secondary-foreground (bukan primary-foreground) — kontras dihitung terhadap
    // warna secondary, bukan primary, karena background sekarang secondary di bagian atas (tempat
    // konten berada). Lihat docs/arsitektur-akun.md § Mobile App Mode.
    <div className="flex items-center justify-between gap-3 bg-gradient-to-b from-secondary to-white px-4 pb-28 pt-5 text-secondary-foreground">
      <div className="flex items-center gap-3 min-w-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl}
          alt={name}
          className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-secondary-foreground/40"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Halo, {name}</p>
          <p className="truncate text-xs text-secondary-foreground/70">{badgeLabel}</p>
        </div>
      </div>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-foreground/15">
        <Bell className="h-4 w-4" />
      </div>
    </div>
  );
}
