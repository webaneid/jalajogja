"use client";

import * as React       from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle2, ChevronRight, ChevronLeft, Loader2,
  User, Phone, MapPin, AtSign,
} from "lucide-react";
import { WilayahSelect }    from "@/components/ui/wilayah-select";
import type { WilayahValue } from "@/components/ui/wilayah-select";
import { SocialMediaInput, type SocialMediaValue, SOCIAL_MEDIA_EMPTY } from "@/components/ui/social-media-input";
import { RegencyCombobox } from "@/components/ui/regency-combobox";
import { Combobox } from "@/components/ui/combobox";
import { CoverImageField } from "@/components/media/member-media-picker";
import { PhoneInput }      from "@/components/ui/phone-input";
import { Search, ChevronDown, Plus, X, ArrowLeft } from "lucide-react";
import { useBaseUrl } from "@/lib/use-base-url";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberData {
  id: string;
  name: string;
  photoUrl: string | null;
  nik: string | null;
  stambukNumber: string | null;
  gender: "male" | "female" | null;
  birthDate: string | null;
  birthRegencyId:   number | null;
  birthRegencyName: string | null;
  birthPlaceText: string | null;
  graduationYear:   number | null;
  graduationPeriod: "awal" | "akhir" | null;
  professionId:     number | null;
  waliSantri:       "gontor" | "alumni" | "lain" | "bukan" | null;
  memberNumber:       string | null;
  domicileStatus:     "permanent" | "temporary" | null;
  primaryCabangRefId: string | null;
  contact: {
    phone: string | null; whatsapp: string | null; email: string | null;
    isPhonePublic: boolean; isWhatsappPublic: boolean; isEmailPublic: boolean;
  } | null;
  address: {
    detail: string | null; country: string | null;
    provinceId: number | null; regencyId: number | null;
    districtId: number | null; villageId: number | null;
    postalCode: string | null;
  } | null;
  social: {
    instagram: string | null; facebook: string | null; linkedin: string | null;
    twitter: string | null; youtube: string | null; tiktok: string | null; website: string | null;
  } | null;
  tenantProvinceId: number | null;
}

interface Profession { id: number; name: string }

// ─── UI helpers ───────────────────────────────────────────────────────────────

function FieldWrap({
  label, optional, required, children,
}: { label: string; optional?: boolean; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
        {optional && <span className="text-muted-foreground font-normal ml-1">(opsional)</span>}
      </label>
      {children}
    </div>
  );
}

function TextInput(props: React.ComponentProps<"input"> & { label: string; optional?: boolean }) {
  const { label, optional, required, ...rest } = props;
  return (
    <FieldWrap label={label} optional={optional} required={required}>
      <input
        required={required}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        {...rest}
      />
    </FieldWrap>
  );
}

function SelectNative(props: React.ComponentProps<"select"> & { label: string; optional?: boolean }) {
  const { label, optional, required, ...rest } = props;
  return (
    <FieldWrap label={label} optional={optional} required={required}>
      <select
        required={required}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        {...rest}
      />
    </FieldWrap>
  );
}

// ─── VisibilityToggle ─────────────────────────────────────────────────────────

function VisibilityToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="rounded border-input accent-primary"
      />
      Publik
    </label>
  );
}

// ─── ProfessionCombobox — filter client-side (25 item) ───────────────────────

function ProfessionCombobox({
  professions,
  value,
  onChange,
}: {
  professions: Profession[];
  value:       number | null;
  onChange:    (id: number | null) => void;
}) {
  const [query,  setQuery]  = React.useState("");
  const [open,   setOpen]   = React.useState(false);
  const wrapRef             = React.useRef<HTMLDivElement>(null);

  const selected = professions.find(p => p.id === value) ?? null;

  const filtered = query.trim()
    ? professions.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : professions;

  // Tutup saat klik di luar
  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        // Jika query tidak cocok dengan pilihan, reset ke nama yang dipilih
        if (selected) setQuery(selected.name);
        else          setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selected]);

  function handleSelect(p: Profession) {
    onChange(p.id);
    setQuery(p.name);
    setOpen(false);
  }

  function handleClear() {
    onChange(null);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5" ref={wrapRef}>
      <label className="text-sm font-medium">Profesi<span className="text-destructive ml-0.5">*</span></label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={selected ? selected.name : query}
          onFocus={() => { setOpen(true); if (selected) setQuery(""); }}
          onChange={e => { setQuery(e.target.value); onChange(null); setOpen(true); }}
          placeholder="Ketik atau pilih profesi..."
          autoComplete="off"
          className="flex h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden">
            <ul className="max-h-52 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">Tidak ditemukan.</li>
              ) : (
                filtered.map(p => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); handleSelect(p); }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-muted/60 ${
                        value === p.id ? "font-medium text-primary bg-primary/5" : ""
                      }`}
                    >
                      {p.name}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step indicator ──────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <React.Fragment key={n}>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
              done   ? "bg-primary text-primary-foreground" :
              active ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2" :
                       "bg-muted text-muted-foreground"
            }`}>
              {done ? <CheckCircle2 className="h-4 w-4" /> : n}
            </div>
            {n < total && <div className={`flex-1 h-0.5 transition-colors ${done ? "bg-primary" : "bg-muted"}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LengkapiPage() {
  const params  = useParams<{ tenant: string }>();
  const slug    = params.tenant;
  const router  = useRouter();
  const baseUrl = useBaseUrl(slug);

  const [step, setStep]       = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving]   = React.useState(false);
  const [error, setError]     = React.useState<string | null>(null);

  const [professions,  setProfessions]  = React.useState<Profession[]>([]);
  const [cabangList,   setCabangList]   = React.useState<{ id: string; nama: string }[]>([]);
  const [primaryCabangRefId, setPrimaryCabangRefId] = React.useState<string>("");

  // ── Step 1 state ──────────────────────────────────────────────────────────
  const [photoUrl,       setPhotoUrl]       = React.useState<string | null>(null);
  const [name,           setName]           = React.useState("");
  const [nik,            setNik]            = React.useState("");
  const [stambukNumber,  setStambukNumber]  = React.useState("");
  const [gender,         setGender]         = React.useState<"male" | "female" | "">("");
  const [birthDate,         setBirthDate]         = React.useState("");
  const [birthType,         setBirthType]         = React.useState<"id" | "ln">("id");
  const [birthPlaceText,    setBirthPlaceText]    = React.useState("");
  const [birthRegencyId,    setBirthRegencyId]    = React.useState<number | null>(null);
  const [birthRegencyName,  setBirthRegencyName]  = React.useState<string | null>(null);
  const [graduationYear,   setGraduationYear]   = React.useState("");
  const [graduationPeriod, setGraduationPeriod] = React.useState<"awal" | "akhir" | "">("");
  const [professionId,   setProfessionId]   = React.useState<number | null>(null);
  const [waliSantri,     setWaliSantri]     = React.useState<"gontor" | "alumni" | "lain" | "bukan" | "">("");

  // ── Step 2 state — kontak ────────────────────────────────────────────────
  const [phone,    setPhone]    = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("");
  const [email,    setEmail]    = React.useState("");
  const [isPhonePublic,    setIsPhonePublic]    = React.useState(false);
  const [isWhatsappPublic, setIsWhatsappPublic] = React.useState(false);
  const [isEmailPublic,    setIsEmailPublic]    = React.useState(false);
  const [domicileStatus, setDomicileStatus] = React.useState<"permanent" | "temporary" | "">("");
  const [addrType,         setAddrType]         = React.useState<"indonesia" | "overseas">("indonesia");
  const [addrCountry,      setAddrCountry]      = React.useState("");
  const [addrWilayah,      setAddrWilayah]      = React.useState<WilayahValue>({});
  const [tenantProvinceId, setTenantProvinceId] = React.useState<number | undefined>(undefined);
  const [addrDetail,     setAddrDetail]     = React.useState("");
  const [addrPostalCode, setAddrPostalCode] = React.useState("");
  const [social, setSocial] = React.useState<SocialMediaValue>(SOCIAL_MEDIA_EMPTY);

  // ── Step 3 state — pendidikan ─────────────────────────────────────────────
  type EduEntry = {
    _key: string;
    level: string;
    institutionName: string;
    major: string;
    startYear: string;
    endYear: string;
    isGontor: boolean;
    gontorCampus: string;
  };

  const EDUCATION_LEVELS = ["TK","SD","SMP","SMA","D3","S1","S2","S3","Non-Formal"] as const;
  const GONTOR_CAMPUSES  = [
    "Gontor 1 (Putra)","Gontor 2 (Putra)","Gontor 3 (Putra)","Gontor 4 (Putra)",
    "Gontor 5 (Putra)","Gontor 6 (Putra)","Gontor 7 (Putra)","Gontor 8 (Putra)",
    "Gontor Putri 1","Gontor Putri 2","Gontor Putri 3",
    "Gontor Putri 4","Gontor Putri 5","Gontor Putri 6",
  ] as const;
  const LEVELS_WITH_MAJOR = new Set(["D3","S1","S2","S3"]);

  function newEdu(): EduEntry {
    return { _key: crypto.randomUUID(), level:"SD", institutionName:"", major:"", startYear:"", endYear:"", isGontor:false, gontorCampus:"" };
  }

  const [eduEntries, setEduEntries] = React.useState<EduEntry[]>([]);

  function updateEdu(key: string, patch: Partial<EduEntry>) {
    setEduEntries(prev => prev.map(e => e._key === key ? { ...e, ...patch } : e));
  }
  function removeEdu(key: string) {
    setEduEntries(prev => prev.filter(e => e._key !== key));
  }

  // ── Load data ─────────────────────────────────────────────────────────────
  React.useEffect(() => {
    async function load() {
      try {
        const [dataRes, profRes, eduRes, cabangRes] = await Promise.all([
          fetch(`/api/akun/member-data?slug=${encodeURIComponent(slug)}`),
          fetch("/api/ref/professions"),
          fetch("/api/akun/member-education"),
          fetch("/api/ref/ikpm-cabang"),
        ]);

        if (dataRes.status === 403) {
          // Bukan anggota → redirect ke dashboard akun
          router.replace(`/${slug}/akun`);
          return;
        }
        if (!dataRes.ok) throw new Error("Gagal memuat data.");

        const { data }: { data: MemberData } = await dataRes.json();

        // Isi Step 1
        setPhotoUrl(data.photoUrl ?? null);
        setName(data.name ?? "");
        setNik(data.nik ?? "");
        setStambukNumber(data.stambukNumber ?? "");
        setGender((data.gender ?? "") as "male" | "female" | "");
        setBirthDate(data.birthDate ?? "");
        if (data.birthPlaceText) {
          setBirthType("ln");
          setBirthPlaceText(data.birthPlaceText);
        } else if (data.birthRegencyId) {
          setBirthType("id");
          setBirthRegencyId(data.birthRegencyId);
          setBirthRegencyName(data.birthRegencyName ?? null);
        }
        setGraduationYear(data.graduationYear ? String(data.graduationYear) : "");
        setGraduationPeriod((data.graduationPeriod ?? "") as "awal" | "akhir" | "");
        setProfessionId(data.professionId ?? null);
        setWaliSantri((data.waliSantri ?? "") as "gontor" | "alumni" | "lain" | "bukan" | "");
        setPrimaryCabangRefId(data.primaryCabangRefId ?? "");

        // Daftar cabang resmi
        if (cabangRes.ok) {
          const cabangData = await cabangRes.json();
          setCabangList(Array.isArray(cabangData) ? cabangData : (cabangData.data ?? []));
        }

        // Isi Step 2 — kontak
        setPhone(data.contact?.phone ?? "");
        setWhatsapp(data.contact?.whatsapp ?? "");
        setEmail(data.contact?.email ?? "");
        setIsPhonePublic(data.contact?.isPhonePublic ?? false);
        setIsWhatsappPublic(data.contact?.isWhatsappPublic ?? false);
        setIsEmailPublic(data.contact?.isEmailPublic ?? false);
        setDomicileStatus((data.domicileStatus ?? "") as "permanent" | "temporary" | "");

        // Isi Step 2 — alamat
        if (data.address?.country) {
          setAddrType("overseas");
          setAddrCountry(data.address.country);
        } else if (data.address) {
          setAddrType("indonesia");
          setAddrWilayah({
            provinceId: data.address.provinceId ?? undefined,
            regencyId:  data.address.regencyId  ?? undefined,
            districtId: data.address.districtId ?? undefined,
            villageId:  data.address.villageId  ?? undefined,
          });
        } else if (data.tenantProvinceId) {
          // Belum ada alamat → pre-fill provinsi dari setting tenant
          setTenantProvinceId(data.tenantProvinceId);
          setAddrWilayah({ provinceId: data.tenantProvinceId });
        }
        setAddrDetail(data.address?.detail ?? "");
        setAddrPostalCode(data.address?.postalCode ?? "");

        // Isi Step 2 — sosial media
        setSocial({
          instagram: data.social?.instagram ?? "",
          facebook:  data.social?.facebook  ?? "",
          linkedin:  data.social?.linkedin  ?? "",
          twitter:   data.social?.twitter   ?? "",
          youtube:   data.social?.youtube   ?? "",
          tiktok:    data.social?.tiktok    ?? "",
          website:   data.social?.website   ?? "",
        });

        if (profRes.ok) {
          const profData = await profRes.json();
          setProfessions(Array.isArray(profData) ? profData : (profData.data ?? []));
        }
        if (eduRes.ok) {
          const eduData = await eduRes.json() as { data?: { level:string; institutionName:string; major:string|null; startYear:number|null; endYear:number|null; isGontor:boolean; gontorCampus:string|null }[] };
          if (eduData.data && eduData.data.length > 0) {
            setEduEntries(eduData.data.map(e => ({
              _key:            crypto.randomUUID(),
              level:           e.level,
              institutionName: e.institutionName,
              major:           e.major           ?? "",
              startYear:       e.startYear != null ? String(e.startYear) : "",
              endYear:         e.endYear   != null ? String(e.endYear)   : "",
              isGontor:        e.isGontor,
              gontorCampus:    e.gontorCampus     ?? "",
            })));
          }
        }
      } catch (e) {
        console.error(e);
        setError("Gagal memuat data. Coba refresh halaman.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug, router]);

  // ── Save Step 1 ───────────────────────────────────────────────────────────
  async function saveStep1() {
    if (!name.trim())     { setError("Nama tidak boleh kosong."); return; }
    if (!gender)          { setError("Jenis kelamin wajib dipilih."); return; }
    if (!birthDate)       { setError("Tanggal lahir wajib diisi."); return; }
    if (!graduationYear)  { setError("Tahun lulus KMI wajib diisi."); return; }
    if (Number(graduationYear) === 1999 && !graduationPeriod) { setError("Angkatan 1999 wajib memilih periode: Awal atau Akhir."); return; }
    if (!professionId)    { setError("Profesi wajib dipilih."); return; }
    if (!waliSantri)      { setError("Status wali santri wajib dipilih."); return; }
    if (!primaryCabangRefId) { setError("PC IKPM Cabang wajib dipilih."); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/akun/member-data", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name: name.trim(),
          photoUrl: photoUrl || null,
          nik:  nik.trim() || null,
          stambukNumber: stambukNumber.trim() || null,
          gender: gender || null,
          birthDate:      birthDate   || null,
          birthRegencyId: birthType === "id" ? (birthRegencyId ?? null) : null,
          birthPlaceText: birthType === "ln" ? (birthPlaceText.trim() || null) : null,
          graduationYear:   graduationYear ? Number(graduationYear) : null,
          graduationPeriod: Number(graduationYear) === 1999 ? (graduationPeriod || null) : null,
          professionId:     professionId ?? null,
          waliSantri:          waliSantri || null,
          primaryCabangRefId:  primaryCabangRefId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Gagal menyimpan."); return; }
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  // ── Save Step 2 ───────────────────────────────────────────────────────────
  async function saveStep2() {
    const effectiveWa = whatsapp.trim() || phone.trim(); // jika sama dengan HP, pakai phone
    if (!phone.trim())       { setError("Nomor HP wajib diisi.");         return; }
    if (!effectiveWa)        { setError("Nomor WhatsApp wajib diisi.");   return; }
    if (!email.trim())       { setError("Email wajib diisi.");             return; }
    if (!domicileStatus)     { setError("Status domisili wajib dipilih."); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/akun/member-contact", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          phone:    phone.trim()    || null,
          whatsapp: effectiveWa             || null,
          email:    email.trim()    || null,
          isPhonePublic,
          isWhatsappPublic,
          isEmailPublic,
          domicileStatus: domicileStatus || null,
          addressCountry:    addrType === "overseas" ? (addrCountry.trim() || null) : null,
          addressProvinceId: addrType === "indonesia" ? (addrWilayah.provinceId ?? null) : null,
          addressRegencyId:  addrType === "indonesia" ? (addrWilayah.regencyId  ?? null) : null,
          addressDistrictId: addrType === "indonesia" ? (addrWilayah.districtId ?? null) : null,
          addressVillageId:  addrType === "indonesia" ? (addrWilayah.villageId  ?? null) : null,
          addressDetail:     addrDetail.trim()     || null,
          addressPostalCode: addrPostalCode.trim() || null,
          instagram: social.instagram.trim() || null,
          facebook:  social.facebook.trim()  || null,
          linkedin:  social.linkedin.trim()  || null,
          twitter:   social.twitter.trim()   || null,
          youtube:   social.youtube.trim()   || null,
          tiktok:    social.tiktok.trim()    || null,
          website:   social.website.trim()   || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Gagal menyimpan."); return; }
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  // ── Save Step 3 ───────────────────────────────────────────────────────────
  async function saveStep3() {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/akun/member-education", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          slug: slug,
          entries: eduEntries
            .filter(e => e.institutionName.trim())
            .map(e => ({
              level:           e.level,
              institutionName: e.institutionName.trim(),
              major:           e.major.trim()  || null,
              startYear:       e.startYear ? Number(e.startYear) : null,
              endYear:         e.endYear   ? Number(e.endYear)   : null,
              isGontor:        e.isGontor,
              gontorCampus:    e.isGontor ? (e.gontorCampus || null) : null,
            })),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Gagal menyimpan."); return; }
      // Reload penuh (bukan router.push) — pastikan /akun tidak menampilkan RSC cache basi
      // dari sebelum data disimpan (lihat lesson window.location.href wajib setelah mutasi data)
      window.location.href = `/${slug}/akun`;
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Lengkapi Data Anggota</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Isi data diri agar profil keanggotaan Anda lengkap dan terverifikasi.
        </p>
        <a href={`${baseUrl}/akun`}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
          <ArrowLeft className="size-4" />
          Kembali ke Dashboard
        </a>
      </div>

      <StepIndicator current={step} total={3} />

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Step 1: Data Identitas ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 font-semibold text-base mb-4">
            <User className="h-4 w-4 text-primary" />
            Data Identitas
          </div>

          <CoverImageField
            slug={slug}
            label="Foto Profil"
            value={photoUrl}
            onChange={setPhotoUrl}
            preferVariant="profile"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <TextInput
                label="Nama Lengkap"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Sesuai KTP / ijazah"
              />
            </div>

            <TextInput
              label="NIK"
              optional
              value={nik}
              onChange={e => setNik(e.target.value)}
              placeholder="16 digit"
              maxLength={16}
            />

            <TextInput
              label="Nomor Induk Gontor (Stambuk)"
              optional
              value={stambukNumber}
              onChange={e => setStambukNumber(e.target.value)}
              placeholder="Nomor stambuk PM Gontor"
            />

            <SelectNative
              label="Jenis Kelamin"
              required
              value={gender}
              onChange={e => setGender(e.target.value as "male" | "female" | "")}
            >
              <option value="">Pilih jenis kelamin</option>
              <option value="male">Laki-laki</option>
              <option value="female">Perempuan</option>
            </SelectNative>

            <TextInput
              label="Tanggal Lahir"
              required
              type="date"
              value={birthDate}
              onChange={e => setBirthDate(e.target.value)}
            />
          </div>

          {/* Tempat lahir */}
          <div className="space-y-3">
            <label className="text-sm font-medium">
              Tempat Lahir
              <span className="text-muted-foreground font-normal ml-1">(opsional)</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="birthType" value="id"
                  checked={birthType === "id"}
                  onChange={() => setBirthType("id")}
                  className="accent-primary" />
                <span className="text-sm">Indonesia</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="birthType" value="ln"
                  checked={birthType === "ln"}
                  onChange={() => setBirthType("ln")}
                  className="accent-primary" />
                <span className="text-sm">Luar Negeri</span>
              </label>
            </div>

            {birthType === "id" ? (
              <RegencyCombobox
                label=""
                value={birthRegencyId}
                displayName={birthRegencyName}
                placeholder="Ketik nama kabupaten / kota..."
                onChange={(id, name) => {
                  setBirthRegencyId(id);
                  setBirthRegencyName(name);
                }}
              />
            ) : (
              <input
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="mis. Ponorogo, Jawa Timur / New York, USA"
                value={birthPlaceText}
                onChange={e => setBirthPlaceText(e.target.value)}
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <TextInput
                label="Tahun Lulus KMI / Keluar PM Gontor"
                required
                type="number"
                min={1920}
                max={new Date().getFullYear()}
                value={graduationYear}
                onChange={e => {
                  setGraduationYear(e.target.value);
                  if (Number(e.target.value) !== 1999) setGraduationPeriod("");
                }}
                placeholder="mis. 2005"
              />
              {Number(graduationYear) === 1999 && (
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="graduationPeriod"
                      value="awal"
                      checked={graduationPeriod === "awal"}
                      onChange={() => setGraduationPeriod("awal")}
                      className="accent-primary"
                    />
                    <span className="text-sm">1999 Awal</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="graduationPeriod"
                      value="akhir"
                      checked={graduationPeriod === "akhir"}
                      onChange={() => setGraduationPeriod("akhir")}
                      className="accent-primary"
                    />
                    <span className="text-sm">1999 Akhir</span>
                  </label>
                </div>
              )}
            </div>

            <ProfessionCombobox
              professions={professions}
              value={professionId}
              onChange={setProfessionId}
            />

            {/* Wali Santri */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Apakah Anda Wali Santri? <span className="text-destructive">*</span></label>
              <select
                value={waliSantri}
                onChange={e => setWaliSantri(e.target.value as typeof waliSantri)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Pilih —</option>
                <option value="gontor">Wali Santri Pondok Modern Gontor</option>
                <option value="alumni">Wali Santri Pondok Modern Alumni Gontor</option>
                <option value="lain">Wali Santri Pesantren Lain</option>
                <option value="bukan">Bukan Wali Santri</option>
              </select>
            </div>

            {/* PC IKPM Cabang */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">PC IKPM Cabang <span className="text-destructive">*</span></label>
              <Combobox
                options={cabangList.map(c => ({ value: c.id, label: c.nama }))}
                value={primaryCabangRefId}
                onValueChange={setPrimaryCabangRefId}
                placeholder="Cari PC IKPM Anda..."
                searchPlaceholder="Ketik nama PC IKPM..."
                emptyText="PC IKPM tidak ditemukan."
              />
              <p className="text-xs text-muted-foreground">
                PC IKPM tempat Anda berdomisili atau bernaung. Dapat diubah jika pindah.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={saveStep1}
              disabled={saving || !name.trim() || !gender || !birthDate || !graduationYear || (Number(graduationYear) === 1999 && !graduationPeriod) || !professionId || !waliSantri || !primaryCabangRefId}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Simpan & Lanjutkan
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Kontak & Alamat ── */}
      {step === 2 && (
        <div className="space-y-8">

          {/* Kontak */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 font-semibold text-base">
              <Phone className="h-4 w-4 text-primary" />
              Data Kontak
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* HP */}
              <div className="space-y-1.5">
                <PhoneInput
                  label="Nomor HP"
                  required
                  value={phone}
                  onChange={setPhone}
                />
                <VisibilityToggle checked={isPhonePublic} onChange={setIsPhonePublic} />
              </div>

              {/* WhatsApp */}
              <div className="space-y-1.5">
                <PhoneInput
                  label="Nomor WhatsApp"
                  required
                  value={whatsapp || phone}
                  onChange={val => setWhatsapp(val === phone ? "" : val)}
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!whatsapp || whatsapp === phone}
                    onChange={e => setWhatsapp(e.target.checked ? "" : phone)}
                    className="rounded border-input accent-primary"
                  />
                  Sama dengan nomor HP
                </label>
                <VisibilityToggle checked={isWhatsappPublic} onChange={setIsWhatsappPublic} />
              </div>

              {/* Email */}
              <div className="sm:col-span-2 space-y-1.5">
                <TextInput
                  label="Email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@example.com"
                />
                <VisibilityToggle checked={isEmailPublic} onChange={setIsEmailPublic} />
              </div>
            </div>
          </div>

          {/* Alamat */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 font-semibold text-base">
              <MapPin className="h-4 w-4 text-primary" />
              Alamat Domisili
            </div>

            <SelectNative
              label="Status Domisili"
              value={domicileStatus}
              onChange={e => setDomicileStatus(e.target.value as "permanent" | "temporary" | "")}
            >
              <option value="">Pilih status domisili</option>
              <option value="permanent">Domisili Tetap</option>
              <option value="temporary">Domisili Sementara</option>
            </SelectNative>

            <div className="space-y-3">
              <label className="text-sm font-medium">Lokasi Alamat</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="addrType" value="indonesia"
                    checked={addrType === "indonesia"}
                    onChange={() => setAddrType("indonesia")}
                    className="accent-primary" />
                  <span className="text-sm">Indonesia</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="addrType" value="overseas"
                    checked={addrType === "overseas"}
                    onChange={() => setAddrType("overseas")}
                    className="accent-primary" />
                  <span className="text-sm">Luar Negeri</span>
                </label>
              </div>

              {addrType === "indonesia" ? (
                <div className="space-y-2">
                  {tenantProvinceId && !addrWilayah.regencyId && (
                    <p className="text-xs text-muted-foreground">
                      Provinsi diisi otomatis sesuai domisili cabang IKPM ini. Anda bisa mengubahnya.
                    </p>
                  )}
                  <WilayahSelect
                    defaultValue={addrWilayah}
                    onChange={v => { setAddrWilayah(v); }}
                    tenantSlug={slug}
                    hints={{
                      province: "Publik",
                      regency:  "Publik",
                      district: "Tidak ditampilkan ke publik",
                      village:  "Tidak ditampilkan ke publik",
                    }}
                  />
                </div>
              ) : (
                <TextInput
                  label="Nama Negara"
                  value={addrCountry}
                  onChange={e => setAddrCountry(e.target.value)}
                  placeholder="mis. Malaysia, Australia"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <TextInput
                label="Alamat Detail"
                optional
                value={addrDetail}
                onChange={e => setAddrDetail(e.target.value)}
                placeholder="Nama jalan, nomor rumah, RT/RW, dll"
              />
              <p className="text-xs text-muted-foreground">Tidak ditampilkan ke publik.</p>
            </div>
            <div className="space-y-1.5">
              <TextInput
                label="Kode Pos"
                optional
                value={addrPostalCode}
                onChange={e => setAddrPostalCode(e.target.value)}
                placeholder="5 digit"
                maxLength={5}
              />
              <p className="text-xs text-muted-foreground">Tidak ditampilkan ke publik.</p>
            </div>
          </div>

          {/* Sosial Media */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 font-semibold text-base">
                <AtSign className="h-4 w-4 text-primary" />
                Media Sosial
                <span className="text-muted-foreground font-normal text-sm ml-1">(semua opsional)</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Semua yang diisi akan ditampilkan ke publik.</p>
            </div>
            <SocialMediaInput value={social} onChange={setSocial} />
          </div>

          {/* Navigasi Step 2 */}
          <div className="flex justify-between pt-4">
            <button
              onClick={() => { setStep(1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Kembali
            </button>
            <button
              onClick={saveStep2}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Simpan &amp; Lanjutkan
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Riwayat Pendidikan ── */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-base">
              Riwayat Pendidikan
            </div>
            <span className="text-xs text-muted-foreground">Opsional — lewati jika tidak ingin mengisi</span>
          </div>

          {eduEntries.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada riwayat pendidikan. Klik tombol di bawah untuk menambahkan.</p>
          )}

          {eduEntries.map((edu) => (
            <div key={edu._key} className="rounded-xl border border-border p-4 space-y-4 relative">
              <button
                type="button"
                onClick={() => removeEdu(edu._key)}
                className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Jenjang */}
                <SelectNative
                  label="Jenjang"
                  value={edu.level}
                  onChange={e => updateEdu(edu._key, { level: e.target.value })}
                >
                  {EDUCATION_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </SelectNative>

                {/* Nama Institusi */}
                <TextInput
                  label="Nama Institusi"
                  required
                  value={edu.institutionName}
                  onChange={e => updateEdu(edu._key, { institutionName: e.target.value })}
                  placeholder="Nama sekolah / universitas"
                />

                {/* Jurusan — hanya untuk D3 ke atas */}
                {LEVELS_WITH_MAJOR.has(edu.level) && (
                  <TextInput
                    label="Jurusan"
                    optional
                    value={edu.major}
                    onChange={e => updateEdu(edu._key, { major: e.target.value })}
                    placeholder="Jurusan / prodi"
                  />
                )}

                <TextInput
                  label="Tahun Mulai"
                  optional
                  type="number"
                  min={1950}
                  max={new Date().getFullYear()}
                  value={edu.startYear}
                  onChange={e => updateEdu(edu._key, { startYear: e.target.value })}
                  placeholder="mis. 2000"
                />
                <TextInput
                  label="Tahun Selesai"
                  optional
                  type="number"
                  min={1950}
                  max={new Date().getFullYear() + 5}
                  value={edu.endYear}
                  onChange={e => updateEdu(edu._key, { endYear: e.target.value })}
                  placeholder="mis. 2006"
                />
              </div>

              {/* Gontor toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                <input
                  type="checkbox"
                  checked={edu.isGontor}
                  onChange={e => updateEdu(edu._key, { isGontor: e.target.checked, gontorCampus: "" })}
                  className="rounded border-input accent-primary"
                />
                Ini adalah Pondok Modern Gontor
              </label>

              {edu.isGontor && (
                <SelectNative
                  label="Kampus Gontor"
                  value={edu.gontorCampus}
                  onChange={e => updateEdu(edu._key, { gontorCampus: e.target.value })}
                >
                  <option value="">Pilih kampus</option>
                  {GONTOR_CAMPUSES.map(c => <option key={c} value={c}>{c}</option>)}
                </SelectNative>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => setEduEntries(prev => [...prev, newEdu()])}
            className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors w-full justify-center"
          >
            <Plus className="h-4 w-4" />
            Tambah Riwayat Pendidikan
          </button>

          {/* Navigasi Step 3 */}
          <div className="flex justify-between pt-4">
            <button
              onClick={() => { setStep(2); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Kembali
            </button>
            <button
              onClick={saveStep3}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Selesai
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
