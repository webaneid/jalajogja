"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { PhoneInput } from "@/components/ui/phone-input";
import { savePjConfigAction, savePjDigestTemplateAction } from "@/app/(dashboard)/app/[tenant]/settings/actions";
import {
  PJ_MODULES, PJ_MODULE_LABELS, PJ_MAX_TARGETS,
  type OfficerNotificationConfig, type PjModule, type PjTarget,
} from "@/lib/pj-config";
import {
  PJ_DIGEST_TEMPLATE_DEFAULTS, PJ_DIGEST_TEMPLATE_LABELS, PJ_DIGEST_TEMPLATE_VARS,
  PJ_DIGEST_TEMPLATE_MAX_LENGTH, type PjDigestTemplateKey,
} from "@/lib/pj-digest-templates";

type TargetDraft = {
  type: "officer" | "division" | "contact";
  officerId: string; divisionId: string; name: string; phone: string; email: string;
};

const emptyDraft = (type: TargetDraft["type"] = "officer"): TargetDraft =>
  ({ type, officerId: "", divisionId: "", name: "", phone: "", email: "" });

function toDraft(t: PjTarget): TargetDraft {
  const d = emptyDraft(t.type);
  if (t.type === "officer")  d.officerId = t.officerId;
  if (t.type === "division") d.divisionId = t.divisionId;
  if (t.type === "contact")  { d.name = t.name; d.phone = t.phone ?? ""; d.email = t.email ?? ""; }
  return d;
}

function toTarget(d: TargetDraft): PjTarget | null {
  if (d.type === "officer")  return d.officerId ? { type: "officer", officerId: d.officerId } : null;
  if (d.type === "division") return d.divisionId ? { type: "division", divisionId: d.divisionId } : null;
  if (!d.name.trim() || (!d.phone.trim() && !d.email.trim())) return null;
  return { type: "contact", name: d.name.trim(), phone: d.phone.trim() || undefined, email: d.email.trim() || undefined };
}

const TYPE_OPTIONS: ComboboxOption[] = [
  { value: "officer",  label: "Pilih pengurus" },
  { value: "division", label: "Pilih divisi" },
  { value: "contact",  label: "Nomor HP / email bebas" },
];

// Satu penerima (jenis + isian) — dipakai PJ utama dan cadangan.
function TargetFields({
  draft, onChange, onRemove, officers, divisions, disabled,
}: {
  draft: TargetDraft; onChange: (patch: Partial<TargetDraft>) => void; onRemove: () => void;
  officers: ComboboxOption[]; divisions: ComboboxOption[]; disabled: boolean;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Combobox
            options={TYPE_OPTIONS} value={draft.type}
            onValueChange={(v) => v && onChange({ type: v as TargetDraft["type"] })}
            placeholder="Jenis penerima" searchPlaceholder="Cari..." disabled={disabled}
          />
        </div>
        <button type="button" onClick={onRemove} disabled={disabled}
          className="p-2 text-muted-foreground hover:text-destructive" aria-label="Hapus penerima">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {draft.type === "officer" && (
        <Combobox
          options={officers} value={draft.officerId} onValueChange={(v) => onChange({ officerId: v })}
          placeholder="Pilih pengurus" searchPlaceholder="Cari pengurus..." emptyText="Belum ada pengurus aktif."
          disabled={disabled}
        />
      )}
      {draft.type === "division" && (
        <>
          <Combobox
            options={divisions} value={draft.divisionId} onValueChange={(v) => onChange({ divisionId: v })}
            placeholder="Pilih divisi" searchPlaceholder="Cari divisi..." emptyText="Belum ada divisi."
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">Dikirim ke pengurus aktif utama (urutan pertama) divisi ini.</p>
        </>
      )}
      {draft.type === "contact" && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Nama</Label>
            <Input value={draft.name} onChange={(e) => onChange({ name: e.target.value })} disabled={disabled} maxLength={100} />
          </div>
          <PhoneInput label="Nomor HP / WhatsApp" optional value={draft.phone} onChange={(v) => onChange({ phone: v })} disabled={disabled} />
          <div className="space-y-1">
            <Label className="text-xs">Email (cadangan bila WhatsApp tidak aktif)</Label>
            <Input type="email" value={draft.email} onChange={(e) => onChange({ email: e.target.value })} disabled={disabled} />
          </div>
        </div>
      )}
    </div>
  );
}

// Editor kerangka teks pesan (override per tenant; kosong = default).
function TemplateEditor({
  slug, templateKey, custom,
}: { slug: string; templateKey: PjDigestTemplateKey; custom: string | null }) {
  const router = useRouter();
  const defaultText = PJ_DIGEST_TEMPLATE_DEFAULTS[templateKey];
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(custom ?? defaultText);
  const [pending, setPending] = React.useState(false);

  async function save(value: string | null) {
    setPending(true);
    try {
      const res = await savePjDigestTemplateAction(slug, templateKey, value);
      if (res.error) { toast.error(res.error); return; }
      toast.success(value ? "Teks pesan disimpan." : "Teks dikembalikan ke default.");
      if (!value) setText(defaultText);
      router.refresh();
    } finally { setPending(false); }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs text-primary hover:underline">
        {open ? "Tutup" : "Edit teks"} — {PJ_DIGEST_TEMPLATE_LABELS[templateKey]}{custom ? " (kustom)" : ""}
      </button>
      {open && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={9} maxLength={PJ_DIGEST_TEMPLATE_MAX_LENGTH} disabled={pending} />
          <p className="text-xs text-muted-foreground">
            Variabel: {PJ_DIGEST_TEMPLATE_VARS[templateKey].map((v) => (
              <code key={v.name} title={v.desc} className="mr-1.5 rounded bg-muted px-1">{`{{${v.name}}}`}</code>
            ))}
            <br />Arahkan kursor ke variabel untuk melihat artinya. *tebal* dan baris baru mengikuti format WhatsApp.
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={pending || !text.trim()} onClick={() => save(text)}>Simpan teks</Button>
            <Button type="button" size="sm" variant="outline" disabled={pending || !custom} onClick={() => save(null)}>
              Kembalikan default
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PjSettingsForm({
  slug, officers, divisions, defaultConfig, customTemplates,
}: {
  slug:            string;
  officers:        ComboboxOption[];
  divisions:       ComboboxOption[];
  defaultConfig:   OfficerNotificationConfig;
  customTemplates: Partial<Record<PjDigestTemplateKey, string>>;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [state, setState] = React.useState<Record<PjModule, { enabled: boolean; targets: TargetDraft[] }>>(() => {
    const init = {} as Record<PjModule, { enabled: boolean; targets: TargetDraft[] }>;
    for (const m of PJ_MODULES) {
      const c = defaultConfig[m];
      init[m] = { enabled: c?.enabled ?? false, targets: (c?.targets ?? []).map(toDraft) };
    }
    return init;
  });
  const [backup, setBackup] = React.useState<TargetDraft | null>(
    defaultConfig.keuangan?.backup ? toDraft(defaultConfig.keuangan.backup) : null,
  );

  function patchTarget(mod: PjModule, idx: number, patch: Partial<TargetDraft>) {
    setState((s) => ({ ...s, [mod]: { ...s[mod], targets: s[mod].targets.map((t, i) => (i === idx ? { ...t, ...patch } : t)) } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const payload: OfficerNotificationConfig = {};
      for (const m of PJ_MODULES) {
        payload[m] = {
          enabled: state[m].enabled,
          targets: state[m].targets.map(toTarget).filter((t): t is PjTarget => t !== null),
          ...(m === "keuangan" ? { backup: backup ? toTarget(backup) : null } : {}),
        };
      }
      const res = await savePjConfigAction(slug, payload);
      if (res.error) toast.error(res.error);
      else { toast.success("Pengaturan penanggung jawab disimpan."); router.refresh(); }
    } finally { setPending(false); }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-5">
        {PJ_MODULES.map((mod) => {
          const max = PJ_MAX_TARGETS[mod];
          const st = state[mod];
          return (
            <div key={mod} className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{PJ_MODULE_LABELS[mod].label}</p>
                  <p className="text-xs text-muted-foreground">{PJ_MODULE_LABELS[mod].hint}</p>
                </div>
                <Switch
                  checked={st.enabled}
                  onCheckedChange={(v) => setState((s) => ({ ...s, [mod]: { ...s[mod], enabled: v } }))}
                  disabled={pending}
                />
              </div>

              {st.targets.map((t, idx) => (
                <TargetFields
                  key={idx} draft={t} officers={officers} divisions={divisions} disabled={pending}
                  onChange={(patch) => patchTarget(mod, idx, patch)}
                  onRemove={() => setState((s) => ({ ...s, [mod]: { ...s[mod], targets: s[mod].targets.filter((_, i) => i !== idx) } }))}
                />
              ))}

              {st.targets.length < max && (
                <Button
                  type="button" variant="outline" size="sm" disabled={pending}
                  onClick={() => setState((s) => ({ ...s, [mod]: { ...s[mod], targets: [...s[mod].targets, emptyDraft()] } }))}
                >
                  <Plus className="mr-1 h-4 w-4" /> Tambah penerima{max > 1 ? ` (maks. ${max})` : ""}
                </Button>
              )}

              {mod === "keuangan" && (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-sm font-medium">Penanggung jawab cadangan (opsional)</p>
                  <p className="text-xs text-muted-foreground">
                    Menerima pembayaran yang belum diverifikasi lebih dari 48 jam (ringkasan 16.00), atau seluruhnya bila
                    bendahara utama tidak bisa dihubungi. Wajib punya nomor HP.
                  </p>
                  {backup ? (
                    <TargetFields
                      draft={backup} officers={officers} divisions={divisions} disabled={pending}
                      onChange={(patch) => setBackup((b) => (b ? { ...b, ...patch } : b))}
                      onRemove={() => setBackup(null)}
                    />
                  ) : (
                    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setBackup(emptyDraft())}>
                      <Plus className="mr-1 h-4 w-4" /> Tambah cadangan
                    </Button>
                  )}
                </div>
              )}

              {mod === "keuangan" && (
                <p className="text-xs text-muted-foreground">
                  Penerima keuangan <strong>wajib punya nomor HP</strong> — 4 digit terakhirnya menjadi kata sandi halaman
                  verifikasi. Bila lebih dari satu, ringkasan dikirim bergantian.
                </p>
              )}
            </div>
          );
        })}

        <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan"}</Button>
      </form>

      <div className="space-y-3 rounded-xl border border-border p-4">
        <div>
          <p className="text-sm font-medium">Teks pesan ringkasan</p>
          <p className="text-xs text-muted-foreground">
            Ubah kerangka pesan yang dikirim ke penanggung jawab. Daftar isi (pembayaran, anggota, dst.) tetap dibuat otomatis.
          </p>
        </div>
        {(["keuangan", "keuangan_backup", "keanggotaan", "toko", "donasi", "event"] as PjDigestTemplateKey[]).map((k) => (
          <TemplateEditor key={`${k}-${customTemplates[k] ?? ""}`} slug={slug} templateKey={k} custom={customTemplates[k] ?? null} />
        ))}
      </div>
    </div>
  );
}
