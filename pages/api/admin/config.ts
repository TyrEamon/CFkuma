import { NextRequest } from 'next/server'
import { getAdminConfig, saveAdminConfig } from '@/util/runtimeConfig'

export const runtime = 'edge'

const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers })
}

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method === 'GET') {
    const config = await getAdminConfig(process.env as any)
    return jsonResponse({ config })
  }

  if (req.method === 'PUT') {
    try {
      const payload = (await req.json()) as any
      const config = await saveAdminConfig(process.env as any, payload?.config ?? payload)
      return jsonResponse({ config })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid request body'
      return jsonResponse({ error: message }, 400)
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405)
}
