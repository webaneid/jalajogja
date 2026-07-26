// EmbedBlock — custom Tiptap Node extension untuk oEmbed universal (YouTube, Instagram, TikTok, Twitter)
import { Node, mergeAttributes, type CommandProps } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { EmbedBlockView } from "./embed-block-view";

export type OEmbedResult = {
  url: string;
  html: string;           // HTML dari oEmbed provider atau generator
  provider: string;       // "YouTube", "Instagram", "Twitter", dll
  title?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  videoId?: string;
};

// ── YouTube URL Helper ────────────────────────────────────────────────────────
export function parseYouTubeUrl(url: string): { videoId: string; embedUrl: string } | null {
  try {
    const parsed = new URL(url);
    let videoId = "";

    if (parsed.hostname.includes("youtu.be")) {
      videoId = parsed.pathname.slice(1);
    } else if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/watch")) {
        videoId = parsed.searchParams.get("v") || "";
      } else if (parsed.pathname.startsWith("/embed/")) {
        videoId = parsed.pathname.split("/embed/")[1] || "";
      } else if (parsed.pathname.startsWith("/shorts/")) {
        videoId = parsed.pathname.split("/shorts/")[1] || "";
      }
    }

    // Clean videoId from any extra parameters (e.g. ?t=10s)
    if (videoId.includes("?")) videoId = videoId.split("?")[0];
    if (videoId.includes("&")) videoId = videoId.split("&")[0];

    if (!videoId) return null;
    return {
      videoId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
    };
  } catch {
    return null;
  }
}

// ── Instagram URL Helper ──────────────────────────────────────────────────────
export function parseInstagramUrl(url: string): { postId: string; cleanUrl: string } | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("instagram.com")) return null;

    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;

    const type = parts[0]; // "p" or "reel"
    const postId = parts[1];

    if ((type === "p" || type === "reel") && postId) {
      const cleanUrl = `https://www.instagram.com/${type}/${postId}/`;
      return { postId, cleanUrl };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Universal oEmbed Fetcher ──────────────────────────────────────────────────
export async function fetchOEmbed(url: string): Promise<OEmbedResult | null> {
  const trimmed = url.trim();

  // 1. YouTube Direct Parsing
  const yt = parseYouTubeUrl(trimmed);
  if (yt) {
    return {
      url: trimmed,
      provider: "YouTube",
      videoId: yt.videoId,
      html: `<div class="aspect-video relative w-full rounded-xl overflow-hidden shadow-md bg-black my-4">
        <iframe src="${yt.embedUrl}" class="absolute inset-0 w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
      </div>`,
    };
  }

  // 2. Instagram Direct Parsing
  const ig = parseInstagramUrl(trimmed);
  if (ig) {
    return {
      url: ig.cleanUrl,
      provider: "Instagram",
      html: `<div class="flex justify-center my-6">
        <blockquote class="instagram-media" data-instgrm-permalink="${ig.cleanUrl}" data-instgrm-version="14" style="background:#FFF; border:0; border-radius:12px; box-shadow:0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15); margin: 1px; max-width:540px; min-width:326px; padding:0; width:99.375%;">
          <div style="padding:16px;">
            <a href="${ig.cleanUrl}" style="background:#FFFFFF; line-height:0; padding:0 0; text-align:center; text-decoration:none; width:100%;" target="_blank" rel="noopener noreferrer">
              Lihat postingan ini di Instagram
            </a>
          </div>
        </blockquote>
      </div>`,
    };
  }

  // 3. Fallback to noembed.com for Twitter, TikTok, Vimeo, Soundcloud, etc.
  try {
    const apiUrl = `https://noembed.com/embed?url=${encodeURIComponent(trimmed)}&maxwidth=800`;
    const res = await fetch(apiUrl);
    if (!res.ok) return null;
    const data = await res.json();

    if (data.error || !data.html) return null;

    return {
      url: trimmed,
      html: data.html,
      provider: data.provider_name ?? "Embed",
      title: data.title,
      thumbnailUrl: data.thumbnail_url,
      width: data.width,
      height: data.height,
    };
  } catch {
    return null;
  }
}

// ── Command type augmentation ─────────────────────────────────────────────────
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    embedBlock: {
      insertEmbed: (data: OEmbedResult) => ReturnType;
    };
  }
}

// ── EmbedBlock Extension ──────────────────────────────────────────────────────
export const EmbedBlock = Node.create({
  name: "embedBlock",
  group: "block",
  atom: true,       // leaf node
  draggable: true,

  addAttributes() {
    return {
      url:          { default: null },
      html:         { default: null },
      provider:     { default: null },
      title:        { default: null },
      thumbnailUrl: { default: null },
      videoId:      { default: null },
    };
  },

  parseHTML() {
    return [
      { tag: 'div[data-type="embed-block"]' },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes as Record<string, string>, { "data-type": "embed-block" }),
    ];
  },

  addCommands() {
    return {
      insertEmbed:
        (data: OEmbedResult) =>
        ({ commands }: CommandProps) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              url:          data.url,
              html:         data.html,
              provider:     data.provider,
              title:        data.title ?? null,
              thumbnailUrl: data.thumbnailUrl ?? null,
              videoId:      data.videoId ?? null,
            },
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedBlockView);
  },
});
