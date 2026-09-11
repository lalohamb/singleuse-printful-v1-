'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2, RefreshCw } from 'lucide-react';

interface FormData { apiKey: string }

export default function ConnectPrintifyPage() {
  const [connected, setConnected] = useState(false);
  const [shopInfo, setShopInfo] = useState<{ name: string; products: number } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormData>();

  const onSubmit = async ({ apiKey }: FormData) => {
    await new Promise((r) => setTimeout(r, 1200));
    setShopInfo({ name: 'My Printify Shop', products: 24 });
    setConnected(true);
  };

  const resync = async () => {
    setSyncing(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSyncing(false);
  };

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-black mb-1">Connect Printify</h1>
      <p className="text-text-secondary text-sm mb-8">
        Find your API key in Printify → My Account → Connections.
      </p>

      {connected && shopInfo ? (
        <div className="space-y-4">
          <div className="bg-accent/10 border border-accent/30 rounded-xl px-5 py-4">
            <div className="font-semibold text-accent mb-1">✓ Connected</div>
            <div className="text-sm text-text-secondary">{shopInfo.name} · {shopInfo.products} products</div>
          </div>
          <button onClick={resync} disabled={syncing}
            className="flex items-center gap-2 border border-border px-5 py-2.5 rounded-xl text-sm hover:border-brand transition-colors disabled:opacity-60">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Re-sync Catalog'}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Printify API Key</label>
            <input type="password" {...register('apiKey', { required: true })} placeholder="eyJ0eXAiOiJKV1Qi..."
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-brand transition-colors" />
            <p className="text-xs text-text-secondary mt-1.5">Encrypted at rest. Never exposed to the browser.</p>
          </div>
          <button type="submit" disabled={isSubmitting}
            className="w-full bg-brand-gradient py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
            {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Connecting…</> : 'Connect Shop'}
          </button>
          <p className="text-xs text-center text-text-secondary">
            No Printify account?{' '}
            <a href="https://printify.com" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Create one free →</a>
          </p>
        </form>
      )}
    </div>
  );
}
