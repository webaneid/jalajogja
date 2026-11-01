"use client";

// Kolom alamat kirim — TERKENDALI dan TANPA logika simpan, supaya dipakai ulang di buku alamat (/akun/alamat), checkout (P3),
// dan gudang/asal kirim tenant (P4). Lokasi dicari dari data tujuan RajaOngkir lokal-dulu. Doc: docs/arsitektur-alamat.md § 16.
import { PhoneInput } from "@/components/ui/phone-input";
import { RajaOngkirCityPicker, type RajaOngkirCity } from "@/components/ui/rajaongkir-city-picker";

export type AddressFieldsValue = {
  label: string;
  recipientName: string;
  phone: string;               // E.164
  destinationId: number | null;
  destinationLabel: string;
  detail: string;
  isDefault: boolean;
};

export const EMPTY_ADDRESS: AddressFieldsValue = {
  label: "", recipientName: "", phone: "", destinationId: null, destinationLabel: "", detail: "", isDefault: false,
};

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

export function AddressFields({ value, onChange, lockDefault, variant = "address" }: {
  value: AddressFieldsValue;
  onChange: (next: AddressFieldsValue) => void;
  /** true = alamat ini sudah/harus jadi utama (kotak "jadikan utama" dikunci) */
  lockDefault?: boolean;
  /** "address" = alamat kirim pembeli (penerima + HP); "origin" = asal kirim gudang/pabrik/toko (tanpa penerima/HP) */
  variant?: "address" | "origin";
}) {
  const isOrigin = variant === "origin";
  const set = (patch: Partial<AddressFieldsValue>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">{isOrigin ? "Nama asal kirim" : "Nama alamat"} <span className="text-destructive">*</span></span>
        <input value={value.label} onChange={(e) => set({ label: e.target.value })} maxLength={isOrigin ? 60 : 40}
          placeholder={isOrigin ? "mis. Gudang Utama, Pabrik Sleman" : "mis. Rumah, Kantor, Indah Permata"} className={inputCls} />
      </label>

      {!isOrigin && (
        <>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Nama penerima <span className="text-destructive">*</span></span>
            <input value={value.recipientName} onChange={(e) => set({ recipientName: e.target.value })} maxLength={100} className={inputCls} />
          </label>

          <PhoneInput label="Nomor HP penerima" required value={value.phone} onChange={(phone) => set({ phone })} />
        </>
      )}

      <div className="space-y-1 text-sm">
        <span className="font-medium">Lokasi (kelurahan / kecamatan) <span className="text-destructive">*</span></span>
        <RajaOngkirCityPicker
          value={value.destinationId}
          valueLabel={value.destinationLabel}
          onChange={(city: RajaOngkirCity | null) =>
            set(city ? { destinationId: city.id, destinationLabel: city.label } : { destinationId: null })}
          placeholder="Ketik nama kelurahan atau kecamatan…"
          helperText={isOrigin ? "Pilih dari daftar yang muncul. Lokasi ini menjadi kota asal untuk menghitung ongkos kirim." : "Pilih dari daftar yang muncul. Lokasi inilah yang dipakai untuk menghitung ongkos kirim."}
        />
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Alamat lengkap <span className="text-destructive">*</span></span>
        <textarea value={value.detail} onChange={(e) => set({ detail: e.target.value })} rows={3} maxLength={300}
          placeholder="Jalan, nomor rumah, RT/RW, patokan" className={inputCls} />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.isDefault || !!lockDefault} disabled={lockDefault}
          onChange={(e) => set({ isDefault: e.target.checked })} />
        {isOrigin ? "Jadikan asal kirim utama" : "Jadikan alamat utama"}
      </label>
    </div>
  );
}
