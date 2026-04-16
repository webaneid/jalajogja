// Resolver merge fields untuk template surat
// Sintaks: {{key}} — di-resolve saat preview/generate PDF
// Contoh: {{org.name}} → "IKPM Yogyakarta"

// ─── Sanitizer: perbaiki autolink-broken merge fields ────────────────────────
// Masalah: Tiptap dengan autolink=true menyimpan {{variable}} sebagai 3 node:
//   text:"{{"  +  link(href="http://variable", text="variable")  +  text:"}}"
// Regex di resolveMergeFields tidak bisa match karena `}` dari JSON ada di antaranya.
// Sanitizer ini menyatukan kembali node-node tersebut menjadi satu text node.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fixNodes(nodes: any[]): any[] {
  const result: ReturnType<typeof fixNodes> = [];
  let i = 0;
  while (i < nodes.length) {
    const curr = nodes[i];

    // Rekursi ke children terlebih dahulu
    if (curr.content) {
      curr.content = fixNodes(curr.content);
    }

    // Deteksi pola autolink-broken: text ending "{{" + link node + text starting "}}"
    if (
      curr.type === "text" &&
      typeof curr.text === "string" &&
      curr.text.endsWith("{{") &&
      i + 2 < nodes.length
    ) {
      const link = nodes[i + 1];
      const end  = nodes[i + 2];

      const hasLinkMark = Array.isArray(link?.marks) &&
        link.marks.some((m: { type: string }) => m.type === "link");

      if (
        link?.type === "text" &&
        hasLinkMark &&
        end?.type === "text" &&
        typeof end.text === "string" &&
        end.text.startsWith("}}")
      ) {
        // Gabungkan menjadi satu text node
        const before = curr.text.slice(0, -2); // teks sebelum "{{"
        const after  = end.text.slice(2);       // teks sesudah "}}"
        const merged = `${before}{{${link.text}}}${after}`;

        // Pertahankan marks yang ada di curr (jika ada), hilangkan link mark
        const newNode: Record<string, unknown> = { type: "text", text: merged };
        if (curr.marks && curr.marks.length > 0) newNode.marks = curr.marks;

        result.push(newNode);
        i += 3;
        continue;
      }
    }

    result.push(curr);
    i++;
  }
  return result;
}

function fixAutolinkMergeFields(jsonStr: string): string {
  if (!jsonStr) return jsonStr;
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(jsonStr);
  } catch {
    return jsonStr; // bukan JSON valid — return as-is (plain text / HTML)
  }
  // Hanya proses dokumen Tiptap
  if (!doc || doc.type !== "doc" || !Array.isArray(doc.content)) return jsonStr;
  doc.content = fixNodes(doc.content as ReturnType<typeof fixNodes>);
  return JSON.stringify(doc);
}

type MergeContext = {
  org: {
    name:    string;
    address: string;
    phone:   string;
    email:   string;
  };
  letter: {
    number:  string;
    date:    string;
    subject: string;
    sender:  string;
    recipient: string;
  };
  signers: Array<{
    name:     string;
    position: string;
    division: string;
  }>;
  // Konteks penerima — terisi saat pilih dari kontak/anggota atau mail merge bulk
  recipient?: {
    name:         string;
    title:        string; // jabatan/gelar penerima (dari letter_contacts.title)
    organization: string; // instansi penerima (dari letter_contacts.organization)
    phone:        string;
    email:        string;
    address:      string;
    number:       string; // nomor anggota
    nik:          string;
  };
};

// ─── Helper: tanggal hari ini dalam berbagai format ─────────────────────────

const ROMAN_MONTHS = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"] as const;
const ID_MONTHS    = ["Januari","Februari","Maret","April","Mei","Juni",
                      "Juli","Agustus","September","Oktober","November","Desember"] as const;
const HIJRI_MONTHS = [
  "Muharram","Safar","Rabiul Awal","Rabiul Akhir",
  "Jumadil Awal","Jumadil Akhir","Rajab","Sya'ban",
  "Ramadan","Syawal","Dzulqa'dah","Dzulhijjah",
] as const;

// hijriOffset: penyesuaian hari kalender pemerintah RI vs kalkulasi internasional (-1/0/+1)
// Base algorithm: islamic-umalqura (Umm al-Qura, Saudi Arabia) via Intl bawaan Node.js
function buildTodayVars(hijriOffset = 0): Record<string, string> {
  const now  = new Date();
  const dd   = String(now.getDate()).padStart(2, "0");
  const mm   = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());

  // Hitung tanggal Hijriah dengan offset
  const shifted = new Date(now);
  shifted.setDate(shifted.getDate() + hijriOffset);

  let hijriStr = "";
  try {
    const parts = new Intl.DateTimeFormat("id-ID-u-ca-islamic-umalqura", {
      year: "numeric", month: "numeric", day: "numeric",
    }).formatToParts(shifted);

    const hDay   = Number(parts.find((p) => p.type === "day")?.value   ?? "0");
    const hMonth = Number(parts.find((p) => p.type === "month")?.value ?? "1");
    const hYear  = Number(parts.find((p) => p.type === "year")?.value  ?? "0");
    const monthName = HIJRI_MONTHS[(hMonth - 1) % 12];
    hijriStr = `${hDay} ${monthName} ${hYear} H`;
  } catch {
    // Fallback jika Intl tidak support islamic-umalqura di runtime ini
    hijriStr = "";
  }

  return {
    "today":        `${dd}/${mm}/${yyyy}`,
    "today.roman":  ROMAN_MONTHS[now.getMonth()],
    "today.year":   yyyy,
    "today.id":     `${now.getDate()} ${ID_MONTHS[now.getMonth()]} ${yyyy}`,
    "today.hijri":  hijriStr,
  };
}

// Resolusi sederhana: ganti semua {{key}} dengan nilai dari context
// Sebelum replace: sanitasi autolink-broken JSON (letter lama)
// hijriOffset: opsional, diambil dari settings.letter_hijri_offset (default 0)
export function resolveMergeFields(template: string, ctx: MergeContext, hijriOffset = 0): string {
  // Perbaiki letter lama yang tersimpan saat autolink=true aktif
  const sanitized = fixAutolinkMergeFields(template);

  const flat: Record<string, string> = {
    "org.name":            ctx.org.name,
    "org.address":         ctx.org.address,
    "org.phone":           ctx.org.phone,
    "org.email":           ctx.org.email,
    "letter.number":       ctx.letter.number,
    "letter.date":         ctx.letter.date,
    "letter.subject":      ctx.letter.subject,
    "letter.sender":       ctx.letter.sender,
    "letter.recipient":    ctx.letter.recipient,
    // Signer pertama (biasanya kepala/ketua)
    "signer.name":         ctx.signers[0]?.name     ?? "",
    "signer.position":     ctx.signers[0]?.position ?? "",
    "signer.division":     ctx.signers[0]?.division ?? "",
    // Penerima — dari kontak/anggota terpilih atau mail merge bulk
    "recipient.name":         ctx.recipient?.name         ?? "",
    "recipient.title":        ctx.recipient?.title        ?? "",
    "recipient.organization": ctx.recipient?.organization ?? "",
    "recipient.phone":        ctx.recipient?.phone        ?? "",
    "recipient.email":        ctx.recipient?.email        ?? "",
    "recipient.address":      ctx.recipient?.address      ?? "",
    "recipient.number":       ctx.recipient?.number       ?? "",
    "recipient.nik":          ctx.recipient?.nik          ?? "",
    // Tanggal hari ini — di-resolve server-side saat render/generate PDF
    ...buildTodayVars(hijriOffset),
  };

  return sanitized.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    return flat[key.trim()] ?? `{{${key}}}`;
  });
}

// Bentuk MergeContext dari data yang sudah ada di generate-pdf route
export function buildMergeContext(params: {
  orgName:    string;
  orgAddress: string;
  orgPhone:   string;
  orgEmail:   string;
  letterNumber: string;
  letterDate:   string;
  subject:      string;
  sender:       string;
  recipient:    string;
  signers: Array<{ name: string; position: string; division: string }>;
  // Opsional — dari kontak/anggota terpilih di form, atau mail merge bulk
  recipientData?: {
    name:          string;
    title?:        string;
    organization?: string;
    phone?:        string;
    email?:        string;
    address?:      string;
    number?:       string;
    nik?:          string;
  };
}): MergeContext {
  return {
    org: {
      name:    params.orgName,
      address: params.orgAddress,
      phone:   params.orgPhone,
      email:   params.orgEmail,
    },
    letter: {
      number:    params.letterNumber,
      date:      params.letterDate,
      subject:   params.subject,
      sender:    params.sender,
      recipient: params.recipient,
    },
    signers: params.signers,
    recipient: params.recipientData
      ? {
          name:         params.recipientData.name,
          title:        params.recipientData.title        ?? "",
          organization: params.recipientData.organization ?? "",
          phone:        params.recipientData.phone        ?? "",
          email:        params.recipientData.email        ?? "",
          address:      params.recipientData.address      ?? "",
          number:       params.recipientData.number       ?? "",
          nik:          params.recipientData.nik          ?? "",
        }
      : undefined,
  };
}
