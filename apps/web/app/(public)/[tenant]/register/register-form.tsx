"use client";

import { useState, useTransition, useRef } from "react";
import { authClient }   from "@/lib/auth-client";
import { useRouter }    from "next/navigation";
import { Button }         from "@/components/ui/button";
import { Input }          from "@/components/ui/input";
import { Label }          from "@/components/ui/label";
import { PasswordInput }  from "@/components/ui/password-input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Users, User, Loader2, CheckCircle2, Info } from "lucide-react";
import { PhoneInput } from "@/components/ui/phone-input";

type MemberLookup =
  | { found: true;  name: string; memberId: string; hasAccount: boolean }
  | { found: false };

type LegalContent =
  | { found: true;  title: string; html: string; updatedAt: string }
  | { found: false };

type AccountPath = "member" | "public" | null;

// ── Modal legal ───────────────────────────────────────────────────────────────
function LegalModal({ slug, template, open, onClose }: {
  slug: string; template: "terms" | "privacy"; open: boolean; onClose: () => void;
}) {
  const [content, setContent] = useState<LegalContent | null>(null);
  const [loading, setLoading] = useState(false);
  const prevTpl = useRef<string | null>(null);

  if (open && template !== prevTpl.current) {
    prevTpl.current = template;
    setLoading(true);
    setContent(null);
    fetch(`/api/akun/legal?slug=${encodeURIComponent(slug)}&template=${template}`)
      .then(r => r.json())
      .then((d: LegalContent) => setContent(d))
      .catch(() => setContent({ found: false }))
      .finally(() => setLoading(false));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {content?.found ? content.title : template === "terms" ? "Syarat dan Ketentuan" : "Kebijakan Privasi"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-1">
          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && content?.found === false && (
            <p className="text-sm text-muted-foreground text-center py-12">Halaman ini belum tersedia.</p>
          )}
          {!loading && content?.found && (
            <div
              className="prose prose-sm max-w-none
                [&_p]:my-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2
                [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1
                [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
                [&_li]:my-1 [&_a]:text-primary [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: content.html }}
            />
          )}
        </div>
        <div className="pt-3 border-t border-border">
          <Button className="w-full" onClick={onClose}>Tutup</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Register Page ─────────────────────────────────────────────────────────────
export function RegisterForm({ slug }: { slug: string }) {
  const router           = useRouter();

  const [accountPath, setAccountPath] = useState<AccountPath>(null);

  // Form fields
  const [name,      setName]      = useState("");
  const [email,     setEmail]     = useState("");
  const [phone,     setPhone]     = useState("");
  const [stambuk,   setStambuk]   = useState("");
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [agreed,    setAgreed]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [isPending, start]        = useTransition();

  // Member lookup state
  const [lookup,       setLookup]       = useState<MemberLookup | null>(null);
  const [lookupStatus, setLookupStatus] = useState<"idle" | "searching" | "done">("idle");
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Legal modal
  const [modalTpl, setModalTpl] = useState<"terms" | "privacy" | null>(null);

  // Apakah mode KLAIM (data ditemukan di DB)
  const isClaiming = lookup?.found === true && !lookup.hasAccount;
  const claimedName = lookup?.found ? lookup.name : null;

  // ── Lookup anggota (debounced) ────────────────────────────────────────────
  function triggerLookup(params: Record<string, string>) {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    setLookupStatus("searching");
    lookupTimer.current = setTimeout(async () => {
      try {
        const qs  = new URLSearchParams(params).toString();
        const res = await fetch(`/api/akun/lookup-member?${qs}`);
        const data = await res.json() as MemberLookup;
        setLookup(data);
        if (data.found && !name.trim()) setName(data.name);
      } catch {
        setLookup(null);
      } finally {
        setLookupStatus("done");
      }
    }, 400);
  }

  function handleStambukBlur(val: string) {
    const v = val.trim();
    if (!v) return;
    triggerLookup({ stambuk: v });
  }

  function handleEmailBlur(val: string) {
    if (accountPath !== "member" || lookup?.found) return;
    const v = val.trim();
    if (!v) return;
    triggerLookup({ email: v });
  }

  function handlePhoneChange(val: string) {
    setPhone(val);
    if (accountPath !== "member" || lookup?.found) return;
    if (!val) return;
    triggerLookup({ phone: val });
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) { setError("Konfirmasi password tidak cocok."); return; }
    if (!agreed)              { setError("Anda harus menyetujui syarat dan ketentuan."); return; }

    start(async () => {
      try {
        const body: Record<string, unknown> = {
          path: accountPath,
          name: isClaiming ? claimedName : name.trim(),
          email, phone, password,
          tenantSlug: slug,
        };

        if (accountPath === "member") {
          if (isClaiming && lookup?.found) body.claimMemberId = lookup.memberId;
          else if (stambuk.trim())         body.stambukNumber = stambuk.trim();
        }

        const res  = await fetch("/api/akun/register", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(body),
        });
        const data = await res.json() as { error?: string };
        if (!res.ok || data.error) { setError(data.error ?? "Pendaftaran gagal."); return; }

        // Auto login
        const loginRes = await authClient.signIn.email({
          email,
          password,
          callbackURL: accountPath === "member" ? `/${slug}/akun/lengkapi` : `/${slug}/akun`,
        });
        if (loginRes.error) router.push(`/${slug}/login`);
        else                router.push(accountPath === "member" ? `/${slug}/akun/lengkapi` : `/${slug}/akun`);
      } catch {
        setError("Terjadi kesalahan. Coba lagi.");
      }
    });
  }

  // ── Step 1: Pilih jalur ───────────────────────────────────────────────────
  if (accountPath === null) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold">Daftar Akun</h1>
            <p className="text-sm text-muted-foreground">Pilih jenis keanggotaan Anda.</p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => setAccountPath("member")}
              className="flex items-start gap-4 rounded-xl border border-border p-4 text-left hover:border-primary/60 hover:bg-primary/5 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Anggota IKPM Gontor</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Saya alumni Pondok Modern Gontor / anggota IKPM
                </p>
              </div>
            </button>

            <button
              onClick={() => setAccountPath("public")}
              className="flex items-start gap-4 rounded-xl border border-border p-4 text-left hover:border-primary/60 hover:bg-primary/5 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 group-hover:bg-muted/60 transition-colors">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-sm">Bukan Anggota IKPM</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Saya masyarakat umum yang ingin menggunakan layanan ini
                </p>
              </div>
            </button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Sudah punya akun?{" "}
            <a href={`/${slug}/login`} className="text-primary hover:underline font-medium">Masuk di sini</a>
          </p>
        </div>
      </div>
    );
  }

  // ── Step 2: Form registrasi ───────────────────────────────────────────────
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">

        {/* Header */}
        <div className="space-y-3">
          <button
            onClick={() => { setAccountPath(null); setLookup(null); setLookupStatus("idle"); setStambuk(""); setName(""); }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            ← Kembali
          </button>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              accountPath === "member" ? "bg-primary/10" : "bg-muted"
            }`}>
              {accountPath === "member"
                ? <Users className="h-4 w-4 text-primary" />
                : <User  className="h-4 w-4 text-muted-foreground" />}
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Daftar Akun</h1>
              <p className="text-xs text-muted-foreground">
                {accountPath === "member" ? "Anggota IKPM Gontor" : "Masyarakat Umum"}
              </p>
            </div>
          </div>
        </div>

        {/* Banner: data ditemukan → mode klaim */}
        {accountPath === "member" && lookup?.found && !lookup.hasAccount && (
          <div className="flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <p className="text-green-800">
              Data ditemukan atas nama <span className="font-semibold">{lookup.name}</span>.
              Lanjutkan untuk mengklaim akun Anda.
            </p>
          </div>
        )}

        {/* Banner: akun sudah ada */}
        {accountPath === "member" && lookup?.found && lookup.hasAccount && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm">
            <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-amber-800">
              Akun untuk <span className="font-semibold">{lookup.name}</span> sudah terdaftar.{" "}
              <a href={`/${slug}/login`} className="underline font-medium">Masuk</a> atau{" "}
              <a href={`/${slug}/forgot-password`} className="underline font-medium">lupa password</a>.
            </p>
          </div>
        )}

        {/* Banner: tidak ditemukan → daftar baru */}
        {accountPath === "member" && lookupStatus === "done" && !lookup?.found && (
          <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-blue-800">
              Data belum ditemukan. Anda akan didaftarkan sebagai anggota IKPM baru.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Stambuk — hanya jalur member */}
          {accountPath === "member" && (
            <div className="space-y-1.5">
              <Label htmlFor="stambuk">
                Nomor Induk Gontor <span className="text-muted-foreground font-normal">(opsional)</span>
              </Label>
              <Input
                id="stambuk"
                value={stambuk}
                onChange={(e) => { setStambuk(e.target.value); setLookup(null); setLookupStatus("idle"); }}
                onBlur={(e) => handleStambukBlur(e.target.value)}
                placeholder="Contoh: 1234 atau 1234-A"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Masukkan untuk verifikasi data keanggotaan Anda.
              </p>
            </div>
          )}

          {/* Nama — read-only jika mode klaim */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama Lengkap</Label>
            <Input
              id="name"
              value={isClaiming ? (claimedName ?? "") : name}
              onChange={(e) => !isClaiming && setName(e.target.value)}
              readOnly={isClaiming}
              placeholder="Nama sesuai identitas"
              required
              autoComplete="name"
              className={isClaiming ? "bg-muted text-muted-foreground" : ""}
            />
            {isClaiming && (
              <p className="text-xs text-muted-foreground">Nama diambil dari data keanggotaan.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={(e) => handleEmailBlur(e.target.value)}
              placeholder="nama@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <PhoneInput
              label="No. HP"
              value={phone}
              onChange={handlePhoneChange}
              required
            />
          </div>

          <PasswordInput
            id="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 karakter"
            required
            minLength={8}
            autoComplete="new-password"
          />

          <PasswordInput
            id="confirm"
            label="Konfirmasi Password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Ulangi password"
            required
            autoComplete="new-password"
          />

          {/* Persetujuan */}
          <div className="flex items-start gap-2.5 pt-1">
            <input
              id="agreed"
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary cursor-pointer"
            />
            <label htmlFor="agreed" className="text-sm text-muted-foreground leading-snug cursor-pointer select-none">
              Saya menyetujui{" "}
              <button type="button" onClick={() => setModalTpl("terms")} className="text-primary hover:underline font-medium">
                Syarat dan Ketentuan
              </button>{" "}serta{" "}
              <button type="button" onClick={() => setModalTpl("privacy")} className="text-primary hover:underline font-medium">
                Kebijakan Privasi
              </button>.
            </label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            className="w-full"
            disabled={isPending || !agreed || (lookup?.found && lookup.hasAccount)}
          >
            {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Memproses...</> : "Daftar"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Sudah punya akun?{" "}
          <a href={`/${slug}/login`} className="text-primary hover:underline font-medium">Masuk di sini</a>
        </p>
      </div>

      {modalTpl && (
        <LegalModal slug={slug} template={modalTpl} open={!!modalTpl} onClose={() => setModalTpl(null)} />
      )}
    </div>
  );
}
