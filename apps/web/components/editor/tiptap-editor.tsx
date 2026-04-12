// Main Tiptap Editor wrapper — "use client"
// Semua extensions dikonfigurasi di sini
// Props: content (JSON string), onChange, placeholder, slug, editable

"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect } from "react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { MediaImageExtension } from "./media-image-ext";
import { EmbedBlock } from "./embed-block-ext";
import { EditorToolbar } from "./editor-toolbar";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TiptapEditorProps {
  /** JSON string dari DB (kolom content). null/undefined = editor kosong */
  content?: string | null;
  /** Dipanggil setiap onChange: json untuk DB, html untuk preview */
  onChange?: (json: string, html: string) => void;
  placeholder?: string;
  /** Tenant slug — dioper ke MediaPicker via toolbar */
  slug: string;
  /** false = read-only mode (preview konten) */
  editable?: boolean;
  /** Batas karakter untuk SEO warning (opsional) */
  charLimit?: number;
}

// ── Editor ────────────────────────────────────────────────────────────────────

export function TiptapEditor({
  content,
  onChange,
  placeholder = "Mulai menulis...",
  slug,
  editable = true,
  charLimit,
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
        codeBlock: {},
      }),

      // Image digantikan oleh MediaImageExtension (extend dengan mediaId attr)
      MediaImageExtension.configure({
        inline: false,
        allowBase64: false,
      }),

      Link.configure({
        openOnClick: false,   // jangan buka link saat edit
        autolink: true,       // auto-detect URL saat paste
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),

      CharacterCount.configure({
        limit: charLimit,     // undefined = tidak ada limit
      }),

      Placeholder.configure({
        placeholder,
      }),

      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),

      Underline,
      TextStyle,  // required oleh Color

      Color.configure({
        types: ["textStyle"],
      }),

      Highlight.configure({
        multicolor: true,
      }),

      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,

      EmbedBlock,
    ],

    content: parseContent(content),
    editable,
    immediatelyRender: false,  // wajib untuk Next.js SSR — hindari hydration mismatch
    autofocus: editable ? "end" : false,

    onUpdate({ editor }) {
      if (!onChange) return;
      const json = JSON.stringify(editor.getJSON());
      const html = editor.getHTML();
      onChange(json, html);
    },

    editorProps: {
      attributes: {
        class: [
          "prose prose-sm sm:prose-base max-w-none",
          "min-h-[400px] px-8 py-6 focus:outline-none",
          "prose-headings:font-semibold prose-headings:tracking-tight prose-headings:mt-6 prose-headings:mb-3",
          "prose-p:my-3",
          "prose-ul:my-3 prose-ol:my-3",
          "prose-blockquote:my-4",
          "prose-pre:my-4",
          "prose-a:text-primary prose-a:underline",
          "prose-table:border-collapse",
          "[&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-2",
          "[&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted",
          "prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-code:text-sm",
          "prose-pre:bg-muted prose-pre:rounded-lg",
        ].join(" "),
      },
    },
  });

  // Sync content dari luar (misal: load dari DB setelah fetch)
  useEffect(() => {
    if (!editor) return;
    const parsed = parseContent(content);
    const currentJson = JSON.stringify(editor.getJSON());
    const incomingJson = JSON.stringify(parsed);
    if (currentJson !== incomingJson) {
      editor.commands.setContent(parsed);
    }
  // editor sengaja tidak di deps — hanya sync saat content prop berubah dari luar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  // Sync editable prop
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  const charCount   = editor?.storage.characterCount?.characters() ?? 0;
  const wordCount   = editor?.storage.characterCount?.words() ?? 0;
  const isOverLimit = charLimit != null && charCount > charLimit;

  return (
    <div className="flex flex-col rounded-lg border border-border bg-background overflow-hidden">
      {/* Fixed toolbar — insert operations */}
      {editable && editor && (
        <EditorToolbar editor={editor} slug={slug} />
      )}

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Character count footer */}
      {editable && (
        <div className="flex items-center justify-end gap-4 px-4 py-2 border-t border-border
                        bg-muted/30 text-xs text-muted-foreground">
          <span>{wordCount} kata</span>
          <span className={isOverLimit ? "text-destructive font-medium" : ""}>
            {charCount.toLocaleString("id-ID")} karakter
            {charLimit && ` / ${charLimit.toLocaleString("id-ID")}`}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse content string dari DB ke format yang Tiptap terima.
 * - null/undefined/kosong → null (editor mulai kosong)
 * - String JSON valid → parse ke object
 * - String lain → wrap sebagai HTML (fallback legacy)
 */
function parseContent(content?: string | null): object | string | null {
  if (!content || content.trim() === "") return null;
  try {
    return JSON.parse(content);
  } catch {
    // Bukan JSON — kemungkinan HTML legacy, render as-is
    return content;
  }
}
