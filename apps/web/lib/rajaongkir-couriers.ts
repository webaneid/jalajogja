// Daftar lengkap 16 kurir yang divalidasi RajaOngkir untuk API key platform kita (dicek langsung via error 422
// endpoint /calculate/domestic-cost saat kirim kode tidak valid — bukan dari dokumentasi RajaOngkir yang tidak
// konsisten soal daftar lengkap per tier akun). Satu sumber untuk form pengaturan DAN validasi server.
export const RAJAONGKIR_COURIER_OPTIONS = [
  { value: "jne",      label: "JNE" },
  { value: "tiki",     label: "TIKI" },
  { value: "pos",      label: "POS Indonesia" },
  { value: "sicepat",  label: "SiCepat" },
  { value: "anteraja", label: "AnterAja" },
  { value: "jnt",      label: "J&T Express" },
  { value: "ninja",    label: "Ninja Xpress" },
  { value: "lion",     label: "Lion Parcel" },
  { value: "rpx",      label: "RPX" },
  { value: "sap",      label: "SAP Express" },
  { value: "ide",      label: "ID Express" },
  { value: "ncs",      label: "NCS Express" },
  { value: "rex",      label: "REX (Royal Express Indonesia)" },
  { value: "sentral",  label: "Sentral Cargo" },
  { value: "star",     label: "Star Cargo" },
  { value: "wahana",   label: "Wahana" },
] as const;

export const RAJAONGKIR_COURIER_CODES: readonly string[] = RAJAONGKIR_COURIER_OPTIONS.map((c) => c.value);
