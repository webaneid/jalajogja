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
