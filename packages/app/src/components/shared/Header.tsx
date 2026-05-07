import { Moon, Sun, Shield } from 'lucide-react'
import { useThemeStore } from '@/stores/theme'

export function Header() {
  const isDark = useThemeStore((s) => s.isDark)
  const toggleTheme = useThemeStore((s) => s.toggle)

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold text-foreground">Aegis</span>
      </div>
      <button
        onClick={toggleTheme}
        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        aria-label="Toggle theme"
      >
        {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
    </header>
  )
}
