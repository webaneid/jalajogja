"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// ─── Konfigurasi tiap step ────────────────────────────────────────────────────

const STEPS = [
  { number: 1, label: "Identitas" },
  { number: 2, label: "Kontak & Alamat" },
  { number: 3, label: "Pendidikan" },
  { number: 4, label: "Usaha" },
] as const

type StepNumber = 1 | 2 | 3 | 4

// ─── Props ────────────────────────────────────────────────────────────────────

interface MemberWizardProps {
  slug: string
  /** Konten tiap step — di-render oleh parent, diteruskan via children map */
  children: (context: WizardContext) => React.ReactNode
}

/** Konteks yang diberikan ke children (render prop) */
export interface WizardContext {
  currentStep: StepNumber
  memberId: string | null
  /** Step 1 selesai → isi memberId, lanjut ke step 2 */
  onStep1Success: (memberId: string) => void
  /** Step 2-4 selesai (simpan) → lanjut ke step berikutnya */
  onStepSuccess: () => void
}

// ─── Stepper indicator ────────────────────────────────────────────────────────

function StepIndicator({
  currentStep,
}: {
  currentStep: StepNumber
}) {
  return (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((step, index) => {
        const isCompleted = step.number < currentStep
        const isActive = step.number === currentStep
        const isUpcoming = step.number > currentStep

        return (
          <React.Fragment key={step.number}>
            {/* Lingkaran + label */}
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                  isCompleted &&
                    "border-green-500 bg-green-500 text-white",
                  isActive &&
                    "border-primary bg-primary text-primary-foreground",
                  isUpcoming &&
                    "border-muted-foreground/30 bg-background text-muted-foreground/50"
                )}
              >
                {isCompleted ? (
                  <CheckIcon className="size-4" />
                ) : (
                  step.number
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium leading-tight text-center max-w-[72px]",
                  isCompleted && "text-green-600",
                  isActive && "text-foreground",
                  isUpcoming && "text-muted-foreground/50"
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Garis penghubung (kecuali setelah step terakhir) */}
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-2 mb-5 transition-colors",
                  step.number < currentStep
                    ? "bg-green-500"
                    : "bg-muted-foreground/20"
                )}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── Navigasi bawah ───────────────────────────────────────────────────────────

interface WizardNavProps {
  currentStep: StepNumber
  memberId: string | null
  onBack: () => void
  onSkip: () => void
  /** ID form yang di-submit saat klik "Lanjut / Simpan & Lanjut" */
  submitFormId: string
  isLastStep: boolean
}

function WizardNav({
  currentStep,
  onBack,
  onSkip,
  submitFormId,
  isLastStep,
}: WizardNavProps) {
  if (currentStep === 1) {
    return (
      <div className="flex justify-end pt-4 border-t">
        <Button type="submit" form={submitFormId}>
          Lanjut →
        </Button>
      </div>
    )
  }

  return (
    <div className="flex justify-between pt-4 border-t">
      <Button type="button" variant="outline" onClick={onBack}>
        ← Sebelumnya
      </Button>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onSkip}>
          {isLastStep ? "Lewati" : "Lewati →"}
        </Button>
        <Button type="submit" form={submitFormId}>
          {isLastStep ? "Simpan & Selesai" : "Simpan & Lanjut →"}
        </Button>
      </div>
    </div>
  )
}

// ─── Komponen utama ───────────────────────────────────────────────────────────

export function MemberWizard({ slug, children }: MemberWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = React.useState<StepNumber>(1)
  const [memberId, setMemberId] = React.useState<string | null>(null)

  // Step 1 selesai: simpan memberId, maju ke step 2
  function handleStep1Success(newMemberId: string) {
    setMemberId(newMemberId)
    setCurrentStep(2)
  }

  // Step 2-3 selesai: maju ke step berikutnya
  function handleStepSuccess() {
    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as StepNumber)
    } else {
      // Step 4 selesai
      finishWizard()
    }
  }

  // Lewati step (step 2-4)
  function handleSkip() {
    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as StepNumber)
    } else {
      finishWizard()
    }
  }

  // Kembali ke step sebelumnya
  function handleBack() {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as StepNumber)
    }
  }

  // Selesai — redirect ke halaman detail anggota
  function finishWizard() {
    if (memberId) {
      router.push(`/${slug}/members/${memberId}`)
    }
  }

  // ID form per step — digunakan oleh tombol submit di WizardNav
  const formId = `wizard-step-${currentStep}-form`
  const isLastStep = currentStep === 4

  return (
    <div className="max-w-2xl mx-auto">
      {/* Stepper visual */}
      <StepIndicator currentStep={currentStep} />

      {/* Konten step — render prop pattern */}
      <div className="min-h-[320px]">
        {children({
          currentStep,
          memberId,
          onStep1Success: handleStep1Success,
          onStepSuccess: handleStepSuccess,
        })}
      </div>

      {/* Navigasi bawah */}
      <WizardNav
        currentStep={currentStep}
        memberId={memberId}
        onBack={handleBack}
        onSkip={handleSkip}
        submitFormId={formId}
        isLastStep={isLastStep}
      />
    </div>
  )
}
