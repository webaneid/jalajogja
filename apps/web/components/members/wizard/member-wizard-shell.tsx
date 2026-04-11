"use client"

import { MemberWizard } from "./member-wizard"
import { Step1Identity } from "./step1-identity"
import { Step2Contact } from "./step2-contact"
import { Step3Education } from "./step3-education"
import { Step4Business } from "./step4-business"
import type { RefProfession } from "@jalajogja/db"

interface MemberWizardShellProps {
  slug: string
  tenantId: string
  tenantName: string
  professions: RefProfession[]
}

export function MemberWizardShell({
  slug,
  tenantId,
  tenantName,
  professions,
}: MemberWizardShellProps) {
  return (
    <MemberWizard slug={slug}>
      {({ currentStep, memberId, onStep1Success, onStepSuccess }) => (
        <>
          {currentStep === 1 && (
            <Step1Identity
              slug={slug}
              professions={professions}
              onSuccess={onStep1Success}
            />
          )}
          {currentStep === 2 && memberId && (
            <Step2Contact
              memberId={memberId}
              slug={slug}
              tenantId={tenantId}
              tenantName={tenantName}
              onSuccess={onStepSuccess}
            />
          )}
          {currentStep === 3 && memberId && (
            <Step3Education
              memberId={memberId}
              slug={slug}
              onSuccess={onStepSuccess}
            />
          )}
          {currentStep === 4 && memberId && (
            <Step4Business
              memberId={memberId}
              slug={slug}
              onSuccess={onStepSuccess}
            />
          )}
        </>
      )}
    </MemberWizard>
  )
}
