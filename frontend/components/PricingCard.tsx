'use client';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import Link from 'next/link';

interface Props {
  name: string;
  price: number;
  stores: string;
  popular?: boolean;
  features: { label: string; included: boolean }[];
}

export default function PricingCard({ name, price, stores, popular, features }: Props) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`relative rounded-2xl border p-8 flex flex-col ${
        popular
          ? 'border-brand bg-brand/5 shadow-[0_0_40px_rgba(108,71,255,0.2)]'
          : 'border-border bg-surface'
      }`}
    >
      {popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-gradient text-white text-xs font-bold px-4 py-1 rounded-full">
          Most Popular
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-lg font-bold mb-1">{name}</h3>
        <p className="text-text-secondary text-sm mb-4">{stores} store{stores !== '1' ? 's' : ''}</p>
        <div className="flex items-end gap-1">
          <span className="text-4xl font-black">${price}</span>
          <span className="text-text-secondary mb-1">/mo</span>
        </div>
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {features.map((f) => (
          <li key={f.label} className="flex items-center gap-3 text-sm">
            {f.included
              ? <Check size={16} className="text-accent flex-shrink-0" />
              : <X size={16} className="text-border flex-shrink-0" />}
            <span className={f.included ? 'text-white' : 'text-text-secondary'}>{f.label}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/signup"
        className={`block text-center py-3 rounded-full font-semibold transition-opacity hover:opacity-90 ${
          popular ? 'bg-brand-gradient text-white' : 'border border-border hover:border-brand hover:text-brand'
        }`}
      >
        Start Free Trial
      </Link>
    </motion.div>
  );
}
