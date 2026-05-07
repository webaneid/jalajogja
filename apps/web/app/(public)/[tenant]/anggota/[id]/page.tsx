import { notFound, redirect } from "next/navigation";
import { createHash }         from "crypto";
import { headers }            from "next/headers";
import { eq }                 from "drizzle-orm";
import { auth }               from "@/lib/auth";
import {
  db, members, contacts, addresses, socialMedias, refProfessions,
  memberBusinesses, memberEducations, memberPesantren, pesantren,
  tenantMemberships, tenants, refProvinces, refRegencies, refDistricts, refVillages,
} from "@jalajogja/db";
import {
  BadgeCheck, Phone, Mail, MessageCircle, MapPin,
  Globe, Building2, BookOpen, GraduationCap, User, Calendar,
  CreditCard, Hash,
} from "lucide-react";

type Params = Promise<{ tenant: string; id: string }>;

function gravatar(email: string) {
  const hash = createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?s=120&d=mp`;
}

function Section({ title, icon: Icon, children }: {
  title: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold border-b border-border pb-3">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-2 gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

const GENDER_LABEL: Record<string, string> = { male: "Laki-laki", female: "Perempuan" };
const DOMICILE_LABEL: Record<string, string> = { permanent: "Domisili Tetap", temporary: "Sementara / Perantau" };
const PERAN_LABEL: Record<string, string> = {
  alumni: "Alumni / Santri", pengajar: "Pengajar", pengurus: "Pengurus",
  pengasuh: "Pengasuh", pendiri: "Pendiri", lainnya: "Lainnya",
};

export default async function AnggotaProfilePage({ params }: { params: Params }) {
  const { tenant: slug, id: memberId } = await params;

  // ── Auth: wajib login ─────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect(`/${slug}/login?redirect=/${slug}/anggota/${memberId}`);

  // ── Pastikan yang melihat adalah pemilik profil ───────────────────────────
  const memberRow = await db.query.members.findFirst({
    where: eq(members.id, memberId),
    columns: {
      id: true, name: true, memberNumber: true, stambukNumber: true,
      nik: true, gender: true, birthDate: true, birthRegencyId: true,
      birthPlaceText: true, graduationYear: true, graduationPeriod: true,
      professionId: true, domicileStatus: true, betterAuthUserId: true,
      contactId: true, homeAddressId: true, socialMediaId: true,
    },
  });
  if (!memberRow) notFound();

  // Hanya pemilik yang bisa lihat halaman ini
  if (memberRow.betterAuthUserId !== session.user.id) {
    redirect(`/${slug}/akun`);
  }

  // ── Fetch semua data relasi ───────────────────────────────────────────────

  // Profesi
  const profession = memberRow.professionId
    ? await db.query.refProfessions.findFirst({
        where: eq(refProfessions.id, memberRow.professionId),
        columns: { name: true },
      })
    : null;

  // Tempat lahir (kabupaten)
  let birthPlaceDisplay: string | null = memberRow.birthPlaceText ?? null;
  if (!birthPlaceDisplay && memberRow.birthRegencyId) {
    const reg = await db.query.refRegencies.findFirst({
      where: eq(refRegencies.id, memberRow.birthRegencyId),
      columns: { name: true },
    });
    birthPlaceDisplay = reg?.name ?? null;
  }

  // Kontak (SEMUA — ini profil pribadi, no filter)
  const contact = memberRow.contactId
    ? await db.query.contacts.findFirst({
        where: eq(contacts.id, memberRow.contactId),
      })
    : null;

  // Alamat LENGKAP
  let addrDisplay: {
    detail: string | null; village: string | null; district: string | null;
    regency: string | null; province: string | null;
    postalCode: string | null; country: string | null;
  } | null = null;

  if (memberRow.homeAddressId) {
    const addr = await db.query.addresses.findFirst({
      where: eq(addresses.id, memberRow.homeAddressId),
    });
    if (addr) {
      const [prov, reg, dist, vil] = await Promise.all([
        addr.provinceId ? db.query.refProvinces.findFirst({ where: eq(refProvinces.id, addr.provinceId), columns: { name: true } }) : null,
        addr.regencyId  ? db.query.refRegencies.findFirst({ where: eq(refRegencies.id, addr.regencyId),  columns: { name: true } }) : null,
        addr.districtId ? db.query.refDistricts.findFirst({ where: eq(refDistricts.id, addr.districtId), columns: { name: true } }) : null,
        addr.villageId  ? db.query.refVillages.findFirst({ where: eq(refVillages.id, addr.villageId),   columns: { name: true } }) : null,
      ]);
      addrDisplay = {
        detail:    addr.detail     ?? null,
        village:   vil?.name       ?? null,
        district:  dist?.name      ?? null,
        regency:   reg?.name       ?? null,
        province:  prov?.name      ?? null,
        postalCode: addr.postalCode ?? null,
        country:   addr.country    ?? null,
      };
    }
  }

  // Sosial media
  const social = memberRow.socialMediaId
    ? await db.query.socialMedias.findFirst({ where: eq(socialMedias.id, memberRow.socialMediaId) })
    : null;

  // Keanggotaan di cabang ini
  const [tenant] = await db.select({ id: tenants.id, name: tenants.name })
    .from(tenants).where(eq(tenants.slug, slug)).limit(1);

  const [membership] = tenant
    ? await db
        .select({ status: tenantMemberships.status, joinedAt: tenantMemberships.joinedAt })
        .from(tenantMemberships)
        .where(eq(tenantMemberships.memberId, memberId))
        .limit(1)
    : [null];

  // Pendidikan
  const educations = await db
    .select()
    .from(memberEducations)
    .where(eq(memberEducations.memberId, memberId))
    .orderBy(memberEducations.startYear);

  // Pesantren
  const pesantrenList = await db
    .select({
      name:         pesantren.name,
      peran:        memberPesantren.peran,
      posisi:       memberPesantren.posisi,
      tahunMulai:   memberPesantren.tahunMulai,
      tahunSelesai: memberPesantren.tahunSelesai,
      isActive:     memberPesantren.isActive,
      catatan:      memberPesantren.catatan,
    })
    .from(memberPesantren)
    .innerJoin(pesantren, eq(pesantren.id, memberPesantren.pesantrenId))
    .where(eq(memberPesantren.memberId, memberId))
    .orderBy(memberPesantren.tahunMulai);

  // Usaha (dengan kontak + sosmed per usaha)
  const businesses = await db
    .select()
    .from(memberBusinesses)
    .where(eq(memberBusinesses.memberId, memberId));

  const businessDetails = await Promise.all(businesses.map(async b => {
    const [bContact, bSocial] = await Promise.all([
      b.contactId    ? db.query.contacts.findFirst({ where: eq(contacts.id, b.contactId) }) : null,
      b.socialMediaId ? db.query.socialMedias.findFirst({ where: eq(socialMedias.id, b.socialMediaId) }) : null,
    ]);
    return { ...b, contact: bContact, social: bSocial };
  }));

  const displayEmail = contact?.email ?? session.user.email;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-5">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <a href={`/${slug}/akun`} className="hover:text-foreground transition-colors">← Dashboard</a>
        <span>/</span>
        <span>Detail Profil</span>
      </div>

      {/* ── Header ── */}
      <div className="flex items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={gravatar(displayEmail ?? memberRow.name)}
          alt={memberRow.name}
          width={80} height={80}
          className="w-20 h-20 rounded-full ring-2 ring-border object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{memberRow.name}</h1>
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium mt-1">
            <BadgeCheck className="h-3 w-3" /> Anggota IKPM
          </span>
        </div>
        <a href={`/${slug}/akun/lengkapi`}
          className="text-xs text-primary hover:underline shrink-0">Edit →</a>
      </div>

      {/* ── Keanggotaan IKPM ── */}
      <Section title="Keanggotaan IKPM" icon={BadgeCheck}>
        <dl className="space-y-2">
          <Row label="No. ID IKPM Gontor" value={memberRow.memberNumber} />
          <Row label="No. Stambuk Gontor" value={memberRow.stambukNumber} />
          <Row label="NIK"              value={memberRow.nik} />
          <Row label="Cabang"           value={tenant?.name} />
          <Row label="Status"           value={membership?.status ? membership.status.charAt(0).toUpperCase() + membership.status.slice(1) : undefined} />
          <Row label="Bergabung"        value={membership?.joinedAt
            ? new Intl.DateTimeFormat("id-ID", { year:"numeric", month:"long", day:"numeric" }).format(new Date(membership.joinedAt))
            : undefined}
          />
        </dl>
      </Section>

      {/* ── Data Pribadi ── */}
      <Section title="Data Pribadi" icon={User}>
        <dl className="space-y-2">
          <Row label="Nama Lengkap"   value={memberRow.name} />
          <Row label="Jenis Kelamin"  value={memberRow.gender ? GENDER_LABEL[memberRow.gender] : undefined} />
          <Row label="Tanggal Lahir"  value={memberRow.birthDate
            ? new Intl.DateTimeFormat("id-ID", { year:"numeric", month:"long", day:"numeric" }).format(new Date(memberRow.birthDate))
            : undefined}
          />
          <Row label="Tempat Lahir"   value={birthPlaceDisplay} />
          <Row label="Tahun Lulus KMI" value={memberRow.graduationYear
            ? `${memberRow.graduationYear}${memberRow.graduationYear === 1999 && memberRow.graduationPeriod ? ` (${memberRow.graduationPeriod})` : ""}`
            : undefined}
          />
          <Row label="Profesi"         value={profession?.name} />
        </dl>
      </Section>

      {/* ── Kontak ── */}
      {(contact?.phone || contact?.whatsapp || contact?.email) && (
        <Section title="Kontak" icon={Phone}>
          <dl className="space-y-2">
            <Row label="Nomor HP"    value={contact?.phone} />
            <Row label="WhatsApp"    value={contact?.whatsapp} />
            <Row label="Email"       value={contact?.email} />
          </dl>
          <div className="pt-2 border-t border-border text-xs text-muted-foreground space-y-0.5">
            <p>Publik ke anggota lain: {[
              contact?.isPhonePublic    ? "HP"        : null,
              contact?.isWhatsappPublic ? "WhatsApp"  : null,
              contact?.isEmailPublic    ? "Email"     : null,
            ].filter(Boolean).join(", ") || "Tidak ada"}</p>
          </div>
        </Section>
      )}

      {/* ── Alamat ── */}
      {addrDisplay && (
        <Section title="Alamat Domisili" icon={MapPin}>
          <dl className="space-y-2">
            <Row label="Status Domisili" value={memberRow.domicileStatus ? DOMICILE_LABEL[memberRow.domicileStatus] : undefined} />
            {addrDisplay.country ? (
              <Row label="Negara" value={addrDisplay.country} />
            ) : (
              <>
                <Row label="Alamat"          value={addrDisplay.detail} />
                <Row label="Desa / Kelurahan" value={addrDisplay.village} />
                <Row label="Kecamatan"        value={addrDisplay.district} />
                <Row label="Kabupaten / Kota" value={addrDisplay.regency} />
                <Row label="Provinsi"         value={addrDisplay.province} />
                <Row label="Kode Pos"         value={addrDisplay.postalCode} />
              </>
            )}
          </dl>
        </Section>
      )}

      {/* ── Sosial Media ── */}
      {social && (social.instagram || social.facebook || social.twitter || social.linkedin || social.youtube || social.tiktok || social.website) && (
        <Section title="Media Sosial" icon={Globe}>
          <dl className="space-y-2">
            <Row label="Instagram" value={social.instagram ? `@${social.instagram}` : null} />
            <Row label="Facebook"  value={social.facebook} />
            <Row label="Twitter / X" value={social.twitter ? `@${social.twitter}` : null} />
            <Row label="LinkedIn"  value={social.linkedin} />
            <Row label="YouTube"   value={social.youtube} />
            <Row label="TikTok"    value={social.tiktok ? `@${social.tiktok}` : null} />
            <Row label="Website"   value={social.website} />
          </dl>
        </Section>
      )}

      {/* ── Riwayat Pendidikan ── */}
      {educations.length > 0 && (
        <Section title="Riwayat Pendidikan" icon={GraduationCap}>
          <div className="space-y-4">
            {educations.map((e, i) => (
              <div key={i} className="text-sm space-y-0.5 pb-3 border-b border-border last:border-0 last:pb-0">
                <p className="font-semibold">{e.level} — {e.institutionName}</p>
                {e.isGontor && e.gontorCampus && <p className="text-primary text-xs">{e.gontorCampus}</p>}
                {e.major && <p className="text-muted-foreground">{e.major}</p>}
                {(e.startYear || e.endYear) && (
                  <p className="text-xs text-muted-foreground">{e.startYear ?? "?"} – {e.endYear ?? "sekarang"}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Pesantren ── */}
      {pesantrenList.length > 0 && (
        <Section title="Pesantren" icon={BookOpen}>
          <div className="space-y-4">
            {pesantrenList.map((p, i) => (
              <div key={i} className="text-sm space-y-0.5 pb-3 border-b border-border last:border-0 last:pb-0">
                <p className="font-semibold">
                  {p.name}
                  {p.isActive && <span className="ml-2 text-xs text-primary">(Aktif)</span>}
                </p>
                <p className="text-muted-foreground">
                  {PERAN_LABEL[p.peran] ?? p.peran}
                  {p.posisi ? ` — ${p.posisi}` : ""}
                </p>
                {(p.tahunMulai || p.tahunSelesai) && (
                  <p className="text-xs text-muted-foreground">{p.tahunMulai ?? "?"} – {p.tahunSelesai ?? "sekarang"}</p>
                )}
                {p.catatan && <p className="text-xs text-muted-foreground italic">{p.catatan}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Usaha ── */}
      {businessDetails.length > 0 && (
        <Section title="Usaha & Bisnis" icon={Building2}>
          <div className="space-y-4">
            {businessDetails.map((b, i) => (
              <div key={i} className="text-sm space-y-1.5 pb-4 border-b border-border last:border-0 last:pb-0">
                <p className="font-semibold">
                  {b.name}
                  {b.brand && <span className="text-muted-foreground font-normal ml-1.5">({b.brand})</span>}
                </p>
                <p className="text-xs text-muted-foreground">{b.category} · {b.sector}</p>
                {b.position  && <p className="text-xs">Jabatan: {b.position}</p>}
                {b.employees && <p className="text-xs text-muted-foreground">Karyawan: {b.employees}</p>}
                {b.revenue   && <p className="text-xs text-muted-foreground">Omzet: {b.revenue}</p>}
                {(b.contact?.phone || b.contact?.email) && (
                  <div className="space-y-0.5 pt-1">
                    <Row label="Telepon" value={b.contact?.phone} />
                    <Row label="Email"   value={b.contact?.email} />
                  </div>
                )}
                {(b.social?.instagram || b.social?.website) && (
                  <div className="space-y-0.5">
                    {b.social?.instagram && <Row label="Instagram" value={`@${b.social.instagram}`} />}
                    {b.social?.website   && <Row label="Website"   value={b.social.website} />}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Link edit ── */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <a href={`/${slug}/akun/lengkapi`} className="rounded-xl border border-border p-3 text-center text-sm hover:bg-muted/40 transition-colors">
          Edit Data Pribadi
        </a>
        <a href={`/${slug}/akun/pesantren`} className="rounded-xl border border-border p-3 text-center text-sm hover:bg-muted/40 transition-colors">
          Edit Data Pesantren
        </a>
        <a href={`/${slug}/akun/usaha`} className="rounded-xl border border-border p-3 text-center text-sm hover:bg-muted/40 transition-colors">
          Edit Data Usaha
        </a>
        <a href={`/${slug}/akun`} className="rounded-xl border border-border p-3 text-center text-sm hover:bg-muted/40 transition-colors text-muted-foreground">
          ← Dashboard
        </a>
      </div>
    </div>
  );
}
