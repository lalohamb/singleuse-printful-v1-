import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { provisionStore } from '@/lib/provisioning';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { authorization: authHeader } } }
  );

  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { plan, subdomain, storeName, printifyApiKey, printifyShopId } = await req.json();

  // Fetch merchant row
  const { data: merchant } = await db.from('merchants').select('id').eq('auth_user_id', user.id).single();
  if (!merchant) return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });

  try {
    const { jobId } = await provisionStore({
      merchantId: merchant.id,
      storeName: storeName ?? subdomain,
      subdomain,
      printifyApiKey: printifyApiKey ?? '',
      printifyShopId: printifyShopId ?? '',
    });
    return NextResponse.json({ jobId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
