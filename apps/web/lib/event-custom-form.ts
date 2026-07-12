// Tipe dan helper untuk dynamic custom form fields di event registrasi.

export type CustomFieldType = "text" | "number" | "select" | "datetime";

export type CustomFormField = {
  key:          string;           // snake_case, dipakai sebagai key di customFields JSONB
  label:        string;           // label yang ditampilkan ke pendaftar
  type:         CustomFieldType;
  required:     boolean;
  options?:     string[];         // hanya untuk type="select"
  placeholder?: string;
};

// Konversi label → snake_case key yang aman untuk JSONB key
export function labelToKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_]/g, "")  // hapus karakter khusus
    .replace(/\s+/g, "_")           // spasi → underscore
    .replace(/_+/g, "_")            // hapus underscore ganda
    .slice(0, 50) || "field";       // max 50 char, fallback "field"
}

// Label display per tipe
export const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text:     "Teks Singkat",
  number:   "Angka",
  select:   "Pilihan",
  datetime: "Tanggal & Waktu",
};

// ─── Parsing data peserta dari invoice item (tiket via cart) ──────────────────
// Item tiket event menyimpan data peserta sebagai JSON di kolom description
// (lihat addEventTicketToCartAction). Dipakai di halaman invoice admin + publik
// agar tidak menampilkan JSON mentah ke user.

export type TicketAttendeeData = {
  attendeeName?:       string;
  attendeePhone?:      string | null;
  attendeeEmail?:      string | null;
  customFieldAnswers?: Record<string, unknown> | null;
};

export function parseTicketAttendee(itemType: string, description: string | null): TicketAttendeeData | null {
  if (itemType !== "ticket" || !description) return null;
  try {
    const parsed = JSON.parse(description) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && "attendeeName" in parsed) {
      return parsed as TicketAttendeeData;
    }
  } catch { /* bukan JSON — tampilkan sebagai teks biasa */ }
  return null;
}

export function humanizeFieldKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatFieldValue(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }
  }
  return String(value);
}
