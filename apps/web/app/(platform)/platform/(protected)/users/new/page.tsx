"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createPlatformUserAction } from "@/app/(platform)/platform/(protected)/actions";

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";
const labelCls = "block text-sm font-medium mb-1";

export default function NewPlatformUserPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error,   setError]        = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const res = await createPlatformUserAction(data);
      if ("error" in res) {
        setError(res.error);
      } else {
        router.push("/platform/users");
        router.refresh();
      }
    });
  }

  return (
    <div className="max-w-lg space-y-5">
      <div>
        <Link href="/platform/users" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
          <ArrowLeft size={14} /> Kembali
        </Link>
        <h1 className="text-xl font-semibold">Tambah Tim Platform</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-background p-5 space-y-4">
        {error && (
          <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-destructive">{error}</p>
        )}
        <div>
          <label className={labelCls}>Nama</label>
          <input name="name" type="text" required className={inputCls} placeholder="Nama lengkap" />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input name="email" type="email" required className={inputCls} placeholder="email@jalakarta.com" />
        </div>
        <div>
          <label className={labelCls}>Password</label>
          <input name="password" type="password" required minLength={8} className={inputCls} placeholder="Min. 8 karakter" />
        </div>
        <div>
          <label className={labelCls}>Role</label>
          <select name="role" className={inputCls}>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {pending ? "Menyimpan..." : "Buat Akun"}
        </button>
      </form>
    </div>
  );
}
