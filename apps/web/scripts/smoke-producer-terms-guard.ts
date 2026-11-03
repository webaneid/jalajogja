// Uji MURNI pengaman terbit Syarat & Ketentuan Produsen (tanpa DB). docs/arsitektur-portal-produsen.md § 28.
//   cd apps/web && bun run scripts/smoke-producer-terms-guard.ts
import { findUnfilledPlaceholders, placeholderPublishError, validateTermInput } from "../lib/producer-terms";

let fails = 0;
const ok = (n: string, v: boolean) => { console.log((v ? "PASS " : "FAIL ") + n); if (!v) fails++; };
const doc = (...blocks: unknown[]) => JSON.stringify({ type: "doc", content: blocks });
const p = (...kids: unknown[]) => ({ type: "paragraph", content: kids });
const t = (text: string, bold = false) => ({ type: "text", text, ...(bold ? { marks: [{ type: "bold" }] } : {}) });

ok("bersih: tanpa penanda → kosong", findUnfilledPlaceholders(doc(p(t("Syarat sah. Biaya Rp7.500 {tidak dihitung}.")))).length === 0 && placeholderPublishError(doc(p(t("Halo")))) === null);
ok("mendeteksi {{penanda}}", JSON.stringify(findUnfilledPlaceholders(doc(p(t("Versi {{nomor_versi}} berlaku."))))) === '["{{nomor_versi}}"]');
ok("penanda terpecah oleh format tebal tetap terdeteksi", findUnfilledPlaceholders(doc(p(t("Pengadilan {{kota_"), t("pengadilan}}", true)))).includes("{{kota_pengadilan}}"));
ok("mendeteksi [PERLU VERIFIKASI HUKUM] (huruf besar/kecil & spasi)", findUnfilledPlaceholders(doc(p(t("Pasal 5 [perlu verifikasi hukum]")), p(t("x [ PERLU VERIFIKASI HUKUM ]")))).length === 1);
ok("penanda sama muncul berkali-kali → unik", findUnfilledPlaceholders(doc(p(t("{{a}} dan {{a}} lalu {{b}}")))).length === 2);
ok("penanda di daftar & tabel (blok bersarang) terdeteksi", findUnfilledPlaceholders(doc({ type: "bulletList", content: [{ type: "listItem", content: [p(t("{{hari_mediasi}} hari"))] }] })).includes("{{hari_mediasi}}"));
ok("pesan galat memuat jumlah & daftar", /2 penanda.*\{\{a\}\}.*\{\{b\}\}/.test(placeholderPublishError(doc(p(t("{{a}} {{b}}")))) ?? ""));
ok("JSON rusak → tidak melempar", findUnfilledPlaceholders("bukan json").length === 0);
ok("draf TETAP boleh disimpan berisi penanda (validateTermInput tak menolaknya)", validateTermInput("Judul", doc(p(t("Isi {{x}}")))) === null);
console.log(fails ? `\n${fails} GAGAL` : "\nSEMUA LULUS");
process.exit(fails ? 1 : 0);
