import Link from 'next/link';

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 pt-16">
      <div className="w-full max-w-sm text-center">
        <div className="text-5xl mb-6">📬</div>
        <h1 className="text-2xl font-black mb-3">Check your email</h1>
        <p className="text-text-secondary mb-8">
          We sent a verification link to your email address. Click it to activate your account and continue setup.
        </p>
        <p className="text-sm text-text-secondary">
          Already verified?{' '}
          <Link href="/login" className="text-brand hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
