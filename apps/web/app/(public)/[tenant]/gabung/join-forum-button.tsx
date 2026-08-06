"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { joinForumAction } from "./actions";
import { LegalModal } from "@/components/akun/legal-modal";

type Props = { slug: string; baseUrl: string; tenantName: string };

// Checkbox "Dengan ini saya menyatakan setuju..." + tombol "Gabung" DIRENDER DUA KALI
// (desktop hidden md:block normal + mobile md:hidden fixed bottom bar) — sama seperti
// `agreed`/`pending`/`error` state di komponen PARENT (satu instance React, dua tempat
// render), jadi state tetap sinkron otomatis. `idSuffix` mencegah duplikat id="..."/
// htmlFor="..." di DOM antara kedua render tsb.
export function AgreementFields({
  idSuffix, agreed, onAgreedChange, onOpenTerms, onOpenPrivacy,
}: {
  idSuffix: string;
  agreed: boolean;
  onAgreedChange: (v: boolean) => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
}) {
  const id = `gabung-agreed-${idSuffix}`;
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={agreed}
        onChange={(e) => onAgreedChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary cursor-pointer"
      />
      <label htmlFor={id} className="text-sm text-muted-foreground leading-snug cursor-pointer select-none">
        Dengan ini saya menyatakan menyetujui{" "}
        <button type="button" onClick={onOpenTerms} className="text-primary hover:underline font-medium">
          Syarat dan Ketentuan
        </button>{" "}serta{" "}
        <button type="button" onClick={onOpenPrivacy} className="text-primary hover:underline font-medium">
          Kebijakan Privasi
        </button>.
      </label>
    </div>
  );
}

export function JoinForumButton({ slug, baseUrl, tenantName }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [joined, setJoined] = useState(false);
  const [modalTpl, setModalTpl] = useState<"terms" | "privacy" | null>(null);

  // Tinggi bar fixed mobile diukur langsung (bukan angka tetap) — teks persetujuan bisa wrap
  // 2-3 baris tergantung lebar layar, spacer yang salah tebak akan menutupi/menyisakan celah
  // di konten sebelum bar ini. Lihat docs/arsitektur-mobile-shell.md § spacer.
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);

  useEffect(() => {
    const el = barRef.current;
    if (!el || joined) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setBarHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [joined]);

  function handleJoin() {
    setError(null);
    startTransition(async () => {
      const result = await joinForumAction(slug);
      if (!result.success) {
        setError(result.error);
        return;
      }
      // TIDAK PERNAH redirect otomatis — tetap di /gabung, status sukses tampil inline.
      // Navigasi ke /akun hanya lewat tombol eksplisit di bawah (aksi user, bukan paksaan).
      setJoined(true);
    });
  }

  if (joined) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">
          Anda sekarang anggota resmi <strong>{tenantName}</strong>. Selamat bergabung!
        </p>
        <a href={`${baseUrl}/akun`} className="btn btn-primary btn-lg btn-full">
          Ke Akun Saya →
        </a>
      </div>
    );
  }

  return (
    <>
      {/* Desktop/tablet — blok biasa mengikuti alur halaman, tidak fixed. */}
      <div className="hidden md:block space-y-3">
        <AgreementFields
          idSuffix="desktop"
          agreed={agreed}
          onAgreedChange={setAgreed}
          onOpenTerms={() => setModalTpl("terms")}
          onOpenPrivacy={() => setModalTpl("privacy")}
        />
        <button
          type="button"
          onClick={handleJoin}
          disabled={pending || !agreed}
          className="btn btn-primary btn-lg btn-full"
        >
          {pending ? "Memproses..." : "Ya, Saya Ingin Bergabung"}
        </button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {/* Mobile — fixed bottom bar, SELALU tampil (bukan bottom sheet yang bisa
          collapse/hilang). z-[72] sengaja SATU TINGKAT di atas MobileActionSheet (z-[71], bar
          tertinggi yang sudah ada di codebase ini) supaya menang atas fixed footer LAIN apa pun
          yang mungkin ada di halaman ini — situs sendiri (BottomNav z-50) sudah tidak dirender
          di /gabung (lihat isSingleMobileRoute di lib/mobile-route-checks.ts), tapi z-index ini
          tetap dijaga tinggi untuk jaga-jaga. */}
      {/* mt-0 wajib — parent pakai space-y-*, tanpa override ini spacer+bar dapat margin-top
          tak diinginkan (lihat lesson "space-y-* :where() spesifisitas 0" di CLAUDE.md). */}
      <div className="md:hidden mt-0" style={{ height: barHeight || undefined }} />
      <div
        ref={barRef}
        className="md:hidden mt-0 fixed bottom-0 left-0 right-0 z-[72] bg-background border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.12)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-3"
      >
        <AgreementFields
          idSuffix="mobile"
          agreed={agreed}
          onAgreedChange={setAgreed}
          onOpenTerms={() => setModalTpl("terms")}
          onOpenPrivacy={() => setModalTpl("privacy")}
        />
        <button
          type="button"
          onClick={handleJoin}
          disabled={pending || !agreed}
          className="btn btn-primary btn-lg btn-full"
        >
          {pending ? "Memproses..." : "Ya, Saya Ingin Bergabung"}
        </button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {modalTpl && (
        <LegalModal slug={slug} template={modalTpl} open={!!modalTpl} onClose={() => setModalTpl(null)} />
      )}
    </>
  );
}
