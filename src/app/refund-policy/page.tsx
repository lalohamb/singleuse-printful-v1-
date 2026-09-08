import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import StorefrontLayout from "@/components/StorefrontLayout";
import { createClient } from "@supabase/supabase-js";

export const metadata: Metadata = {
  title: "Refund and Returns Policy",
  description: "Body & Sleeves refund and returns policy.",
};

const EMAIL = "info@bodyandsleeves.com";

const FALLBACK = `Our refund and returns policy lasts 30 days from purchase. If 30 days have passed, we can't offer a full refund or exchange.

Eligibility
To be eligible for a return, your item must be unused, unworn, and in original sellable condition with tags attached.

We accept return requests for:
- Sizing issues
- Misprints or defects
- Accidental duplicate orders

We do not accept returns for buyer's remorse or general dissatisfaction with a design.

Refunds
Once your return is received and inspected, we will notify you of the approval or rejection of your refund. If approved, a credit will be applied to your original payment method within a certain number of days.

Late or Missing Refunds
If you haven't received a refund yet, check your bank account, then contact your credit card company, then your bank. If you've done all of this and still have not received your refund, please contact us.

Exchanges
We only replace items if they are defective or damaged. Contact us to arrange an exchange.

Shipping Returns
You will be responsible for paying your own shipping costs for returning your item. Shipping costs are non-refundable.`;

export default async function RefundPolicyPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.from("policies").select("content").eq("id", "refund").maybeSingle();
  const content = data?.content || FALLBACK;

  return (
    <StorefrontLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <p className="text-sm text-secondary-400 mb-2">
          <Link href="/" className="hover:text-secondary-700 transition-colors">Home</Link>{" › "}Refund and Returns Policy
        </p>
        <h1 className="text-3xl lg:text-4xl font-bold text-secondary-900 mb-10">Refund and Returns Policy</h1>
        <div className="space-y-4 text-secondary-600 leading-relaxed whitespace-pre-wrap">{content}</div>
        <div className="mt-12 bg-secondary-50 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-secondary-900 mb-3">Need Help?</h2>
          <p className="mb-4">Contact us for questions related to refunds and returns.</p>
          <a href={`mailto:${EMAIL}`} className="inline-flex items-center gap-2 btn-outline"><Mail size={18} />{EMAIL}</a>
        </div>
      </div>
    </StorefrontLayout>
  );
}
