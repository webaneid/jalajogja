"use client";

import { useState, useTransition } from "react";
import { joinForumAction } from "./actions";
import { LegalModal } from "@/components/akun/legal-modal";

export function JoinForumButton({ slug, baseUrl }: { slug: string; baseUrl: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [modalTpl, setModalTpl] = useState<"terms" | "privacy" | null>(null);

  function handleJoin() {
    setError(null);
    startTransition(async () => {
      const result = await joinForumAction(slug);
      if (!result.success) {
        setError(result.error);
        return;
      }
      // /akun sensitif terhadap cache RSC basi setelah mutasi — window.location.href
      // memaksa full reload, bukan router.push (lihat lesson "PC IKPM Cabang — Cache RSC
      // basi di /akun" di CLAUDE.md).
      window.location.href = `${baseUrl}/akun`;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5">
        <input
          id="gabung-agreed"
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary cursor-pointer"
        />
        <label htmlFor="gabung-agreed" className="text-sm text-muted-foreground leading-snug cursor-pointer select-none">
          Dengan ini saya menyatakan menyetujui{" "}
          <button type="button" onClick={() => setModalTpl("terms")} className="text-primary hover:underline font-medium">
            Syarat dan Ketentuan
          </button>{" "}serta{" "}
          <button type="button" onClick={() => setModalTpl("privacy")} className="text-primary hover:underline font-medium">
            Kebijakan Privasi
          </button>.
        </label>
      </div>

      <button
        type="button"
        onClick={handleJoin}
        disabled={pending || !agreed}
        className="btn btn-primary btn-lg btn-full"
      >
        {pending ? "Memproses..." : "Ya, Saya Ingin Bergabung"}
      </button>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {modalTpl && (
        <LegalModal slug={slug} template={modalTpl} open={!!modalTpl} onClose={() => setModalTpl(null)} />
      )}
    </div>
  );
}
