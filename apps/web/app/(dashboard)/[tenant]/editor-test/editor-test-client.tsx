"use client";

import { useState } from "react";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

export function EditorTestClient({ slug }: { slug: string }) {
  const [content, setContent] = useState<string>("");
  const [preview, setPreview] = useState(false);

  function handleChange(json: string, _html: string) {
    setContent(json);
  }

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Test Tiptap Editor</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tenant:{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">{slug}</code>
          </p>
        </div>
        <Button
          variant={preview ? "default" : "outline"}
          size="sm"
          onClick={() => setPreview((v) => !v)}
          className="gap-2"
        >
          {preview ? (
            <><EyeOff className="h-4 w-4" /> Edit Mode</>
          ) : (
            <><Eye className="h-4 w-4" /> Preview Mode</>
          )}
        </Button>
      </div>

      {/* Editor atau Preview */}
      {preview ? (
        /* Preview: TiptapEditor read-only — EmbedBlockView tetap aktif, embed tampil */
        <TiptapEditor
          slug={slug}
          content={content || null}
          editable={false}
        />
      ) : (
        <TiptapEditor
          slug={slug}
          content={content || null}
          onChange={handleChange}
          placeholder="Coba tulis sesuatu... Pilih teks untuk melihat BubbleMenu."
        />
      )}

      {/* Checklist */}
      <div className="rounded-lg border border-border p-4 text-sm space-y-1.5">
        <p className="font-medium mb-2">Checklist Test:</p>
        {[
          "Editor muncul dengan toolbar di atas",
          "Ketik teks → select → BubbleMenu muncul (Bold, Italic, Link, dll)",
          "Fixed toolbar: klik 🖼 Image → MediaPicker terbuka",
          "Fixed toolbar: klik 🎬 Embed → paste URL YouTube → embed muncul",
          "Fixed toolbar: klik Table → tabel 3×3 muncul",
          "Toggle Preview → render sebagai HTML",
          "Character count di bawah editor update real-time",
        ].map((item, i) => (
          <p key={i} className="text-muted-foreground">
            ☐ {i + 1}. {item}
          </p>
        ))}
      </div>

      {/* Debug JSON */}
      <details className="rounded-lg border border-border text-sm">
        <summary className="px-4 py-3 font-medium cursor-pointer hover:bg-muted/40 rounded-lg select-none">
          Debug — JSON Content (Tiptap format)
        </summary>
        <pre className="px-4 pb-4 pt-2 text-xs font-mono text-muted-foreground overflow-x-auto max-h-96">
          {content
            ? JSON.stringify(JSON.parse(content), null, 2)
            : "(kosong)"}
        </pre>
      </details>
    </div>
  );
}
