// Daftar bank untuk rekening produsen (pencairan). Kode dipakai membandingkan bank produsen dengan bank tenant (biaya transfer: sesama bank = murah).
export const BANKS: { code: string; name: string }[] = [
  { code: "bca", name: "BCA" }, { code: "bri", name: "BRI" }, { code: "bni", name: "BNI" }, { code: "mandiri", name: "Mandiri" },
  { code: "bsi", name: "BSI (Bank Syariah Indonesia)" }, { code: "cimb", name: "CIMB Niaga" }, { code: "permata", name: "Permata" },
  { code: "danamon", name: "Danamon" }, { code: "btn", name: "BTN" }, { code: "muamalat", name: "Bank Muamalat" }, { code: "jago", name: "Bank Jago" },
  { code: "seabank", name: "SeaBank" }, { code: "btpn", name: "BTPN / Jenius" }, { code: "ocbc", name: "OCBC" }, { code: "panin", name: "Panin" },
  { code: "maybank", name: "Maybank" }, { code: "mega", name: "Bank Mega" }, { code: "bjb", name: "Bank BJB" }, { code: "dki", name: "Bank DKI" },
  { code: "bpd_diy", name: "BPD DIY" }, { code: "bank_jatim", name: "Bank Jatim" }, { code: "bank_jateng", name: "Bank Jateng" }, { code: "lainnya", name: "Bank lainnya" },
];
export const BANK_CODES = new Set(BANKS.map((b) => b.code));
export const bankNameOf = (code: string) => BANKS.find((b) => b.code === code)?.name ?? code;

/** Tebak kode bank dari teks bebas (nama bank di pengaturan rekening tenant). null = tidak dikenali. */
export function guessBankCode(label: string | null | undefined): string | null {
  const t = (label ?? "").toLowerCase();
  if (!t.trim()) return null;
  const rules: [string, RegExp][] = [
    ["bsi", /\bbsi\b|syariah indonesia|\bbri\s*syariah|mandiri syariah|bni syariah/], ["bca", /\bbca\b|central asia/], ["bri", /\bbri\b|rakyat indonesia/], ["bni", /\bbni\b|negara indonesia/],
    ["mandiri", /mandiri/], ["cimb", /cimb/], ["permata", /permata/], ["danamon", /danamon/], ["btn", /\bbtn\b|tabungan negara/], ["muamalat", /muamalat/],
    ["jago", /jago/], ["seabank", /seabank|sea bank/], ["btpn", /btpn|jenius/], ["ocbc", /ocbc/], ["panin", /panin/], ["maybank", /maybank/], ["mega", /\bmega\b/],
    ["bjb", /\bbjb\b/], ["dki", /\bdki\b/], ["bpd_diy", /bpd diy|daerah yogyakarta/], ["bank_jatim", /jatim/], ["bank_jateng", /jateng/],
  ];
  for (const [code, re] of rules) if (re.test(t)) return code;
  return null;
}
