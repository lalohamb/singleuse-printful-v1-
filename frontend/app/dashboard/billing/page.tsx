import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

export default function BillingPage() {
  // In production: fetch merchant + subscription data from Supabase
  const plan = 'trial';
  const daysLeft = 12;

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-black mb-1">Billing</h1>
      <p className="text-text-secondary text-sm mb-8">Manage your plan and payment details.</p>

      {/* Current plan */}
      <div className="bg-surface border border-border rounded-2xl p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-lg">Free Trial</span>
              <span className="text-xs bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded-full">Trialing</span>
            </div>
            <p className="text-text-secondary text-sm">{daysLeft} days remaining · No credit card on file</p>
          </div>
          <Link href="/dashboard/billing/upgrade"
            className="bg-brand-gradient px-5 py-2 rounded-full font-semibold text-sm hover:opacity-90 transition-opacity">
            Upgrade
          </Link>
        </div>
        <div className="h-2 bg-bg rounded-full overflow-hidden">
          <div className="h-full bg-brand-gradient rounded-full" style={{ width: `${(daysLeft / 14) * 100}%` }} />
        </div>
      </div>

      {/* Invoice history placeholder */}
      <div className="bg-surface border border-border rounded-2xl p-6 mb-4">
        <h2 className="font-semibold mb-4">Invoice History</h2>
        <p className="text-text-secondary text-sm">No invoices yet. Invoices appear here after your first payment.</p>
      </div>

      {/* Cancel */}
      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={16} className="text-text-secondary" />
          <span className="font-semibold">Cancel Subscription</span>
        </div>
        <p className="text-text-secondary text-sm mb-4">
          Your store stays live until the end of your billing period. Data is retained for 30 days.
        </p>
        <button className="text-sm text-red-400 hover:text-red-300 transition-colors border border-red-400/30 px-4 py-2 rounded-lg hover:border-red-400/60">
          Cancel Subscription
        </button>
      </div>
    </div>
  );
}
