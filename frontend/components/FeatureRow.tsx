'use client';
import { motion } from 'framer-motion';
import { Zap, ShoppingCart, LayoutDashboard, Shield, Server, LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Zap, ShoppingCart, LayoutDashboard, Shield, Server,
};

interface Props {
  iconName: string;
  title: string;
  desc: string;
  flip: boolean;
}

export default function FeatureRow({ iconName, title, desc, flip }: Props) {
  const Icon = ICON_MAP[iconName] ?? Zap;
  return (
    <motion.div
      initial={{ opacity: 0, x: flip ? 40 : -40 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-col ${flip ? 'md:flex-row-reverse' : 'md:flex-row'} gap-12 items-center py-16 border-b border-border last:border-0`}
    >
      <div className="flex-1 w-full">
        <div className="rounded-2xl border border-border bg-surface p-10 flex items-center justify-center min-h-[200px]">
          <div className="w-20 h-20 rounded-2xl bg-brand/10 flex items-center justify-center">
            <Icon size={36} className="text-brand" />
          </div>
        </div>
      </div>
      <div className="flex-1">
        <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center mb-5">
          <Icon size={20} className="text-brand" />
        </div>
        <h3 className="text-2xl md:text-3xl font-bold mb-4">{title}</h3>
        <p className="text-text-secondary text-lg leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
}
