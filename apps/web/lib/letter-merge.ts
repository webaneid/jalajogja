// Resolver merge fields untuk template surat
// Sintaks: {{key}} — di-resolve saat preview/generate PDF
// Contoh: {{org.name}} → "IKPM Yogyakarta"

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
};

// Resolusi sederhana: ganti semua {{key}} dengan nilai dari context
export function resolveMergeFields(template: string, ctx: MergeContext): string {
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
  };

  return template.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
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
  };
}
