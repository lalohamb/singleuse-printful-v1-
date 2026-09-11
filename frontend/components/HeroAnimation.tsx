'use client';
import { motion } from 'framer-motion';

function BrowserMockup({ label, branded }: { label: string; branded: boolean }) {
  return (
    <div className={`rounded-xl border overflow-hidden text-left ${branded ? 'border-brand/60 shadow-[0_0_40px_rgba(108,71,255,0.25)]' : 'border-border opacity-60'}`}>
      {/* Browser chrome */}
      <div className="bg-surface px-4 py-3 flex items-center gap-2 border-b border-border">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
        </div>
        <div className={`flex-1 mx-3 rounded-md px-3 py-1 text-xs font-mono truncate ${branded ? 'bg-brand/10 text-brand' : 'bg-border/40 text-text-secondary'}`}>
          {branded ? 'yourstore.com' : 'printify.com/shop/abc123xyz'}
        </div>
      </div>
      {/* Content */}
      <div className={`p-5 min-h-[160px] ${branded ? 'bg-bg' : 'bg-surface'}`}>
        {branded ? (
          <div className="space-y-3">
            <div className="h-5 w-32 rounded bg-brand/30" />
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-lg overflow-hidden">
                  <div className="h-16 bg-brand/10 rounded-t-lg" />
                  <div className="p-1.5 space-y-1">
                    <div className="h-2 w-full rounded bg-border" />
                    <div className="h-2 w-2/3 rounded bg-border" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2 opacity-50">
            <div className="h-3 w-24 rounded bg-border" />
            <div className="h-3 w-full rounded bg-border" />
            <div className="h-3 w-3/4 rounded bg-border" />
            <div className="h-8 w-28 rounded bg-border mt-4" />
          </div>
        )}
      </div>
      <div className={`px-5 py-2 text-xs font-semibold border-t border-border ${branded ? 'text-accent' : 'text-text-secondary'}`}>
        {label}
      </div>
    </div>
  );
}

export default function HeroAnimation() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="mt-16 grid grid-cols-2 gap-4 max-w-2xl mx-auto"
    >
      <BrowserMockup label="❌ Generic Printify link" branded={false} />
      <BrowserMockup label="✅ Your branded store" branded={true} />
    </motion.div>
  );
}
