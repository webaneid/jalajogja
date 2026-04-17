"use client";

// Layer 3 — Komponen interaktif admin untuk manajemen slot TTD
// Mode "form"   : dipakai di edit/new page — combobox assign, simpan via syncSignatureSlotsAction saat save letter
// Mode "detail" : dipakai di detail page  — hanya copy link TTD + QR viewer (slot sudah di DB)

import { useState, useTransition } from "react";
import { Copy, Check, QrCode, ChevronDown, ChevronUp, UserPlus, Search, Trash2, PenLine } from "lucide-react";
import { SignatureBlock } from "./signature-block";
import {
  type SignatureLayout,
  type SignatureSlot,
  SIGNATURE_LAYOUTS,
  SIGNER_ROLE_LABELS,
  type SlotRole,
  buildEmptyMainSlots,
} from "@/lib/letter-signature-layout";
import {
  signLetterAction,
  removeSignatureAction,
  generateSigningTokenAction,
} from "@/app/(dashboard)/[tenant]/letters/actions";
import type { SlotInput } from "@/app/(dashboard)/[tenant]/letters/actions";

// ── Types ──────────────────────────────────────────────────────────────────────

export type AvailableOfficer = {
  officerId:    string;
  name:         string;
  position:     string;
  division:     string | null;
  userRole:     string | null;   // ketua|sekretaris|bendahara|custom|owner|null
  canSign:      boolean;
  isCurrentUser: boolean;
};

type Props = {
  slug:              string;
  letterId:          string;
  layout:            SignatureLayout;
  showDate:          boolean;
  dateFormat:        "masehi" | "masehi_hijri";
  hijriOffset:       number;
  initialSlots:      SignatureSlot[];
  availableOfficers: AvailableOfficer[];
  isAdmin:           boolean;
  appUrl?:           string;    // wajib di detail mode (untuk copy link); opsional di form mode
  // mode "form"   → controlled: onChange dipanggil tiap perubahan slot, simpan via parent
  // mode "detail" → standalone: aksi langsung ke DB (copy link, QR)
  mode:              "form" | "detail";
  onChange?:         (slots: SlotInput[]) => void;
};

const ROLE_BADGE: Record<string, string> = {
  owner:       "bg-purple-100 text-purple-700",
  ketua:       "bg-blue-100 text-blue-700",
  sekretaris:  "bg-sky-100 text-sky-700",
  bendahara:   "bg-green-100 text-green-700",
  custom:      "bg-zinc-100 text-zinc-600",
};
const ROLE_LABEL: Record<string, string> = {
  owner:       "Owner",
  ketua:       "Ketua",
  sekretaris:  "Sekretaris",
  bendahara:   "Bendahara",
  custom:      "Custom",
};

// ── Komponen ───────────────────────────────────────────────────────────────────

export function SignatureSlotManager({
  slug, letterId, layout, showDate, dateFormat, hijriOffset,
  initialSlots, availableOfficers, isAdmin, appUrl, mode, onChange,
}: Props) {
  const [slots, setSlots]             = useState<SignatureSlot[]>(initialSlots);
  const [expandedQr, setExpandedQr]   = useState<string | null>(null);
  const [error, setError]             = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [pending, startTransition]    = useTransition();

  // State combobox per slot
  type SlotCombo = { open: boolean; search: string };
  const [combos, setCombos] = useState<Record<string, SlotCombo>>({});
  function getCombo(key: string): SlotCombo {
    return combos[key] ?? { open: false, search: "" };
  }
  function setCombo(key: string, patch: Partial<SlotCombo>) {
    setCombos((prev) => ({ ...prev, [key]: { ...getCombo(key), ...patch } }));
  }

  function slotKey(s: SignatureSlot) { return `${s.section}-${s.order}`; }

  function getSlot(section: SignatureSlot["section"], order: number): SignatureSlot | undefined {
    return slots.find((s) => s.section === section && s.order === order);
  }

  const mainCount   = SIGNATURE_LAYOUTS[layout].mainSlots;
  const mainSlots   = Array.from({ length: mainCount }, (_, i) =>
    getSlot("main", i + 1) ?? buildEmptyMainSlots(layout)[i]
  );
  const witnessSlots = slots
    .filter((s) => s.section === "witnesses")
    .sort((a, b) => a.order - b.order);

  // Emit SlotInput[] ke parent (mode form)
  function emitChange(updatedSlots: SignatureSlot[]) {
    if (!onChange) return;
    const inputs: SlotInput[] = updatedSlots.map((s) => ({
      id:        s.id,
      order:     s.order,
      section:   s.section,
      officerId: s.officerId,
      role:      s.role ?? "signer",
    }));
    onChange(inputs);
  }

  // Assign officer ke slot (mode form — lokal saja)
  function handleAssignForm(slot: SignatureSlot, officerId: string, role: SlotRole) {
    const officer = availableOfficers.find((o) => o.officerId === officerId);
    const updated = slots.filter((s) => !(s.section === slot.section && s.order === slot.order));
    const newSlot: SignatureSlot = {
      id:           slot.id,
      order:        slot.order,
      section:      slot.section,
      officerId,
      officerName:  officer?.name ?? "—",
      position:     officer?.position ?? null,
      division:     officer?.division ?? null,
      role,
      signedAt:     null,
      qrDataUrl:    null,
      verifyUrl:    null,
      signingToken: null,
    };
    const next = [...updated, newSlot];
    setSlots(next);
    emitChange(next);
    setCombo(slotKey(slot), { open: false, search: "" });
  }

  // Hapus assignment slot (mode form — lokal saja)
  function handleClearForm(slot: SignatureSlot) {
    const next = slots.filter((s) => !(s.section === slot.section && s.order === slot.order));
    setSlots(next);
    emitChange(next);
  }

  // TTD langsung (mode detail)
  function handleSignDirect(slot: SignatureSlot) {
    const officer = availableOfficers.find((o) => o.isCurrentUser);
    if (!officer) return;
    setError("");
    startTransition(async () => {
      const role: SlotRole = slot.section === "witnesses" ? "witness" : (slot.role ?? "signer");
      const res = await signLetterAction(slug, letterId, officer.officerId, role);
      if (res.success) {
        setSlots((prev) => prev.map((s) =>
          s.section === slot.section && s.order === slot.order
            ? { ...s, signedAt: new Date(), verifyUrl: `${appUrl}/${slug}/verify/${res.verificationHash}` }
            : s
        ));
      } else {
        setError(res.error);
      }
    });
  }

  // Hapus slot (mode detail)
  function handleRevoke(slot: SignatureSlot) {
    if (!slot.id) return;
    if (!confirm("Hapus tanda tangan ini?")) return;
    setError("");
    startTransition(async () => {
      const res = await removeSignatureAction(slug, slot.id!);
      if (res.success) {
        setSlots((prev) => prev.filter((s) => !(s.section === slot.section && s.order === slot.order)));
      } else {
        setError(res.error);
      }
    });
  }

  function copySigningLink(token: string) {
    const url = `${appUrl ?? ""}/${slug}/sign/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  }

  // Generate token on-demand untuk slot lama yang belum punya (edge case)
  function handleGenerateToken(slot: SignatureSlot) {
    if (!slot.id) return;
    setError("");
    startTransition(async () => {
      const res = await generateSigningTokenAction(slug, slot.id!);
      if (res.success) {
        setSlots((prev) => prev.map((s) =>
          s.section === slot.section && s.order === slot.order
            ? { ...s, signingToken: res.token }
            : s
        ));
      } else {
        setError(res.error);
      }
    });
  }

  function addWitnessSlot() {
    const nextOrder = witnessSlots.length + 1;
    const next: SignatureSlot[] = [...slots, {
      id: null, order: nextOrder, section: "witnesses",
      officerId: null, officerName: null, position: null, division: null,
      role: "witness", signedAt: null, qrDataUrl: null, verifyUrl: null, signingToken: null,
    }];
    setSlots(next);
    emitChange(next);
  }

  // ── Render combobox officer (dipakai di kedua mode untuk assign) ─────────────

  function renderOfficerCombobox(slot: SignatureSlot, onSelect: (officerId: string, role: SlotRole) => void, onClear?: () => void) {
    const key    = slotKey(slot);
    const combo  = getCombo(key);
    const isSigned = slot.signedAt !== null;

    // Officer sudah di-assign dan sudah TTD → tidak bisa diubah
    if (isSigned) return null;

    // Filter officer yang belum dipakai di slot lain
    const usedIds = new Set(slots.map((s) => s.officerId).filter(Boolean) as string[]);
    const filtered = availableOfficers.filter(
      (o) => o.officerId === slot.officerId || !usedIds.has(o.officerId)
    );
    const searched = combo.search
      ? filtered.filter((o) =>
          o.name.toLowerCase().includes(combo.search.toLowerCase()) ||
          o.position.toLowerCase().includes(combo.search.toLowerCase())
        )
      : filtered;

    // Jika sudah di-assign tapi belum TTD
    if (slot.officerId) {
      return (
        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          <button
            type="button"
            onClick={() => setCombo(key, { open: !combo.open })}
            className="text-xs text-primary hover:underline"
          >
            Ganti
          </button>
          {onClear && (
            <button type="button" onClick={onClear} className="text-xs text-muted-foreground hover:text-destructive">
              Hapus
            </button>
          )}
          {combo.open && renderDropdown(key, searched, slot, onSelect)}
        </div>
      );
    }

    // Belum di-assign
    return (
      <div className="relative mt-1.5">
        <button
          type="button"
          onClick={() => setCombo(key, { open: !combo.open })}
          className="w-full flex items-center justify-between rounded border border-input bg-background px-2.5 py-1.5 text-xs text-left hover:bg-muted/30"
        >
          <span className="text-muted-foreground">Pilih pengurus...</span>
          <Search className="h-3 w-3 text-muted-foreground" />
        </button>
        {combo.open && renderDropdown(key, searched, slot, onSelect)}
      </div>
    );
  }

  function renderDropdown(key: string, officers: AvailableOfficer[], slot: SignatureSlot, onSelect: (officerId: string, role: SlotRole) => void) {
    return (
      <div className="absolute z-50 mt-1 w-full min-w-[220px] rounded-md border border-border bg-background shadow-lg">
        <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
          <Search className="h-3 w-3 text-muted-foreground shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Cari pengurus..."
            value={getCombo(key).search}
            onChange={(e) => setCombo(key, { search: e.target.value })}
            className="w-full bg-transparent text-xs outline-none"
          />
        </div>
        <div className="max-h-[200px] overflow-y-auto">
          {officers.length === 0
            ? <p className="px-3 py-2 text-xs text-muted-foreground">Tidak ada pengurus.</p>
            : officers.map((o) => (
              <button
                key={o.officerId}
                type="button"
                onClick={() => {
                  const role: SlotRole = slot.section === "witnesses" ? "witness" : "signer";
                  onSelect(o.officerId, role);
                }}
                className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-muted/40"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold underline leading-tight">{o.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{o.position}</p>
                  {o.division && (
                    <p className="text-[10px] text-muted-foreground">{o.division}</p>
                  )}
                </div>
                {o.userRole && ROLE_LABEL[o.userRole] && (
                  <span className={`shrink-0 mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${ROLE_BADGE[o.userRole] ?? "bg-zinc-100 text-zinc-600"}`}>
                    {ROLE_LABEL[o.userRole]}
                  </span>
                )}
              </button>
            ))
          }
        </div>
      </div>
    );
  }

  // ── Render satu kartu slot ───────────────────────────────────────────────────

  function renderSlotCard(slot: SignatureSlot, label: string) {
    const key      = slotKey(slot);
    const isSigned = slot.signedAt !== null;
    const qrOpen   = expandedQr === key;

    return (
      <div key={key} className="rounded-md border border-border p-3 space-y-1.5">
        {/* Header slot */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          {isSigned && (
            <span className="text-[10px] text-green-600 font-medium">✓ TTD</span>
          )}
          {!isSigned && slot.officerId && !isSigned && (
            <span className="text-[10px] text-amber-600">⏳ Menunggu</span>
          )}
        </div>

        {/* Info officer */}
        {slot.officerId && (
          <div>
            <p className="text-xs font-bold underline">{slot.officerName ?? "—"}</p>
            {slot.position && <p className="text-[10px] text-muted-foreground">{slot.position}</p>}
            {slot.division && <p className="text-[10px] text-muted-foreground">{slot.division}</p>}
          </div>
        )}

        {/* Mode form — combobox assign */}
        {mode === "form" && renderOfficerCombobox(
          slot,
          (officerId, role) => handleAssignForm(slot, officerId, role),
          slot.officerId && !isSigned ? () => handleClearForm(slot) : undefined,
        )}

        {/* Mode detail — link TTD (unsigned) */}
        {mode === "detail" && !isSigned && slot.officerId && (
          <div className="mt-2 space-y-1.5">
            {/* Tombol TTD Sekarang — hanya untuk officer yang sedang login */}
            {availableOfficers.find((o) => o.isCurrentUser)?.officerId === slot.officerId && (
              <button
                type="button"
                disabled={pending}
                onClick={() => handleSignDirect(slot)}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                <PenLine className="h-3.5 w-3.5" />
                TTD Sekarang
              </button>
            )}

            {/* Link TTD — tampilkan jika sudah ada token */}
            {slot.signingToken && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Link TTD — kirim ke penandatangan:</p>
                <div className="flex items-center gap-1">
                  <input
                    readOnly
                    type="text"
                    value={`${appUrl ?? ""}/${slug}/sign/${slot.signingToken}`}
                    className="flex-1 rounded border border-border bg-muted/30 px-2 py-1 font-mono text-[10px] text-foreground outline-none"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    type="button"
                    onClick={() => copySigningLink(slot.signingToken!)}
                    className="shrink-0 inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
                    title="Salin link"
                  >
                    {copiedToken === slot.signingToken
                      ? <Check className="h-3.5 w-3.5 text-green-500" />
                      : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Tidak ada token — tombol generate on-demand (slot lama / edge case) */}
            {!slot.signingToken && slot.id && isAdmin && (
              <button
                type="button"
                disabled={pending}
                onClick={() => handleGenerateToken(slot)}
                className="inline-flex items-center gap-1 rounded-md border border-primary/40 px-2.5 py-1.5 text-[11px] text-primary hover:bg-primary/5 disabled:opacity-60"
              >
                <PenLine className="h-3.5 w-3.5" />
                Buat Link TTD
              </button>
            )}

            {/* Hapus slot (admin) */}
            {isAdmin && slot.id && (
              <div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleRevoke(slot)}
                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive disabled:opacity-40 mt-0.5"
                >
                  <Trash2 className="h-3 w-3" />
                  Batalkan
                </button>
              </div>
            )}
          </div>
        )}

        {/* Mode detail — QR sudah TTD */}
        {mode === "detail" && isSigned && (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setExpandedQr(qrOpen ? null : key)}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <QrCode className="h-3 w-3" />
              QR {qrOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {qrOpen && slot.verifyUrl && (
              <div className="rounded border border-border bg-muted/5 p-2 space-y-1">
                {slot.qrDataUrl
                  ? <img src={slot.qrDataUrl} alt="QR" className="mx-auto w-16 h-16" />
                  : <p className="text-center text-[10px] text-muted-foreground italic">QR muncul setelah refresh</p>
                }
                <a href={slot.verifyUrl} target="_blank" rel="noopener noreferrer"
                  className="block break-all font-mono text-[9px] text-primary hover:underline">
                  {slot.verifyUrl}
                </a>
              </div>
            )}
            {isAdmin && slot.id && (
              <button type="button" disabled={pending} onClick={() => handleRevoke(slot)}
                className="text-[10px] text-muted-foreground hover:text-destructive disabled:opacity-40">
                Hapus TTD
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Label slot per layout ────────────────────────────────────────────────────

  const SLOT_LABELS: Record<SignatureLayout, string[]> = {
    "single-center":         ["Penandatangan"],
    "single-left":           ["Penandatangan"],
    "single-right":          ["Penandatangan"],
    "double":                ["Kiri", "Kanan"],
    "triple-row":            ["Kiri", "Tengah", "Kanan"],
    "triple-pyramid":        ["Kiri", "Kanan", "Tengah"],
    "double-with-witnesses": ["Kiri", "Kanan"],
  };

  // ── Render utama ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Preview / live display */}
      <SignatureBlock
        layout={layout}
        slots={slots}
        showDate={showDate}
        dateFormat={dateFormat}
        hijriOffset={hijriOffset}
        mode={mode === "form" ? "preview" : "live"}
        onQrClick={(slot) => setExpandedQr(expandedQr === slotKey(slot) ? null : slotKey(slot))}
      />

      {/* Kartu kontrol per slot */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          {mode === "form" ? "Assign Penandatangan" : "Status Penandatangan"}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {mainSlots.map((slot, i) =>
            renderSlotCard(slot, SLOT_LABELS[layout]?.[i] ?? `Slot ${i + 1}`)
          )}
        </div>

        {/* Saksi (hanya double-with-witnesses) */}
        {layout === "double-with-witnesses" && (
          <div className="space-y-2 pt-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Saksi</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {witnessSlots.map((slot) =>
                renderSlotCard(slot, `Saksi ${slot.order}`)
              )}
            </div>
            {isAdmin && (
              <button type="button" onClick={addWitnessSlot}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1">
                <UserPlus className="h-3.5 w-3.5" />
                Tambah Saksi
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
