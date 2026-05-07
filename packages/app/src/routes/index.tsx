import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState, useCallback } from 'react'
import {
  Shield,
  LayoutDashboard,
  MessageSquare,
  Code2,
  Github,
  KeyRound,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Settings,
  Cpu,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { authManager } from '@/lib/auth/manager'
import type { AuthState } from '@/lib/auth/types'
import { AuthLevel } from '@/lib/auth/types'
import { initiateGitHubAuth } from '@/lib/auth/github'
import { initiateRedHatAuth } from '@/lib/auth/redhat-sso'
import { getGitHubConfig, getRedHatConfig } from '@/lib/auth/config'
import { useRecentStore } from '@/stores/recent'
import type { RecentIssue } from '@/stores/recent'

export const Route = createFileRoute('/')({
  component: HomePage,
})

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: 'Kanban Board',
    description: 'Jira-backed boards with drag-and-drop transitions',
  },
  {
    icon: MessageSquare,
    title: 'AI Chat',
    description: 'Context-aware AI with your team\'s conventions',
  },
  {
    icon: Code2,
    title: 'Web IDE',
    description: 'Browser-based editing with branch management',
  },
] as const

function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>(() => authManager.getState())

  useEffect(() => {
    const unsubscribe = authManager.onAuthChange((newState) => {
      setState(newState)
    })
    return unsubscribe
  }, [])

  return state
}

function authLevelLabel(level: AuthLevel): string {
  switch (level) {
    case AuthLevel.RedHatSSO:
      return 'Red Hat Employee'
    case AuthLevel.GitHub:
      return 'Contributor'
    default:
      return 'Guest'
  }
}

// ---------------------------------------------------------------------------
// Hero section (used for unauthenticated users at the top)
// ---------------------------------------------------------------------------

function HeroSection() {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Shield className="h-9 w-9 text-primary" />
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-foreground">
        Aegis
      </h1>
      <p className="mt-2 text-lg text-muted-foreground">
        Guard your workflow, ship with confidence.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Zero-infrastructure development platform
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Feature cards (collapsible about section)
// ---------------------------------------------------------------------------

function FeatureCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {FEATURES.map((feature) => {
        const Icon = feature.icon
        return (
          <Card key={feature.title} className="text-center">
            <CardHeader className="pb-2">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="mt-2 text-base">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{feature.description}</CardDescription>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// About Aegis — collapsible wrapper around feature cards
// ---------------------------------------------------------------------------

function AboutSection({ defaultExpanded }: { defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-2 py-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        About Aegis
      </button>
      {expanded && (
        <div className="mt-2">
          <FeatureCards />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Auth CTA for unauthenticated users
// ---------------------------------------------------------------------------

function AuthCTA() {
  const handleConnectGitHub = useCallback(() => {
    initiateGitHubAuth(getGitHubConfig())
  }, [])

  const handleConnectSSO = useCallback(() => {
    initiateRedHatAuth(getRedHatConfig())
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center text-lg">Get Started</CardTitle>
        <CardDescription className="text-center">
          Choose how you want to use Aegis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Guest</p>
            <p className="text-xs text-muted-foreground">Browse public docs</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/board/$boardId" params={{ boardId: '1' }}>
              Browse
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Contributor</p>
            <p className="text-xs text-muted-foreground">Sign in with GitHub</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleConnectGitHub}>
            <Github className="mr-1 h-3.5 w-3.5" />
            Connect GitHub
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Red Hat Employee</p>
            <p className="text-xs text-muted-foreground">Sign in with SSO</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleConnectSSO}>
            <KeyRound className="mr-1 h-3.5 w-3.5" />
            Connect SSO
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Auth status badges (shown inline with greeting for authenticated users)
// ---------------------------------------------------------------------------

function AuthBadges({ authState }: { authState: AuthState }) {
  const connectedProviders = (
    Object.keys(authState.tokens) as Array<keyof typeof authState.tokens>
  ).filter((p) => authManager.isConnected(p))

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge>{authLevelLabel(authState.level)}</Badge>
      {connectedProviders.map((provider) => (
        <Badge key={provider} variant="secondary">
          {provider}
        </Badge>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recent issues grid
// ---------------------------------------------------------------------------

function RecentIssueCard({ issue }: { issue: RecentIssue }) {
  const linkTo = issue.lastView === 'ide'
    ? '/issue/$issueKey/ide'
    : '/issue/$issueKey/chat'
  const viewLabel = issue.lastView === 'ide' ? 'IDE' : 'Chat'
  const ViewIcon = issue.lastView === 'ide' ? Code2 : MessageSquare

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{issue.key}</CardTitle>
        <CardDescription className="line-clamp-2 text-xs">
          {issue.summary}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
          <Link to={linkTo} params={{ issueKey: issue.key }}>
            <ViewIcon className="mr-1 h-3.5 w-3.5" />
            {viewLabel}
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function RecentIssuesSection() {
  const issues = useRecentStore((s) => s.issues)

  if (issues.length === 0) return null

  return (
    <div>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        Recent Issues
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {issues.map((issue) => (
          <RecentIssueCard key={issue.key} issue={issue} />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quick actions
// ---------------------------------------------------------------------------

function QuickActions() {
  return (
    <div>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        Quick Actions
      </h2>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link to="/board/$boardId" params={{ boardId: '1' }}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Open Board
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/settings" search={{ tab: 'connections' }}>
            <Cpu className="mr-2 h-4 w-4" />
            Configure AI
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/settings">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Authenticated landing
// ---------------------------------------------------------------------------

function AuthenticatedLanding({ authState }: { authState: AuthState }) {
  const recentIssues = useRecentStore((s) => s.issues)
  const hasRecent = recentIssues.length > 0

  return (
    <div className="space-y-8">
      {/* Greeting + auth badges */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back{authState.user?.displayName ? `, ${authState.user.displayName}` : ''}
        </h1>
        <AuthBadges authState={authState} />
      </div>

      {/* Recent issues */}
      <RecentIssuesSection />

      {/* Quick actions */}
      <QuickActions />

      <Separator />

      {/* About Aegis — collapsed for returning users (who have recent issues) */}
      <AboutSection defaultExpanded={!hasRecent} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Unauthenticated landing
// ---------------------------------------------------------------------------

function UnauthenticatedLanding() {
  return (
    <div className="space-y-8">
      <HeroSection />

      <AuthCTA />

      <Separator />

      {/* About Aegis — expanded for first visit */}
      <AboutSection defaultExpanded={true} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------

function HomePage() {
  const authState = useAuthState()

  useEffect(() => { document.title = 'Aegis — Home' }, [])

  return (
    <div className="mx-auto max-w-3xl p-6">
      {authState.isAuthenticated ? (
        <AuthenticatedLanding authState={authState} />
      ) : (
        <UnauthenticatedLanding />
      )}
    </div>
  )
}
