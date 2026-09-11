import { DollarSign, Store, TrendingDown, TrendingUp, Download } from 'lucide-react';

const STATS = [
  { label: 'MRR', value: '$0', icon: DollarSign, color: 'text-accent' },
  { label: 'Active Stores', value: '0', icon: Store, color: 'text-brand' },
  { label: 'Trial Conversions', value: '0', icon: TrendingUp, color: 'text-yellow-400' },
  { label: 'Churn This Month', value: '0', icon: TrendingDown, color: 'text-red-400' },
  { label: 'Download Sales', value: '0', icon: Download, color: 'text-blue-400' },
];

export default function PlatformAdminPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-black mb-1">Platform Overview</h1>
      <p className="text-text-secondary text-sm mb-8">Real-time platform metrics.</p>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        {STATS.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-surface border border-border rounded-2xl p-5">
            <Icon size={18} className={`${color} mb-3`} />
            <div className="text-2xl font-black mb-0.5">{value}</div>
            <div className="text-text-secondary text-xs">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="font-semibold mb-4">Recent Provisioning Jobs</h2>
        <p className="text-text-secondary text-sm">No jobs yet. Jobs appear here as merchants sign up.</p>
      </div>
    </div>
  );
}
