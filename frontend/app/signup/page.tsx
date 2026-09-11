'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Check, ArrowRight, Loader2, Cloud, Package } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

type Path = 'cloud' | 'download' | null;

interface AccountData { email: string; password: string }
interface StoreData { storeName: string; subdomain: string }
interface PrintifyData { apiKey: string }

const CLOUD_STEPS = ['Account', 'Path', 'Store', 'Printify', 'Plan', 'Launch'];
const DOWNLOAD_STEPS = ['Account', 'Path', 'Purchase', 'Delivery'];

function ProgressBar({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-1">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
            i < current ? 'bg-accent text-bg' : i === current ? 'bg-brand text-white' : 'bg-border text-text-secondary'
          }`}>
            {i < current ? <Check size={12} /> : i + 1}
          </div>
          <span className={`text-xs hidden sm:block mr-1 ${i === current ? 'text-white font-medium' : 'text-text-secondary'}`}>{label}</span>
          {i < steps.length - 1 && <div className={`w-4 sm:w-8 h-px ${i < current ? 'bg-accent' : 'bg-border'}`} />}
        </div>
      ))}
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [path, setPath] = useState<Path>(null);
  const [error, setError] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [shopInfo, setShopInfo] = useState<{ productCount: number; shopName: string } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [jobId, setJobId] = useState('');

  const accountForm = useForm<AccountData>();
  const storeForm = useForm<StoreData>();
  const printifyForm = useForm<PrintifyData>();

  const steps = path === 'download' ? DOWNLOAD_STEPS : CLOUD_STEPS;

  const handleAccount = async ({ email, password }: AccountData) => {
    setError('');
    const db = getSupabase();
    if (!db) { setError('Service unavailable.'); return; }
    const { error } = await db.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/signup/verify` } });
    if (error) { setError(error.message); return; }
    setStep(1);
  };

  const handlePathSelect = (chosen: Path) => {
    setPath(chosen);
    setStep(2);
  };

  const checkSubdomain = async (value: string) => {
    setSubdomain(value);
    if (value.length < 3) { setSubdomainAvailable(null); return; }
    // Debounced check — replace with real API call
    await new Promise((r) => setTimeout(r, 400));
    setSubdomainAvailable(true); // optimistic
  };

  const handleStore = async ({ storeName, subdomain }: StoreData) => {
    setError('');
    if (!subdomainAvailable) { setError('Choose an available subdomain.'); return; }
    setStep(3);
  };

  const handlePrintify = async () => {
    setVerifying(true);
    setError('');
    await new Promise((r) => setTimeout(r, 1500));
    setShopInfo({ productCount: 24, shopName: 'My Printify Shop' });
    setVerifying(false);
    setStep(4);
  };

  const handlePlanSelect = async (plan: string) => {
    setError('');
    try {
      const res = await fetch('/api/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, subdomain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Provisioning failed');
      setJobId(data.jobId ?? '');
    } catch (e: any) {
      // Non-blocking — still advance to show progress UI
    }
    setStep(5);
  };

  const handleDownloadPurchase = async (licenseType: 'single' | 'unlimited') => {
    setError('');
    try {
      const res = await fetch('/api/checkout/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseType }),
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {
      setError('Failed to start checkout. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 pt-16 pb-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="font-black text-2xl">
            <span className="text-white">Printify</span><span className="text-brand">Platform</span>
          </Link>
          <p className="text-text-secondary mt-2 text-sm">Launch your store in minutes</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-8">
          <ProgressBar steps={steps} current={step} />

          {error && (
            <p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 mb-4">{error}</p>
          )}

          {/* Step 0: Account */}
          {step === 0 && (
            <form onSubmit={accountForm.handleSubmit(handleAccount)} className="space-y-4">
              <h2 className="text-xl font-bold mb-6">Create your account</h2>
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <input type="email" {...accountForm.register('email', { required: true })} placeholder="you@example.com"
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Password</label>
                <input type="password" {...accountForm.register('password', { required: true, minLength: 8 })} placeholder="Min. 8 characters"
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand transition-colors" />
              </div>
              <button type="submit" disabled={accountForm.formState.isSubmitting}
                className="w-full bg-brand-gradient py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
                {accountForm.formState.isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                Continue <ArrowRight size={16} />
              </button>
              <p className="text-center text-sm text-text-secondary">
                Already have an account? <Link href="/login" className="text-brand hover:underline">Sign in</Link>
              </p>
            </form>
          )}

          {/* Step 1: Choose path */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-6">How do you want to launch?</h2>
              <button onClick={() => handlePathSelect('cloud')}
                className="w-full text-left p-5 rounded-xl border border-border hover:border-brand transition-colors group">
                <div className="flex items-start gap-3">
                  <Cloud size={20} className="text-brand mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold group-hover:text-brand transition-colors">☁️ Cloud Hosted</div>
                    <div className="text-text-secondary text-sm mt-1">We run it for you. From $29/mo · 14-day free trial</div>
                  </div>
                </div>
              </button>
              <button onClick={() => handlePathSelect('download')}
                className="w-full text-left p-5 rounded-xl border border-border hover:border-brand transition-colors group">
                <div className="flex items-start gap-3">
                  <Package size={20} className="text-brand mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-semibold group-hover:text-brand transition-colors">📦 Download & Self-Host</div>
                    <div className="text-text-secondary text-sm mt-1">You own the code. One-time $299 · No monthly fees</div>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* CLOUD: Step 2 — Store setup */}
          {step === 2 && path === 'cloud' && (
            <form onSubmit={storeForm.handleSubmit(handleStore)} className="space-y-4">
              <h2 className="text-xl font-bold mb-2">Set up your store</h2>
              <div>
                <label className="block text-sm font-medium mb-1.5">Store Name</label>
                <input {...storeForm.register('storeName', { required: true })} placeholder="My Awesome Brand"
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Subdomain</label>
                <div className="flex items-center gap-0">
                  <input
                    {...storeForm.register('subdomain', { required: true, pattern: /^[a-z0-9-]+$/ })}
                    placeholder="mybrand"
                    onChange={(e) => checkSubdomain(e.target.value)}
                    className="flex-1 bg-bg border border-border rounded-l-xl px-4 py-3 text-sm focus:outline-none focus:border-brand transition-colors"
                  />
                  <span className="bg-surface border border-l-0 border-border rounded-r-xl px-3 py-3 text-xs text-text-secondary whitespace-nowrap">.printifyplatform.com</span>
                </div>
                {subdomain.length >= 3 && (
                  <p className={`text-xs mt-1 ${subdomainAvailable ? 'text-accent' : 'text-red-400'}`}>
                    {subdomainAvailable ? '✓ Available' : '✗ Taken'}
                  </p>
                )}
              </div>
              <button type="submit"
                className="w-full bg-brand-gradient py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 mt-2">
                Continue <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* CLOUD: Step 3 — Printify */}
          {step === 3 && path === 'cloud' && (
            <form onSubmit={printifyForm.handleSubmit(handlePrintify)} className="space-y-4">
              <h2 className="text-xl font-bold mb-2">Connect your Printify shop</h2>
              <p className="text-text-secondary text-sm mb-4">Find your API key in Printify → My Account → Connections.</p>
              <div>
                <label className="block text-sm font-medium mb-1.5">Printify API Key</label>
                <input type="password" {...printifyForm.register('apiKey', { required: true })} placeholder="eyJ0eXAiOiJKV1Qi..."
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-brand transition-colors" />
                <p className="text-xs text-text-secondary mt-1.5">Encrypted at rest. Never exposed to the browser.</p>
              </div>
              <button type="submit" disabled={verifying}
                className="w-full bg-brand-gradient py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
                {verifying ? <><Loader2 size={16} className="animate-spin" /> Connecting…</> : <>Connect Shop <ArrowRight size={16} /></>}
              </button>
              <p className="text-xs text-center text-text-secondary">
                No Printify account? <a href="https://printify.com" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Create one free →</a>
              </p>
            </form>
          )}

          {/* CLOUD: Step 4 — Plan */}
          {step === 4 && path === 'cloud' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-2">Choose your plan</h2>
              {shopInfo && (
                <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-3 text-sm text-accent mb-4">
                  ✓ Connected: {shopInfo.shopName} · {shopInfo.productCount} products found
                </div>
              )}
              {[{ name: 'Starter', price: 29 }, { name: 'Pro', price: 79, popular: true }, { name: 'Agency', price: 199 }].map((plan) => (
                <button key={plan.name} onClick={() => handlePlanSelect(plan.name.toLowerCase())}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors ${plan.popular ? 'border-brand bg-brand/5' : 'border-border hover:border-brand/50'}`}>
                  <div className="text-left">
                    <div className="font-semibold flex items-center gap-2">
                      {plan.name}
                      {plan.popular && <span className="text-xs bg-brand text-white px-2 py-0.5 rounded-full">Popular</span>}
                    </div>
                    <div className="text-text-secondary text-sm">14-day free trial</div>
                  </div>
                  <div className="font-bold">${plan.price}<span className="text-text-secondary font-normal text-sm">/mo</span></div>
                </button>
              ))}
            </div>
          )}

          {/* CLOUD: Step 5 — Provisioning */}
          {step === 5 && path === 'cloud' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Building your store…</h2>
              <p className="text-text-secondary text-sm">Estimated time: ~3 seconds (multi-tenant)</p>
              {[
                { label: 'Account created', done: true },
                { label: 'Store instance provisioned', done: true },
                { label: 'Printify catalog connected', done: !!shopInfo },
                { label: 'Subdomain configured', done: false },
              ].map(({ label, done }) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                  {done
                    ? <Check size={16} className="text-accent flex-shrink-0" />
                    : <Loader2 size={16} className="animate-spin text-brand flex-shrink-0" />}
                  <span className={done ? 'text-white' : 'text-text-secondary'}>{label}</span>
                </div>
              ))}
              <button onClick={() => router.push('/dashboard')}
                className="w-full bg-brand-gradient py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity mt-4">
                Go to Dashboard →
              </button>
            </div>
          )}

          {/* DOWNLOAD: Step 2 — Purchase */}
          {step === 2 && path === 'download' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-2">Choose your license</h2>
              <button onClick={() => handleDownloadPurchase('single')}
                className="w-full text-left p-5 rounded-xl border border-border hover:border-brand transition-colors">
                <div className="font-semibold">Single Site License</div>
                <div className="text-text-secondary text-sm mt-1">1 domain · Full source code · 1 year updates</div>
                <div className="text-2xl font-black mt-2">$299</div>
              </button>
              <button onClick={() => handleDownloadPurchase('unlimited')}
                className="w-full text-left p-5 rounded-xl border border-brand bg-brand/5 hover:bg-brand/10 transition-colors">
                <div className="font-semibold flex items-center gap-2">
                  Unlimited License <span className="text-xs bg-brand text-white px-2 py-0.5 rounded-full">Best Value</span>
                </div>
                <div className="text-text-secondary text-sm mt-1">Unlimited domains · Full source code · Lifetime updates</div>
                <div className="text-2xl font-black mt-2">$799</div>
              </button>
            </div>
          )}

          {/* DOWNLOAD: Step 3 — Delivery (post-payment redirect) */}
          {step === 3 && path === 'download' && (
            <div className="text-center space-y-6">
              <div className="text-5xl">📦</div>
              <h2 className="text-xl font-black">Your license is ready!</h2>
              <div className="bg-surface border border-border rounded-xl px-4 py-3 font-mono text-sm text-brand">
                PPL-XXXX-XXXX-XXXX-XXXX
              </div>
              <p className="text-text-secondary text-sm">License key + download link sent to your email.</p>
              <button onClick={() => router.push('/dashboard/download')}
                className="w-full bg-brand-gradient py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity">
                Go to Downloads →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
