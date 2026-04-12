// EditorToolbar — dua toolbar:
// 1. BubbleToolbar: floating saat text selection (bold, italic, heading, link, color)
// 2. FixedToolbar: selalu tampil di atas editor (insert image, embed, table, align)

"use client";

import { useState, useCallback } from "react";
import { type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Bold, Italic, Underline, Strikethrough,
  Heading2, Heading3,
  Link, Link2Off,
  Highlighter, Palette,
  ImagePlus, Code2, Minus,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Table, Film,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MediaPicker, type MediaItem } from "@/components/media/media-picker";
import { fetchOEmbed, type OEmbedResult } from "./embed-block-ext";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ToolbarProps {
  editor: Editor;
  slug: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const HIGHLIGHT_COLORS = [
  { color: "#fef08a", label: "Kuning" },
  { color: "#bbf7d0", label: "Hijau" },
  { color: "#bfdbfe", label: "Biru" },
  { color: "#fecaca", label: "Merah" },
  { color: "#e9d5ff", label: "Ungu" },
  { color: "transparent", label: "Hapus" },
];

const TEXT_COLORS = [
  { color: "#ef4444", label: "Merah" },
  { color: "#f97316", label: "Oranye" },
  { color: "#eab308", label: "Kuning" },
  { color: "#22c55e", label: "Hijau" },
  { color: "#3b82f6", label: "Biru" },
  { color: "#8b5cf6", label: "Ungu" },
  { color: "#6b7280", label: "Abu" },
  { color: "#000000", label: "Hitam" },
];

// ── ToolBtn ───────────────────────────────────────────────────────────────────

function ToolBtn({
  onClick,
  active,
  disabled,
  title,
  children,
  className,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // jangan unfocus editor
        onClick();
      }}
      disabled={disabled}
      title={title}
      className={cn(
        "h-7 w-7 flex items-center justify-center rounded transition-colors",
        "hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed",
        active && "bg-muted text-foreground",
        !active && "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-5 bg-border mx-0.5 shrink-0" />;
}

// ── BubbleToolbar ─────────────────────────────────────────────────────────────

function BubbleToolbar({ editor }: { editor: Editor }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl,  setLinkUrl]  = useState("");

  const applyLink = useCallback(() => {
    if (!linkUrl.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link")
        .setLink({ href: linkUrl.trim() }).run();
    }
    setLinkOpen(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  const openLinkPopover = useCallback(() => {
    const existing = editor.getAttributes("link").href as string | undefined;
    setLinkUrl(existing ?? "");
    setLinkOpen(true);
  }, [editor]);

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top" }}
      shouldShow={({ editor, state }: { editor: Editor; state: { selection: { empty: boolean } } }) => {
        const { empty } = state.selection;
        return !empty && !editor.isActive("image") && !editor.isActive("embedBlock");
      }}
    >
      <div className="flex items-center gap-0.5 bg-popover border border-border rounded-lg
                      shadow-md px-1.5 py-1">
        {/* Bold / Italic / Underline / Strike */}
        <ToolBtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title="Underline (Ctrl+U)"
        >
          <Underline className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolBtn>

        <Separator />

        {/* Heading H2 / H3 */}
        <ToolBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolBtn>

        <Separator />

        {/* Link */}
        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); openLinkPopover(); }}
              title="Tambah link"
              className={cn(
                "h-7 w-7 flex items-center justify-center rounded transition-colors",
                "hover:bg-muted",
                editor.isActive("link")
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Link className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <div className="flex gap-2">
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="h-8 text-sm"
                onKeyDown={(e) => e.key === "Enter" && applyLink()}
                autoFocus
              />
              <Button size="sm" className="h-8 px-3" onClick={applyLink}>
                OK
              </Button>
            </div>
            {editor.isActive("link") && (
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().unsetLink().run();
                  setLinkOpen(false);
                }}
                className="mt-2 flex items-center gap-1.5 text-xs text-destructive hover:underline"
              >
                <Link2Off className="h-3 w-3" />
                Hapus link
              </button>
            )}
          </PopoverContent>
        </Popover>

        <Separator />

        {/* Highlight */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              title="Highlight"
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted
                         text-muted-foreground hover:text-foreground transition-colors"
            >
              <Highlighter className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="flex gap-1.5 flex-wrap max-w-[160px]">
              {HIGHLIGHT_COLORS.map(({ color, label }) => (
                <button
                  key={color}
                  type="button"
                  title={label}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (color === "transparent") {
                      editor.chain().focus().unsetHighlight().run();
                    } else {
                      editor.chain().focus().setHighlight({ color }).run();
                    }
                  }}
                  className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform
                             flex items-center justify-center"
                  style={{ backgroundColor: color === "transparent" ? "#fff" : color }}
                >
                  {color === "transparent" && (
                    <span className="text-[10px] text-muted-foreground">✕</span>
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Text color */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              title="Warna teks"
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted
                         text-muted-foreground hover:text-foreground transition-colors"
            >
              <Palette className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="flex gap-1.5 flex-wrap max-w-[160px]">
              {TEXT_COLORS.map(({ color, label }) => (
                <button
                  key={color}
                  type="button"
                  title={label}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    editor.chain().focus().setColor(color).run();
                  }}
                  className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                />
              ))}
              <button
                type="button"
                title="Reset warna"
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().unsetColor().run();
                }}
                className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform
                           flex items-center justify-center text-[10px] text-muted-foreground bg-white"
              >
                ✕
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </BubbleMenu>
  );
}

// ── EmbedDialog ───────────────────────────────────────────────────────────────

function EmbedDialog({
  open,
  onClose,
  onInsert,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (data: OEmbedResult) => void;
}) {
  const [url,     setUrl]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleInsert = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    const result = await fetchOEmbed(trimmed);
    setLoading(false);
    if (!result) {
      toast.error("URL tidak dikenali. Coba YouTube, TikTok, Twitter, Instagram, atau Vimeo.");
      return;
    }
    onInsert(result);
    setUrl("");
    onClose();
  }, [url, onInsert, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Embed Media</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Paste URL dari YouTube, TikTok, Instagram, Twitter/X, Vimeo, Spotify,
            dan 300+ platform lainnya.
          </p>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            onKeyDown={(e) => e.key === "Enter" && handleInsert()}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleInsert} disabled={!url.trim() || loading}>
            {loading ? "Memuat..." : "Embed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── FixedToolbar ──────────────────────────────────────────────────────────────

function FixedToolbar({ editor, slug }: ToolbarProps) {
  const [mediaOpen, setMediaOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);

  const handleMediaSelect = useCallback((item: MediaItem) => {
    editor.chain().focus().insertMediaImage({
      src:     item.url,
      alt:     item.altText ?? item.originalName,
      title:   item.title ?? undefined,
      mediaId: item.id,
    }).run();
  }, [editor]);

  const handleInsertTable = useCallback(() => {
    editor.chain().focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  }, [editor]);

  return (
    <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-b border-border bg-muted/30">

      {/* Insert: Image, Embed, Table */}
      <ToolBtn onClick={() => setMediaOpen(true)} title="Sisipkan Gambar">
        <ImagePlus className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn onClick={() => setEmbedOpen(true)} title="Embed Media (YouTube, TikTok, dll)">
        <Film className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn onClick={handleInsertTable} title="Sisipkan Tabel">
        <Table className="h-4 w-4" />
      </ToolBtn>

      <Separator />

      {/* Text align */}
      <ToolBtn
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        active={editor.isActive({ textAlign: "left" })}
        title="Rata kiri"
      >
        <AlignLeft className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        active={editor.isActive({ textAlign: "center" })}
        title="Rata tengah"
      >
        <AlignCenter className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        active={editor.isActive({ textAlign: "right" })}
        title="Rata kanan"
      >
        <AlignRight className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        active={editor.isActive({ textAlign: "justify" })}
        title="Rata penuh"
      >
        <AlignJustify className="h-4 w-4" />
      </ToolBtn>

      <Separator />

      {/* Block: Blockquote, Code, HR */}
      <ToolBtn
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        title="Blockquote"
      >
        <Quote className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive("codeBlock")}
        title="Code block"
      >
        <Code2 className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Garis pemisah"
      >
        <Minus className="h-4 w-4" />
      </ToolBtn>

      {/* MediaPicker */}
      <MediaPicker
        slug={slug}
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
        onSelect={handleMediaSelect}
        module="website"
        accept={["image/"]}
      />

      {/* Embed Dialog */}
      <EmbedDialog
        open={embedOpen}
        onClose={() => setEmbedOpen(false)}
        onInsert={(data) => {
          editor.chain().focus().insertEmbed(data).run();
        }}
      />
    </div>
  );
}

// ── EditorToolbar (export utama) ──────────────────────────────────────────────

export function EditorToolbar({ editor, slug }: ToolbarProps) {
  return (
    <>
      <BubbleToolbar editor={editor} />
      <FixedToolbar editor={editor} slug={slug} />
    </>
  );
}
