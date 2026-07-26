// React NodeView untuk RelatedLinkBlock di Tiptap Editor
"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Link2, ExternalLink, Trash2 } from "lucide-react";

export function RelatedLinkBlockView({ node, selected, deleteNode }: NodeViewProps) {
  const { label, title, url, isExternal } = node.attrs as {
    label: string;
    title: string;
    url: string;
    isExternal: boolean;
  };

  return (
    <NodeViewWrapper className="my-4">
      <div
        className={`group relative flex items-center justify-between gap-3 rounded-xl
                    border border-primary/20 bg-primary/5 p-3.5 sm:p-4 transition-all
                    ${selected ? "ring-2 ring-primary ring-offset-2" : ""}`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                           bg-primary text-primary-foreground shadow-sm">
            <Link2 className="h-4 w-4" />
          </span>

          <div className="min-w-0 flex-1 text-sm sm:text-base">
            <span className="font-bold text-primary mr-2">{label || "Baca Juga:"}</span>
            <span className="font-medium text-foreground underline decoration-primary/30 underline-offset-4">
              {title || "Judul artikel terkait..."}
            </span>
            {url && (
              <span className="ml-2 text-xs text-muted-foreground truncate block sm:inline">
                ({url})
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isExternal ? (
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          ) : (
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
              Internal
            </span>
          )}

          {/* Delete button when selected or hovered */}
          <button
            type="button"
            onClick={deleteNode}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Hapus Block Baca Juga"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
