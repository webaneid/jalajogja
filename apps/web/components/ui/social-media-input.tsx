"use client"

import * as React from "react"
import { Globe } from "lucide-react"

// ─── Tipe data ────────────────────────────────────────────────────────────────

export interface SocialMediaValue {
  instagram: string
  facebook:  string
  linkedin:  string
  twitter:   string
  youtube:   string
  tiktok:    string
  website:   string
}

export const SOCIAL_MEDIA_EMPTY: SocialMediaValue = {
  instagram: "", facebook: "", linkedin: "",
  twitter:   "", youtube:  "", tiktok:  "", website: "",
}

// ─── Platform definitions ─────────────────────────────────────────────────────

const PLATFORMS = [
  { key: "instagram" as const, label: "Instagram",   placeholder: "username (tanpa @)",    hint: "Format: username tanpa @",              inputType: "text", icon: null,  fullWidth: false },
  { key: "facebook"  as const, label: "Facebook",    placeholder: "URL atau nama halaman",  hint: "URL halaman atau nama halaman",          inputType: "text", icon: null,  fullWidth: false },
  { key: "twitter"   as const, label: "Twitter / X", placeholder: "username (tanpa @)",    hint: "Format: username tanpa @",              inputType: "text", icon: null,  fullWidth: false },
  { key: "tiktok"    as const, label: "TikTok",      placeholder: "username (tanpa @)",    hint: "Format: username tanpa @",              inputType: "text", icon: null,  fullWidth: false },
  { key: "linkedin"  as const, label: "LinkedIn",    placeholder: "URL profil lengkap",    hint: "URL profil atau halaman perusahaan",    inputType: "url",  icon: null,  fullWidth: false },
  { key: "youtube"   as const, label: "YouTube",     placeholder: "URL channel",           hint: "URL channel YouTube",                  inputType: "url",  icon: null,  fullWidth: false },
  { key: "website"   as const, label: "Website",     placeholder: "https://...",           hint: "URL lengkap dengan https://",          inputType: "url",  icon: Globe, fullWidth: true  },
] as const

const inputCls =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

// ─── Komponen ─────────────────────────────────────────────────────────────────

export function SocialMediaInput({
  value,
  onChange,
  disabled = false,
}: {
  value: SocialMediaValue
  onChange: (val: SocialMediaValue) => void
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {PLATFORMS.map(({ key, label, placeholder, hint, inputType, icon: Icon, fullWidth }) => (
        <div key={key} className={`flex flex-col gap-1.5${fullWidth ? " sm:col-span-2" : ""}`}>
          <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            {Icon && <Icon className="size-3.5 text-muted-foreground" />}
            {label}
            <span className="font-normal text-muted-foreground">(opsional)</span>
          </label>
          <input
            type={inputType}
            value={value[key]}
            onChange={e => onChange({ ...value, [key]: e.target.value })}
            placeholder={placeholder}
            disabled={disabled}
            className={inputCls}
          />
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      ))}
    </div>
  )
}
