import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return _stripe;
}

export const PRICE_IDS = {
  starter: process.env.STRIPE_STARTER_PRICE_ID!,
  pro: process.env.STRIPE_PRO_PRICE_ID!,
  agency: process.env.STRIPE_AGENCY_PRICE_ID!,
  downloadSingle: process.env.STRIPE_DOWNLOAD_SINGLE_PRICE_ID!,
  downloadUnlimited: process.env.STRIPE_DOWNLOAD_UNLIMITED_PRICE_ID!,
} as const;
