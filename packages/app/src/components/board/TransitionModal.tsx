/**
 * TransitionModal — dialog for transitions that require additional fields.
 *
 * When a drag-and-drop transition has `hasScreen: true`, the board opens
 * this modal so the user can fill in required fields (resolution, comment,
 * etc.) before the transition is executed.
 *
 * The transition's `fields` object describes required and optional fields,
 * along with their allowed values. This component renders a simple form
 * and calls the transition mutation on submit, or rolls back the
 * optimistic update on cancel.
 */

import { Loader2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { JiraTransition, JiraTransitionField } from '@/lib/jira/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransitionModalProps {
  open: boolean
  issueKey: string
  transition: JiraTransition
  onSubmit: (fields: Record<string, unknown>) => Promise<void>
  onCancel: () => void
}

interface FieldEntry {
  fieldId: string
  meta: JiraTransitionField
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransitionModal({ open, issueKey, transition, onSubmit, onCancel }: TransitionModalProps) {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Extract the fields that need user input
  const fields = useMemo<FieldEntry[]>(() => {
    if (!transition.fields) return []
    return Object.entries(transition.fields).map(([fieldId, meta]) => ({
      fieldId,
      meta,
    }))
  }, [transition.fields])

  const requiredFields = useMemo(() => fields.filter((f) => f.meta.required), [fields])

  const isValid = useMemo(() => {
    return requiredFields.every((f) => {
      const val = fieldValues[f.fieldId]
      return val !== undefined && val.trim() !== ''
    })
  }, [requiredFields, fieldValues])

  const updateField = useCallback((fieldId: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!isValid) return
    setSubmitting(true)
    setError(null)

    try {
      // Build the fields payload. For fields with allowedValues (like
      // resolution), send as { id: value }. For free-text, send as string.
      const payload: Record<string, unknown> = {}
      for (const { fieldId, meta } of fields) {
        const value = fieldValues[fieldId]
        if (value === undefined || value.trim() === '') continue

        if (meta.allowedValues && meta.allowedValues.length > 0) {
          payload[fieldId] = { id: value }
        } else {
          payload[fieldId] = value
        }
      }

      await onSubmit(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute transition')
      setSubmitting(false)
    }
  }, [isValid, fields, fieldValues, onSubmit])

  const handleCancel = useCallback(() => {
    setFieldValues({})
    setError(null)
    setSubmitting(false)
    onCancel()
  }, [onCancel])

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleCancel()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {transition.name} &mdash; {issueKey}
          </DialogTitle>
          <DialogDescription>
            This transition requires additional information before it can be completed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground">No additional fields are needed for this transition.</p>
          )}

          {fields.map(({ fieldId, meta }) => (
            <div key={fieldId} className="flex flex-col gap-1.5">
              <label htmlFor={`transition-field-${fieldId}`} className="text-sm font-medium text-foreground">
                {meta.name}
                {meta.required && <span className="ml-1 text-red-500">*</span>}
              </label>

              {meta.allowedValues && meta.allowedValues.length > 0 ? (
                <select
                  id={`transition-field-${fieldId}`}
                  value={fieldValues[fieldId] ?? ''}
                  onChange={(e) => updateField(fieldId, e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">Select...</option>
                  {meta.allowedValues.map((av) => (
                    <option key={av.id} value={av.id}>
                      {av.name}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id={`transition-field-${fieldId}`}
                  value={fieldValues[fieldId] ?? ''}
                  onChange={(e) => updateField(fieldId, e.target.value)}
                  placeholder={`Enter ${meta.name.toLowerCase()}...`}
                  className="h-9 text-sm"
                />
              )}
            </div>
          ))}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {transition.name}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
