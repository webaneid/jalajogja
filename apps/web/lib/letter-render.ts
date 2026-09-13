// Render body surat: Tiptap JSON → HTML, atau plain text → escaped HTML
// Dipakai di halaman detail surat dan template PDF (server-side)
//
// PENTING: implementasi ini pure string manipulation — tidak pakai @tiptap/core
// atau prosemirror-model agar tidak ada dependency pada window/document (server-safe).

import { stripTenantPrefix } from "./strip-tenant-prefix"; // pure string, aman di sini (nol DOM/Node dependency)
import sanitizeHtml          from "sanitize-html";          // Node-only (htmlparser2), TIDAK butuh window/document — aman di server

type TiptapNode = {
  type: string;
  text?: string;
  attrs?: Record<string, string | number | null>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
};

type TiptapMark = {
  type: string;
  attrs?: Record<string, string | null>;
};

// Konteks opsional untuk render — dipakai untuk perbaikan URL gambar
type RenderContext = {
  // Base URL MinIO lengkap termasuk bucket tenant, mis. "https://minio.jalakarta.com/tenant-pc-ikpm-jogjakarta"
  imageBaseUrl?: string;
  // Untuk strip prefix "/{slug}" dari link internal (block "Baca Juga") saat custom domain
  // aktif — link dari <PublicLinkPicker> SELALU tersimpan path-mode ("/{slug}/post/...").
  // `baseUrl` di sini pakai semantik resolveBaseUrl(): "" = custom domain aktif (WAJIB strip),
  // "/{slug}" = domain sendiri (jangan strip). Tanpa `tenantSlug`+`baseUrl===""`, url dibiarkan
  // apa adanya (aman untuk semua caller lama yang belum diupdate — post/produk/campaign lama
  // tanpa "Baca Juga" tidak terpengaruh).
  tenantSlug?: string;
  baseUrl?: string;
};

// Strip prefix "/{slug}" dari href internal HANYA saat custom domain aktif — lihat
// docs/arsitektur-public-link-picker.md § 9 dan lesson CLAUDE.md soal stripTenantPrefix.
function resolveInternalHref(url: string, ctx?: RenderContext): string {
  if (!url || !ctx?.tenantSlug || ctx.baseUrl !== "") return url;
  return stripTenantPrefix(url, ctx.tenantSlug);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// `content` Tiptap tersimpan sebagai JSON bebas dari client (Server Action `updatePostAction`
// dkk tidak validasi struktur) — siapa pun dengan akses "website: full" di suatu tenant bisa
// menyisipkan node `embedBlock` dengan `html` mentah (mis. `<script>`) langsung lewat Server
// Action, bypass UI editor. `renderBody` dipakai untuk render publik (semua pengunjung tenant),
// jadi TIDAK boleh percaya `html`/`href` apa adanya — sanitasi di titik render ini (bukan cuma
// saat save) supaya menutup konten lama yang mungkin sudah tersimpan sebelum fix ini juga.
const EMBED_IFRAME_HOSTS = new Set([
  "www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com",
  "w.soundcloud.com", "www.instagram.com", "www.tiktok.com", "twitframe.com",
]);
const EMBED_SCRIPT_HOSTS = new Set([
  "platform.twitter.com", "www.tiktok.com", "www.instagram.com",
]);

function isAllowedEmbedHost(src: string | undefined, allowlist: Set<string>): boolean {
  if (!src) return false;
  try {
    const u = new URL(src, "https://invalid.local"); // base dummy — tolak relative src (tidak valid utk iframe/script eksternal)
    return u.protocol === "https:" && allowlist.has(u.hostname);
  } catch {
    return false;
  }
}

function sanitizeEmbedHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["div", "blockquote", "p", "a", "span", "img", "iframe", "script"],
    allowedAttributes: {
      // "data-*" aman di-wildcard — atribut data- tidak pernah dieksekusi browser (beda dari
      // "on*" event handler yang memang tidak di-whitelist di sini), dibutuhkan widget script
      // resmi (Instagram/TikTok) untuk tahu konten mana yang di-render ulang jadi embed.
      "*":        ["class", "style", "title", "data-*"],
      a:          ["href", "target", "rel"],
      img:        ["src", "alt", "width", "height"],
      iframe:     ["src", "allow", "allowfullscreen", "loading", "frameborder", "width", "height"],
      script:     ["src", "async", "charset"],
      blockquote: ["cite"],
    },
    allowedSchemesByTag: { a: ["https", "mailto"], img: ["https"], iframe: ["https"], script: ["https"] },
    // Whitelist HOST (bukan cuma scheme) untuk iframe/script — dua tag ini yang bisa
    // eksekusi kode kalau host-nya bebas. Tag lain sudah cukup aman lewat allowedAttributes.
    exclusiveFilter: (frame) => {
      if (frame.tag === "iframe") return !isAllowedEmbedHost(frame.attribs.src, EMBED_IFRAME_HOSTS);
      if (frame.tag === "script") {
        if (frame.text?.trim()) return true; // tolak inline script content, hanya boleh `src` loader
        return !isAllowedEmbedHost(frame.attribs.src, EMBED_SCRIPT_HOSTS);
      }
      return false;
    },
  });
}

// Skema URL aman untuk link teks biasa — tolak `javascript:`/`data:`/`vbscript:` dst.
// Path relatif ("/...", "#...") dan URL tanpa skema (protocol-relative sudah lolos regex ini
// karena "//" bukan skema) dianggap aman (link internal).
function sanitizeLinkHref(href: string): string {
  const trimmed = href.trim();
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(trimmed)) return escapeHtml(trimmed);
  return "#";
}

function applyMark(text: string, mark: TiptapMark): string {
  switch (mark.type) {
    case "bold":      return `<strong>${text}</strong>`;
    case "italic":    return `<em>${text}</em>`;
    case "underline": return `<u>${text}</u>`;
    case "strike":    return `<s>${text}</s>`;
    case "code":      return `<code>${text}</code>`;
    case "link": {
      const href = sanitizeLinkHref(mark.attrs?.href ?? "");
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }
    case "textStyle": {
      const color = mark.attrs?.color;
      return color ? `<span style="color:${color}">${text}</span>` : text;
    }
    case "highlight": {
      const color = mark.attrs?.color;
      return color
        ? `<mark style="background-color:${color}">${text}</mark>`
        : `<mark>${text}</mark>`;
    }
    default: return text;
  }
}

function renderChildren(node: TiptapNode, ctx?: RenderContext): string {
  if (!node.content?.length) return "";
  return node.content.map((n) => renderNode(n, ctx)).join("");
}

// Perbaiki URL gambar yang relative atau pakai localhost
function fixImageSrc(src: string, ctx?: RenderContext): string {
  if (!src || !ctx?.imageBaseUrl) return src;
  // Relative path tanpa leading slash (mis. "website/2026/05/uuid_lg.webp")
  if (!src.startsWith("http://") && !src.startsWith("https://") && !src.startsWith("//") && !src.startsWith("data:")) {
    return `${ctx.imageBaseUrl}/${src.replace(/^\//, "")}`;
  }
  // localhost atau IP lokal — ganti dengan URL produksi
  if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.)/.test(src)) {
    const pathMatch = src.match(/\/tenant-[^/]+\/(.+)$/);
    if (pathMatch) return `${ctx.imageBaseUrl}/${pathMatch[1]}`;
  }
  return src;
}

function renderNode(node: TiptapNode, ctx?: RenderContext): string {
  switch (node.type) {
    case "doc":
      return renderChildren(node, ctx);

    case "paragraph": {
      const align = node.attrs?.textAlign as string | null;
      const style = align ? ` style="text-align:${align}"` : "";
      const inner = renderChildren(node, ctx);
      return `<p${style}>${inner || "<br>"}</p>`;
    }

    case "heading": {
      const level = node.attrs?.level ?? 2;
      const align = node.attrs?.textAlign as string | null;
      const style = align ? ` style="text-align:${align}"` : "";
      return `<h${level}${style}>${renderChildren(node, ctx)}</h${level}>`;
    }

    case "text": {
      let text = escapeHtml(node.text ?? "");
      for (const mark of node.marks ?? []) {
        text = applyMark(text, mark);
      }
      return text;
    }

    case "bulletList":
      return `<ul style="padding-left:1.5em;margin:0.5em 0">${renderChildren(node, ctx)}</ul>`;

    case "orderedList":
      return `<ol style="padding-left:1.5em;margin:0.5em 0">${renderChildren(node, ctx)}</ol>`;

    case "listItem":
      return `<li>${renderChildren(node, ctx)}</li>`;

    case "blockquote": {
      const citation = node.attrs?.citation ? escapeHtml(node.attrs.citation as string) : "";
      const inner = renderChildren(node, ctx);
      return `<figure class="relative my-8 overflow-hidden rounded-r-2xl border-l-4 border-primary bg-muted/40 p-6 sm:p-8">
        <blockquote class="text-base sm:text-lg italic font-medium leading-relaxed text-foreground/90">${inner}</blockquote>
        ${citation ? `<figcaption class="mt-4 flex items-center gap-2 text-xs sm:text-sm font-semibold text-primary"><span class="h-0.5 w-6 bg-primary/40 inline-block"></span><span>${citation}</span></figcaption>` : ""}
      </figure>`;
    }

    case "relatedLinkBlock": {
      const label = escapeHtml((node.attrs?.label as string) ?? "Baca Juga:");
      const title = escapeHtml((node.attrs?.title as string) ?? "");
      const rawUrl = (node.attrs?.url as string) ?? "";
      const isExternal = Boolean(node.attrs?.isExternal);
      // URL internal ("/{slug}/post/...") tersimpan path-mode dari <PublicLinkPicker> — WAJIB
      // di-strip di custom domain aktif, jangan pernah untuk URL eksternal (isExternal=true).
      const url = escapeHtml(isExternal ? rawUrl : resolveInternalHref(rawUrl, ctx));
      return `<div class="related-link-callout my-6 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 transition-all hover:bg-primary/10 hover:shadow-sm">
        <div class="flex items-center gap-3">
          <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">🔗</span>
          <div class="min-w-0 flex-1 text-sm sm:text-base">
            <span class="font-bold text-primary mr-2">${label}</span>
            <a href="${url}" ${isExternal ? 'target="_blank" rel="noopener noreferrer"' : ""} class="font-medium text-foreground hover:underline hover:text-primary transition-colors">${title}</a>
          </div>
        </div>
      </div>`;
    }

    case "codeBlock":
      return `<pre style="background:#f5f5f5;padding:1em;border-radius:4px;overflow-x:auto"><code>${renderChildren(node, ctx)}</code></pre>`;

    case "horizontalRule":
      return `<hr style="border:none;border-top:1px solid #ddd;margin:1em 0">`;

    case "hardBreak":
      return `<br>`;

    case "image": {
      const rawSrc = node.attrs?.src as string ?? "";
      const src = escapeHtml(fixImageSrc(rawSrc, ctx));
      const alt = escapeHtml(node.attrs?.alt as string ?? "");
      return `<img src="${src}" alt="${alt}" style="max-width:100%;height:auto">`;
    }

    case "table":
      return `<table style="width:100%;border-collapse:collapse;margin:0.5em 0">${renderChildren(node, ctx)}</table>`;

    case "tableRow":
      return `<tr>${renderChildren(node, ctx)}</tr>`;

    case "tableHeader":
      return `<th style="border:1px solid #ddd;padding:8px;background:#f5f5f5;text-align:left">${renderChildren(node, ctx)}</th>`;

    case "tableCell":
      return `<td style="border:1px solid #ddd;padding:8px">${renderChildren(node, ctx)}</td>`;

    case "embedBlock": {
      const html = node.attrs?.html as string | null;
      if (html) return `<div style="margin:1em 0">${sanitizeEmbedHtml(html)}</div>`;
      const url = escapeHtml(node.attrs?.url as string ?? "");
      return `<a href="${url}" target="_blank">${url}</a>`;
    }

    case "galleryBlock": {
      // Render sebagai grid gambar sederhana untuk PDF — tanpa lightbox
      const items = (node.attrs?.items as unknown as Array<{ url: string; alt?: string }>) ?? [];
      if (items.length === 0) return "";
      const cols = (node.attrs?.columns as number) ?? 3;
      const width = Math.floor(100 / cols);
      const imgs = items
        .map((item) =>
          `<td style="width:${width}%;padding:4px;vertical-align:top">` +
          `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.alt ?? "")}" ` +
          `style="width:100%;height:auto;display:block;border-radius:4px" /></td>`
        )
        .join("");
      return `<table style="width:100%;border-collapse:collapse;margin:1em 0"><tr>${imgs}</tr></table>`;
    }

    default:
      return renderChildren(node, ctx);
  }
}

export function renderBody(body: string | null | undefined, ctx?: RenderContext): string {
  if (!body) return "";
  try {
    const json = JSON.parse(body) as TiptapNode;
    if (json?.type !== "doc") {
      return escapeHtml(body).replace(/\n/g, "<br>");
    }
    return renderNode(json, ctx);
  } catch {
    return escapeHtml(body ?? "").replace(/\n/g, "<br>");
  }
}
