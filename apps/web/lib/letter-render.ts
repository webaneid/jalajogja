// Render body surat: Tiptap JSON → HTML, atau plain text → escaped HTML
// Dipakai di halaman detail surat dan template PDF
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderBody(body: string | null | undefined): string {
  if (!body) return "";
  try {
    const json = JSON.parse(body);
    // Pastikan ini memang Tiptap doc
    if (json?.type !== "doc") return escapeHtml(body).replace(/\n/g, "<br>");
    return generateHTML(json, [StarterKit, Underline]);
  } catch {
    // Plain text fallback — escape HTML + newline → <br>
    return escapeHtml(body).replace(/\n/g, "<br>");
  }
}
