// Mask nomor HP/WA untuk ditampilkan ke client tanpa membocorkan nomor penuh —
// dipakai saat OTP dikirim ke nomor yang BUKAN nomor yang diketik user sendiri
// (klaim akun member), supaya user tetap tahu ke nomor mana kode dikirim tanpa
// mengekspos nomor lengkap ke siapa pun yang melihat response API.
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  const visible = digits.slice(-4);
  return `${"*".repeat(digits.length - 4)}${visible}`;
}
