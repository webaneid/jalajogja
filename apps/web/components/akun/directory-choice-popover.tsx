"use client";

import { Briefcase, Building2, BookOpen } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { EkosistemModulesConfig } from "@/lib/ekosistem-modules";

// Popup pilihan 3 arah — dipakai saat profil pribadi SUDAH lengkap, tinggal minimal 1 dari
// Usaha/Profesional/Pesantren yang belum diisi. Menggantikan link langsung ke /gabung yang
// sebelumnya membingungkan (klik "Lengkapi Data" tapi malah masuk halaman pendaftaran forum
// yang belum bisa diproses). Lihat docs/arsitektur-backbone-ikpm.md § "Alur Pendaftaran
// Forum v2 — Overlay".
//
// `enabledModules` opsional — kalau tidak dikirim (mis. caller lama), semua 3 opsi tampil
// (perilaku lama). Kalau dikirim, opsi yang dimatikan admin tenant ini disembunyikan — lihat
// lib/ekosistem-modules.ts + docs/arsitektur-ekosistem.md.
const OPTIONS = [
  { moduleKey: "profesional" as const, href: "/akun/profesional", icon: Briefcase, label: "Saya seorang profesional" },
  { moduleKey: "usaha"       as const, href: "/akun/usaha",       icon: Building2, label: "Saya memiliki usaha" },
  { moduleKey: "pesantren"   as const, href: "/akun/pesantren",   icon: BookOpen,  label: "Saya memiliki lembaga pendidikan/kursus" },
];

export function DirectoryChoicePopover({ baseUrl, enabledModules }: {
  baseUrl: string;
  enabledModules?: EkosistemModulesConfig;
}) {
  const options = OPTIONS.filter((opt) => !enabledModules || enabledModules[opt.moduleKey]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="btn btn-outline-dark btn-sm">
          Lengkapi Data →
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="center">
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Pilih salah satu yang sesuai dengan Anda:
        </p>
        <div className="flex flex-col gap-1">
          {options.map(({ moduleKey, href, icon: Icon, label }) => (
            <a
              key={moduleKey}
              href={`${baseUrl}${href}`}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/60 transition-colors"
            >
              <Icon className="h-4 w-4 text-primary shrink-0" />
              {label}
            </a>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
