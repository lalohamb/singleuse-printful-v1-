import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Blog — PrintifyPlatform',
};

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  return (
    <div className="pt-24 max-w-3xl mx-auto px-6 py-16">
      <Link href="/blog" className="inline-flex items-center gap-2 text-text-secondary hover:text-white transition-colors text-sm mb-10">
        <ArrowLeft size={16} /> Back to Blog
      </Link>
      <p className="text-brand text-sm font-semibold uppercase tracking-widest mb-4">Blog</p>
      <h1 className="text-4xl font-black mb-6 capitalize">{params.slug.replace(/-/g, ' ')}</h1>
      <p className="text-text-secondary leading-relaxed">
        Full article content coming soon. In the meantime, <Link href="/signup" className="text-brand hover:underline">launch your free store</Link>.
      </p>
    </div>
  );
}
