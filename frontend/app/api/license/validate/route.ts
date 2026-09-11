import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isValidKeyFormat } from '@/lib/license';

export async function POST(req: NextRequest) {
  const { license_key, domain } = await req.json();

  if (!license_key || !isValidKeyFormat(license_key)) {
    return NextResponse.json({ valid: false, error: 'Invalid key format' }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: purchase } = await db
    .from('download_purchases')
    .select('id, license_type, activated_at')
    .eq('license_key', license_key)
    .single();

  if (!purchase) {
    return NextResponse.json({ valid: false, error: 'License key not found' }, { status: 404 });
  }

  if (purchase.license_type === 'single' && domain) {
    const { data: activation } = await db
      .from('license_activations')
      .select('domain')
      .eq('license_key', license_key)
      .single();

    if (activation && activation.domain !== domain) {
      return NextResponse.json({ valid: false, error: 'License bound to different domain' }, { status: 403 });
    }
  }

  return NextResponse.json({
    valid: true,
    license_type: purchase.license_type,
    activated_at: purchase.activated_at,
  });
}
