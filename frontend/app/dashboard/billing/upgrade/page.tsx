'use client';
import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

const PLANS = [
  {
    id: 'starter', name: 'Starter', price: 29,
    features: ['1 store', 'Custom domain', 'Printify sync', 'Stripe checkout', 'Admin dashboard'],
  },
  {
    id: 'pro', name: 'Pro', price: 79, popular: true,
    features: ['1 store', 'Everything in Starter', 'Priority support', 'Advanced analytics'],
  },
  {
    id: 'agency', name: 'Agency', price: 199,
    features: ['Up to 10 stores', 'Everything in Pro', 'White-label', 'Multi-shop management'],
  },
];

export default function UpgradePage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (planId: string) => {
    setLoading(planId);
    try {
      const res = await fetch('/api/checkout/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {
      setLoading(null);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-black mb-1">Upgrade Your Plan</h1>
      <p className="text-text-secondary text-sm mb-8">All plans include a 14-day free trial. Cancel anytime.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
        {PLANS.map((plan) => (
          <div key={plan.id}
            className={`bg-surface border rounded-2xl p-6 flex flex-col ${plan.popular ? 'border-brand' : 'border-border'}`}>
            {plan.popular && (
              <div className="text-xs bg-brand text-white px-2 py-0.5 rounded-full self-start mb-3">Most Popular</div>
            )}
            <div className="font-bold text-lg mb-1">{plan.name}</div>
            <div className="text-3xl font-black mb-4">${plan.price}<span className="text-text-secondary font-normal text-sm">/mo</span></div>
            <ul className="space-y-2 flex-1 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-text-secondary">
                  <Check size={14} className="text-accent flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <button onClick={() => handleUpgrade(plan.id)} disabled={!!loading}
              className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 ${
                plan.popular ? 'bg-brand-gradient hover:opacity-90' : 'border border-border hover:border-brand transition-colors'
              }`}>
              {loading === plan.id ? <Loader2 size={14} className="animate-spin" /> : null}
              {loading === plan.id ? 'Redirecting…' : 'Start Free Trial'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
