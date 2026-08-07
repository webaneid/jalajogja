import type { ReactNode } from "react";
import type { MemberEligibilityField } from "@/lib/member-eligibility";
import type { EkosistemModule, EkosistemModulesConfig, EkosistemModuleLabels } from "@/lib/ekosistem-modules";
import { ALL_EKOSISTEM_MODULES, resolveEkosistemModuleLabel } from "@/lib/ekosistem-modules";
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
// 4 kondisi tombol (bukan cuma eligible/tidak) — supaya tombol selalu mengarahkan ke
// tempat yang BENAR-BENAR bisa diproses, bukan selalu ke /gabung:
//   1. Profil pribadi belum lengkap (field apa pun di luar "directory" masih hilang) →
//      "Lengkapi Data Pribadi" → langsung ke /akun/lengkapi.
//   2. Profil pribadi lengkap, tinggal "directory", DAN member sudah MULAI mengisi salah
//      satu modul (punya baris) tapi field wajibnya belum lengkap → langsung ke modul itu
//      ("Lengkapi Data Usaha Anda"), bukan minta pilih ulang — mereka sudah memilih.
//   3. Profil pribadi lengkap, tinggal "directory", member BELUM mulai isi modul apa pun →
//      "Lengkapi Data →" → popup 3 pilihan (DirectoryChoicePopover).
//   4. Semua syarat terpenuhi:
//      - Forum → "Gabung {tenantName}" → /gabung (satu-satunya kasus yang benar-benar
//        boleh masuk /gabung, karena di situ tombol join sungguhan aktif).
//      - Cabang/marhalah → caller sudah tidak render overlay ini sama sekali di kondisi
//        ini (lihat catatan di atas) — cabang tetap dijaga di sini secara defensif.

type Props = {
  tenantName: string;
  missing:    MemberEligibilityField[];
  // Kalau "directory" ada di `missing` DAN member sudah mulai isi salah satu modul (punya
  // baris) tapi belum lengkap field wajibnya — modul itu (lihat lib/member-eligibility.ts).
  // `null` = belum mulai isi modul mana pun sama sekali (tetap popup pilih salah satu).
  directoryIncompleteModule: EkosistemModule | null;
  baseUrl:    string;
  isForum:    boolean;
  // Sudah GENUINELY menjadi anggota tenant ini (forumStatus='active' untuk forum, atau
  // baris tenant_memberships sudah ada untuk cabang/marhalah) — MESKI datanya belum
  // eligible. Menentukan framing pesan: kalau sudah anggota, jangan bilang "sebelum
  // dapat mendaftar" (kontradiktif dengan kartu No. Anggota/Status di baliknya yang
  // sudah menunjukkan mereka anggota aktif) — pakai framing "lengkapi data" saja.
  isJoined:   boolean;
  // Modul mana yang aktif di tenant ini — diteruskan ke DirectoryChoicePopover supaya
  // popup 3 pilihan hanya menampilkan modul yang benar-benar ditawarkan tenant ini.
  enabledModules?: EkosistemModulesConfig;
  // Label custom nama modul (2026-08-07, /ekosistem/pengaturan) — dipakai untuk pesan
  // spesifik-modul ("Lengkapi Data {label} Anda"). TIDAK dipakai DirectoryChoicePopover —
  // opsinya kalimat deskriptif ("Saya memiliki usaha"), bukan sekadar nama modul, rename
  // tidak natural disisipkan ke situ.
  moduleLabels?: EkosistemModuleLabels;
  // Ada invoice OUTSTANDING (belum lunas) hasil komitmen /gabung (produk/donasi yang
  // ditambahkan lewat GabungItemWidget) — PRIORITAS TERTINGGI di atas semua state lain:
  // user SUDAH commit membayar, overlay harus mengarahkan mereka melunasi, bukan menyuruh
  // "Lengkapi Data"/"Gabung X" dari awal lagi. Secara struktural hanya pernah diisi saat
  // isForum=true (dihitung caller di dalam blok forum-only) — cabang/marhalah tidak punya
  // konsep komitmen pembayaran gabung. Lihat docs/arsitektur-gabung-forum.md § "Koreksi:
  // Komitmen Cart Selalu Menahan Aktivasi Sampai Bayar".
  pendingInvoiceId?: string | null;
};

export function MembershipEligibilityOverlay({
  tenantName, missing, directoryIncompleteModule, baseUrl, isForum, isJoined, enabledModules,
  pendingInvoiceId, moduleLabels,
}: Props) {
  const eligible             = missing.length === 0;
  const onlyDirectoryMissing = missing.length === 1 && missing[0] === "directory";

  // Defensif: cabang/marhalah yang sudah eligible DAN tidak punya invoice pending seharusnya
  // tidak pernah sampai render komponen ini (caller sudah berhenti menampilkannya) — kalau
  // tetap terpanggil, jangan tampilkan apa pun daripada salah menyarankan "Gabung X" untuk
  // tenant yang tidak punya alur /gabung.
  if (eligible && !isForum && !pendingInvoiceId) return null;

  const moduleLabel = directoryIncompleteModule
    ? resolveEkosistemModuleLabel(directoryIncompleteModule, moduleLabels ?? {})
    : null;

  // Fallback generik "Usaha/Profesional/Pesantren" untuk kasus belum mulai isi modul mana pun
  // — kalau moduleLabels diisi, susun ulang dari label CUSTOM (bukan literal kanonik) sesuai
  // modul yang aktif untuk tenant ini.
  const genericDirectoryLabel = (enabledModules
    ? ALL_EKOSISTEM_MODULES.filter((m) => enabledModules[m])
    : ALL_EKOSISTEM_MODULES
  ).map((m) => resolveEkosistemModuleLabel(m, moduleLabels ?? {})).join("/");

  let message: ReactNode;
  let action:  ReactNode;

  if (pendingInvoiceId) {
    message = (
      <>Anda sudah memilih untuk mendukung <strong>{tenantName}</strong> — selesaikan
        pembayaran untuk melengkapi keanggotaan Anda.</>
    );
    action = (
      <a href={`${baseUrl}/invoice/${pendingInvoiceId}`} className="btn btn-primary btn-md">
        Lunasi Pembayaran →
      </a>
    );
  } else if (eligible) {
    message = <>Data Anda lengkap. Jika ingin mendaftar menjadi anggota <strong>{tenantName}</strong>, klik tombol di bawah ini:</>;
    action  = <a href={`${baseUrl}/gabung`} className="btn btn-primary btn-md">Gabung {tenantName}</a>;
  } else if (onlyDirectoryMissing && moduleLabel && directoryIncompleteModule) {
    message = isJoined ? (
      <>Anda sudah menjadi anggota <strong>{tenantName}</strong>. Lengkapi Data {moduleLabel} Anda —
        masih ada bagian wajib yang belum terisi.</>
    ) : (
      <>Sebelum dapat mendaftar menjadi anggota <strong>{tenantName}</strong>, lengkapi Data
        {" "}{moduleLabel} Anda — masih ada bagian wajib yang belum terisi.</>
    );
    action = (
      <a href={`${baseUrl}/akun/${directoryIncompleteModule}`} className="btn btn-outline-dark btn-sm">
        Lengkapi Data {moduleLabel} →
      </a>
    );
  } else if (onlyDirectoryMissing) {
    message = isJoined ? (
      <>Anda sudah menjadi anggota <strong>{tenantName}</strong>. Lengkapi salah satu dari
        data {genericDirectoryLabel} Anda agar profil keanggotaan tercatat dengan benar.</>
    ) : (
      <>Anda harus melengkapi salah satu dari data {genericDirectoryLabel} Anda
        terlebih dahulu sebelum dapat mendaftar menjadi anggota <strong>{tenantName}</strong></>
    );
    action = <DirectoryChoicePopover baseUrl={baseUrl} enabledModules={enabledModules} />;
  } else {
    message = isJoined ? (
      <>Anda sudah menjadi anggota <strong>{tenantName}</strong>. Lengkapi profil Anda agar
        data keanggotaan tercatat dengan benar.</>
    ) : (
      <>Anda harus melengkapi profil Anda terlebih dahulu sebelum dapat mendaftar menjadi
        anggota <strong>{tenantName}</strong></>
    );
    action = (
      <a href={`${baseUrl}/akun/lengkapi`} className="btn btn-outline-dark btn-sm">
        Lengkapi Data Pribadi
      </a>
    );
  }

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-background/80 p-6 text-center backdrop-blur-lg shadow-lg">
      <p className="text-sm font-semibold leading-snug">{message}</p>
      {action}
    </div>
  );
}
