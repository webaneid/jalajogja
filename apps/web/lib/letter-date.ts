// Konstanta tanggal dan helper bersama untuk modul surat
// Dipakai oleh: letter-number.ts, letter-merge.ts, letter-html.ts

export const ROMAN_MONTHS = [
  "I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII",
] as const;

export const ID_MONTHS = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember",
] as const;

export const HIJRI_MONTHS = [
  "Muharram","Safar","Rabiul Awal","Rabiul Akhir",
  "Jumadil Awal","Jumadil Akhir","Rajab","Sya'ban",
  "Ramadan","Syawal","Dzulqa'dah","Dzulhijjah",
] as const;

// Hitung dan format tanggal Hijriah via Intl (islamic-umalqura / Umm al-Qura)
// hijriOffset: penyesuaian hari kalender pemerintah RI vs kalkulasi internasional (-1/0/+1)
export function formatHijri(date: Date, hijriOffset = 0): string {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + hijriOffset);
  try {
    const parts = new Intl.DateTimeFormat("id-ID-u-ca-islamic-umalqura", {
      year: "numeric", month: "numeric", day: "numeric",
    }).formatToParts(shifted);
    const hDay   = Number(parts.find((p) => p.type === "day")?.value   ?? "0");
    const hMonth = Number(parts.find((p) => p.type === "month")?.value ?? "1");
    const hYear  = Number(parts.find((p) => p.type === "year")?.value  ?? "0");
    return `${hDay} ${HIJRI_MONTHS[(hMonth - 1) % 12]} ${hYear} H`;
  } catch {
    return "";
  }
}
