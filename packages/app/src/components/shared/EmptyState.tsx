/**
 * EmptyState -- reusable contextual empty state component.
 *
 * Displays a friendly message with an icon, title, description, and
 * an optional CTA button when a view has no content to show. Variants
 * control the icon and visual tone:
 *   - info:          general informational empty state
 *   - auth-required: prompts the user to connect a provider
 *   - no-data:       no results match the current filters/configuration
 *   - error:         something went wrong (non-fatal)
 */

import type { ReactNode } from 'react'
import {
  Info,
  LogIn,
  Inbox,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type EmptyStateVariant = 'info' | 'auth-required' | 'no-data' | 'error'

const VARIANT_ICONS: Record<EmptyStateVariant, LucideIcon> = {
  info: Info,
  'auth-required': LogIn,
  'no-data': Inbox,
  error: AlertCircle,
}

const VARIANT_ICON_COLORS: Record<EmptyStateVariant, string> = {
  info: 'text-primary',
  'auth-required': 'text-primary',
  'no-data': 'text-muted-foreground',
  error: 'text-destructive',
}

export interface EmptyStateAction {
  label: string
  onClick: () => void
  variant?: 'default' | 'outline' | 'secondary' | 'ghost'
}

export interface EmptyStateProps {
  /** Icon variant controls the default icon and color */
  variant?: EmptyStateVariant
  /** Override the default icon */
  icon?: LucideIcon
  /** Main heading */
  title: string
  /** Supporting description text */
  description?: string
  /** Primary CTA button */
  action?: EmptyStateAction
  /** Additional content below the description (e.g. suggested prompts) */
  children?: ReactNode
  /** Additional CSS class names */
  className?: string
}

export function EmptyState({
  variant = 'info',
  icon,
  title,
  description,
  action,
  children,
  className,
}: EmptyStateProps) {
  const Icon = icon ?? VARIANT_ICONS[variant]
  const iconColor = VARIANT_ICON_COLORS[variant]

  return (
    <Card
      className={cn(
        'mx-auto max-w-md border-dashed',
        className,
      )}
      role="status"
      aria-label={title}
    >
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        <Icon
          className={cn('h-12 w-12', iconColor)}
          aria-hidden="true"
        />

        <div className="space-y-1.5">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>

        {children}

        {action && (
          <Button
            variant={action.variant ?? 'default'}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
