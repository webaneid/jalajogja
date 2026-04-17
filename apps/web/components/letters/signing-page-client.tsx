"use client";

// Halaman publik penandatanganan via link token
// Menampilkan: info surat + info officer + tombol TTD + QR setelah TTD

import { useState, useTransition } from "react";
import { CheckCircle2, PenLine, Shield } from "lucide-react";
import { signByTokenAction } from "@/app/(dashboard)/[tenant]/letters/actions";

const ROLE_LABELS: Record<string, string> = {
  signer:   "Penandatangan",
  approver: "Penyetuju",
  witness:  "Saksi",
};

type Props = {
  slug:             string;
  token:            string;
  signatureId:      string;
  letterId:         string;
  letterSubject:    string | null;
  letterNumber:     string | null;
  letterDate:       string | null;
  recipient:        string | null;
  officerName:      string;
  officerPosition:  string | null;
  officerDivision:  string | null;
  role:             "signer" | "approver" | "witness";
  alreadySigned:    boolean;
  verificationHash: string | null;
  appUrl:           string;
};

export function SigningPageClient({
  slug, token, letterId,
  letterSubject, letterNumber, letterDate, recipient,
  officerName, officerPosition, officerDivision, role,
  alreadySigned, verificationHash: initialHash, appUrl,
}: Props) {
  const [signed, setSigned]     = useState(alreadySigned);
  const [hash, setHash]         = useState<string | null>(initialHash);
  const [error, setError]       = useState("");
  const [pending, startTransition] = useTransition();

  const verifyUrl = hash ? `${appUrl}/${slug}/verify/${hash}` : null;

  function handleSign() {
    setError("");
    startTransition(async () => {
      const res = await signByTokenAction(slug, token);
      if (res.success) {
        setSigned(true);
        setHash(res.verificationHash);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-background shadow-sm overflow-hidden">
      {/* Header status */}
      <div className={`px-6 py-4 ${signed ? "bg-green-50 border-b border-green-100" : "bg-muted/5 border-b border-border"}`}>
        <div className="flex items-center gap-3">
          {signed
            ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            : <Shield className="h-5 w-5 text-primary shrink-0" />
          }
          <div>
            <p className={`font-semibold text-sm ${signed ? "text-green-700" : "text-foreground"}`}>
              {signed ? "Surat Sudah Ditandatangani" : "Permintaan Tanda Tangan"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ROLE_LABELS[role] ?? role}
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Info surat */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Detail Surat</p>
          <div className="rounded-lg border border-border divide-y divide-border text-sm">
            {letterSubject && (
              <div className="px-3 py-2">
                <span className="text-muted-foreground text-xs">Perihal</span>
                <p className="font-medium mt-0.5">{letterSubject}</p>
              </div>
            )}
            {letterNumber && (
              <div className="grid grid-cols-[100px_1fr] px-3 py-2 text-xs">
                <span className="text-muted-foreground">Nomor</span>
                <span className="font-mono">{letterNumber}</span>
              </div>
            )}
            {letterDate && (
              <div className="grid grid-cols-[100px_1fr] px-3 py-2 text-xs">
                <span className="text-muted-foreground">Tanggal</span>
                <span>{letterDate}</span>
              </div>
            )}
            {recipient && (
              <div className="grid grid-cols-[100px_1fr] px-3 py-2 text-xs">
                <span className="text-muted-foreground">Kepada</span>
                <span>{recipient}</span>
              </div>
            )}
          </div>
        </div>

        {/* Info penandatangan */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Penandatangan</p>
          <div className="rounded-lg border border-border px-3 py-2.5 text-sm">
            <p className="font-medium">{officerName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {officerPosition}
              {officerDivision ? ` · ${officerDivision}` : ""}
            </p>
          </div>
        </div>

        {/* Tombol TTD atau QR setelah TTD */}
        {!signed ? (
          <div className="space-y-2">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="button"
              disabled={pending}
              onClick={handleSign}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <PenLine className="h-4 w-4" />
              {pending ? "Memproses..." : "Tanda Tangan Sekarang"}
            </button>
            <p className="text-xs text-center text-muted-foreground">
              Dengan menandatangani, Anda menyetujui isi surat di atas.
            </p>
          </div>
        ) : (
          <div className="space-y-3 text-center">
            <p className="text-sm text-green-700 font-medium">
              Tanda tangan berhasil tersimpan.
            </p>
            {verifyUrl && (
              <div className="rounded-lg border border-border bg-muted/5 px-4 py-3 space-y-1.5">
                <p className="text-xs text-muted-foreground">URL Verifikasi</p>
                <a
                  href={verifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-xs font-mono text-primary hover:underline"
                >
                  {verifyUrl}
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
