"use client";

import { useState, useTransition } from "react";
import { saveLetterConfigAction, type LetterConfig } from "@/app/(dashboard)/[tenant]/letters/actions";

const FONTS = ["Times New Roman", "Arial", "Calibri", "Georgia", "Helvetica"];
const PAPER_SIZES = ["A4", "F4", "Letter"] as const;

const FORMAT_VARS = [
  { var: "{number}",      desc: "Nomor urut (padding dari pengaturan)" },
  { var: "{number:3}",    desc: "Nomor urut 3 digit: 001" },
  { var: "{type_code}",   desc: "Kode jenis surat (dari Jenis Surat)" },
  { var: "{org_code}",    desc: "Kode organisasi (diisi di bawah)" },
  { var: "{issuer_code}", desc: "Kode divisi pengeluar surat (dipilih saat buat surat)" },
  { var: "{month_roman}", desc: "Bulan Romawi: I–XII" },
  { var: "{month}",       desc: "Bulan angka 2 digit: 01–12" },
  { var: "{year}",        desc: "Tahun 4 digit: 2026" },
  { var: "{year:2}",      desc: "Tahun 2 digit: 26" },
];

type Props = {
  slug:          string;
  initialConfig: LetterConfig;
  isAdmin:       boolean;
};

export function LetterConfigClient({ slug, initialConfig, isAdmin }: Props) {
  const [config, setConfig]   = useState<LetterConfig>(initialConfig);
  const [error, setError]     = useState("");
  const [saved, setSaved]     = useState(false);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof LetterConfig>(key: K, value: LetterConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    setError("");
    setSaved(false);
    if (!config.number_format.trim()) {
      setError("Format nomor wajib diisi.");
      return;
    }
    startTransition(async () => {
      const res = await saveLetterConfigAction(slug, {
        ...config,
        margin_top:     Number(config.margin_top),
        margin_right:   Number(config.margin_right),
        margin_bottom:  Number(config.margin_bottom),
        margin_left:    Number(config.margin_left),
        number_padding: Number(config.number_padding),
      });
      if (res.success) {
        setSaved(true);
      } else {
        setError(res.error);
      }
    });
  }

  const fieldCls = "w-full mt-0.5 rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60";

  return (
    <div className="space-y-8">

      {/* ── Kop Surat ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold border-b border-border pb-2">Kop Surat</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Gambar Header (URL atau ID media)</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={config.header_image_id ?? ""}
              onChange={(e) => set("header_image_id", e.target.value || null)}
              placeholder="Kosongkan untuk teks otomatis"
              className={fieldCls}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Jika kosong, nama organisasi dari pengaturan umum akan digunakan sebagai kop.
            </p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Gambar Footer (URL atau ID media)</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={config.footer_image_id ?? ""}
              onChange={(e) => set("footer_image_id", e.target.value || null)}
              placeholder="Opsional"
              className={fieldCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Ukuran Kertas Default</label>
            <select
              disabled={!isAdmin}
              value={config.paper_size}
              onChange={(e) => set("paper_size", e.target.value as LetterConfig["paper_size"])}
              className={fieldCls}
            >
              {PAPER_SIZES.map((s) => (
                <option key={s} value={s}>{s === "F4" ? "F4 / Folio" : s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Font</label>
            <select
              disabled={!isAdmin}
              value={config.body_font}
              onChange={(e) => set("body_font", e.target.value)}
              className={fieldCls}
            >
              {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Margin (mm)</label>
          <div className="grid grid-cols-4 gap-3">
            {(["margin_top", "margin_right", "margin_bottom", "margin_left"] as const).map((field) => (
              <div key={field}>
                <label className="text-xs text-muted-foreground">
                  {field === "margin_top" ? "Atas" : field === "margin_right" ? "Kanan" : field === "margin_bottom" ? "Bawah" : "Kiri"}
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  disabled={!isAdmin}
                  value={config[field]}
                  onChange={(e) => set(field, Number(e.target.value))}
                  className={fieldCls}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Format Nomor Surat ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold border-b border-border pb-2">Format Nomor Surat</h2>

        <div>
          <label className="text-xs text-muted-foreground">Kode Organisasi</label>
          <input
            type="text"
            disabled={!isAdmin}
            value={config.org_code}
            onChange={(e) => set("org_code", e.target.value)}
            placeholder="mis. IKPMJogja"
            className={fieldCls}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Digunakan sebagai variabel <code className="font-mono">{"{org_code}"}</code> di format nomor.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Padding Nomor Urut (digit)</label>
            <input
              type="number"
              min="1"
              max="6"
              disabled={!isAdmin}
              value={config.number_padding}
              onChange={(e) => set("number_padding", Number(e.target.value))}
              className={fieldCls}
            />
            <p className="text-xs text-muted-foreground mt-1">
              2 → <code className="font-mono">01</code>, 3 → <code className="font-mono">001</code>
            </p>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Template Format Nomor <span className="text-destructive">*</span></label>
          <input
            type="text"
            disabled={!isAdmin}
            value={config.number_format}
            onChange={(e) => set("number_format", e.target.value)}
            placeholder="{number}/{type_code}/{org_code}/{month_roman}/{year}"
            className={`${fieldCls} font-mono`}
          />
          {config.number_format && (
            <p className="text-xs text-muted-foreground mt-1">
              Contoh output:{" "}
              <code className="font-mono">
                {config.number_format
                  .replace(/\{number:\d+\}/g, "001")
                  .replace(/\{number\}/g, "01".padStart(config.number_padding, "0"))
                  .replace(/\{type_code\}/g, "UD")
                  .replace(/\{org_code\}/g, config.org_code || "ORG")
                  .replace(/\{issuer_code\}/g, "SEKR")
                  .replace(/\{month_roman\}/g, "IV")
                  .replace(/\{month\}/g, "04")
                  .replace(/\{year:2\}/g, "26")
                  .replace(/\{year\}/g, "2026")}
              </code>
            </p>
          )}
        </div>

        {/* Referensi variabel */}
        <div className="rounded-lg border border-border bg-muted/10 p-4">
          <p className="text-xs font-medium mb-2">Variabel yang tersedia:</p>
          <div className="space-y-1">
            {FORMAT_VARS.map((v) => (
              <div key={v.var} className="flex gap-2 text-xs">
                <code className="font-mono text-primary w-28 shrink-0">{v.var}</code>
                <span className="text-muted-foreground">{v.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Actions */}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-600">Pengaturan berhasil disimpan.</p>}

      {isAdmin && (
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Menyimpan..." : "Simpan Pengaturan"}
        </button>
      )}
    </div>
  );
}
