import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { authorization: authHeader } } }
  );

  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminDb = supabaseAdmin();
  const { data: purchase } = await adminDb
    .from('download_purchases')
    .select('id, download_count, max_downloads, expires_at')
    .eq('email', user.email)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!purchase) return NextResponse.json({ error: 'No purchase found' }, { status: 404 });
  if (purchase.download_count >= purchase.max_downloads) {
    return NextResponse.json({ error: 'Download limit reached' }, { status: 403 });
  }
  if (purchase.expires_at && new Date(purchase.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Download link expired' }, { status: 410 });
  }

  const { data: signedUrl } = await adminDb.storage
    .from(process.env.STORE_RELEASE_BUCKET ?? 'releases')
    .createSignedUrl(process.env.STORE_RELEASE_FILE ?? 'printifyplatform-v1.0.0.zip', 3600);

  if (!signedUrl?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate URL' }, { status: 500 });
  }

  await adminDb.from('download_purchases')
    .update({ download_count: purchase.download_count + 1 })
    .eq('id', purchase.id);

  return NextResponse.json({ url: signedUrl.signedUrl });
}
