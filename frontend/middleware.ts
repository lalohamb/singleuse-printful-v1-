import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN ?? 'printifyplatform.com';

// Simple in-process cache (edge runtime compatible)
const cache = new Map<string, { tenantId: string; ts: number }>();
const TTL = 60_000; // 60s

async function resolveTenant(hostname: string): Promise<string | null> {
  const cached = cache.get(hostname);
  if (cached && Date.now() - cached.ts < TTL) return cached.tenantId;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) return null;

  const db = createClient(url, key);
  const isSubdomain = hostname.endsWith(`.${PLATFORM_DOMAIN}`);
  const field = isSubdomain ? 'subdomain' : 'custom_domain';
  const value = isSubdomain ? hostname.split('.')[0] : hostname;

  const { data } = await db
    .from('store_instances')
    .select('id')
    .eq(field, value)
    .eq('status', 'active')
    .single();

  if (!data) return null;
  cache.set(hostname, { tenantId: data.id, ts: Date.now() });
  return data.id;
}

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';
  const { pathname } = request.nextUrl;

  // Skip platform routes — only resolve tenant for storefront subdomains/custom domains
  const isPlatformRoute =
    hostname === PLATFORM_DOMAIN ||
    hostname === `www.${PLATFORM_DOMAIN}` ||
    hostname.startsWith('localhost') ||
    hostname.startsWith('127.0.0.1');

  if (isPlatformRoute) return NextResponse.next();

  const tenantId = await resolveTenant(hostname);
  if (!tenantId) {
    return NextResponse.redirect(new URL('/not-found', request.url));
  }

  const response = NextResponse.next();
  response.headers.set('x-tenant-id', tenantId);
  response.headers.set('x-tenant-host', hostname);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
