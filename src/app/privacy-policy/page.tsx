import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import StorefrontLayout from "@/components/StorefrontLayout";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_POLICY_CONTENT } from "@/lib/policy-content";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy.",
};

const FALLBACK = `Your Store ("we," "us," "our") is committed to protecting your privacy. This policy explains how we collect, use, and protect your information.

Information We Collect
- Personal information you provide: name, email address, shipping address, and payment information when placing an order.
- Usage data: pages visited, browser type, and IP address collected automatically.

How We Use Your Information
- To process and fulfill your orders
- To send order confirmations and shipping updates
- To respond to customer service inquiries
- To send marketing emails (only if you opt in)

Payment Information
All payment processing is handled securely by Stripe. We do not store your credit card information on our servers.

Sharing Your Information
We do not sell or rent your personal information. We share data only with:
- Printify (our print-on-demand fulfillment partner) to produce and ship your orders
- Stripe for payment processing
- Shipping carriers to deliver your orders

Cookies
We use cookies to maintain your shopping cart session and analyze site traffic. You can disable cookies in your browser settings.

Data Retention
We retain your order information for as long as necessary to fulfill orders and comply with legal obligations.

Your Rights
You may request access to, correction of, or deletion of your personal data by contacting us.

Changes to This Policy
We may update this policy at any time. Changes will be posted on this page.`;

export default async function PrivacyPolicyPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [{ data: policyData }, { data: settingsData }] = await Promise.all([
    supabase.from("policies").select("content").eq("id", "privacy").maybeSingle(),
    supabase.from("settings").select("social_links").maybeSingle(),
  ]);
  const content = policyData?.content || DEFAULT_POLICY_CONTENT.privacy || FALLBACK;
  const emailEntry = (settingsData?.social_links as Record<string, { url: string; enabled: boolean }> | null)?.email;
  const email = emailEntry?.enabled ? emailEntry.url : null;

  return (
    <StorefrontLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <p className="text-sm text-secondary-400 mb-2">
          <Link href="/" className="hover:text-secondary-700 transition-colors">Home</Link>{" › "}Privacy Policy
        </p>
        <h1 className="text-3xl lg:text-4xl font-bold text-secondary-900 mb-10">Privacy Policy</h1>
        <div className="prose prose-sm max-w-none text-secondary-600 leading-relaxed [&_p]:mb-4 [&_h2]:mt-8 [&_h2]:mb-3" dangerouslySetInnerHTML={{ __html: content }} />
        {email && (
          <div className="mt-12 bg-secondary-50 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">Contact Us</h2>
            <p className="mb-4">Questions about this Privacy Policy? Reach out to us.</p>
            <a href={`mailto:${email}`} className="inline-flex items-center gap-2 btn-outline"><Mail size={18} />{email}</a>
          </div>
        )}
      </div>
    </StorefrontLayout>
  );
}
