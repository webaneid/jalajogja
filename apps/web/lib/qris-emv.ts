// QRIS EMV TLV — parser dan builder untuk QRIS Indonesia
// Format: Tag(2) + Length(2 desimal) + Value(N chars) — text-based, bukan binary

type Tlv = { tag: string; value: string };

function parseTlv(str: string): Tlv[] {
  const result: Tlv[] = [];
  let i = 0;
  // Berhenti sebelum CRC (tag 63)
  while (i + 4 <= str.length) {
    const tag = str.slice(i, i + 2);
    if (tag === "63") break; // CRC = akhir payload
    const len = parseInt(str.slice(i + 2, i + 4), 10);
    if (isNaN(len) || i + 4 + len > str.length) break;
    result.push({ tag, value: str.slice(i + 4, i + 4 + len) });
    i += 4 + len;
  }
  return result;
}

function makeTlv(tag: string, value: string): string {
  return `${tag}${String(value.length).padStart(2, "0")}${value}`;
}

function buildFromTlvs(tlvs: Tlv[]): string {
  return tlvs.map(({ tag, value }) => makeTlv(tag, value)).join("");
}

function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildDynamicQris(staticPayload: string, amount: number, reference: string): string {
  // Strip CRC lama di akhir ("6304XXXX" = 8 chars)
  const body = staticPayload.replace(/6304[0-9A-Fa-f]{4}$/, "");
  const tlvs = parseTlv(body);
  const output: Tlv[] = [];
  let hasTa54 = false;
  let hasT62  = false;

  for (const { tag, value } of tlvs) {
    if (tag === "01") {
      // Static(11) → Dynamic(12)
      output.push({ tag: "01", value: "12" });

    } else if (tag === "54") {
      // Override nominal
      output.push({ tag: "54", value: Math.round(amount).toString() });
      hasTa54 = true;

    } else if (tag === "53") {
      // Currency (IDR=360) — inject Tag 54 tepat setelahnya jika belum ada
      output.push({ tag, value });
      if (!hasTa54) {
        output.push({ tag: "54", value: Math.round(amount).toString() });
        hasTa54 = true;
      }

    } else if (tag === "62") {
      // Additional Data Field — inject/ganti sub-tag 05 (reference label)
      const ref     = reference.slice(0, 25);
      const subTlvs = parseTlv(value);
      const has05   = subTlvs.some((s) => s.tag === "05");
      const newSubs = has05
        ? subTlvs.map((s) => (s.tag === "05" ? { tag: "05", value: ref } : s))
        : [{ tag: "05", value: ref }, ...subTlvs];
      output.push({ tag: "62", value: buildFromTlvs(newSubs) });
      hasT62 = true;

    } else {
      output.push({ tag, value });
    }
  }

  // Tambahkan Tag 62 jika belum ada sama sekali
  if (!hasT62) {
    const ref = reference.slice(0, 25);
    output.push({ tag: "62", value: makeTlv("05", ref) });
  }

  const withoutCrc = buildFromTlvs(output) + "6304";
  return withoutCrc + crc16(withoutCrc);
}

export function isValidQrisPayload(payload: string): boolean {
  return (
    payload.startsWith("0002") &&
    /6304[0-9A-Fa-f]{4}$/.test(payload)
  );
}
