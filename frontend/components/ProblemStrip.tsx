'use client';
import { Link2, ShoppingCart, LayoutDashboard, LucideIcon } from 'lucide-react';
import FadeUp from './FadeUp';

const ICON_MAP: Record<string, LucideIcon> = { Link2, ShoppingCart, LayoutDashboard };

interface Problem {
  iconName: string;
  problem: string;
  solution: string;
}

export default function ProblemStrip({ problems }: { problems: Problem[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {problems.map(({ iconName, problem, solution }) => {
        const Icon = ICON_MAP[iconName] ?? Link2;
        return (
          <FadeUp key={problem}>
            <div className="text-center p-8 rounded-2xl border border-border bg-bg hover:border-brand/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center mx-auto mb-5">
                <Icon size={22} className="text-brand" />
              </div>
              <p className="text-text-secondary text-sm mb-3 line-through">{problem}</p>
              <p className="font-semibold text-white">{solution}</p>
            </div>
          </FadeUp>
        );
      })}
    </div>
  );
}
