import type { ReactNode } from "react";
import React from "react";

// Safe inline HTML tags allowed in title & text formatting
const ALLOWED_TAGS = new Set([
  "span", "i", "em", "b", "strong", "u", "small", "mark", "sub", "sup", "br", "p", "div", "code",
]);

// Dangerous style properties (e.g. position: fixed, z-index, javascript expression)
const DANGEROUS_STYLE_PATTERNS = [
  /position\s*:/i,
  /z-index\s*:/i,
  /expression\s*\(/i,
  /url\s*\(/i,
  /behavior\s*:/i,
  /-moz-binding\s*:/i,
];

function isSafeStyle(styleStr: string): boolean {
  return !DANGEROUS_STYLE_PATTERNS.some((pat) => pat.test(styleStr));
}

/**
 * Sanitizer & Parser HTML Aman (XSS-Safe) untuk teks judul/hero.
 * - Membolehkan tag formatting inline (`<span>`, `<i>`, `<b>`, `<em>`, `<strong>`, `style="..."` aman).
 * - Menolak tag/atribut berbahaya (`<script>`, `<iframe>`, `onerror`, `javascript:`, dsb).
 * - Mendukung pula sintaks `*asterisk*` dari renderAccentTitle secara seamless.
 */
export function renderSafeHtml(input?: string | null): ReactNode {
  if (!input) return null;

  // Jika input tidak memuat tag HTML '<' dan tidak memuat '*', kembalikan string langsung
  if (!input.includes("<") && !input.includes("*")) {
    return input;
  }

  // Jika ada sintaks *asterisk* dari renderAccentTitle tanpa tag HTML, proses asterisk
  if (!input.includes("<") && input.includes("*")) {
    const parts = input.split(/\*([^*]+)\*/);
    return parts.map((part, i) =>
      i % 2 === 1 ? <em key={i}>{part}</em> : <span key={i}>{part}</span>
    );
  }

  // Clean dangerous tags like <script...>, <iframe...>, <object...>, event handlers
  try {
    const cleaned = input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
      .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

    const tagRegex = /<(\/)?([a-z1-6]+)([^>]*)>|([^<]+)/gi;
    let match: RegExpExecArray | null;
    let keyIdx = 0;

    const stack: { tag: string; props: Record<string, unknown>; children: ReactNode[] }[] = [
      { tag: "root", props: {}, children: [] },
    ];

    while ((match = tagRegex.exec(cleaned)) !== null) {
      const [, isClosing, rawTagName, rawAttrs, textContent] = match;

      if (textContent) {
        if (textContent.includes("*")) {
          const parts = textContent.split(/\*([^*]+)\*/);
          parts.forEach((part, i) => {
            if (part) {
              stack[stack.length - 1].children.push(
                i % 2 === 1 ? <em key={keyIdx++}>{part}</em> : part
              );
            }
          });
        } else {
          stack[stack.length - 1].children.push(textContent);
        }
      } else if (rawTagName) {
        const tagName = rawTagName.toLowerCase();

        if (tagName === "br") {
          stack[stack.length - 1].children.push(<br key={keyIdx++} />);
          continue;
        }

        if (!ALLOWED_TAGS.has(tagName)) {
          continue; // Abaikan tag tak dikenal / tidak aman
        }

        if (isClosing) {
          if (stack.length > 1 && stack[stack.length - 1].tag === tagName) {
            const popped = stack.pop()!;
            const parent = stack[stack.length - 1];
            parent.children.push(
              React.createElement(
                popped.tag,
                { key: keyIdx++, ...popped.props },
                popped.children.length === 1 ? popped.children[0] : popped.children
              )
            );
          }
        } else {
          const props: Record<string, unknown> = {};

          if (rawAttrs) {
            // Match style="..."
            const styleMatch = /style\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(rawAttrs);
            if (styleMatch) {
              const styleVal = styleMatch[1] || styleMatch[2] || "";
              if (isSafeStyle(styleVal)) {
                const styleObj: Record<string, string> = {};
                styleVal.split(";").forEach((rule) => {
                  const [prop, val] = rule.split(":").map((s) => s.trim());
                  if (prop && val) {
                    const camelProp = prop.replace(/-([a-z])/g, (_, g1) => g1.toUpperCase());
                    styleObj[camelProp] = val;
                  }
                });
                props.style = styleObj;
              }
            }

            // Match class="..." atau className="..."
            const classMatch = /(?:class|className)\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(rawAttrs);
            if (classMatch) {
              props.className = classMatch[1] || classMatch[2] || "";
            }
          }

          stack.push({ tag: tagName, props, children: [] });
        }
      }
    }

    while (stack.length > 1) {
      const popped = stack.pop()!;
      const parent = stack[stack.length - 1];
      parent.children.push(
        React.createElement(
          popped.tag,
          { key: keyIdx++, ...popped.props },
          popped.children.length === 1 ? popped.children[0] : popped.children
        )
      );
    }

    return stack[0].children.length === 1 ? stack[0].children[0] : stack[0].children;
  } catch (err) {
    console.error("[renderSafeHtml] Error parsing HTML, falling back to text:", err);
    return input;
  }
}
