/**
 * Toaster — global toast notification renderer.
 *
 * Reads from the toast Zustand store and renders stacked notifications
 * in the bottom-right corner. Supports success (green), error (red),
 * and info (blue) types with auto-dismiss and manual close.
 *
 * Add this component once in the root layout.
 */

import { CheckCircle, Info, X, XCircle } from 'lucide-react'
import { type ToastType, useToastStore } from '@/stores/toast'

const typeStyles: Record<ToastType, { container: string; icon: string }> = {
  success: {
    container: 'border-green-500/30 bg-green-50 dark:bg-green-950/30',
    icon: 'text-green-600 dark:text-green-400',
  },
  error: {
    container: 'border-red-500/30 bg-red-50 dark:bg-red-950/30',
    icon: 'text-red-600 dark:text-red-400',
  },
  info: {
    container: 'border-blue-500/30 bg-blue-50 dark:bg-blue-950/30',
    icon: 'text-blue-600 dark:text-blue-400',
  },
}

const TypeIcon: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 md:max-w-[420px]"
    >
      {toasts.map((t) => {
        const styles = typeStyles[t.type]
        const Icon = TypeIcon[t.type]

        return (
          <div
            key={t.id}
            role="alert"
            className={`flex items-start gap-3 rounded-md border p-4 pr-10 shadow-lg animate-in slide-in-from-right-full duration-200 ${styles.container}`}
          >
            <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${styles.icon}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{t.title}</p>
              {t.description && <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 hover:text-foreground transition-opacity"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
