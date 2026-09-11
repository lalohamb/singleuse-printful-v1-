'use client';
import { motion } from 'framer-motion';
import {
  Key, Palette, Rocket, ShoppingBag, CreditCard, Package,
  RefreshCw, LayoutDashboard, Shield, Globe, BarChart3,
  Zap, Search, Mail, LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Key, Palette, Rocket, ShoppingBag, CreditCard, Package,
  RefreshCw, LayoutDashboard, Shield, Globe, BarChart3,
  Zap, Search, Mail,
};

interface Step {
  iconName: string;
  step: string;
  title: string;
  desc: string;
  detail: string;
  bullets?: string[];
}

export default function HowItWorksSteps({ steps }: { steps: Step[] }) {
  return (
    <div className="relative">
      <div className="absolute left-8 top-0 bottom-0 w-px bg-border hidden md:block" />
      <div className="space-y-12">
        {steps.map(({ iconName, step, title, desc, detail, bullets }, i) => {
          const Icon = ICON_MAP[iconName] ?? Zap;
          return (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="flex gap-8 items-start"
            >
              <div className="relative flex-shrink-0 w-16 h-16 rounded-2xl bg-brand/10 border border-brand/30 flex items-center justify-center z-10">
                <Icon size={24} className="text-brand" />
                <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center">
                  {parseInt(step)}
                </span>
              </div>
              <div className="flex-1 pt-2 pb-4">
                <h3 className="text-2xl font-bold mb-3">{title}</h3>
                <p className="text-text-secondary leading-relaxed mb-3">{desc}</p>
                {bullets && bullets.length > 0 && (
                  <ul className="space-y-1.5 mb-3">
                    {bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm text-text-secondary">
                        <span className="text-accent mt-0.5 flex-shrink-0">✓</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-sm text-accent font-medium">{detail}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
