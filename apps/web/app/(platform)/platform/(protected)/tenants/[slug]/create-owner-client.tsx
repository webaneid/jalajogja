"use client";

import { useState, useTransition } from "react";
import { UserPlus, Eye, EyeOff } from "lucide-react";
import { createFirstOwnerAction } from "../../actions";

interface Props {
  tenantSlug: string;
}

export function CreateOwnerClient({ tenantSlug }: Props) {
  const [pending, startTransition] = useTransition();
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState<{ email: string } | null>(null);

  const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await createFirstOwnerAction(tenantSlug, name, email, password);
      if ("error" in res) { setError(res.error); return; }
      setSuccess({ email: res.email });
    });
  }

  if (success) {
    return (
      <div className="px-5 py-4 bg-green-50 dark:bg-green-950 rounded-b-xl">
        <p className="text-sm font-semibold text-green-800 dark:text-green-200">Owner berhasil dibuat</p>
        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
          Akun <span className="font-mono font-medium">{success.email}</span> sekarang bisa login di{" "}
          <span className="font-mono">jalakarta.com/app/login</span>
        </p>
        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
          Bagikan email dan password kepada pengurus tersebut. Mereka dapat mengubah password setelah login.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted-foreground">Nama Lengkap</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            placeholder="Ahmad Fauzi"
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted-foreground">Email (untuk login)</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="ketua@ikpmjogja.com"
            className={inputCls}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted-foreground">Password</label>
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Min. 8 karakter"
            className={inputCls + " pr-10"}
          />
          <button
            type="button"
            onClick={() => setShowPw(p => !p)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Catat password ini — tidak bisa dilihat lagi. Owner dapat mengubahnya setelah login.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
      >
        <UserPlus size={15} />
        {pending ? "Membuat..." : "Buat Akun Owner"}
      </button>
    </form>
  );
}
