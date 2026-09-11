export default function ProvisioningPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-black mb-1">Provisioning Queue</h1>
      <p className="text-text-secondary text-sm mb-8">Live job queue with step-by-step status.</p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Queued', value: '0', color: 'text-yellow-400' },
          { label: 'Running', value: '0', color: 'text-brand' },
          { label: 'Avg. Time', value: '—', color: 'text-accent' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface border border-border rounded-2xl p-5">
            <div className={`text-2xl font-black mb-0.5 ${color}`}>{value}</div>
            <div className="text-text-secondary text-xs">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="font-semibold mb-4">Recent Jobs</h2>
        <p className="text-text-secondary text-sm">No jobs yet.</p>
      </div>
    </div>
  );
}
