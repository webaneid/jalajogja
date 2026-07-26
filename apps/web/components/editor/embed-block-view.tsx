// React NodeView untuk EmbedBlock (YouTube 16:9, Instagram, Twitter, oEmbed)
"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useEffect, useRef } from "react";

type InstgrmWindow = Window & { instgrm?: { Embeds: { process: () => void } } };

// ── Loader singleton untuk script Instagram embed.js ──────────────────────────
// BUG LAMA: tiap instance EmbedBlockView cek `window.instgrm?.Embeds` lalu langsung
// `document.body.appendChild(script)` kalau belum ada — dua embed Instagram yang mount
// nyaris bersamaan (atau React StrictMode dev-mode double-invoke effect) SAMA-SAMA lolos cek
// itu sebelum script pertama sempat load → script ter-inject DOBEL. Ditambah, `.process()`
// tidak pernah dipanggil setelah script benar-benar load — cuma mengandalkan auto-scan
// implisit Instagram saat script pertama kali dieksekusi (tidak reliable untuk embed yang
// mount SETELAH script sudah ada tapi belum sempat auto-scan ulang).
// Fix: satu promise module-level — cuma SATU script tag pernah dibuat, siapa pun yang
// memanggil `loadInstagramScript()` (berapa kali pun, dari instance manapun) berbagi promise
// yang sama dan sama-sama dapat notifikasi lewat `.then()` begitu script siap.
let instagramScriptPromise: Promise<void> | null = null;
function loadInstagramScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const win = window as InstgrmWindow;
  if (win.instgrm?.Embeds) return Promise.resolve();
  if (instagramScriptPromise) return instagramScriptPromise;

  instagramScriptPromise = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.instagram.com/embed.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    script.onload = () => resolve();
    document.body.appendChild(script);
  });
  return instagramScriptPromise;
}

export function EmbedBlockView({ node, selected }: NodeViewProps) {
  const { html, provider, url, title, videoId } = node.attrs as {
    html:         string | null;
    provider:     string | null;
    url:          string | null;
    title:        string | null;
    thumbnailUrl: string | null;
    videoId:      string | null;
  };

  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-inject script untuk Twitter / Instagram jika ada
  useEffect(() => {
    if (!containerRef.current || !html) return;

    let cancelled = false;

    // Instagram script loader — loadInstagramScript() singleton, aman dipanggil dari
    // instance manapun berapa kali pun tanpa risiko duplicate <script> tag (lihat komentar
    // di definisinya). `.process()` selalu dipanggil eksplisit setelah script siap, bukan
    // mengandalkan auto-scan implisit — supaya embed yang mount setelah script sudah load
    // (mis. instance kedua) tetap ter-render.
    if (provider === "Instagram" || html.includes("instagram-media")) {
      loadInstagramScript().then(() => {
        if (cancelled) return;
        (window as InstgrmWindow).instgrm?.Embeds?.process();
      });
    }

    // Generic script re-injection (Twitter/TikTok/dll dari noembed.com — HTML-nya bisa
    // bawa <script> asli yang tidak dieksekusi oleh dangerouslySetInnerHTML)
    const scripts = containerRef.current.querySelectorAll("script");
    scripts.forEach((oldScript) => {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) =>
        newScript.setAttribute(attr.name, attr.value),
      );
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });

    return () => { cancelled = true; };
  }, [html, provider]);

  return (
    <NodeViewWrapper
      className={`embed-block-wrapper my-4 rounded-xl overflow-hidden transition-all
        ${selected ? "ring-2 ring-primary ring-offset-2" : ""}`}
    >
      {/* 1. YouTube Direct Render (16:9 Responsive) */}
      {provider === "YouTube" && videoId ? (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-md bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}`}
            className="absolute inset-0 w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={title ?? "YouTube Video"}
          />
        </div>
      ) : html ? (
        /* 2. Generic / Instagram / Twitter Render */
        <div className="relative">
          {provider && (
            <div className="absolute top-2 left-2 z-10 bg-black/60 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full pointer-events-none shadow-sm">
              {provider}
            </div>
          )}
          <div
            ref={containerRef}
            className="embed-html-container [&_iframe]:w-full [&_iframe]:rounded-xl
                       [&_blockquote]:border [&_blockquote]:rounded-xl [&_blockquote]:p-4"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      ) : (
        /* 3. Fallback Link Card */
        <div className="bg-muted/50 border border-border rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">🔗</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{title ?? url}</p>
            <p className="text-xs text-muted-foreground truncate">{url}</p>
          </div>
        </div>
      )}
    </NodeViewWrapper>
  );
}
