import { useCallback, useState } from 'react'
import { Github, KeyRound, Globe, Bot, Check, ChevronRight, SkipForward } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { authManager } from '@/lib/auth/manager'
import { AuthLevel } from '@/lib/auth/types'

interface OnboardingWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = 'github' | 'atlassian' | 'google' | 'llm'

const STEPS: { id: Step; label: string; optional: boolean; rhOnly?: boolean }[] = [
  { id: 'github', label: 'GitHub', optional: false },
  { id: 'atlassian', label: 'Atlassian', optional: true },
  { id: 'google', label: 'Google / Vertex AI', optional: true, rhOnly: true },
  { id: 'llm', label: 'LLM Provider', optional: false },
]

function StepIcon({ step }: { step: Step }) {
  switch (step) {
    case 'github':
      return <Github className="h-5 w-5" />
    case 'atlassian':
      return <Globe className="h-5 w-5" />
    case 'google':
      return <KeyRound className="h-5 w-5" />
    case 'llm':
      return <Bot className="h-5 w-5" />
  }
}

function StepDescription({ step }: { step: Step }) {
  switch (step) {
    case 'github':
      return (
        <p className="text-sm text-muted-foreground">
          Connect your GitHub account to access repositories, create branches,
          and manage pull requests directly from Aegis.
        </p>
      )
    case 'atlassian':
      return (
        <p className="text-sm text-muted-foreground">
          Link your Atlassian account to sync Jira boards and access
          Confluence documentation. This step is optional.
        </p>
      )
    case 'google':
      return (
        <p className="text-sm text-muted-foreground">
          Connect your Google account to enable Vertex AI models. This step is
          available only for Red Hat employees.
        </p>
      )
    case 'llm':
      return (
        <p className="text-sm text-muted-foreground">
          Select which AI provider and model to use for chat assistance. You can
          change this later in Settings.
        </p>
      )
  }
}

export function OnboardingWizard({ open, onOpenChange }: OnboardingWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set())

  const isRHEmployee = authManager.getAuthLevel() === AuthLevel.RedHatSSO

  const visibleSteps = STEPS.filter(
    (step) => !step.rhOnly || isRHEmployee,
  )

  const currentStep = visibleSteps[currentStepIndex]
  const isLastStep = currentStepIndex === visibleSteps.length - 1
  const totalSteps = visibleSteps.length

  const handleConnect = useCallback(() => {
    if (!currentStep) return
    // Placeholder for the actual OAuth flow initiation.
    console.info(`[Onboarding] Connect flow for ${currentStep.id} not yet wired`)
    setCompletedSteps((prev) => new Set([...prev, currentStep.id]))
  }, [currentStep])

  const handleNext = useCallback(() => {
    if (isLastStep) {
      onOpenChange(false)
      setCurrentStepIndex(0)
      setCompletedSteps(new Set())
    } else {
      setCurrentStepIndex((prev) => prev + 1)
    }
  }, [isLastStep, onOpenChange])

  const handleSkip = useCallback(() => {
    handleNext()
  }, [handleNext])

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (!value) {
        setCurrentStepIndex(0)
        setCompletedSteps(new Set())
      }
      onOpenChange(value)
    },
    [onOpenChange],
  )

  if (!currentStep) return null

  const isStepComplete = completedSteps.has(currentStep.id)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Your Accounts</DialogTitle>
          <DialogDescription>
            Step {currentStepIndex + 1} of {totalSteps}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center gap-1.5">
          {visibleSteps.map((step, index) => (
            <div
              key={step.id}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                index < currentStepIndex
                  ? 'bg-primary'
                  : index === currentStepIndex
                    ? 'bg-primary/60'
                    : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <Separator />

        {/* Step content */}
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <StepIcon step={currentStep.id} />
            </div>
            <div>
              <p className="font-medium text-foreground">{currentStep.label}</p>
              {currentStep.optional && (
                <Badge variant="secondary" className="mt-0.5">
                  Optional
                </Badge>
              )}
            </div>
          </div>

          <StepDescription step={currentStep.id} />

          {isStepComplete ? (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-700 dark:text-green-300">
                {currentStep.label} connected successfully
              </p>
            </div>
          ) : (
            <Button className="w-full" onClick={handleConnect}>
              <StepIcon step={currentStep.id} />
              Connect {currentStep.label}
            </Button>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          {currentStep.optional && !isStepComplete ? (
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              <SkipForward className="mr-1 h-3.5 w-3.5" />
              Skip
            </Button>
          ) : (
            <div />
          )}
          <Button
            variant={isLastStep ? 'default' : 'outline'}
            size="sm"
            onClick={handleNext}
          >
            {isLastStep ? 'Finish' : 'Next'}
            {!isLastStep && <ChevronRight className="ml-1 h-3.5 w-3.5" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
