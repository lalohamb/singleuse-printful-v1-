import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <div className="text-8xl font-black text-brand/20 mb-4">404</div>
      <h1 className="text-3xl font-black mb-3">Page not found.</h1>
      <p className="text-text-secondary mb-8">This page doesn&apos;t exist. But your store can.</p>
      <div className="flex gap-4">
        <Link href="/" className="bg-brand-gradient px-6 py-3 rounded-full font-semibold hover:opacity-90 transition-opacity">
          Go Home
        </Link>
        <Link href="/signup" className="border border-border px-6 py-3 rounded-full font-semibold hover:border-brand hover:text-brand transition-colors">
          Launch My Store
        </Link>
      </div>
    </div>
  );
}
