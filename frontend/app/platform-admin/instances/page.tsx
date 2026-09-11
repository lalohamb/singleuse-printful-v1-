export default function InstancesPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-black mb-1">Store Instances</h1>
      <p className="text-text-secondary text-sm mb-8">All provisioned store instances and their status.</p>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr className="text-text-secondary text-xs uppercase tracking-wider">
              <th className="text-left px-6 py-3">Store</th>
              <th className="text-left px-6 py-3">Subdomain</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-left px-6 py-3">Printify</th>
              <th className="text-left px-6 py-3">Stripe</th>
              <th className="text-left px-6 py-3">Provisioned</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="px-6 py-8 text-center text-text-secondary">
                No instances yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
