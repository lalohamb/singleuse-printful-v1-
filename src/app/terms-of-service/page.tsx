import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import StorefrontLayout from "@/components/StorefrontLayout";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_POLICY_CONTENT } from "@/lib/policy-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service.",
};

const FALLBACK = `Welcome to Your Store ("we," "us," "our"). By accessing or purchasing from our site, you agree to the following Terms of Service. Please read them carefully.

1. General
By using this website and placing an order, you confirm that you are at least 18 years of age (or have parental consent), are authorized to use the payment method provided, and that all information you provide is accurate and complete.

2. Products
All products are made to order through our print-on-demand partner, Printify. Product images are for illustration purposes — actual colors may vary slightly. We reserve the right to discontinue any product at any time.

3. Pricing
All prices are listed in US Dollars (USD). We reserve the right to change prices at any time. The price charged will be the price displayed at the time of your order.

4. Orders & Payment
By placing an order, you agree to pay the full amount shown at checkout. We accept payment via Stripe and major credit cards. We reserve the right to cancel any order for payment failure, suspected fraud, or product unavailability. Cancelled orders receive a full refund.

5. Production & Shipping
All orders enter production within 2–7 business days. Once in production, orders cannot be modified or cancelled. Shipping times are estimates and not guaranteed.

6. Returns & Refunds
Full details are available in our Refund and Returns Policy. We accept return requests for sizing issues, misprints or defects, and accidental duplicate orders.

7. Intellectual Property
All designs, graphics, logos, and content on this site are the property of Your Store. You may not copy, reproduce, or distribute any content without express written permission.

8. Governing Law
These Terms are governed by the laws of your applicable jurisdiction.

9. Changes to These Terms
We reserve the right to update these Terms at any time. Continued use of the site after changes constitutes your acceptance.`;

export default async function TermsOfServicePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [{ data: policyData }, { data: settingsData }] = await Promise.all([
    supabase.from("policies").select("content").eq("id", "terms").maybeSingle(),
    supabase.from("settings").select("social_links").maybeSingle(),
  ]);
  const content = policyData?.content || DEFAULT_POLICY_CONTENT.terms || FALLBACK;
  const emailEntry = (settingsData?.social_links as Record<string, { url: string; enabled: boolean }> | null)?.email;
  const email = emailEntry?.enabled ? emailEntry.url : null;

  return (
    <StorefrontLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <p className="text-sm text-secondary-400 mb-2">
          <Link href="/" className="hover:text-secondary-700 transition-colors">Home</Link>{" › "}Terms of Service
        </p>
        <h1 className="text-3xl lg:text-4xl font-bold text-secondary-900 mb-10">Terms of Service</h1>
        <div className="prose prose-sm max-w-none text-secondary-600 leading-relaxed [&_p]:mb-4 [&_h2]:mt-8 [&_h2]:mb-3" dangerouslySetInnerHTML={{ __html: content }} />
        {email && (
          <div className="mt-12 bg-secondary-50 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">Contact Us</h2>
            <p className="mb-4">Questions about these Terms? Reach out to us.</p>
            <a href={`mailto:${email}`} className="inline-flex items-center gap-2 btn-outline"><Mail size={18} />{email}</a>
          </div>
        )}
      </div>
    </StorefrontLayout>
  );
}
