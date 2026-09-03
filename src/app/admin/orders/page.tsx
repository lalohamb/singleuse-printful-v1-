"use client";
import { useEffect, useState } from "react";
import { Search, Eye, X, Package, Truck } from "lucide-react";
import { supabase, formatPrice } from "@/lib/supabase";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import type { Order } from "@/types";

const statusColors: Record<string, string> = {
  pending: "bg-warning-50 text-warning-600", paid: "bg-success-50 text-success-600",
  fulfilled: "bg-primary-50 text-primary-600", shipped: "bg-primary-100 text-primary-700",
  delivered: "bg-success-100 text-success-700", cancelled: "bg-error-50 text-error-600",
};

function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Order | null>(null);

  const fetchOrders = () => { supabase.from("orders").select("*").order("created_at", { ascending: false }).then(({ data }) => { setOrders((data || []) as Order[]); setLoading(false); }); };
  useEffect(() => { fetchOrders(); }, []);

  const filtered = orders.filter((o) => {
    const matchesSearch = o.shipping_name.toLowerCase().includes(search.toLowerCase()) || o.email.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (statusFilter === "all" || o.status === statusFilter);
  });

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    supabase.from("orders").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setOrders((data || []) as Order[]);
      const updated = (data || []).find((o) => o.id === id);
      if (updated) setSelected(updated as Order);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]"><Search size={18} className="absolute left-3 top-2.5 text-secondary-400" /><input type="text" placeholder="Search by name, email, or order ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10 py-2" /></div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field py-2 w-auto">
          <option value="all">All Status</option>
          {["pending","paid","fulfilled","shipped","delivered","cancelled"].map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div> : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-secondary-100 shadow-sm text-center py-16"><Package size={40} className="mx-auto mb-3 text-secondary-200" /><p className="text-secondary-400">No orders found</p></div>
      ) : (
        <div className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary-50 border-b border-secondary-100">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700">Order</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700 hidden md:table-cell">Customer</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700 hidden lg:table-cell">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700">Total</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700">Status</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-secondary-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-secondary-50 transition-colors">
                    <td className="px-4 py-3"><p className="font-medium text-secondary-900">#{order.id.slice(-8).toUpperCase()}</p><p className="text-xs text-secondary-400">{order.items.length} items</p></td>
                    <td className="px-4 py-3 hidden md:table-cell"><p className="text-sm font-medium text-secondary-900">{order.shipping_name}</p><p className="text-xs text-secondary-500">{order.email}</p></td>
                    <td className="px-4 py-3 text-sm text-secondary-600 hidden lg:table-cell">{new Date(order.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-secondary-900">{formatPrice(Number(order.total))}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full ${statusColors[order.status] || "bg-secondary-100 text-secondary-500"}`}>{order.status}</span></td>
                    <td className="px-4 py-3 text-right"><button onClick={() => setSelected(order)} className="p-2 text-secondary-500 hover:text-secondary-900 hover:bg-secondary-100 rounded-lg transition-colors"><Eye size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {selected && <OrderDetailModal order={selected} onClose={() => setSelected(null)} onUpdateStatus={updateStatus} />}
    </div>
  );
}

function OrderDetailModal({ order, onClose, onUpdateStatus }: { order: Order; onClose: () => void; onUpdateStatus: (id: string, status: string) => void }) {
  const addr = order.shipping_address;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-secondary-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-secondary-100 sticky top-0 bg-white rounded-t-2xl">
          <div><h2 className="text-lg font-bold text-secondary-900">Order #{order.id.slice(-8).toUpperCase()}</h2><p className="text-sm text-secondary-500">{new Date(order.created_at).toLocaleString()}</p></div>
          <button onClick={onClose} className="p-2 text-secondary-400 hover:text-secondary-900"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-6">
          <div><label className="label-text">Order Status</label><select value={order.status} onChange={(e) => onUpdateStatus(order.id, e.target.value)} className="input-field">{["pending","paid","fulfilled","shipped","delivered","cancelled"].map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}</select></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-secondary-50 rounded-lg p-4"><h3 className="text-sm font-semibold text-secondary-900 mb-2">Customer</h3><p className="text-sm text-secondary-600">{order.shipping_name}</p><p className="text-sm text-secondary-600">{order.email}</p></div>
            <div className="bg-secondary-50 rounded-lg p-4"><h3 className="text-sm font-semibold text-secondary-900 mb-2">Shipping Address</h3><p className="text-sm text-secondary-600">{addr.line1}</p>{addr.line2 && <p className="text-sm text-secondary-600">{addr.line2}</p>}<p className="text-sm text-secondary-600">{addr.city}, {addr.state} {addr.zip}</p><p className="text-sm text-secondary-600">{addr.country}</p></div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-secondary-900 mb-3">Items</h3>
            <div className="space-y-3">
              {(Array.isArray(order.items) ? order.items : []).map((item, i) => (
                <div key={i} className="flex items-center gap-3 pb-3 border-b border-secondary-50 last:border-0">
                  <img src={item.image_url} alt={item.title} className="w-14 h-14 rounded-lg object-cover bg-secondary-100" />
                  <div className="flex-1 min-w-0"><p className="font-medium text-sm text-secondary-900">{item.title}</p><p className="text-xs text-secondary-500">{item.variant_label} - Qty: {item.quantity}</p></div>
                  <span className="font-semibold text-sm text-secondary-900">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-secondary-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-secondary-600">Subtotal</span><span className="font-medium">{formatPrice(Number(order.subtotal))}</span></div>
            <div className="flex justify-between text-sm"><span className="text-secondary-600">Shipping</span><span className="font-medium">{Number(order.shipping_cost) === 0 ? "Free" : formatPrice(Number(order.shipping_cost))}</span></div>
            <div className="flex justify-between text-base font-bold border-t border-secondary-200 pt-2"><span>Total</span><span>{formatPrice(Number(order.total))}</span></div>
          </div>
          {(order.tracking_number || order.fulfillment_status || order.printify_order_id) && (
            <div className="bg-primary-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-secondary-900 mb-2 flex items-center gap-2"><Truck size={18} className="text-primary-600" />Fulfillment</h3>
              {order.printify_order_id && <p className="text-sm text-secondary-600">Printify Order: {order.printify_order_id}</p>}
              {order.fulfillment_status && <p className="text-sm text-secondary-600">Status: {order.fulfillment_status}</p>}
              {order.tracking_number && <p className="text-sm text-secondary-600">Tracking: {order.tracking_number}</p>}
              {order.tracking_url && <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:underline">Track Package</a>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminOrdersPage() {
  return <ProtectedAdmin><Orders /></ProtectedAdmin>;
}
