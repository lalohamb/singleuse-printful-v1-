"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Layers, CheckCircle, AlertTriangle, XCircle, Clock, Loader2 } from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";

type Batch = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  counts: Record<string, number>;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-secondary-100 text-secondary-600",
  planning: "bg-amber-50 text-amber-700",
  validated: "bg-blue-50 text-blue-700",
  ready: "bg-primary-50 text-primary-700",
  generating: "bg-purple-50 text-purple-700",
  processing: "bg-purple-50 text-purple-700",
  review: "bg-amber-50 text-amber-700",
  completed: "bg-success-50 text-success-700",
  failed: "bg-red-50 text-red-700",
  cancelled: "bg-secondary-100 text-secondary-400",
};

function BatchList() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/batches")
      .then((r) => r.json())
      .then((d) => { setBatches(d.batches ?? []); setLoading(false); });
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-secondary-300" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-secondary-900">Batch Catalog Generator</h1>
          <p className="text-sm text-secondary-500 mt-1">Create multiple products from designs × recipes</p>
        </div>
        <Link href="/admin/catalog-batches/new" className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          <Plus size={16} /> New Batch
        </Link>
      </div>

      {batches.length === 0 ? (
        <div className="bg-white rounded-xl border border-secondary-100 p-12 text-center">
          <Layers size={40} className="mx-auto mb-3 text-secondary-200" />
          <p className="text-secondary-500 text-sm">No batches yet. Create your first batch to generate products at scale.</p>
          <Link href="/admin/catalog-batches/new" className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm mt-4">
            <Plus size={16} /> New Batch
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => (
            <Link key={batch.id} href={`/admin/catalog-batches/${batch.id}`}
              className="block bg-white rounded-xl border border-secondary-100 p-4 hover:border-secondary-300 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Layers size={20} className="text-secondary-400" />
                  <div>
                    <p className="font-medium text-secondary-900">{batch.name}</p>
                    <p className="text-xs text-secondary-400">{new Date(batch.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {batch.counts.total > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      {batch.counts.pass > 0 && <span className="flex items-center gap-1 text-success-600"><CheckCircle size={12} />{batch.counts.pass}</span>}
                      {batch.counts.warning > 0 && <span className="flex items-center gap-1 text-amber-600"><AlertTriangle size={12} />{batch.counts.warning}</span>}
                      {batch.counts.fail > 0 && <span className="flex items-center gap-1 text-red-600"><XCircle size={12} />{batch.counts.fail}</span>}
                      <span className="text-secondary-400">{batch.counts.total} items</span>
                    </div>
                  )}
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[batch.status] ?? "bg-secondary-100 text-secondary-500"}`}>
                    {batch.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CatalogBatchesPage() {
  return <ProtectedAdmin><BatchList /></ProtectedAdmin>;
}
