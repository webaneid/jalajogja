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
