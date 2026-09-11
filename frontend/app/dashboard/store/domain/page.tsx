'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Copy, Check } from 'lucide-react';

interface FormData { customDomain: string }

export default function DomainPage() {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropletIp = '0.0.0.0'; // Replace with real IP from store_instances
  const { register, handleSubmit, watch, formState: { isSubmitting } } = useForm<FormData>();
  const domain = watch('customDomain');

  const onSubmit = async ({ customDomain }: FormData) => {
    await new Promise((r) => setTimeout(r, 600));
    setSaved(true);
  };

  const copy = () => {
    navigator.clipboard.writeText(dropletIp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-black mb-1">Custom Domain</h1>
      <p className="text-text-secondary text-sm mb-8">Point your own domain to your store.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium mb-1.5">Your Domain</label>
          <input {...register('customDomain', { required: true })} placeholder="mybrand.com"
            className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand transition-colors" />
        </div>
        <button type="submit" disabled={isSubmitting}
          className="bg-brand-gradient px-6 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60">
          {isSubmitting ? 'Saving…' : saved ? '✓ Saved' : 'Save Domain'}
        </button>
      </form>

      {domain && (
        <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold">DNS Setup Instructions</h2>
          <p className="text-text-secondary text-sm">Add this A record in your DNS provider (Cloudflare, Namecheap, etc.):</p>
          <div className="bg-bg rounded-xl p-4 font-mono text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span><span className="text-text-secondary">Type:</span> A</span>
            </div>
            <div><span className="text-text-secondary">Name:</span> @</div>
            <div className="flex items-center justify-between">
              <span><span className="text-text-secondary">Value:</span> {dropletIp}</span>
              <button onClick={copy} className="text-brand hover:opacity-80 transition-opacity">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <div><span className="text-text-secondary">TTL:</span> Auto</div>
          </div>
          <p className="text-xs text-text-secondary">SSL is auto-provisioned via Let&apos;s Encrypt once DNS propagates (up to 48h).</p>
        </div>
      )}
    </div>
  );
}
