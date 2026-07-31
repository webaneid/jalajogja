import type { MemberEligibilityField } from "@/lib/member-eligibility";
import type { EkosistemModulesConfig } from "@/lib/ekosistem-modules";
import { DirectoryChoicePopover } from "@/components/akun/directory-choice-popover";

// Overlay glass-effect yang menutupi kartu keanggotaan di /akun — standar UMUM untuk
// SEMUA tipe tenant (cabang/marhalah/forum), bukan cuma forum. Kartu di belakangnya
// (MemberCard / kartu "Info keanggotaan") TETAP dirender di DOM, sengaja tidak
// disembunyikan — cuma ketutup visual. Lihat docs/arsitektur-akun.md § "Eligibility
// Overlay Generik".
//
// Kapan overlay ini tampil (ditentukan CALLER, lihat akun/page.tsx):
//   - Cabang/marhalah: HANYA selama belum eligible (data pribadi belum lengkap). Begitu
//     eligible, keanggotaan SUDAH otomatis (auto-populate) — caller TIDAK render overlay
//     lagi, kartu langsung tampil normal. Prop isForum=false di sini.
//   - Forum: tampil selama belum GENUINELY forumStatus='active' — termasuk kasus "sudah
//     eligible tapi belum klik gabung", karena forum butuh langkah `/gabung` eksplisit.
//     Prop isForum=true.
//
// 3 kondisi tombol (bukan cuma eligible/tidak) — supaya tombol selalu mengarahkan ke
// tempat yang BENAR-BENAR bisa diproses, bukan selalu ke /gabung:
//   1. Profil pribadi belum lengkap (field apa pun di luar "directory" masih hilang) →
//      "Lengkapi Data Pribadi" → langsung ke /akun/lengkapi.
//   2. Profil pribadi SUDAH lengkap, tinggal minimal 1 dari Usaha/Profesional/Pesantren →
//      "Lengkapi Data →" → popup 3 pilihan (DirectoryChoicePopover).
//   3. Semua syarat terpenuhi:
//      - Forum → "Gabung {tenantName}" → /gabung (satu-satunya kasus yang benar-benar
//        boleh masuk /gabung, karena di situ tombol join sungguhan aktif).
//      - Cabang/marhalah → caller sudah tidak render overlay ini sama sekali di kondisi
//        ini (lihat catatan di atas) — cabang tetap dijaga di sini secara defensif.

type Props = {
  tenantName: string;
  missing:    MemberEligibilityField[];
  baseUrl:    string;
  isForum:    boolean;
  // Modul mana yang aktif di tenant ini — diteruskan ke DirectoryChoicePopover supaya
  // popup 3 pilihan hanya menampilkan modul yang benar-benar ditawarkan tenant ini.
  enabledModules?: EkosistemModulesConfig;
};

export function MembershipEligibilityOverlay({ tenantName, missing, baseUrl, isForum, enabledModules }: Props) {
  const eligible             = missing.length === 0;
  const onlyDirectoryMissing = missing.length === 1 && missing[0] === "directory";

  // Defensif: cabang/marhalah yang sudah eligible seharusnya tidak pernah sampai render
  // komponen ini (caller sudah berhenti menampilkannya) — kalau tetap terpanggil, jangan
  // tampilkan apa pun daripada salah menyarankan "Gabung X" untuk tenant yang tidak
  // punya alur /gabung.
  if (eligible && !isForum) return null;

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-background/80 p-6 text-center backdrop-blur-lg shadow-lg">
      <p className="text-sm font-semibold leading-snug">
        {eligible ? (
          <>Data Anda lengkap. Jika ingin mendaftar menjadi anggota <strong>{tenantName}</strong>, klik tombol di bawah ini:</>
        ) : onlyDirectoryMissing ? (
          <>Anda harus melengkapi salah satu dari data Usaha/Profesional/Pesantren Anda
            terlebih dahulu sebelum dapat mendaftar menjadi anggota <strong>{tenantName}</strong></>
        ) : (
          <>Anda harus melengkapi profil Anda terlebih dahulu sebelum dapat mendaftar menjadi
            anggota <strong>{tenantName}</strong></>
        )}
      </p>

      {eligible ? (
        <a href={`${baseUrl}/gabung`} className="btn btn-primary btn-md">
          Gabung {tenantName}
        </a>
      ) : onlyDirectoryMissing ? (
        <DirectoryChoicePopover baseUrl={baseUrl} enabledModules={enabledModules} />
      ) : (
        <a href={`${baseUrl}/akun/lengkapi`} className="btn btn-outline-dark btn-sm">
          Lengkapi Data Pribadi
        </a>
      )}
    </div>
  );
}
