/**
 * Cloudflare Worker — OAuth + Jira API CORS Proxy
 *
 * Routes:
 *   POST /           — OAuth token exchange (GitHub, Google)
 *   /jira/*          — Proxies to Jira Cloud REST API with CORS headers
 *
 * The Jira proxy forwards requests to the target Jira instance specified
 * in the X-Jira-Base-URL header, injecting Basic Auth credentials from
 * the X-Jira-Auth header. This avoids CORS blocks on direct browser calls.
 *
 * Secrets (set via wrangler secret put):
 *   GITHUB_CLIENT_SECRET
 *   GOOGLE_CLIENT_SECRET
 *
 * Deploy: wrangler deploy
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Jira-Base-URL, X-Jira-Auth',
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    // Jira API proxy: /jira/rest/...
    if (url.pathname.startsWith('/jira/')) {
      return handleJiraProxy(request)
    }

    // OAuth token exchange (existing behavior)
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
    }

    return handleOAuthExchange(request, env)
  },
}

async function handleJiraProxy(request) {
  try {
    const jiraBaseUrl = request.headers.get('X-Jira-Base-URL')
    const jiraAuth = request.headers.get('X-Jira-Auth')

    if (!jiraBaseUrl) {
      return new Response(JSON.stringify({ error: 'Missing X-Jira-Base-URL header' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // Strip /jira prefix to get the Jira REST path
    const url = new URL(request.url)
    const jiraPath = url.pathname.replace(/^\/jira/, '')
    const targetUrl = `${jiraBaseUrl.replace(/\/$/, '')}${jiraPath}${url.search}`

    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }

    if (jiraAuth) {
      headers['Authorization'] = jiraAuth
    }

    const fetchOptions = {
      method: request.method,
      headers,
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      fetchOptions.body = await request.text()
    }

    const response = await fetch(targetUrl, fetchOptions)
    const data = await response.text()

    return new Response(data, {
      status: response.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Jira proxy error', detail: err.message }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
}

async function handleOAuthExchange(request, env) {
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
}
