// Format rupiah & tanggal untuk UI pencairan (client-safe).
export const rupiah = (n: number | string | null | undefined) => `Rp${Math.round(Number(n ?? 0)).toLocaleString("id-ID")}`;
export const rupiahSigned = (n: number) => (n < 0 ? `−${rupiah(-n)}` : rupiah(n));
export const fmtDateTime = (d: Date | string | null | undefined) => d ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(d)) + " WIB" : "—";
export const fmtDate = (d: Date | string | null | undefined) => d ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(d)) : "—";
