import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getStripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { generateLicenseKey } from '@/lib/license';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = headers().get('stripe-signature') ?? '';
  const stripe = getStripe();
  const db = supabaseAdmin();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as any;
      await db.from('merchants')
        .update({ plan_status: sub.status, stripe_sub_id: sub.id, updated_at: new Date().toISOString() })
        .eq('stripe_customer_id', sub.customer);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as any;
      await db.from('merchants')
        .update({ plan_status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('stripe_customer_id', sub.customer);
      // Trigger deprovision via edge function (fire-and-forget)
      break;
    }

    case 'invoice.payment_failed': {
      const inv = event.data.object as any;
      await db.from('merchants')
        .update({ plan_status: 'past_due', updated_at: new Date().toISOString() })
        .eq('stripe_customer_id', inv.customer);
      break;
    }

    case 'checkout.session.completed': {
      const session = event.data.object as any;
      if (session.mode !== 'payment') break;

      const licenseKey = generateLicenseKey();
      const licenseType = session.metadata?.license_type ?? 'single';
      const email = session.customer_details?.email ?? session.metadata?.email;

      await db.from('download_purchases').insert({
        email,
        stripe_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent,
        license_key: licenseKey,
        license_type: licenseType,
        download_count: 0,
        max_downloads: 5,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

      await resend.emails.send({
        from: process.env.PLATFORM_FROM_EMAIL ?? 'hello@printifyplatform.com',
        to: email,
        subject: 'Your PrintifyPlatform License Key & Download',
        html: `
          <h2>Your license is ready!</h2>
          <p><strong>License Key:</strong> <code>${licenseKey}</code></p>
          <p><strong>License Type:</strong> ${licenseType === 'single' ? 'Single Site' : 'Unlimited'}</p>
          <p>Log in to your dashboard to download the ZIP: <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/download">Download Now</a></p>
          <p>Setup guide: <a href="${process.env.NEXT_PUBLIC_SITE_URL}/docs/setup">Getting Started</a></p>
        `,
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
