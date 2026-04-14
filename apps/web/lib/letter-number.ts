// Helper: generate nomor surat dengan format yang bisa dikonfigurasi
// Format string contoh: "{number}/{type_code}/{org_code}/{month_roman}/{year}"
// Variabel: {number}, {number:N}, {type_code}, {org_code}, {issuer_code},
//           {month_roman}, {month}, {year}, {year:2}

const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"] as const;

export type LetterNumberConfig = {
  number_format:  string;   // template string
  org_code:       string;   // kode organisasi, mis. "IKPMJogja"
  number_padding: number;   // lebar digit nomor urut, default 2
};

export const DEFAULT_LETTER_CONFIG: LetterNumberConfig = {
  number_format:  "{number}/{type_code}/{org_code}/{month_roman}/{year}",
  org_code:       "",
  number_padding: 2,
};

// Resolve format string dengan variabel yang diberikan
export function resolveLetterNumberFormat(
  format: string,
  vars: {
    number:      number;
    padding:     number;
    typeCode:    string;
    orgCode:     string;
    issuerCode:  string;
    date:        Date;
  }
): string {
  const { number, padding, typeCode, orgCode, issuerCode, date } = vars;
  const year  = date.getFullYear();
  const month = date.getMonth(); // 0-indexed

  return format
    // {number:N} — padding eksplisit, harus lebih dulu dari {number}
    .replace(/\{number:(\d+)\}/g, (_, n) => String(number).padStart(Number(n), "0"))
    .replace(/\{number\}/g, String(number).padStart(padding, "0"))
    .replace(/\{type_code\}/g, typeCode)
    .replace(/\{org_code\}/g, orgCode)
    .replace(/\{issuer_code\}/g, issuerCode)
    .replace(/\{month_roman\}/g, ROMAN[month])
    .replace(/\{month\}/g, String(month + 1).padStart(2, "0"))
    // {year:2} — harus lebih dulu dari {year}
    .replace(/\{year:2\}/g, String(year).slice(-2))
    .replace(/\{year\}/g, String(year));
}

// Tentukan "category" untuk letter_number_sequences
// Jika format memakai {issuer_code} dan issuerCode tersedia → pakai issuerCode
// Jika tidak → "UMUM"
export function resolveSequenceCategory(format: string, issuerCode: string): string {
  if (format.includes("{issuer_code}") && issuerCode.trim()) {
    return issuerCode.trim().toUpperCase();
  }
  return "UMUM";
}
