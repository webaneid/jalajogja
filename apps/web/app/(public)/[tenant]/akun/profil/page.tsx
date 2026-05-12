"use client";

import { useState, useEffect, useTransition } from "react";
import { use }    from "react";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { CheckCircle2, Loader2, Eye, EyeOff } from "lucide-react";

type Params = Promise<{ tenant: string }>;

type ProfileData = {
  type:     "member" | "public";
  name:     string;
  email:    string;
  phone:    string | null;
};

export default function ProfilPage({ params }: { params: Params }) {
  const { tenant: slug } = use(params);

  const [data,       setData]       = useState<ProfileData | null>(null);
  const [name,       setName]       = useState("");
  const [loading,    setLoading]    = useState(true);
  const [nameSaved,  setNameSaved]  = useState(false);
  const [nameError,  setNameError]  = useState<string | null>(null);
  const [isPending,  start]         = useTransition();

  // ── Ganti password ───────────────────────────────────────────────────────
  const [currentPw,   setCurrentPw]   = useState("");
  const [newPw,       setNewPw]       = useState("");
  const [confirmPw,   setConfirmPw]   = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [pwSaved,     setPwSaved]     = useState(false);
  const [pwError,     setPwError]     = useState<string | null>(null);
  const [isPwPending, startPw]        = useTransition();

  useEffect(() => {
    fetch("/api/akun/profil")
      .then(r => r.json())
      .then((res: { data?: ProfileData; error?: string; type?: string }) => {
        if (res.data) {
          setData({ ...res.data, type: (res.type ?? "public") as "member" | "public" });
          setName(res.data.name);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setNameError(null);
    setNameSaved(false);
    if (!name.trim()) { setNameError("Nama tidak boleh kosong."); return; }
    start(async () => {
      const res  = await fetch("/api/akun/profil", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok || json.error) { setNameError(json.error ?? "Gagal menyimpan."); return; }
      setNameSaved(true);
    });
  }

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSaved(false);
    if (!currentPw)               { setPwError("Password saat ini wajib diisi."); return; }
    if (newPw.length < 8)         { setPwError("Password baru minimal 8 karakter."); return; }
    if (newPw !== confirmPw)      { setPwError("Konfirmasi password tidak cocok."); return; }
    startPw(async () => {
      const res  = await fetch("/api/auth/change-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const json = await res.json() as { error?: string; message?: string };
      if (!res.ok) {
        setPwError(json.message ?? json.error ?? "Password saat ini salah.");
        return;
      }
      setPwSaved(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    });
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-8">

      <h1 className="text-xl font-bold">Info Login</h1>

      {/* ── Nama tampilan ── */}
      <section className="space-y-4">
        <div className="border-b border-border pb-2">
          <h2 className="text-sm font-semibold">Nama</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Nama yang ditampilkan di profil dan transaksi.</p>
        </div>
        <form onSubmit={handleSaveName} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama Lengkap</Label>
            <Input
              id="name"
              value={name}
              onChange={e => { setName(e.target.value); setNameSaved(false); }}
              required
              autoComplete="name"
            />
          </div>
          {nameError && <p className="text-sm text-destructive">{nameError}</p>}
          {nameSaved && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" /> Nama berhasil disimpan.
            </div>
          )}
          <Button type="submit" disabled={isPending} size="sm">
            {isPending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Menyimpan...</> : "Simpan Nama"}
          </Button>
        </form>
      </section>

      {/* ── Email login ── */}
      <section className="space-y-4">
        <div className="border-b border-border pb-2">
          <h2 className="text-sm font-semibold">Email Login</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Email digunakan untuk masuk ke akun. Tidak dapat diubah di sini.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={data?.email ?? ""} disabled className="bg-muted cursor-not-allowed" />
        </div>
      </section>

      {/* ── Ganti password ── */}
      <section className="space-y-4">
        <div className="border-b border-border pb-2">
          <h2 className="text-sm font-semibold">Ganti Password</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Kosongkan jika tidak ingin mengganti password.</p>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="currentPw">Password Saat Ini</Label>
            <div className="relative">
              <Input
                id="currentPw"
                type={showCurrent ? "text" : "password"}
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                placeholder="Password lama"
                autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="newPw">Password Baru</Label>
            <div className="relative">
              <Input
                id="newPw"
                type={showNew ? "text" : "password"}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="Min. 8 karakter"
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPw">Konfirmasi Password Baru</Label>
            <Input
              id="confirmPw"
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="Ulangi password baru"
              autoComplete="new-password"
            />
          </div>

          {pwError && <p className="text-sm text-destructive">{pwError}</p>}
          {pwSaved && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" /> Password berhasil diubah.
            </div>
          )}

          <Button type="submit" disabled={isPwPending || !currentPw || !newPw || !confirmPw} size="sm">
            {isPwPending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Menyimpan...</> : "Ganti Password"}
          </Button>
        </form>
      </section>
    </div>
  );
}
