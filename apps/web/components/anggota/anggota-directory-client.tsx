"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link  from "next/link";
import {
  X, Loader2, Phone, MessageCircle, Mail, MapPin,
  Globe, Briefcase, School, Users, ChevronRight,
} from "lucide-react";

const GENDER_LABEL: Record<string, string> = {
  male:   "Laki-laki",
  female: "Perempuan",
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: "Aktif",  cls: "bg-green-100 text-green-700 border-green-200"  },
  alumni: { label: "Alumni", cls: "bg-blue-100  text-blue-700  border-blue-200"   },
};

export type MemberRow = {
  id:               string;
  name:             string;
  photoUrl:         string | null;
  gender:           string | null;
  graduationYear:   number | null;
  graduationPeriod: string | null;
  memberStatus:     string;
  professionName:   string | null;
  professionCategory: string | null;
  domicileProvince: string | null;
  domicileRegency:  string | null;
};

type MemberDetail = {
  id:               string;
  name:             string;
  photoUrl:         string | null;
  gender:           string | null;
  graduationYear:   number | null;
  graduationPeriod: string | null;
  professionName:   string | null;
  professionCategory: string | null;
  domicileProvince: string | null;
  domicileRegency:  string | null;
  birthProvince:    string | null;
  membershipStatus: "active" | "alumni";
  phone:            string | null;
  whatsapp:         string | null;
  email:            string | null;
  socials: {
    instagram?: string; facebook?: string; linkedin?: string;
    twitter?: string;   youtube?: string;  tiktok?: string; website?: string;
  };
  businesses:   { id: string; name: string; sector: string; category: string }[];
  pesantrenList: { id: string; name: string; kurikulum: string | null }[];
};

type Props = {
  slug:      string;
  rows:      MemberRow[];
  hasFilter: boolean;
};

function Avatar({ name, photoUrl, size = 36 }: { name: string; photoUrl?: string | null; size?: number }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  if (photoUrl) {
    return (
      <Image
        src={photoUrl} alt={name}
        width={size} height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }
  return (
    <div
      className="rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function AnggotaDirectoryClient({ slug, rows, hasFilter }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail,     setDetail]     = useState<MemberDetail | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setDetail(null);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    fetch(`/api/member-public/${selectedId}?slug=${slug}`)
      .then(r => {
        if (!r.ok && r.headers.get("content-type")?.includes("text/html")) {
          throw new Error(`Server error ${r.status}`);
        }
        return r.json();
      })
      .then((data: MemberDetail | { error: string }) => {
        if ("error" in data) setError(data.error);
        else setDetail(data);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Gagal memuat data anggota."))
      .finally(() => setLoading(false));
  }, [selectedId, slug]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") handleClose(); }
    if (selectedId) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedId, handleClose]);

  const statusBadge = detail
    ? (STATUS_LABEL[detail.membershipStatus] ?? { label: detail.membershipStatus, cls: "bg-muted text-muted-foreground border-border" })
    : null;

  // ── Empty state ───────────────────────────────────────────────────────────
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">
          {hasFilter ? "Tidak ada anggota yang cocok dengan filter." : "Belum ada anggota terdaftar."}
        </p>
        {hasFilter && (
          <Link href={`/${slug}/anggota`} className="mt-3 text-sm text-primary hover:underline">
            Tampilkan semua
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      {/* ── DESKTOP: tabel ─────────────────────────────────────────────────── */}
      <div className="hidden md:block rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wide">
              <th className="px-4 py-3 font-semibold w-[260px]">Nama</th>
              <th className="px-4 py-3 font-semibold w-[90px]">Angkatan</th>
              <th className="px-4 py-3 font-semibold">Profesi</th>
              <th className="px-4 py-3 font-semibold">Domisili</th>
              <th className="px-4 py-3 font-semibold w-[80px]">Status</th>
              <th className="px-4 py-3 w-[40px]" />
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr
                key={m.id}
                onClick={() => handleSelect(m.id)}
                className={`group cursor-pointer hover:bg-muted/40 transition-colors ${i !== rows.length - 1 ? "border-b border-border" : ""}`}
              >
                {/* Nama + avatar */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} photoUrl={m.photoUrl} size={34} />
                    <span className="font-medium leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                      {m.name}
                    </span>
                  </div>
                </td>
                {/* Angkatan */}
                <td className="px-4 py-3 text-muted-foreground">
                  {m.graduationYear
                    ? <>{m.graduationYear}{m.graduationPeriod ? <span className="text-xs"> ({m.graduationPeriod})</span> : null}</>
                    : <span className="text-muted-foreground/40">—</span>
                  }
                </td>
                {/* Profesi */}
                <td className="px-4 py-3 text-muted-foreground">
                  <span className="line-clamp-1">
                    {m.professionName ?? <span className="text-muted-foreground/40">—</span>}
                  </span>
                </td>
                {/* Domisili */}
                <td className="px-4 py-3 text-muted-foreground">
                  {m.domicileRegency || m.domicileProvince
                    ? <span className="line-clamp-1">{[m.domicileRegency, m.domicileProvince].filter(Boolean).join(", ")}</span>
                    : <span className="text-muted-foreground/40">—</span>
                  }
                </td>
                {/* Status */}
                <td className="px-4 py-3">
                  <StatusBadge status={m.memberStatus} />
                </td>
                {/* Action */}
                <td className="px-3 py-3 text-right">
                  <ChevronRight size={15} className="text-muted-foreground/40 group-hover:text-primary transition-colors inline" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── MOBILE: card list ──────────────────────────────────────────────── */}
      <div className="md:hidden space-y-2">
        {rows.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => handleSelect(m.id)}
            className="w-full text-left flex items-center gap-3 rounded-xl border border-border px-4 py-3 hover:bg-muted/40 hover:border-primary/30 transition-all group"
          >
            <Avatar name={m.name} photoUrl={m.photoUrl} size={44} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-1">
                {m.name}
              </p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                {m.professionName && (
                  <span className="text-xs text-muted-foreground line-clamp-1">{m.professionName}</span>
                )}
                {m.professionName && m.domicileProvince && (
                  <span className="text-muted-foreground/30 text-xs">·</span>
                )}
                {m.domicileProvince && (
                  <span className="text-xs text-muted-foreground">{m.domicileProvince}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={m.memberStatus} />
                {m.graduationYear && (
                  <span className="text-xs text-muted-foreground/60">
                    {m.graduationYear}{m.graduationPeriod ? ` (${m.graduationPeriod})` : ""}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight size={16} className="text-muted-foreground/40 shrink-0 group-hover:text-primary transition-colors" />
          </button>
        ))}
      </div>

      {/* ── Popup detail ───────────────────────────────────────────────────── */}
      {selectedId && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <div
            className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold">Detail Anggota</h2>
              <button onClick={handleClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              {loading && (
                <div className="flex justify-center py-12">
                  <Loader2 size={28} className="animate-spin text-muted-foreground" />
                </div>
              )}
              {error && <p className="text-sm text-destructive text-center py-8">{error}</p>}

              {detail && !loading && (
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <Avatar name={detail.name} photoUrl={detail.photoUrl} size={72} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-lg leading-tight">{detail.name}</p>
                      {detail.professionName && (
                        <p className="text-sm text-muted-foreground mt-0.5">{detail.professionName}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {statusBadge && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${statusBadge.cls}`}>
                            {statusBadge.label}
                          </span>
                        )}
                        {detail.gender && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {GENDER_LABEL[detail.gender] ?? detail.gender}
                          </span>
                        )}
                        {detail.graduationYear && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            Angkatan {detail.graduationYear}
                            {detail.graduationPeriod ? ` (${detail.graduationPeriod})` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-sm">
                    {detail.domicileProvince && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin size={14} className="mt-0.5 shrink-0" />
                        <span>
                          {detail.domicileRegency ? `${detail.domicileRegency}, ` : ""}
                          {detail.domicileProvince}
                        </span>
                      </div>
                    )}
                    {detail.birthProvince && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <span className="text-xs shrink-0 w-[14px]">🏠</span>
                        <span>Asal: {detail.birthProvince}</span>
                      </div>
                    )}
                    {detail.professionCategory && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <Briefcase size={14} className="mt-0.5 shrink-0" />
                        <span>{detail.professionCategory}</span>
                      </div>
                    )}
                  </div>

                  {(detail.phone || detail.whatsapp || detail.email) && (
                    <div className="rounded-lg border border-border p-3 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kontak</p>
                      <div className="space-y-1.5 text-sm">
                        {detail.phone && (
                          <a href={`tel:${detail.phone}`} className="flex items-center gap-2 hover:text-primary">
                            <Phone size={14} className="text-muted-foreground" />
                            {detail.phone}
                          </a>
                        )}
                        {detail.whatsapp && (
                          <a href={`https://wa.me/${detail.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-primary">
                            <MessageCircle size={14} className="text-muted-foreground" />
                            {detail.whatsapp}
                          </a>
                        )}
                        {detail.email && (
                          <a href={`mailto:${detail.email}`} className="flex items-center gap-2 hover:text-primary">
                            <Mail size={14} className="text-muted-foreground" />
                            {detail.email}
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {Object.keys(detail.socials).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {detail.socials.instagram && (
                        <a href={`https://instagram.com/${detail.socials.instagram}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors">
                          <Globe size={12} /> <span>@{detail.socials.instagram}</span>
                        </a>
                      )}
                      {detail.socials.youtube && (
                        <a href={detail.socials.youtube} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors">
                          <Globe size={12} /> YouTube
                        </a>
                      )}
                      {detail.socials.website && (
                        <a href={detail.socials.website} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors">
                          <Globe size={12} /> Website
                        </a>
                      )}
                      {detail.socials.linkedin && (
                        <a href={detail.socials.linkedin} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors">
                          <Globe size={12} /> LinkedIn
                        </a>
                      )}
                      {detail.socials.facebook && (
                        <a href={`https://facebook.com/${detail.socials.facebook}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors">
                          <Globe size={12} /> Facebook
                        </a>
                      )}
                      {detail.socials.tiktok && (
                        <a href={`https://tiktok.com/@${detail.socials.tiktok}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors">
                          <Globe size={12} /> @{detail.socials.tiktok}
                        </a>
                      )}
                      {detail.socials.twitter && (
                        <a href={`https://twitter.com/${detail.socials.twitter}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors">
                          <Globe size={12} /> @{detail.socials.twitter}
                        </a>
                      )}
                    </div>
                  )}

                  {detail.businesses.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <Briefcase size={12} /> Usaha
                      </p>
                      <div className="space-y-1.5">
                        {detail.businesses.map(b => (
                          <div key={b.id} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                            <p className="font-medium">{b.name}</p>
                            <p className="text-xs text-muted-foreground">{b.category} · {b.sector}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {detail.pesantrenList.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <School size={12} /> Pesantren
                      </p>
                      <div className="space-y-1.5">
                        {detail.pesantrenList.map(p => (
                          <div key={p.id} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                            <p className="font-medium">{p.name}</p>
                            {p.kurikulum && <p className="text-xs text-muted-foreground">{p.kurikulum}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
