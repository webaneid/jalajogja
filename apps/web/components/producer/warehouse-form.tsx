"use client";

// Form Gudang Pengiriman produsen (alamat utama, format RajaOngkir). Satu alamat dulu; tabel sudah siap multi-alamat.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RajaOngkirCityPicker, type RajaOngkirCity } from "@/components/ui/rajaongkir-city-picker";
import { saveWarehouseAction } from "@/app/(producer)/app/[tenant]/portal-produsen/profil/actions";

export type WarehouseInitial = { label: string; addressDetail: string; cityId: number | null; cityLabel: string; postalCode: string };

export function WarehouseForm({ slug, initial }: { slug: string; initial: WarehouseInitial }) {
  const router = useRouter();
  const [label, setLabel] = useState(initial.label);
  const [addressDetail, setAddressDetail] = useState(initial.addressDetail);
  const [cityId, setCityId] = useState<number | null>(initial.cityId);
  const [cityLabel, setCityLabel] = useState(initial.cityLabel);
  const [postalCode, setPostalCode] = useState(initial.postalCode);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    setMsg(null);
    if (!cityId) { setMsg({ ok: false, text: "Pilih lokasi dari daftar pencarian." }); return; }
    start(async () => {
      const r = await saveWarehouseAction(slug, { label, addressDetail, cityId, cityLabel, postalCode });
      setMsg(r.success ? { ok: true, text: "Gudang tersimpan." } : { ok: false, text: r.error });
      if (r.success) router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Nama gudang</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="mis. Gudang Utama"
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm" />
      </label>

      <div className="space-y-1 text-sm">
        <span className="font-medium">Lokasi (kelurahan / kecamatan)</span>
        <RajaOngkirCityPicker
          value={cityId}
          valueLabel={cityLabel}
          onChange={(city: RajaOngkirCity | null) => {
            setCityId(city?.id ?? null);
            setCityLabel(city?.label ?? "");
            if (city?.zipCode) setPostalCode(city.zipCode);
          }}
          placeholder="Ketik nama kelurahan atau kecamatan (min. 2 karakter)..."
          helperText="Dipakai sebagai kota asal ongkir semua produk Anda. Pembeli hanya melihat kota/kabupaten dan provinsi — bukan kelurahan, kode pos, atau alamat lengkap."
        />
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Alamat lengkap</span>
        <textarea value={addressDetail} onChange={(e) => setAddressDetail(e.target.value)} maxLength={300} rows={3}
          placeholder="Jalan, nomor, RT/RW, patokan…"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </label>

      <label className="block space-y-1 text-sm sm:max-w-[200px]">
        <span className="font-medium">Kode pos</span>
        <input value={postalCode} onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, ""))} maxLength={10} inputMode="numeric"
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm" />
      </label>

      {msg && <p className={`rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <button onClick={submit} disabled={pending || !label.trim() || !addressDetail.trim() || !cityId}
        className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {pending ? "Menyimpan…" : "Simpan Gudang"}
      </button>
    </div>
  );
}
