"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { PhoneInput } from "@/components/ui/phone-input";
import { savePjConfigAction } from "@/app/(dashboard)/app/[tenant]/settings/actions";
import {
  PJ_MODULES, PJ_MODULE_LABELS, PJ_MAX_TARGETS,
  type OfficerNotificationConfig, type PjModule, type PjTarget,
} from "@/lib/pj-config";

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

export function PjSettingsForm({
  slug, officers, divisions, defaultConfig,
}: {
  slug:          string;
  officers:      ComboboxOption[];
  divisions:     ComboboxOption[];
  defaultConfig: OfficerNotificationConfig;
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
        };
      }
      const res = await savePjConfigAction(slug, payload);
      if (res.error) toast.error(res.error);
      else { toast.success("Pengaturan penanggung jawab disimpan."); router.refresh(); }
    } finally { setPending(false); }
  }

  return (
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
              <div key={idx} className="space-y-2 rounded-lg border border-dashed border-border p-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Combobox
                      options={TYPE_OPTIONS}
                      value={t.type}
                      onValueChange={(v) => v && patchTarget(mod, idx, { type: v as TargetDraft["type"] })}
                      placeholder="Jenis penerima"
                      searchPlaceholder="Cari..."
                      disabled={pending}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setState((s) => ({ ...s, [mod]: { ...s[mod], targets: s[mod].targets.filter((_, i) => i !== idx) } }))}
                    disabled={pending}
                    className="p-2 text-muted-foreground hover:text-destructive"
                    aria-label="Hapus penerima"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {t.type === "officer" && (
                  <Combobox
                    options={officers} value={t.officerId}
                    onValueChange={(v) => patchTarget(mod, idx, { officerId: v })}
                    placeholder="Pilih pengurus" searchPlaceholder="Cari pengurus..." emptyText="Belum ada pengurus aktif."
                    disabled={pending}
                  />
                )}
                {t.type === "division" && (
                  <>
                    <Combobox
                      options={divisions} value={t.divisionId}
                      onValueChange={(v) => patchTarget(mod, idx, { divisionId: v })}
                      placeholder="Pilih divisi" searchPlaceholder="Cari divisi..." emptyText="Belum ada divisi."
                      disabled={pending}
                    />
                    <p className="text-xs text-muted-foreground">Dikirim ke pengurus aktif utama (urutan pertama) divisi ini.</p>
                  </>
                )}
                {t.type === "contact" && (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Nama</Label>
                      <Input value={t.name} onChange={(e) => patchTarget(mod, idx, { name: e.target.value })} disabled={pending} maxLength={100} />
                    </div>
                    <PhoneInput label="Nomor HP / WhatsApp" optional value={t.phone} onChange={(v) => patchTarget(mod, idx, { phone: v })} disabled={pending} />
                    <div className="space-y-1">
                      <Label className="text-xs">Email (cadangan bila WhatsApp tidak aktif)</Label>
                      <Input type="email" value={t.email} onChange={(e) => patchTarget(mod, idx, { email: e.target.value })} disabled={pending} />
                    </div>
                  </div>
                )}
              </div>
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
  );
}
