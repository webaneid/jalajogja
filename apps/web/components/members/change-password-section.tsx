"use client";

import { useState, useTransition } from "react";
import {
  changeUserPasswordAction,
  activateMemberAccountAction,
} from "@/app/(dashboard)/app/[tenant]/members/actions";
import { KeyRound, UserCheck, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";

type Props = {
  slug:         string;
  memberId:     string;
  hasAccount:   boolean;  // false → anggota belum punya akun login
  initialEmail?: string;
};

export function ChangePasswordSection({ slug, memberId, hasAccount, initialEmail = "" }: Props) {
  const [email,       setEmail]      = useState(initialEmail);
  const [newPw,       setNewPw]      = useState("");
  const [confirmPw,   setConfirmPw]  = useState("");
  const [showNew,     setShowNew]    = useState(false);
  const [showConfirm, setShowConfirm]= useState(false);
  const [error,       setError]      = useState<string | null>(null);
  const [success,     setSuccess]    = useState(false);
  const [pending,     startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    setSuccess(false);

    if (!hasAccount && !email.trim()) {
      setError("Email login wajib diisi.");
      return;
    }
    if (newPw.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }
    if (newPw !== confirmPw) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    startTransition(async () => {
      if (!hasAccount) {
        // Mode Aktivasi Akun
        const res = await activateMemberAccountAction(slug, memberId, email, newPw);
        if (!res.success) {
          setError(res.error ?? "Gagal mengaktifkan akun.");
          return;
        }
        setSuccess(true);
        setNewPw("");
        setConfirmPw("");
      } else {
        // Mode Ubah Password
        const res = await changeUserPasswordAction(slug, memberId, newPw);
        if (!res.success) {
          setError(res.error ?? "Gagal mengubah password.");
          return;
        }
        setSuccess(true);
        setNewPw("");
        setConfirmPw("");
        setTimeout(() => setSuccess(false), 4000);
      }
    });
  }

  return (
    <div className="rounded-xl border border-border p-5 space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2 font-semibold text-sm">
          {hasAccount ? (
            <KeyRound className="h-4 w-4 text-primary" />
          ) : (
            <UserCheck className="h-4 w-4 text-primary" />
          )}
          {hasAccount ? "Ubah Password" : "Aktifkan Akun Login"}
        </div>
        {!hasAccount && (
          <p className="text-xs text-muted-foreground">
            Anggota ini belum memiliki akun login. Masukkan email dan buatkan password sementara agar anggota dapat masuk.
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-300 rounded-lg px-3 py-2 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {hasAccount
            ? "Password berhasil diubah."
            : `Akun login berhasil diaktifkan dengan email ${email}. Berikan password sementara kepada anggota.`}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {!hasAccount && (
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium">
              Email Login <span className="text-destructive">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            {hasAccount ? "Password Baru" : "Password Sementara"} <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              placeholder="Min. 8 karakter"
              className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button type="button" onClick={() => setShowNew(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            {hasAccount ? "Konfirmasi Password" : "Ulangi Password Sementara"} <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="Ulangi password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button type="button" onClick={() => setShowConfirm(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={pending || (!hasAccount && !email) || !newPw || !confirmPw}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {hasAccount ? "Simpan Password" : "Aktifkan Akun Login"}
      </button>
    </div>
  );
}
