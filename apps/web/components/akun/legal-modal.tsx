"use client";

import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type LegalContent =
  | { found: true;  title: string; html: string; updatedAt: string }
  | { found: false };

// Dipakai oleh register-form.tsx (daftar akun) dan gabung/join-forum-button.tsx (daftar forum).
// Konten diambil dari halaman legal singleton tenant (terms/privacy) via GET /api/akun/legal.
export function LegalModal({ slug, template, open, onClose }: {
  slug: string; template: "terms" | "privacy"; open: boolean; onClose: () => void;
}) {
  const [content, setContent] = useState<LegalContent | null>(null);
  const [loading, setLoading] = useState(false);
  const prevTpl = useRef<string | null>(null);

  if (open && template !== prevTpl.current) {
    prevTpl.current = template;
    setLoading(true);
    setContent(null);
    fetch(`/api/akun/legal?slug=${encodeURIComponent(slug)}&template=${template}`)
      .then(r => r.json())
      .then((d: LegalContent) => setContent(d))
      .catch(() => setContent({ found: false }))
      .finally(() => setLoading(false));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {content?.found ? content.title : template === "terms" ? "Syarat dan Ketentuan" : "Kebijakan Privasi"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-1">
          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && content?.found === false && (
            <p className="text-sm text-muted-foreground text-center py-12">Halaman ini belum tersedia.</p>
          )}
          {!loading && content?.found && (
            <div
              className="prose prose-sm max-w-none
                [&_p]:my-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2
                [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1
                [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
                [&_li]:my-1 [&_a]:text-primary [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: content.html }}
            />
          )}
        </div>
        <div className="pt-3 border-t border-border">
          <Button className="w-full" onClick={onClose}>Tutup</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
