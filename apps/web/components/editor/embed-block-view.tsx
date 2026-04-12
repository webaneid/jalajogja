// React NodeView untuk EmbedBlock
// Render HTML oEmbed via dangerouslySetInnerHTML — diperlukan untuk iframe/script
// Provider dideteksi untuk styling khusus (misal: Twitter butuh script inject)

"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useEffect, useRef } from "react";

export function EmbedBlockView({ node, selected }: NodeViewProps) {
  const { html, provider, url, title } = node.attrs as {
    html:         string | null;
    provider:     string | null;
    url:          string | null;
    title:        string | null;
    thumbnailUrl: string | null;
  };

  const containerRef = useRef<HTMLDivElement>(null);

  // Re-inject scripts setelah HTML di-render (Twitter, Instagram butuh ini)
  useEffect(() => {
    if (!containerRef.current || !html) return;

    const scripts = containerRef.current.querySelectorAll("script");
    scripts.forEach((oldScript) => {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) =>
        newScript.setAttribute(attr.name, attr.value),
      );
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });
  }, [html]);

  return (
    <NodeViewWrapper
      className={`embed-block-wrapper my-4 rounded-lg overflow-hidden
        ${selected ? "ring-2 ring-primary ring-offset-2" : ""}`}
    >
      {html ? (
        <div className="relative">
          {/* Label provider di pojok kiri atas */}
          {provider && (
            <div className="absolute top-2 left-2 z-10 bg-black/50 text-white text-xs
                            px-2 py-0.5 rounded pointer-events-none">
              {provider}
            </div>
          )}
          <div
            ref={containerRef}
            className="embed-html-container [&_iframe]:w-full [&_iframe]:rounded-md
                       [&_blockquote]:border [&_blockquote]:rounded-md [&_blockquote]:p-4"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      ) : (
        // Fallback: URL saja jika tidak ada HTML
        <div className="bg-muted rounded-md p-4 flex items-center gap-3">
          <span className="text-2xl">🔗</span>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{title ?? url}</p>
            <p className="text-xs text-muted-foreground truncate">{url}</p>
          </div>
        </div>
      )}
    </NodeViewWrapper>
  );
}
