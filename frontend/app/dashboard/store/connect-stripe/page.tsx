'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ExternalLink } from 'lucide-react';

interface ManualKeys { publishableKey: string; secretKey: string }

export default function ConnectStripePage() {
  const [mode, setMode] = useState<'oauth' | 'manual' | null>(null);
  const [connected, setConnected] = useState(false);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<ManualKeys>();

  const onManualSubmit = async (data: ManualKeys) => {
    await new Promise((r) => setTimeout(r, 800));
    setConnected(true);
  };

  if (connected) {
    return (
      <div className="p-8 max-w-lg">
        <h1 className="text-2xl font-black mb-8">Connect Stripe</h1>
        <div className="bg-accent/10 border border-accent/30 rounded-xl px-5 py-4 mb-4">
          <div className="font-semibold text-accent mb-1">✓ Stripe Connected</div>
          <div className="text-sm text-text-secondary">Payments go directly to your Stripe account.</div>
        </div>
        <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-brand hover:underline">
          Open Stripe Dashboard <ExternalLink size={14} />
        </a>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-black mb-1">Connect Stripe</h1>
      <p className="text-text-secondary text-sm mb-2">Payments go directly to your Stripe account. We never touch your money.</p>
      <p className="text-xs text-text-secondary mb-8 bg-surface border border-border rounded-lg px-3 py-2">
        💡 Stripe Connect (OAuth) gives a cleaner setup. Manual keys work if you already have Stripe configured.
      </p>

      {!mode && (
        <div className="space-y-3">
          <button onClick={() => setMode('oauth')}
            className="w-full p-4 rounded-xl border border-brand bg-brand/5 hover:bg-brand/10 transition-colors text-left">
            <div className="font-semibold">Connect with Stripe OAuth</div>
            <div className="text-text-secondary text-sm mt-1">Recommended · One-click setup</div>
          </button>
          <button onClick={() => setMode('manual')}
            className="w-full p-4 rounded-xl border border-border hover:border-brand/50 transition-colors text-left">
            <div className="font-semibold">Enter keys manually</div>
            <div className="text-text-secondary text-sm mt-1">Paste your publishable + secret keys</div>
          </button>
        </div>
      )}

      {mode === 'oauth' && (
        <div className="space-y-4">
          <a href="/api/stripe/connect-oauth"
            className="w-full bg-brand-gradient py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
            Connect Stripe Account →
          </a>
          <button onClick={() => setMode(null)} className="text-sm text-text-secondary hover:text-white transition-colors">← Back</button>
        </div>
      )}

      {mode === 'manual' && (
        <form onSubmit={handleSubmit(onManualSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Publishable Key</label>
            <input {...register('publishableKey', { required: true })} placeholder="pk_live_..."
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-brand transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Secret Key</label>
            <input type="password" {...register('secretKey', { required: true })} placeholder="sk_live_..."
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-brand transition-colors" />
          </div>
          <button type="submit" disabled={isSubmitting}
            className="w-full bg-brand-gradient py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-60">
            {isSubmitting ? 'Saving…' : 'Save Keys'}
          </button>
          <button type="button" onClick={() => setMode(null)} className="text-sm text-text-secondary hover:text-white transition-colors">← Back</button>
        </form>
      )}
    </div>
  );
}
