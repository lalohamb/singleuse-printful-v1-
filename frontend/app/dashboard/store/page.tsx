import Link from 'next/link';
import { ExternalLink, Globe, Printer, CreditCard } from 'lucide-react';

export default function StorePage() {
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-black mb-1">Store Settings</h1>
      <p className="text-text-secondary text-sm mb-8">Manage your store configuration and integrations.</p>

      <div className="space-y-4">
        <div className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-brand" />
              <span className="font-semibold">Domain</span>
            </div>
            <Link href="/dashboard/store/domain" className="text-sm text-brand hover:underline">Configure →</Link>
          </div>
          <div className="font-mono text-sm text-text-secondary">yourshop.printifyplatform.com</div>
          <div className="text-xs text-text-secondary mt-1">Custom domain: not configured</div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Printer size={16} className="text-brand" />
              <span className="font-semibold">Printify</span>
            </div>
            <Link href="/dashboard/store/connect-printify" className="text-sm text-brand hover:underline">Manage →</Link>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-accent">Connected</span>
            <span className="text-text-secondary">· 24 products synced</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="text-brand" />
              <span className="font-semibold">Stripe</span>
            </div>
            <Link href="/dashboard/store/connect-stripe" className="text-sm text-brand hover:underline">Manage →</Link>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <span className="text-yellow-400">Not connected</span>
          </div>
          <p className="text-xs text-text-secondary mt-2">Connect Stripe to accept payments. Payments go directly to your account.</p>
        </div>

        <a href="#" target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-between bg-surface border border-border rounded-2xl p-6 hover:border-brand/50 transition-colors">
          <span className="font-semibold">Open Store Admin Panel</span>
          <ExternalLink size={16} className="text-text-secondary" />
        </a>
      </div>
    </div>
  );
}
