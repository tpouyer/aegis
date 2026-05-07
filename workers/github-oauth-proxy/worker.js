/**
 * Cloudflare Worker — GitHub OAuth CORS Proxy
 *
 * GitHub's token exchange endpoint (POST /login/oauth/access_token)
 * does not support CORS from browser origins. This worker proxies
 * the request and adds CORS headers so the Aegis SPA can complete
 * the OAuth flow.
 *
 * Deploy: wrangler deploy
 * URL: https://github-oauth-proxy.<your-subdomain>.workers.dev
 */

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
    }

    try {
      const body = await request.json()

      const response = await fetch(GITHUB_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: body.client_id,
          code: body.code,
          code_verifier: body.code_verifier,
          redirect_uri: body.redirect_uri,
        }),
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
