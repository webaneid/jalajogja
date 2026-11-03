// Utilitas MURNI Syarat & Ketentuan Produsen (tanpa DB) — docs/arsitektur-portal-produsen.md § 28.
// Isi syarat = JSON Tiptap (string) dari <TiptapEditor>; dirender dengan renderBody() (standar editor project).

export const PRODUCER_TERM_TITLE_MAX = 200;
export const PRODUCER_TERM_BODY_MAX  = 300_000; // karakter JSON — batas wajar dokumen hukum panjang

type TiptapNode = { type?: string; text?: string; content?: TiptapNode[] };

/** Ada teks nyata di dokumen Tiptap? Dokumen kosong ({"type":"doc","content":[{"type":"paragraph"}]}) ditolak. */
export function tiptapHasText(body: string): boolean {
  try {
    const root = JSON.parse(body) as TiptapNode;
    if (root?.type !== "doc") return false;
    const walk = (n: TiptapNode): boolean =>
      (typeof n.text === "string" && n.text.trim().length > 0) || (n.content ?? []).some(walk);
    return walk(root);
  } catch {
    return false;
  }
}

/** Validasi isian draf; kembalikan pesan galat atau null. */
export function validateTermInput(title: string, body: string): string | null {
  if (!title.trim()) return "Judul wajib diisi.";
  if (title.trim().length > PRODUCER_TERM_TITLE_MAX) return `Judul maksimal ${PRODUCER_TERM_TITLE_MAX} karakter.`;
  if (body.length > PRODUCER_TERM_BODY_MAX) return "Isi syarat terlalu panjang.";
  if (!tiptapHasText(body)) return "Isi syarat & ketentuan wajib diisi.";
  return null;
}

// ── Pengaman TERBIT: draf boleh berisi penanda, versi TERBIT tidak boleh ───────────────────────────────────────────
// Isi versi terbit tidak bisa diedit (tanda tangan produsen mengikat isi persis itu). Penanda sisa penyusunan — `{{nomor_versi}}`,
// `{{OPSI_forum}}`, `[PERLU VERIFIKASI HUKUM]` — akan terbaca produsen apa adanya bila lolos. Karena itu terbit DITOLAK selama masih ada.
const PLACEHOLDER_RE = /\{\{[^{}]{1,120}\}\}|\[\s*PERLU VERIFIKASI HUKUM\s*\]/gi;
const BLOCK_TYPES = new Set(["paragraph", "heading", "listItem", "blockquote", "tableCell", "tableHeader", "tableRow", "hardBreak", "codeBlock"]);

/** Penanda yang belum diisi (unik, urutan kemunculan, maks. 30). Teks dirangkai per blok, jadi penanda yang terpecah oleh format tebal/miring tetap terdeteksi. */
export function findUnfilledPlaceholders(body: string): string[] {
  let root: TiptapNode;
  try { root = JSON.parse(body) as TiptapNode; } catch { return []; }
  let text = "";
  const walk = (n: TiptapNode) => {
    if (typeof n.text === "string") text += n.text;
    for (const c of n.content ?? []) walk(c);
    if (n.type && BLOCK_TYPES.has(n.type)) text += "\n";
  };
  walk(root);
  const found: string[] = [];
  for (const m of text.matchAll(PLACEHOLDER_RE)) {
    const t = /^\[/.test(m[0]) ? "[PERLU VERIFIKASI HUKUM]" : m[0].replace(/\s+/g, " ");   // penanda hukum dikanonkan (besar/kecil huruf & spasi sama)
    if (!found.includes(t)) found.push(t);
    if (found.length >= 30) break;
  }
  return found;
}

/** Galat khusus penerbitan (selain validateTermInput): masih ada penanda yang belum diisi. */
export function placeholderPublishError(body: string): string | null {
  const left = findUnfilledPlaceholders(body);
  if (left.length === 0) return null;
  return `Masih ada ${left.length} penanda yang belum diisi: ${left.slice(0, 8).join(", ")}${left.length > 8 ? ", …" : ""}. Isi semuanya (dan hapus catatan penyusun) sebelum menerbitkan — isi versi terbit tidak bisa diubah.`;
}
