import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAdminPasswordProtection, getStatusPasswordProtection } from './util/auth'

function isAdminRequest(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/api/admin/')
}

function hasBasicAuth(request: NextRequest, passwordProtection: string) {
  const authHeader = request.headers.get('Authorization')
  let authenticated = false
  const expected = 'Basic ' + btoa(passwordProtection)

  if (authHeader && authHeader.length === expected.length) {
    // Keep the comparison length-stable so mismatches do not short-circuit early.
    authenticated = true
    for (let i = 0; i < authHeader.length; i++) {
      if (authHeader[i] !== expected[i]) authenticated = false
    }
  }

  return authenticated
}

function unauthorized(realm: string) {
  return NextResponse.json(
    { code: 401, message: 'Not authenticated' },
    { status: 401, headers: { 'WWW-Authenticate': `Basic realm="${realm}"` } }
  )
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const adminPasswordProtection = getAdminPasswordProtection()

  if (isAdminRequest(pathname)) {
    if (!adminPasswordProtection || !hasBasicAuth(request, adminPasswordProtection)) {
      return unauthorized('CFkuma Admin')
    }

    return NextResponse.next()
  }

  const passwordProtection = getStatusPasswordProtection()
  if (passwordProtection && !hasBasicAuth(request, passwordProtection)) {
    return unauthorized('UptimeFlare')
  }

  return NextResponse.next()
}
