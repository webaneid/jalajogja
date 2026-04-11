"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MemberFormData } from "@/app/(dashboard)/[tenant]/members/actions";

type MemberFormProps = {
  slug: string;
  defaultValues?: Partial<MemberFormData>;
  memberId?: string;
  onSubmit: (slug: string, data: MemberFormData) => Promise<
    { success: true; memberId: string } | { success: false; error: string }
  >;
};

function today(): string {
  return new Date().toISOString().split("T")[0];
}

// Catatan: Ini adalah Step 1 dari form wizard anggota (data wajib + dasar).
// Step 2 (kontak & domisili), Step 3 (pendidikan), Step 4 (usaha) akan
// diimplementasikan terpisah menggunakan helper tables (contacts, addresses, dll).
export function MemberForm({ slug, defaultValues = {}, memberId, onSubmit }: MemberFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const fd = new FormData(e.currentTarget);
    const graduationYearRaw = fd.get("graduationYear") as string;
    const data: MemberFormData = {
      name: fd.get("name") as string,
      stambukNumber: fd.get("stambukNumber") as string,
      nik: fd.get("nik") as string,
      gender: (fd.get("gender") as "male" | "female") || undefined,
      birthPlaceText: fd.get("birthPlaceText") as string,
      birthDate: fd.get("birthDate") as string,
      graduationYear: graduationYearRaw ? parseInt(graduationYearRaw) : undefined,
      status: (fd.get("status") as "active" | "inactive" | "alumni") || "active",
      joinedAt: fd.get("joinedAt") as string,
    };

    startTransition(async () => {
      const result = await onSubmit(slug, data);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(`/${slug}/members/${result.memberId}`);
    });
  }

  const field = "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  const label = "mb-1.5 block text-sm font-medium";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── Identitas Pribadi ── */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Identitas Pribadi
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">

          <div className="sm:col-span-2">
            <label className={label}>Nama Lengkap <span className="text-destructive">*</span></label>
            <input name="name" required defaultValue={defaultValues.name} className={field} placeholder="Muhammad Ali" />
          </div>

          <div>
            <label className={label}>Nomor Stambuk</label>
            <input name="stambukNumber" defaultValue={defaultValues.stambukNumber} className={field} placeholder="cth: 4321" />
            <p className="mt-1 text-xs text-muted-foreground">Nomor santri di PM Gontor</p>
          </div>

          <div>
            <label className={label}>NIK</label>
            <input name="nik" defaultValue={defaultValues.nik} className={field} placeholder="16 digit NIK KTP" maxLength={16} />
          </div>

          <div>
            <label className={label}>Jenis Kelamin</label>
            <select name="gender" defaultValue={defaultValues.gender ?? ""} className={field}>
              <option value="">— Pilih —</option>
              <option value="male">Laki-laki</option>
              <option value="female">Perempuan</option>
            </select>
          </div>

          <div>
            <label className={label}>Tahun Lulus Gontor</label>
            <input
              name="graduationYear"
              type="number"
              min={1950}
              max={new Date().getFullYear()}
              defaultValue={defaultValues.graduationYear}
              className={field}
              placeholder="cth: 2005"
            />
          </div>

          <div>
            <label className={label}>Tempat Lahir</label>
            <input name="birthPlaceText" defaultValue={defaultValues.birthPlaceText} className={field} placeholder="Yogyakarta" />
            <p className="mt-1 text-xs text-muted-foreground">Kota/kabupaten atau negara jika lahir di luar negeri</p>
          </div>

          <div>
            <label className={label}>Tanggal Lahir</label>
            <input name="birthDate" type="date" defaultValue={defaultValues.birthDate} className={field} />
          </div>

        </div>
      </section>

      {/* ── Keanggotaan Cabang ── */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Keanggotaan
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">

          <div>
            <label className={label}>Status</label>
            <select name="status" defaultValue={defaultValues.status ?? "active"} className={field}>
              <option value="active">Aktif</option>
              <option value="inactive">Tidak Aktif</option>
              <option value="alumni">Alumni</option>
            </select>
          </div>

          <div>
            <label className={label}>Tanggal Bergabung di Cabang</label>
            <input
              name="joinedAt"
              type="date"
              defaultValue={defaultValues.joinedAt ?? today()}
              className={field}
            />
          </div>

        </div>
      </section>

      {/* Informasi wizard */}
      <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Data kontak, alamat, riwayat pendidikan, dan informasi usaha dapat dilengkapi setelah anggota tersimpan.
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-medium
                     text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "Menyimpan..." : memberId ? "Simpan Perubahan" : "Tambah Anggota"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border px-5 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          Batal
        </button>
      </div>

    </form>
  );
}
