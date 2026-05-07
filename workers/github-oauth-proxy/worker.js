/**
 * Cloudflare Worker — GitHub OAuth CORS Proxy
 *
 * Proxies the token exchange request to GitHub and adds CORS headers.
 * The client_secret is stored as a Cloudflare Worker secret (not in
 * browser code) via: wrangler secret put GITHUB_CLIENT_SECRET
 */

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'

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

      const response = await fetch(GITHUB_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: body.client_id,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: body.code,
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
