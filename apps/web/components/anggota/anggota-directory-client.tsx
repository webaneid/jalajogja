"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X, Loader2, Phone, MessageCircle, Mail, MapPin,
  Globe, Briefcase, School,
} from "lucide-react";
import Image from "next/image";

const GENDER_LABEL: Record<string, string> = {
  male:   "Laki-laki",
  female: "Perempuan",
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: "Aktif",  cls: "bg-green-100 text-green-700" },
  alumni: { label: "Alumni", cls: "bg-blue-100 text-blue-700"  },
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
  children:  (onSelect: (id: string) => void) => React.ReactNode;
};

function Avatar({ name, photoUrl, size = 64 }: { name: string; photoUrl?: string | null; size?: number }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  if (photoUrl) {
    return (
      <Image
        src={photoUrl} alt={name}
        width={size} height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }
  return (
    <div
      className="rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

export function AnggotaDirectoryClient({ slug, children }: Props) {
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
      .then(r => r.json())
      .then((data: MemberDetail | { error: string }) => {
        if ("error" in data) setError(data.error);
        else setDetail(data);
      })
      .catch(() => setError("Gagal memuat data anggota."))
      .finally(() => setLoading(false));
  }, [selectedId, slug]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") handleClose(); }
    if (selectedId) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedId, handleClose]);

  const statusBadge = detail ? (STATUS_LABEL[detail.membershipStatus] ?? { label: detail.membershipStatus, cls: "bg-muted text-muted-foreground" }) : null;

  return (
    <>
      {children(handleSelect)}

      {/* Popup Overlay */}
      {selectedId && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <div
            className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
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
                  {/* Identity */}
                  <div className="flex items-start gap-4">
                    <Avatar name={detail.name} photoUrl={detail.photoUrl} size={72} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-lg leading-tight">{detail.name}</p>
                      {detail.professionName && (
                        <p className="text-sm text-muted-foreground mt-0.5">{detail.professionName}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {statusBadge && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge.cls}`}>
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

                  {/* Info singkat */}
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

                  {/* Kontak (kondisional) */}
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

                  {/* Social Media */}
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

                  {/* Usaha */}
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

                  {/* Pesantren */}
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
