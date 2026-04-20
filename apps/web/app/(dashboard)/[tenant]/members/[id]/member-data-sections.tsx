"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PlusIcon, BookOpen, Briefcase, School } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Step3Education, type EducationEntry } from "@/components/members/wizard/step3-education"
import { Step4Business, type BusinessEntry } from "@/components/members/wizard/step4-business"
import { Step5Pesantren, type PesantrenEntry } from "@/components/members/wizard/step5-pesantren"

// ─── Types untuk props (data dari server) ────────────────────────────────────

export type EduRow = {
  id: string
  level: string
  institutionName: string
  major: string | null
  startYear: number | null
  endYear: number | null
  isGontor: boolean
  gontorCampus: string | null
}

export type BizRow = {
  id: string
  name: string
  brand: string | null
  description: string | null
  category: string | null
  sector: string | null
  legality: string | null
  position: string | null
  employees: string | null
  branches: string | null
  revenue: string | null
  bizPhone: string | null
  bizWhatsapp: string | null
  bizEmail: string | null
  bizAddrDetail: string | null
  bizAddrPostal: string | null
  bizDistrictName: string | null
  bizRegencyName: string | null
  bizProvinceName: string | null
  bizInstagram: string | null
  bizFacebook: string | null
  bizLinkedin: string | null
  bizTwitter: string | null
  bizYoutube: string | null
  bizTiktok: string | null
  bizWebsite: string | null
}

export type PesantrenRow = {
  id: string
  pesantrenId: string
  pesantrenName: string
  peran: string
  posisi: string | null
  tahunMulai: number | null
  tahunSelesai: number | null
  catatan: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, onAdd }: {
  icon: React.ElementType; title: string; onAdd: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4" /> {title}
      </h2>
      <Button type="button" variant="outline" size="sm" onClick={onAdd} className="gap-1.5">
        <PlusIcon className="size-3.5" /> Tambah
      </Button>
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="grid grid-cols-3 gap-2 py-2 border-b last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="col-span-2 text-sm font-medium">{value}</dd>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="py-6 text-center text-sm text-muted-foreground italic">{label}</p>
  )
}

// ─── Section: Riwayat Pendidikan ──────────────────────────────────────────────

export function EducationSection({
  memberId, slug, educations,
}: { memberId: string; slug: string; educations: EduRow[] }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)

  const defaultEntries: EducationEntry[] = educations.map((e) => ({
    id: e.id,
    level: e.level,
    institutionName: e.institutionName,
    major: e.major ?? "",
    startYear: e.startYear?.toString() ?? "",
    endYear: e.endYear?.toString() ?? "",
    isGontor: e.isGontor,
    gontorCampus: e.gontorCampus ?? "",
  }))

  function handleSuccess() {
    setOpen(false)
    router.refresh()
  }

  return (
    <section className="rounded-xl border bg-card p-5 mb-4">
      <SectionHeader icon={BookOpen} title="Riwayat Pendidikan" onAdd={() => setOpen(true)} />

      {educations.length === 0 ? (
        <EmptyState label="Belum ada riwayat pendidikan." />
      ) : (
        <div className="space-y-4">
          {educations.map((edu, i) => (
            <div key={edu.id} className={i > 0 ? "border-t pt-4" : ""}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{edu.institutionName}</p>
                  <p className="text-xs text-muted-foreground">
                    {edu.level}{edu.major ? ` — ${edu.major}` : ""}
                  </p>
                  {(edu.startYear || edu.endYear) && (
                    <p className="text-xs text-muted-foreground">
                      {edu.startYear ?? "?"} – {edu.endYear ?? "sekarang"}
                    </p>
                  )}
                </div>
                {edu.isGontor && (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    {edu.gontorCampus ?? "Gontor"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kelola Riwayat Pendidikan</DialogTitle>
          </DialogHeader>
          <Step3Education
            memberId={memberId}
            slug={slug}
            onSuccess={handleSuccess}
            defaultEntries={defaultEntries}
          />
          <DialogFooter className="pt-2 border-t">
            <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" form="wizard-step-3-form">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

// ─── Section: Data Usaha ──────────────────────────────────────────────────────

export function BusinessSection({
  memberId, slug, businesses,
}: { memberId: string; slug: string; businesses: BizRow[] }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)

  const defaultEntries: BusinessEntry[] = businesses.map((b) => ({
    id: b.id,
    name: b.name,
    brand: b.brand ?? "",
    description: b.description ?? "",
    category: b.category ?? "",
    sector: b.sector ?? "",
    legality: b.legality ?? "",
    position: b.position ?? "",
    employees: b.employees ?? "",
    branches: b.branches ?? "",
    revenue: b.revenue ?? "",
    addressCountry: "",
    provinceId: null,
    regencyId: null,
    districtId: null,
    villageId: null,
    addressDetail: b.bizAddrDetail ?? "",
    postalCode: b.bizAddrPostal ?? "",
    phone: b.bizPhone ?? "",
    whatsapp: b.bizWhatsapp ?? "",
    email: b.bizEmail ?? "",
    instagram: b.bizInstagram ?? "",
    facebook: b.bizFacebook ?? "",
    linkedin: b.bizLinkedin ?? "",
    twitter: b.bizTwitter ?? "",
    youtube: b.bizYoutube ?? "",
    tiktok: b.bizTiktok ?? "",
    website: b.bizWebsite ?? "",
  }))

  function handleSuccess() {
    setOpen(false)
    router.refresh()
  }

  return (
    <section className="rounded-xl border bg-card p-5 mb-4">
      <SectionHeader icon={Briefcase} title="Data Usaha" onAdd={() => setOpen(true)} />

      {businesses.length === 0 ? (
        <EmptyState label="Belum ada data usaha." />
      ) : (
        <div className="space-y-6">
          {businesses.map((biz, i) => {
            const bizSocials = [
              { label: "Instagram", value: biz.bizInstagram },
              { label: "Facebook",  value: biz.bizFacebook },
              { label: "LinkedIn",  value: biz.bizLinkedin },
              { label: "Twitter/X", value: biz.bizTwitter },
              { label: "YouTube",   value: biz.bizYoutube },
              { label: "TikTok",    value: biz.bizTiktok },
              { label: "Website",   value: biz.bizWebsite },
            ].filter((s) => s.value)

            return (
              <div key={biz.id} className={i > 0 ? "border-t pt-6" : ""}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {biz.name}
                      {biz.brand && <span className="font-normal text-muted-foreground"> ({biz.brand})</span>}
                    </p>
                    {biz.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{biz.description}</p>
                    )}
                  </div>
                  {biz.position && (
                    <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                      {biz.position}
                    </span>
                  )}
                </div>
                <dl>
                  <Row label="Kategori"  value={biz.category} />
                  <Row label="Sektor"    value={biz.sector} />
                  <Row label="Legalitas" value={biz.legality} />
                  <Row label="Karyawan"  value={biz.employees} />
                  <Row label="Cabang"    value={biz.branches} />
                  <Row label="Omzet"     value={biz.revenue} />
                  <Row label="Detail Alamat" value={biz.bizAddrDetail} />
                  <Row label="Kab / Kota"    value={biz.bizRegencyName} />
                  <Row label="Provinsi"      value={biz.bizProvinceName} />
                  <Row label="Telepon"   value={biz.bizPhone} />
                  <Row label="WhatsApp"  value={biz.bizWhatsapp} />
                  <Row label="Email"     value={biz.bizEmail} />
                  {bizSocials.map((s) => (
                    <Row key={s.label} label={s.label} value={s.value} />
                  ))}
                </dl>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kelola Data Usaha</DialogTitle>
          </DialogHeader>
          <Step4Business
            memberId={memberId}
            slug={slug}
            onSuccess={handleSuccess}
            defaultEntries={defaultEntries}
          />
          <DialogFooter className="pt-2 border-t">
            <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" form="wizard-step-4-form">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

// ─── Section: Data Pesantren ──────────────────────────────────────────────────

const PERAN_LABEL: Record<string, string> = {
  pengasuh: "Pengasuh",
  pendiri:  "Pendiri",
  pengurus: "Pengurus",
  pengajar: "Pengajar / Ustadz",
  alumni:   "Alumni / Santri",
  lainnya:  "Lainnya",
}

export function PesantrenSection({
  memberId, slug, pesantrenList,
}: { memberId: string; slug: string; pesantrenList: PesantrenRow[] }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)

  const defaultEntries: PesantrenEntry[] = pesantrenList.map((p) => ({
    id: p.id,
    pesantrenId: p.pesantrenId,
    pesantrenName: p.pesantrenName,
    peran: p.peran,
    posisi: p.posisi ?? "",
    tahunMulai: p.tahunMulai?.toString() ?? "",
    tahunSelesai: p.tahunSelesai?.toString() ?? "",
    catatan: p.catatan ?? "",
  }))

  function handleSuccess() {
    setOpen(false)
    router.refresh()
  }

  return (
    <section className="rounded-xl border bg-card p-5 mb-4">
      <SectionHeader icon={School} title="Pesantren" onAdd={() => setOpen(true)} />

      {pesantrenList.length === 0 ? (
        <EmptyState label="Belum ada data pesantren." />
      ) : (
        <div className="space-y-4">
          {pesantrenList.map((p, i) => (
            <div key={p.id} className={i > 0 ? "border-t pt-4" : ""}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{p.pesantrenName}</p>
                  <p className="text-xs text-muted-foreground">
                    {PERAN_LABEL[p.peran] ?? p.peran}
                    {p.posisi ? ` — ${p.posisi}` : ""}
                  </p>
                  {(p.tahunMulai || p.tahunSelesai) && (
                    <p className="text-xs text-muted-foreground">
                      {p.tahunMulai ?? "?"} – {p.tahunSelesai ?? "sekarang"}
                    </p>
                  )}
                  {p.catatan && (
                    <p className="mt-1 text-xs text-muted-foreground italic">{p.catatan}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kelola Data Pesantren</DialogTitle>
          </DialogHeader>
          <Step5Pesantren
            memberId={memberId}
            slug={slug}
            onSuccess={handleSuccess}
            defaultEntries={defaultEntries}
          />
          <DialogFooter className="pt-2 border-t">
            <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" form="wizard-step-5-form">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
