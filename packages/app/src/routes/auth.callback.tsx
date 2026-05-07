import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { handleAtlassianCallback } from '@/lib/auth/atlassian'
import { getAtlassianConfig, getGitHubConfig, getGoogleConfig, getRedHatConfig } from '@/lib/auth/config'
import { handleGitHubCallback } from '@/lib/auth/github'
import { handleGoogleCallback } from '@/lib/auth/google'
import { authManager } from '@/lib/auth/manager'
import { handleRedHatCallback } from '@/lib/auth/redhat-sso'
import type { AuthProvider, TokenSet } from '@/lib/auth/types'
import { toast } from '@/stores/toast'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
})

function AuthCallbackPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    document.title = 'Authenticating... — Aegis'

    const params = new URLSearchParams(window.location.search)
    const provider = params.get('provider') as AuthProvider | null

    if (!provider) {
      setStatus('error')
      setErrorMessage('Missing provider parameter in callback URL')
      return
    }

    async function exchangeToken() {
      try {
        let tokenSet: TokenSet

        switch (provider) {
          case 'github':
            tokenSet = await handleGitHubCallback(params, getGitHubConfig())
            break
          case 'atlassian':
            tokenSet = await handleAtlassianCallback(params, getAtlassianConfig())
            break
          case 'redhat-sso':
            tokenSet = await handleRedHatCallback(params, getRedHatConfig())
            break
          case 'google':
            tokenSet = await handleGoogleCallback(params, getGoogleConfig())
            break
          default:
            throw new Error(`Unknown provider: ${provider}`)
        }

        await authManager.setToken(provider!, tokenSet)
        setStatus('success')
        toast.success('Connected', `Successfully connected to ${provider}`)

        setTimeout(() => {
          navigate({ to: '/' })
        }, 1500)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication failed'
        setStatus('error')
        setErrorMessage(message)
        toast.error('Authentication failed', message)
      }
    }

    exchangeToken()
  }, [navigate])

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Authenticating...</h2>
            <p className="text-sm text-muted-foreground">Completing the OAuth flow</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <h2 className="text-lg font-semibold text-foreground">Connected!</h2>
            <p className="text-sm text-muted-foreground">Redirecting to home...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="text-lg font-semibold text-foreground">Authentication Failed</h2>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <button
              onClick={() => navigate({ to: '/settings' })}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go to Settings
            </button>
          </>
        )}
      </div>
    </div>
  )
}
