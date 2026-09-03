import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import StorefrontLayout from "@/components/StorefrontLayout";

export const metadata: Metadata = {
  title: "Refund and Returns Policy",
  description: "Body & Sleeves refund and returns policy. Our policy lasts 30 days from purchase.",
};

const EMAIL = "Hello.BodyandSleeves@gmail.com";

export default function RefundPolicyPage() {
  return (
    <StorefrontLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <p className="text-sm text-secondary-400 mb-2">
          <Link href="/" className="hover:text-secondary-700 transition-colors">Home</Link>{" › "}Refund and Returns Policy
        </p>
        <h1 className="text-3xl lg:text-4xl font-bold text-secondary-900 mb-10">Refund and Returns Policy</h1>
        <div className="space-y-8 text-secondary-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">Overview</h2>
            <p>Our refund and returns policy lasts 30 days. If 30 days have passed since your purchase, we can&apos;t offer you a full refund or exchange.</p>
            <p className="mt-3">To be eligible for a return, your item must be unused and in the same condition that you received it. It must also be in the original packaging.</p>
            <p className="mt-3">Several types of goods are exempt from being returned. Perishable goods such as food, flowers, newspapers or magazines cannot be returned. We also do not accept products that are intimate or sanitary goods, hazardous materials, or flammable liquids or gases.</p>
            <p className="mt-3 font-medium text-secondary-700">Additional non-returnable items:</p>
            <ul className="list-disc list-inside mt-2 space-y-1"><li>Gift cards</li><li>Downloadable software products</li><li>Some health and personal care items</li></ul>
            <p className="mt-3">To complete your return, we require a receipt or proof of purchase.</p>
            <p className="mt-3">Please do not send your purchase back to the manufacturer.</p>
            <p className="mt-3 font-medium text-secondary-700">There are certain situations where only partial refunds are granted:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Book with obvious signs of use</li>
              <li>CD, DVD, VHS tape, software, video game, cassette tape, or vinyl record that has been opened</li>
              <li>Any item not in its original condition, is damaged or missing parts for reasons not due to our error</li>
              <li>Any item that is returned more than 30 days after delivery</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">Refunds</h2>
            <p>Once your return is received and inspected, we will send you an email to notify you that we have received your returned item. We will also notify you of the approval or rejection of your refund.</p>
            <p className="mt-3">If you are approved, then your refund will be processed, and a credit will automatically be applied to your credit card or original method of payment, within a certain amount of days.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">Late or Missing Refunds</h2>
            <p>If you haven&apos;t received a refund yet, first check your bank account again.</p>
            <p className="mt-3">Then contact your credit card company — it may take some time before your refund is officially posted.</p>
            <p className="mt-3">Next contact your bank. There is often some processing time before a refund is posted.</p>
            <p className="mt-3">If you&apos;ve done all of this and you still have not received your refund yet, please contact us at <a href={`mailto:${EMAIL}`} className="text-primary-600 hover:underline">{EMAIL}</a>.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">Sale Items</h2>
            <p>Only regular priced items may be refunded. Sale items cannot be refunded.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">Exchanges</h2>
            <p>We only replace items if they are defective or damaged. If you need to exchange it for the same item, send us an email at <a href={`mailto:${EMAIL}`} className="text-primary-600 hover:underline">{EMAIL}</a>.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">Gifts</h2>
            <p>If the item was marked as a gift when purchased and shipped directly to you, you&apos;ll receive a gift credit for the value of your return. Once the returned item is received, a gift certificate will be mailed to you.</p>
            <p className="mt-3">If the item wasn&apos;t marked as a gift when purchased, or the gift giver had the order shipped to themselves to give to you later, we will send a refund to the gift giver and they will find out about your return.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">Shipping Returns</h2>
            <p>To return your product, please contact us at <a href={`mailto:${EMAIL}`} className="text-primary-600 hover:underline">{EMAIL}</a> for return shipping instructions.</p>
            <p className="mt-3">You will be responsible for paying for your own shipping costs for returning your item. Shipping costs are non-refundable. If you receive a refund, the cost of return shipping will be deducted from your refund.</p>
            <p className="mt-3">If you are returning more expensive items, you may consider using a trackable shipping service or purchasing shipping insurance. We don&apos;t guarantee that we will receive your returned item.</p>
          </section>
          <section className="bg-secondary-50 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-secondary-900 mb-3">Need Help?</h2>
            <p className="mb-4">Contact us for questions related to refunds and returns.</p>
            <a href={`mailto:${EMAIL}`} className="inline-flex items-center gap-2 btn-outline"><Mail size={18} />{EMAIL}</a>
          </section>
        </div>
      </div>
    </StorefrontLayout>
  );
}
