"use client";

// Tombol "Ya, Saya Ingin Bergabung" untuk mode WAJIB (ada syarat produk/campaign) — beda dari
// JoinForumButton (mode gratis, memanggil joinForumAction, tampil status sukses inline).
// Komponen ini TIDAK memanggil server action apa pun — murni navigasi ke /checkout begitu
// checkbox dicentang DAN item wajib sudah ada di cart (canProceed). Aktivasi keanggotaan
// sesungguhnya terjadi belakangan, saat invoice lunas (activateForumMembershipIfApplicable).
// Lihat docs/arsitektur-gabung-forum.md § "Redesain /gabung" § 11.

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AgreementFields } from "./join-forum-button";
import { LegalModal } from "@/components/akun/legal-modal";

type Props = { slug: string; baseUrl: string; canProceed: boolean };

export function GabungCheckoutButton({ slug, baseUrl, canProceed }: Props) {
  const router = useRouter();
  const [agreed, setAgreed]     = useState(false);
  const [modalTpl, setModalTpl] = useState<"terms" | "privacy" | null>(null);

  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setBarHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function handleClick() {
    router.push(`${baseUrl}/checkout`);
  }

  const disabled = !agreed || !canProceed;

  return (
    <>
      <div className="hidden md:block space-y-3">
        <AgreementFields
          idSuffix="checkout-desktop"
          agreed={agreed}
          onAgreedChange={setAgreed}
          onOpenTerms={() => setModalTpl("terms")}
          onOpenPrivacy={() => setModalTpl("privacy")}
        />
        <button type="button" onClick={handleClick} disabled={disabled} className="btn btn-primary btn-lg btn-full">
          Ya, Saya Ingin Bergabung
        </button>
        {!canProceed && (
          <p className="text-xs text-muted-foreground text-center">
            Lengkapi syarat di atas dulu sebelum melanjutkan.
          </p>
        )}
      </div>

      <div className="md:hidden mt-0" style={{ height: barHeight || undefined }} />
      <div
        ref={barRef}
        className="md:hidden mt-0 fixed bottom-0 left-0 right-0 z-[72] bg-background border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.12)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-3"
      >
        <AgreementFields
          idSuffix="checkout-mobile"
          agreed={agreed}
          onAgreedChange={setAgreed}
          onOpenTerms={() => setModalTpl("terms")}
          onOpenPrivacy={() => setModalTpl("privacy")}
        />
        <button type="button" onClick={handleClick} disabled={disabled} className="btn btn-primary btn-lg btn-full">
          Ya, Saya Ingin Bergabung
        </button>
        {!canProceed && (
          <p className="text-xs text-muted-foreground text-center">
            Lengkapi syarat di atas dulu sebelum melanjutkan.
          </p>
        )}
      </div>

      {modalTpl && (
        <LegalModal slug={slug} template={modalTpl} open={!!modalTpl} onClose={() => setModalTpl(null)} />
      )}
    </>
  );
}
