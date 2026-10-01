"use client";
import { useEffect, useState } from "react";
import { Search, Eye, X, Package, Truck, RefreshCw, CheckCircle, AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { supabase, formatPrice } from "@/lib/supabase";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import type { Order } from "@/types";
import { getErrorMessage } from "@/lib/errors";
import AppImage from "@/components/AppImage";

type PrintfulOrderData = {
  status?: string;
  shipments?: { number?: string | null; url?: string | null }[];
};

const statusColors: Record<string, string> = {
  pending: "bg-warning-50 text-warning-600", paid: "bg-success-50 text-success-600",
  fulfilled: "bg-primary-50 text-primary-600", "partially-fulfilled": "bg-warning-100 text-warning-700",
  shipped: "bg-primary-100 text-primary-700", delivered: "bg-success-100 text-success-700",
  cancelled: "bg-error-50 text-error-600",
};

function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [selected, setSelected] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [infoDismissed, setInfoDismissed] = useState(false);

  const fetchOrders = () => {
    setLoading(true);
    supabase.from("orders").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setOrders((data || []) as Order[]);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel("orders-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = orders.filter((o) => {
    const matchesSearch = o.shipping_name.toLowerCase().includes(search.toLowerCase()) || o.email.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    const matchesMode = modeFilter === "all" || (modeFilter === "live" ? o.livemode : !o.livemode);
    return matchesSearch && matchesStatus && matchesMode;
  });

  const deleteOrder = async (id: string) => {
    if (!confirm("Delete this test order from the database?")) return;
    setDeleting(id);
    await supabase.from("orders").delete().eq("id", id);
    setOrders((prev) => prev.filter((o) => o.id !== id));
    if (selected?.id === id) setSelected(null);
    setDeleting(null);
  };

  const updateStatus = async (id: string, status: string): Promise<boolean> => {
    if (status === "cancelled") {
      const order = orders.find((o) => o.id === id);
      if (order?.printful_order_id) {
        // Printful cancellation is handled via webhook — just update DB
      }
    }
    await supabase.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    supabase.from("orders").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setOrders((data || []) as Order[]);
      const updated = (data || []).find((o) => o.id === id);
      if (updated) setSelected(updated as Order);
    });
    return true;
  };

  return (
    <div className="space-y-6">
      {!infoDismissed && (
        <div className="bg-primary-50 border border-primary-100 rounded-lg p-4 flex items-start justify-between gap-4">
          <div className="space-y-3 text-sm text-secondary-700">
            <p className="font-semibold text-secondary-900 text-base">How Orders Work</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <span className="text-lg leading-none mt-0.5">💳</span>
                <div><p className="font-medium">Customer places order</p><p className="text-secondary-500 text-xs">Stripe processes payment → order is created here with status <span className="px-1.5 py-0.5 rounded-full bg-warning-50 text-warning-600 text-[10px] font-medium">pending</span> then <span className="px-1.5 py-0.5 rounded-full bg-success-50 text-success-600 text-[10px] font-medium">paid</span>.</p></div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg leading-none mt-0.5">📦</span>
                <div><p className="font-medium">Sent to Printful</p><p className="text-secondary-500 text-xs">Paid orders are automatically submitted to Printful for printing &amp; fulfillment. A Printful Order ID is assigned.</p></div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg leading-none mt-0.5">🔄</span>
                <div><p className="font-medium">Fulfillment updates</p><p className="text-secondary-500 text-xs">Printful webhooks automatically update tracking and fulfillment status here when your order ships.</p></div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg leading-none mt-0.5">🚫</span>
                <div><p className="font-medium">Cancellations</p><p className="text-secondary-500 text-xs">Setting status to <span className="px-1.5 py-0.5 rounded-full bg-error-50 text-error-600 text-[10px] font-medium">cancelled</span> updates your store DB. Cancel in Printful Dashboard before the order enters production.</p></div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg leading-none mt-0.5">⚠️</span>
                <div><p className="font-medium">Live order rule</p><p className="text-secondary-500 text-xs">For live orders, do not manually change status — Printful webhooks keep it accurate automatically.</p></div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg leading-none mt-0.5">🧪</span>
                <div><p className="font-medium">Test orders</p><p className="text-secondary-500 text-xs">Orders placed in test mode show a <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">Test</span> badge and can be deleted. Live orders cannot be deleted.</p></div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg leading-none mt-0.5">📊</span>
                <div><p className="font-medium">Status is local</p><p className="text-secondary-500 text-xs">Changing status here updates your store DB only. Printful webhooks keep statuses accurate automatically.</p></div>
              </div>
            </div>
          </div>
          <button onClick={() => setInfoDismissed(true)} className="flex-shrink-0 text-secondary-400 hover:text-secondary-700"><X size={16} /></button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]"><Search size={18} className="absolute left-3 top-2.5 text-secondary-400" /><input type="text" placeholder="Search by name, email, or order ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10 py-2" /></div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field py-2 w-auto">
          <option value="all">All Status</option>
          {["pending","paid","fulfilled","partially-fulfilled","shipped","delivered","cancelled"].map((s) => <option key={s} value={s}>{s.split("-").map(w => w.charAt(0).toUpperCase()+w.slice(1)).join(" ")}</option>)}
        </select>
        <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)} className="input-field py-2 w-auto">
          <option value="all">Live + Test</option>
          <option value="live">Live only</option>
          <option value="test">Test only</option>
        </select>
        <button onClick={fetchOrders} disabled={loading} className="flex items-center gap-2 text-sm text-secondary-500 hover:text-secondary-900 transition-colors">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />Refresh
        </button>
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
                  <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700 hidden sm:table-cell">Mode</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-secondary-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-secondary-50 transition-colors cursor-pointer" onClick={() => setSelected(order)}>
                    <td className="px-4 py-3"><p className="font-medium text-primary-600 hover:underline">#{order.id.slice(-8).toUpperCase()}</p><p className="text-xs text-secondary-400">{order.items.length} items</p></td>
                    <td className="px-4 py-3 hidden md:table-cell"><p className="text-sm font-medium text-secondary-900">{order.shipping_name}</p><p className="text-xs text-secondary-500">{order.email}</p></td>
                    <td className="px-4 py-3 text-sm text-secondary-600 hidden lg:table-cell">{new Date(order.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-secondary-900">{formatPrice(Number(order.total))}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full ${statusColors[order.status] || "bg-secondary-100 text-secondary-500"}`}>{order.status}</span></td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {order.livemode
                        ? <span className="text-xs px-2 py-1 rounded-full bg-success-50 text-success-700 font-medium">Live</span>
                        : <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">Test</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setSelected(order); }} className="p-2 text-secondary-500 hover:text-secondary-900 hover:bg-secondary-100 rounded-lg transition-colors"><Eye size={16} /></button>
                        {!order.livemode && (
                          <button onClick={(e) => { e.stopPropagation(); deleteOrder(order.id); }} disabled={deleting === order.id} className="p-2 text-error-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors disabled:opacity-40">
                            {deleting === order.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          </button>
                        )}
                      </div>
                    </td>
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

function OrderDetailModal({ order, onClose, onUpdateStatus }: { order: Order; onClose: () => void; onUpdateStatus: (id: string, status: string) => Promise<boolean> }) {
  const addr = order.shipping_address;
  const [localStatus, setLocalStatus] = useState(order.status);
  const [printfulData, setPrintfulData] = useState<PrintfulOrderData | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);

  // Keep local status in sync when parent updates the order prop
  useEffect(() => { setLocalStatus(order.status); }, [order.status]);

  const handleStatusChange = async (newStatus: string) => {
    setLocalStatus(newStatus);
    const ok = await onUpdateStatus(order.id, newStatus);
    if (!ok) setLocalStatus(order.status); // revert if aborted
  };

  const checkPrintful = async () => {
    if (!order.printful_order_id) return;
    setChecking(true); setCheckError(null); setSynced(false);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/printful-proxy/orders/${order.printful_order_id}`,
        { headers: { Authorization: `Bearer ${anonKey}` } }
      );
      if (!res.ok) throw new Error(`Printful returned ${res.status}`);
      const data = await res.json();
      setPrintfulData(data.result ?? data);
    } catch (e: unknown) {
      setCheckError(getErrorMessage(e));
    }
    setChecking(false);
  };

  const syncStatus = async () => {
    if (!printfulData) return;
    const statusMap: Record<string, string> = {
      "pending":             "paid",
      "in-production":       "fulfilled",
      "fulfilled":           "fulfilled",
      "partially-fulfilled": "fulfilled",
      "shipped":             "shipped",
      "delivered":           "delivered",
      "canceled":            "cancelled",
      "cancelled":           "cancelled",
    };
    const printfulStatus = printfulData.status ?? "";
    const newStatus = statusMap[printfulStatus] ?? localStatus;
    const shipment = printfulData.shipments?.[0];
    await supabase.from("orders").update({
      status: newStatus,
      fulfillment_status: printfulStatus,
      tracking_number: shipment?.number || order.tracking_number,
      tracking_url: shipment?.url || order.tracking_url,
      updated_at: new Date().toISOString(),
    }).eq("id", order.id);
    setLocalStatus(newStatus);
    setSynced(true);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-secondary-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-secondary-100 sticky top-0 bg-white rounded-t-2xl">
          <div><h2 className="text-lg font-bold text-secondary-900">Order #{order.id.slice(-8).toUpperCase()}</h2><p className="text-sm text-secondary-500">{new Date(order.created_at).toLocaleString()}</p></div>
          <button onClick={onClose} className="p-2 text-secondary-400 hover:text-secondary-900"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label className="label-text">Order Status <span className="text-xs font-normal text-secondary-400 ml-1">(updates your store only)</span></label>
            {order.livemode && (
              <div className="mb-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5 text-amber-500" />
                <span>For live orders, do not manually change status — Printful webhooks keep it accurate automatically.</span>
              </div>
            )}
            <select value={localStatus} onChange={(e) => handleStatusChange(e.target.value)} className="input-field">
              {[
                { value: "pending",             label: "Pending" },
                { value: "paid",                label: "Paid" },
                { value: "fulfilled",           label: "Fulfilled" },
                { value: "partially-fulfilled", label: "Partially Fulfilled" },
                { value: "shipped",             label: "Shipped" },
                { value: "delivered",           label: "Delivered" },
                { value: "cancelled",           label: "Cancelled" },
              ].map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
            <p className="text-xs text-secondary-400 mt-1">Setting to <strong>cancelled</strong> updates your store DB. Cancel in Printful Dashboard before the order enters production.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-secondary-50 rounded-lg p-4"><h3 className="text-sm font-semibold text-secondary-900 mb-2">Customer</h3><p className="text-sm text-secondary-600">{order.shipping_name}</p><p className="text-sm text-secondary-600">{order.email}</p></div>
            <div className="bg-secondary-50 rounded-lg p-4"><h3 className="text-sm font-semibold text-secondary-900 mb-2">Shipping Address</h3><p className="text-sm text-secondary-600">{addr.line1}</p>{addr.line2 && <p className="text-sm text-secondary-600">{addr.line2}</p>}<p className="text-sm text-secondary-600">{addr.city}, {addr.state} {addr.zip}</p><p className="text-sm text-secondary-600">{addr.country}</p></div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-secondary-900 mb-3">Items</h3>
            <div className="space-y-3">
              {(Array.isArray(order.items) ? order.items : []).map((item, i) => (
                <div key={i} className="flex items-center gap-3 pb-3 border-b border-secondary-50 last:border-0">
                  <AppImage src={item.image_url || "/product-placeholder.svg"} alt={item.title} width={56} height={56} className="w-14 h-14 rounded-lg object-cover bg-secondary-100" onError={async (e) => {
                    const el = e.target as HTMLImageElement;
                    if (item.product_id) {
                      const { data } = await supabase.from("products").select("image_url").eq("id", item.product_id).maybeSingle();
                      if (data?.image_url) { el.src = data.image_url; return; }
                    }
                    el.src = "/product-placeholder.svg";
                  }} />
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
          {order.printful_order_id && (
            <div className="bg-primary-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-secondary-900 flex items-center gap-2"><Truck size={18} className="text-primary-600" />Fulfillment</h3>
                <button onClick={checkPrintful} disabled={checking} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-primary-200 text-primary-700 hover:bg-primary-100 transition-colors disabled:opacity-50">
                  <RefreshCw size={13} className={checking ? "animate-spin" : ""} />{checking ? "Checking…" : "Check Printful"}
                </button>
              </div>
              <p className="text-sm text-secondary-600">Printful Order: {order.printful_order_id}</p>
              {order.fulfillment_status && <p className="text-sm text-secondary-600">Stored Status: <span className="font-medium">{order.fulfillment_status}</span></p>}
              {order.tracking_number && <p className="text-sm text-secondary-600">Tracking: {order.tracking_number}</p>}
              {order.tracking_url && <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:underline">Track Package</a>}
              {checkError && <p className="text-xs text-error-600 flex items-center gap-1"><AlertTriangle size={13} />{checkError}</p>}
              {printfulData && (
                <div className="border-t border-primary-100 pt-3 space-y-2">
                  <p className="text-xs font-semibold text-secondary-700 uppercase tracking-wide">Live from Printful</p>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-secondary-700">Status: <span className="font-semibold">{printfulData.status}</span></p>
                      {printfulData.shipments?.[0] && (
                        <p className="text-sm text-secondary-600">Tracking: {printfulData.shipments[0].number}</p>
                      )}
                    </div>
                    {!synced
                      ? <button onClick={syncStatus} className="text-xs px-3 py-1.5 rounded bg-secondary-900 text-white hover:bg-secondary-700 transition-colors">Sync to Order</button>
                      : <span className="flex items-center gap-1 text-xs text-success-600 font-medium"><CheckCircle size={13} />Synced!</span>
                    }
                  </div>
                </div>
              )}
            </div>
          )}
          {!order.printful_order_id && (order.tracking_number || order.fulfillment_status) && (
            <div className="bg-primary-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-secondary-900 mb-2 flex items-center gap-2"><Truck size={18} className="text-primary-600" />Fulfillment</h3>
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
