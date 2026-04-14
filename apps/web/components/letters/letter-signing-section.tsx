"use client";

import { useState, useTransition } from "react";
import { PenLine, CheckCircle2, Trash2, Shield } from "lucide-react";
import { signLetterAction, removeSignatureAction } from "@/app/(dashboard)/[tenant]/letters/actions";

type SignerRole = "signer" | "approver" | "witness";

export type AvailableSigner = {
  officerId:     string;
  name:          string;
  position:      string;
  division:      string | null;
  canSign:       boolean;
  isCurrentUser: boolean;
};

export type ExistingSignature = {
  id:               string;
  officerId:        string;
  role:             SignerRole;
  signedAt:         Date;
  verificationHash: string;
  signerName:       string;
  signerPosition:   string;
  signerDivision:   string | null;
};

type Props = {
  slug:               string;
  letterId:           string;
  availableSigners:   AvailableSigner[];
  initialSignatures:  ExistingSignature[];
  isAdmin:            boolean;
};

const ROLE_LABELS: Record<SignerRole, string> = {
  signer:   "Penandatangan",
  approver: "Penyetuju",
  witness:  "Saksi",
};

export function LetterSigningSection({
  slug, letterId, availableSigners, initialSignatures, isAdmin,
}: Props) {
  const [signatures, setSignatures] = useState<ExistingSignature[]>(initialSignatures);
  // selectedRole[officerId] → role yang dipilih untuk officer ini sebelum TTD
  const [selectedRole, setSelectedRole] = useState<Record<string, SignerRole>>(
    Object.fromEntries(availableSigners.map((s) => [s.officerId, "signer" as SignerRole]))
  );
  const [error, setError]          = useState("");
  const [pending, startTransition] = useTransition();

  function isSigned(officerId: string): boolean {
    return signatures.some((s) => s.officerId === officerId);
  }

  function getSignature(officerId: string): ExistingSignature | undefined {
    return signatures.find((s) => s.officerId === officerId);
  }

  function setRole(officerId: string, role: SignerRole) {
    setSelectedRole((prev) => ({ ...prev, [officerId]: role }));
  }

  function handleSign(signer: AvailableSigner) {
    const role = selectedRole[signer.officerId] ?? "signer";
    setError("");

    startTransition(async () => {
      const res = await signLetterAction(slug, letterId, signer.officerId, role);
      if (res.success) {
        // Optimistic update — hash langsung tersedia untuk QR (Step 3b)
        setSignatures((prev) => [
          ...prev,
          {
            id:               crypto.randomUUID(), // placeholder; halaman akan reload jika user refresh
            officerId:        signer.officerId,
            role,
            signedAt:         new Date(),
            verificationHash: res.verificationHash,
            signerName:       signer.name,
            signerPosition:   signer.position,
            signerDivision:   signer.division,
          },
        ]);
      } else {
        setError(res.error);
      }
    });
  }

  function handleRemove(signatureId: string) {
    if (!confirm("Hapus tanda tangan ini? Tindakan ini tidak bisa dibatalkan.")) return;
    setError("");

    startTransition(async () => {
      const res = await removeSignatureAction(slug, signatureId);
      if (res.success) {
        setSignatures((prev) => prev.filter((s) => s.id !== signatureId));
      } else {
        setError(res.error);
      }
    });
  }

  if (availableSigners.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Belum ada pengurus dengan izin tanda tangan.
        <br />
        <span className="text-xs">Aktifkan "Dapat Menandatangani" di halaman Pengurus.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
        {availableSigners.map((signer) => {
          const sig    = getSignature(signer.officerId);
          const signed = !!sig;
          const role   = selectedRole[signer.officerId] ?? "signer";

          return (
            <div key={signer.officerId} className="flex items-center justify-between px-4 py-3 gap-4">
              {/* Kiri: status icon + info */}
              <div className="flex items-center gap-3 min-w-0">
                {signed
                  ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  : <Shield className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                }
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{signer.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {signer.position}
                    {signer.division ? ` · ${signer.division}` : ""}
                    {signed && sig ? ` · ${ROLE_LABELS[sig.role]}` : ""}
                  </p>
                  {signed && sig && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      TTD: {new Date(sig.signedAt).toLocaleString("id-ID")}
                    </p>
                  )}
                </div>
              </div>

              {/* Kanan: role select + tombol */}
              <div className="flex items-center gap-2 shrink-0">
                {!signed && signer.isCurrentUser && (
                  <>
                    {/* Pilih role sebelum TTD */}
                    <select
                      value={role}
                      onChange={(e) => setRole(signer.officerId, e.target.value as SignerRole)}
                      disabled={pending}
                      className="rounded border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="signer">Penandatangan</option>
                      <option value="approver">Penyetuju</option>
                      <option value="witness">Saksi</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleSign(signer)}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 whitespace-nowrap"
                    >
                      <PenLine className="h-3.5 w-3.5" />
                      Tanda Tangani
                    </button>
                  </>
                )}

                {!signed && !signer.isCurrentUser && (
                  <span className="text-xs text-muted-foreground italic">Menunggu</span>
                )}

                {signed && sig && isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleRemove(sig.id)}
                    disabled={pending}
                    title="Hapus tanda tangan (admin)"
                    className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
