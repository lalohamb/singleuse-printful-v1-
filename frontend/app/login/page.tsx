'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { getSupabase } from '@/lib/supabase';

interface FormData { email: string; password: string }

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormData>();

  const onSubmit = async ({ email, password }: FormData) => {
    setError('');
    const db = getSupabase();
    if (!db) { setError('Service unavailable. Please try again later.'); return; }
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); return; }
    router.replace('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 pt-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="font-black text-2xl">
            <span className="text-white">Printify</span><span className="text-brand">Platform</span>
          </Link>
          <p className="text-text-secondary mt-2 text-sm">Sign in to your merchant dashboard</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-surface border border-border rounded-2xl p-8 space-y-4">
          {error && <p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">{error}</p>}

          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              {...register('email', { required: true })}
              placeholder="you@example.com"
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <input
              type="password"
              {...register('password', { required: true })}
              placeholder="••••••••"
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand-gradient py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 mt-2"
          >
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>

          <p className="text-center text-sm text-text-secondary pt-2">
            No account?{' '}
            <Link href="/signup" className="text-brand hover:underline">Start free trial</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
