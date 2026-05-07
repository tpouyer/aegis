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
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { authManager } from '@/lib/auth/manager'
import type { AuthState } from '@/lib/auth/types'
import { AuthLevel } from '@/lib/auth/types'

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

function QuickStartSection() {
  const handleConnectGitHub = useCallback(() => {
    console.info('[Landing] GitHub connect flow not yet wired')
  }, [])

  const handleConnectSSO = useCallback(() => {
    console.info('[Landing] Red Hat SSO connect flow not yet wired')
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
            <Link to="/board/$boardId" params={{ boardId: 'default' }}>
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

function AuthStatusSection() {
  const authState = useAuthState()

  if (!authState.isAuthenticated) return null

  const connectedProviders = (
    Object.keys(authState.tokens) as Array<keyof typeof authState.tokens>
  ).filter((p) => authManager.isConnected(p))

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Welcome back</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge>{authLevelLabel(authState.level)}</Badge>
          {authState.user?.displayName && (
            <span className="text-sm text-foreground">
              {authState.user.displayName}
            </span>
          )}
        </div>
        {connectedProviders.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-1.5">
              {connectedProviders.map((provider) => (
                <Badge key={provider} variant="secondary">
                  {provider}
                </Badge>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function HomePage() {
  const authState = useAuthState()

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="space-y-8">
        <HeroSection />

        <FeatureCards />

        <Separator />

        {authState.isAuthenticated ? <AuthStatusSection /> : <QuickStartSection />}
      </div>
    </div>
  )
}
