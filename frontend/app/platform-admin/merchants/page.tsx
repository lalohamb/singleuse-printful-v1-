export default function MerchantsPage() {
  // In production: fetch from merchants table via supabaseAdmin()
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black mb-1">Merchants</h1>
          <p className="text-text-secondary text-sm">All merchant accounts and their status.</p>
        </div>
        <button className="bg-brand-gradient px-5 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity">
          + Add Merchant
        </button>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr className="text-text-secondary text-xs uppercase tracking-wider">
              <th className="text-left px-6 py-3">Email</th>
              <th className="text-left px-6 py-3">Plan</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-left px-6 py-3">Store</th>
              <th className="text-left px-6 py-3">Created</th>
              <th className="text-left px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="px-6 py-8 text-center text-text-secondary">
                No merchants yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
