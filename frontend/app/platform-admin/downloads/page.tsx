export default function AdminDownloadsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-black mb-1">Download Purchases</h1>
      <p className="text-text-secondary text-sm mb-8">License keys, activations, and download management.</p>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr className="text-text-secondary text-xs uppercase tracking-wider">
              <th className="text-left px-6 py-3">Email</th>
              <th className="text-left px-6 py-3">License Key</th>
              <th className="text-left px-6 py-3">Type</th>
              <th className="text-left px-6 py-3">Downloads</th>
              <th className="text-left px-6 py-3">Domain</th>
              <th className="text-left px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="px-6 py-8 text-center text-text-secondary">
                No purchases yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
