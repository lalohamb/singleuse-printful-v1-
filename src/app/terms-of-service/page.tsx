import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import StorefrontLayout from "@/components/StorefrontLayout";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Body & Sleeves Terms of Service.",
};

const EMAIL = "info@bodyandsleeves.com";

export default function TermsOfServicePage() {
  return (
    <StorefrontLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <p className="text-sm text-secondary-400 mb-2">
          <Link href="/" className="hover:text-secondary-700 transition-colors">Home</Link>{" › "}Terms of Service
        </p>
        <h1 className="text-3xl lg:text-4xl font-bold text-secondary-900 mb-10">Terms of Service</h1>
        <div className="space-y-8 text-secondary-600 leading-relaxed">
          <p>Welcome to Body &amp; Sleeves (&ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo;). By accessing or purchasing from our site, you agree to the following Terms of Service. Please read them carefully.</p>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">1. General</h2>
            <p>By using this website and placing an order, you confirm that:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>You are at least 18 years of age, or have parental consent</li>
              <li>You are authorized to use the payment method provided</li>
              <li>All information you provide is accurate and complete</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">2. Products</h2>
            <p>All Body &amp; Sleeves products are made to order through our print-on-demand partner, Printify. Product images are for illustration purposes — actual colors may vary slightly depending on your screen calibration and the printing process.</p>
            <p className="mt-3">We reserve the right to discontinue any product or design at any time without notice.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">3. Pricing</h2>
            <p>All prices are listed in US Dollars (USD). We reserve the right to change prices at any time. The price charged will be the price displayed at the time of your order.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">4. Orders &amp; Payment</h2>
            <p>By placing an order, you agree to pay the full amount shown at checkout, including applicable taxes and shipping fees.</p>
            <p className="mt-3">We accept payment via Stripe and major credit cards. All transactions are encrypted and secure.</p>
            <p className="mt-3">We reserve the right to cancel any order for any reason, including but not limited to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Payment failure</li>
              <li>Suspected fraud</li>
              <li>Product unavailability</li>
            </ul>
            <p className="mt-3">If your order is cancelled, you will receive a full refund.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">5. Production &amp; Shipping</h2>
            <p>All orders enter production within 2–7 business days. Once in production, orders cannot be modified or cancelled.</p>
            <p className="mt-3">Shipping times are estimates and not guaranteed. Body &amp; Sleeves is not responsible for carrier delays.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">6. Returns &amp; Refunds</h2>
            <p>Full details are available in our <Link href="/refund-policy" className="text-primary-600 hover:underline">Returns &amp; Refunds Policy</Link>. In short: we accept return requests for sizing issues, misprints or defects, and accidental duplicate orders. Items returned for sizing issues must be unused, unworn, and in original, sellable condition with tags attached. We do not accept returns for buyer&apos;s remorse or general dissatisfaction with a design.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">7. Intellectual Property</h2>
            <p>All designs, graphics, logos, and content on this site are the property of Body &amp; Sleeves or their respective creators. You may not copy, reproduce, distribute, or use any content from this site without express written permission.</p>
            <p className="mt-3">Purchasing a product does not grant you rights to the design or artwork on that product.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">8. User Conduct</h2>
            <p>When using our website, you agree not to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Use the site for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any part of the site</li>
              <li>Transmit spam, malware, or harmful content</li>
              <li>Impersonate any person or entity</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">9. Disclaimer of Warranties</h2>
            <p>Our website and products are provided &ldquo;as is.&rdquo; We make no warranties, express or implied, regarding:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>The accuracy or completeness of content on the site</li>
              <li>The fitness of products for a particular purpose</li>
              <li>Uninterrupted or error-free operation of the website</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">10. Limitation of Liability</h2>
            <p>To the fullest extent permitted by law, Body &amp; Sleeves shall not be liable for any indirect, incidental, or consequential damages arising from your use of this site or purchase of our products. Our maximum liability is limited to the amount you paid for the specific order in question.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">11. Governing Law</h2>
            <p>These Terms are governed by the laws of the State of Illinois, United States, without regard to conflict of law principles.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">12. Changes to These Terms</h2>
            <p>We reserve the right to update these Terms at any time. Changes take effect when posted on this page. Continued use of the site after changes constitutes your acceptance.</p>
          </section>

          <section className="bg-secondary-50 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">13. Contact Us</h2>
            <p className="mb-4">Questions about these Terms? Reach out to us.</p>
            <a href={`mailto:${EMAIL}`} className="inline-flex items-center gap-2 btn-outline"><Mail size={18} />{EMAIL}</a>
          </section>
        </div>
      </div>
    </StorefrontLayout>
  );
}
