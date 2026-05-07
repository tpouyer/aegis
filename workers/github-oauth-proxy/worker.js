/**
 * Cloudflare Worker — OAuth Token Exchange Proxy
 *
 * Proxies token exchange requests to GitHub and Google, injecting
 * the client_secret from Worker secrets. Adds CORS headers so the
 * browser SPA can complete OAuth flows.
 *
 * Secrets (set via wrangler secret put):
 *   GITHUB_CLIENT_SECRET
 *   GOOGLE_CLIENT_SECRET
 *
 * Deploy: wrangler deploy
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
    }

    try {
      const body = await request.json()
      const provider = body.provider || 'github'

      let tokenUrl
      let tokenBody

      if (provider === 'google') {
        tokenUrl = 'https://oauth2.googleapis.com/token'
        tokenBody = new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: body.client_id,
          client_secret: env.GOOGLE_CLIENT_SECRET || '',
          code: body.code,
          redirect_uri: body.redirect_uri,
          code_verifier: body.code_verifier || '',
        }).toString()
      } else {
        tokenUrl = 'https://github.com/login/oauth/access_token'
        tokenBody = JSON.stringify({
          client_id: body.client_id,
          client_secret: env.GITHUB_CLIENT_SECRET || '',
          code: body.code,
          redirect_uri: body.redirect_uri,
        })
      }

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': provider === 'google' ? 'application/x-www-form-urlencoded' : 'application/json',
          'Accept': 'application/json',
        },
        body: tokenBody,
      })

      const data = await response.text()

      return new Response(data, {
        status: response.status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
        },
      })
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Proxy error' }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
  },
}
