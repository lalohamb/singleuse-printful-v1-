import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe, PRICE_IDS } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { authorization: authHeader } } }
  );

  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { plan, licenseType } = await req.json();
  const stripe = getStripe();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://printifyplatform.com';

  if (licenseType) {
    // One-time download purchase
    const priceId = licenseType === 'unlimited' ? PRICE_IDS.downloadUnlimited : PRICE_IDS.downloadSingle;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      metadata: { license_type: licenseType, email: user.email ?? '' },
      success_url: `${siteUrl}/dashboard/download?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pricing`,
    });
    return NextResponse.json({ url: session.url });
  }

  // Subscription
  const priceMap: Record<string, string> = {
    starter: PRICE_IDS.starter,
    pro: PRICE_IDS.pro,
    agency: PRICE_IDS.agency,
  };
  const priceId = priceMap[plan];
  if (!priceId) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: user.email,
    subscription_data: { trial_period_days: 14 },
    success_url: `${siteUrl}/dashboard/billing?upgraded=1`,
    cancel_url: `${siteUrl}/dashboard/billing/upgrade`,
  });
  return NextResponse.json({ url: session.url });
}
