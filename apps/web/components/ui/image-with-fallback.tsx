"use client";

import { useEffect, useState } from "react";
import Image, { type ImageProps } from "next/image";

// Wrapper <Image> yang otomatis fallback ke variant "original" (_ori.webp) kalau variant yang
// diminta (mis. _th/_lg/_sq) gagal load (404) — untuk record LAMA yang cuma sempat generate
// sebagian variant saat upload (lihat CLAUDE.md lesson "Regresi Foto Sampul Usaha" +
// "Bug Fix Sistem Crop Gambar"). Menjamin foto yang sudah diupload anggota TIDAK PERNAH hilang
// begitu saja di halaman publik, terlepas dari variant mana yang genuinely tersimpan di storage.
//
// Duplikasi pure suffix-swap logic dari lib/image-processor.ts SENGAJA (bukan import) — file itu
// import `sharp` di level modul, tidak aman dibawa ke client bundle (lihat lesson client/server
// boundary lain di project ini: nav-menu.ts/tenant-timezone.ts, dst).
function toOriginalUrl(url: string): string {
  return url.replace(/_(lg|md|th|sq|sql|pf)\.webp$/, "_ori.webp");
}

type Props = Omit<ImageProps, "src"> & { src: string };

export function ImageWithFallback({ src, ...props }: Props) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [failed, setFailed] = useState(false);

  // Sinkronkan ulang kalau prop src berubah (mis. dipakai di form yang bisa ganti gambar) —
  // useState(src) cuma dipakai sekali sebagai initial value, tidak otomatis ikut prop berikutnya.
  useEffect(() => {
    setCurrentSrc(src);
    setFailed(false);
  }, [src]);

  return (
    <Image
      {...props}
      src={currentSrc}
      onError={() => {
        if (!failed) {
          setFailed(true);
          setCurrentSrc(toOriginalUrl(src));
        }
      }}
    />
  );
}
