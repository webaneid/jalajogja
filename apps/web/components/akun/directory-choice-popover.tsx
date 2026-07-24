"use client";

import { Briefcase, Building2, BookOpen } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Popup pilihan 3 arah — dipakai saat profil pribadi SUDAH lengkap, tinggal minimal 1 dari
// Usaha/Profesional/Pesantren yang belum diisi. Menggantikan link langsung ke /gabung yang
// sebelumnya membingungkan (klik "Lengkapi Data" tapi malah masuk halaman pendaftaran forum
// yang belum bisa diproses). Lihat docs/arsitektur-backbone-ikpm.md § "Alur Pendaftaran
// Forum v2 — Overlay".
export function DirectoryChoicePopover({ baseUrl }: { baseUrl: string }) {
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
          <a
            href={`${baseUrl}/akun/profesional`}
            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/60 transition-colors"
          >
            <Briefcase className="h-4 w-4 text-primary shrink-0" />
            Saya seorang profesional
          </a>
          <a
            href={`${baseUrl}/akun/usaha`}
            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/60 transition-colors"
          >
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            Saya memiliki usaha
          </a>
          <a
            href={`${baseUrl}/akun/pesantren`}
            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/60 transition-colors"
          >
            <BookOpen className="h-4 w-4 text-primary shrink-0" />
            Saya memiliki lembaga pendidikan/kursus
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
