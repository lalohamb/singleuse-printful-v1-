import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isValidKeyFormat } from '@/lib/license';

export async function POST(req: NextRequest) {
  const { license_key, domain } = await req.json();
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '';

  if (!license_key || !isValidKeyFormat(license_key) || !domain) {
    return NextResponse.json({ error: 'license_key and domain required' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: purchase } = await db
    .from('download_purchases')
    .select('id, license_type')
    .eq('license_key', license_key)
    .single();

  if (!purchase) return NextResponse.json({ error: 'License not found' }, { status: 404 });

  if (purchase.license_type === 'single') {
    const { data: existing } = await db
      .from('license_activations')
      .select('domain')
      .eq('license_key', license_key)
      .single();

    if (existing && existing.domain !== domain) {
      return NextResponse.json({ error: 'License already activated on a different domain' }, { status: 409 });
    }
  }

  await db.from('license_activations').upsert({
    license_key,
    domain,
    ip_address: ip,
    activated_at: new Date().toISOString(),
  }, { onConflict: 'license_key,domain' });

  await db.from('download_purchases')
    .update({ activated_at: new Date().toISOString() })
    .eq('license_key', license_key)
    .is('activated_at', null);

  return NextResponse.json({ activated: true, domain });
}
