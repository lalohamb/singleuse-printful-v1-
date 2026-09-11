'use client';
import { useState } from 'react';
import { Copy, Check, Download, Loader2 } from 'lucide-react';

export default function DownloadPage() {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  // In production: fetch from download_purchases via Supabase
  const licenseKey = 'PPL-XXXX-XXXX-XXXX-XXXX';
  const licenseType = 'single';
  const downloadsUsed = 1;
  const maxDownloads = 5;

  const copy = () => {
    navigator.clipboard.writeText(licenseKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateUrl = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/download/generate-url', { method: 'POST' });
      const { url } = await res.json();
      if (url) window.open(url, '_blank');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-black mb-1">Downloads</h1>
      <p className="text-text-secondary text-sm mb-8">Your license key and download access.</p>

      <div className="bg-surface border border-border rounded-2xl p-6 space-y-5">
        <div>
          <div className="text-sm font-medium mb-2">License Key</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-bg border border-border rounded-xl px-4 py-2.5 font-mono text-sm text-brand">
              {licenseKey}
            </div>
            <button onClick={copy} className="p-2.5 border border-border rounded-xl hover:border-brand transition-colors">
              {copied ? <Check size={16} className="text-accent" /> : <Copy size={16} />}
            </button>
          </div>
          <p className="text-xs text-text-secondary mt-1.5">
            {licenseType === 'single' ? 'Single Site License' : 'Unlimited License'}
          </p>
        </div>

        <div>
          <div className="text-sm font-medium mb-2">Downloads</div>
          <div className="flex items-center justify-between text-sm text-text-secondary mb-2">
            <span>{downloadsUsed} of {maxDownloads} used</span>
            <span>{maxDownloads - downloadsUsed} remaining</span>
          </div>
          <div className="h-2 bg-bg rounded-full overflow-hidden">
            <div className="h-full bg-brand-gradient rounded-full" style={{ width: `${(downloadsUsed / maxDownloads) * 100}%` }} />
          </div>
        </div>

        <button onClick={generateUrl} disabled={generating || downloadsUsed >= maxDownloads}
          className="w-full bg-brand-gradient py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {generating ? 'Generating link…' : 'Download ZIP'}
        </button>

        <div className="border-t border-border pt-4 space-y-2">
          <a href="#" className="block text-sm text-brand hover:underline">📖 Setup Guide</a>
          <a href="#" className="block text-sm text-brand hover:underline">🔧 Environment Variables Reference</a>
          <a href="mailto:hello@printifyplatform.com" className="block text-sm text-brand hover:underline">💬 Need help? Book a setup call →</a>
        </div>
      </div>
    </div>
  );
}
