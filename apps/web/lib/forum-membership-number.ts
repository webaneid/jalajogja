// Bagian CLIENT-SAFE dari nomor keanggotaan lokal forum — konstanta + fungsi format murni,
// TANPA import ke @jalajogja/db (jangan tambahkan — akan menarik postgres client ke bundle
// client, lihat lesson "getSettings butuh TenantDb lengkap"/"nav-menu.ts vs
// get-public-nav-menu.ts" di CLAUDE.md). Dipakai oleh membership-config-form.tsx (client
// component). Fungsi yang butuh DB (generateForumMembershipNumber) ada di
// forum-membership-number.server.ts.
export const FORUM_MEMBERSHIP_NUMBER_FORMATS = ["year_seq", "year_birthdate_seq", "month_year_seq", "joinyear_gradyear_seq"] as const;
export type ForumMembershipNumberFormat = typeof FORUM_MEMBERSHIP_NUMBER_FORMATS[number];

export const FORUM_MEMBERSHIP_NUMBER_FORMAT_LABELS: Record<ForumMembershipNumberFormat, { label: string; example: string }> = {
  year_seq:              { label: "Tahun + Urutan",                    example: "2017.00001" },
  year_birthdate_seq:    { label: "Tahun + Tgl Lahir + Urutan",         example: "20172610199700001" },
  month_year_seq:         { label: "Bulan-Tahun + Urutan",               example: "082017.00001" },
  joinyear_gradyear_seq: { label: "Tahun Daftar + Angkatan + Urutan",   example: "2690.00001" },
};

export function formatForumMembershipNumber(
  format: ForumMembershipNumberFormat,
  opts: { seq: number; joinDate: Date; birthDate: string | null; graduationYear: number | null },
): string {
  const seqPart = opts.seq.toString().padStart(5, "0");
  const year    = opts.joinDate.getFullYear();

  switch (format) {
    case "year_seq":
      return `${year}.${seqPart}`;

    case "year_birthdate_seq": {
      // Format tanggal lahir: YYYY-MM-DD → DDMMYYYY, sama persis recipe member_number global
      // (lib/member-number.ts di packages/db) — sengaja dipertahankan konsisten.
      let birthPart = "00000000";
      if (opts.birthDate) {
        const [y, m, d] = opts.birthDate.split("-");
        birthPart = `${d}${m}${y}`;
      }
      return `${year}${birthPart}${seqPart}`;
    }

    case "month_year_seq": {
      const month = (opts.joinDate.getMonth() + 1).toString().padStart(2, "0");
      return `${month}${year}.${seqPart}`;
    }

    case "joinyear_gradyear_seq": {
      // 2 digit terakhir tahun daftar + 2 digit terakhir tahun angkatan (Tahun Lulus KMI).
      // graduationYear WAJIB terisi sebelum sampai sini (field eligibility mandatory, dicek
      // checkMemberEligibility() di kedua caller — join gratis & aktivasi via pembayaran) —
      // fallback "00" murni defensif, sama pola dengan birthPart di atas.
      const joinYY = String(year).slice(-2);
      const gradYY = opts.graduationYear ? String(opts.graduationYear).slice(-2) : "00";
      return `${joinYY}${gradYY}.${seqPart}`;
    }
  }
}
