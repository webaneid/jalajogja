"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Step1Identity, type Step1DefaultValues } from "./wizard/step1-identity"
import { Step2Contact, type Step2DefaultValues } from "./wizard/step2-contact"
import { Step3Education, type EducationEntry } from "./wizard/step3-education"
import { Step4Business, type BusinessEntry } from "./wizard/step4-business"
import type { RefProfession } from "@jalajogja/db"

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberEditShellProps {
  memberId: string
  slug: string
  tenantId: string
  tenantName: string
  professions: RefProfession[]
  defaultStep1: Step1DefaultValues
  defaultStep2: Step2DefaultValues
  defaultEducations: EducationEntry[]
  defaultBusinesses: BusinessEntry[]
}

type TabId = "identitas" | "kontak" | "pendidikan" | "usaha"

const TABS: { id: TabId; label: string; formId: string }[] = [
  { id: "identitas",  label: "Identitas",        formId: "wizard-step-1-form" },
  { id: "kontak",     label: "Kontak & Alamat",  formId: "wizard-step-2-form" },
  { id: "pendidikan", label: "Pendidikan",        formId: "wizard-step-3-form" },
  { id: "usaha",      label: "Data Usaha",        formId: "wizard-step-4-form" },
]

// ─── MemberEditShell ──────────────────────────────────────────────────────────

export function MemberEditShell({
  memberId,
  slug,
  tenantId,
  tenantName,
  professions,
  defaultStep1,
  defaultStep2,
  defaultEducations,
  defaultBusinesses,
}: MemberEditShellProps) {
  const [activeTab, setActiveTab] = React.useState<TabId>("identitas")
  const [savedTabs, setSavedTabs] = React.useState<Set<TabId>>(new Set())
  const [savingTab, setSavingTab] = React.useState<TabId | null>(null)

  function handleSuccess(_memberId?: string | undefined) {
    setSavedTabs((prev) => new Set([...prev, activeTab]))
    setSavingTab(null)
    // Auto-clear "saved" indicator setelah 3 detik
    setTimeout(() => {
      setSavedTabs((prev) => {
        const next = new Set(prev)
        next.delete(activeTab)
        return next
      })
    }, 3000)
  }

  function handleSaveClick() {
    setSavingTab(activeTab)
    // Trigger form submit via form attribute — form akan memanggil handleSuccess via onSuccess
    const btn = document.getElementById(`edit-save-trigger-${activeTab}`) as HTMLButtonElement | null
    btn?.click()
  }

  return (
    <div className="space-y-6">
      {/* ── Tab Nav ── */}
      <div className="flex border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {savedTabs.has(tab.id) && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                <CheckIcon className="size-2.5" />
                Tersimpan
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div>
        {activeTab === "identitas" && (
          <Step1Identity
            slug={slug}
            professions={professions}
            memberId={memberId}
            defaultValues={defaultStep1}
            onSuccess={(id) => handleSuccess(id)}
          />
        )}
        {activeTab === "kontak" && (
          <Step2Contact
            memberId={memberId}
            slug={slug}
            tenantId={tenantId}
            tenantName={tenantName}
            defaultValues={defaultStep2}
            onSuccess={() => handleSuccess()}
          />
        )}
        {activeTab === "pendidikan" && (
          <Step3Education
            memberId={memberId}
            slug={slug}
            defaultEntries={defaultEducations}
            onSuccess={() => handleSuccess()}
          />
        )}
        {activeTab === "usaha" && (
          <Step4Business
            memberId={memberId}
            slug={slug}
            defaultEntries={defaultBusinesses}
            onSuccess={() => handleSuccess()}
          />
        )}
      </div>

      {/* ── Save Button Area ── */}
      <div className="flex items-center justify-between border-t pt-4">
        <div className="flex gap-2">
          {TABS.map((tab) => {
            if (tab.id !== activeTab) return null
            return (
              // Hidden submit trigger yang dihubungkan ke form via form attribute
              <button
                key={tab.id}
                id={`edit-save-trigger-${tab.id}`}
                type="submit"
                form={tab.formId}
                className="hidden"
                aria-hidden="true"
              />
            )
          })}
        </div>
        <button
          type="button"
          onClick={handleSaveClick}
          disabled={savingTab === activeTab}
          className={cn(
            "flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-colors",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "disabled:pointer-events-none disabled:opacity-60"
          )}
        >
          {savingTab === activeTab ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </div>
    </div>
  )
}
