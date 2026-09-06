"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, ShoppingBag, DollarSign, TrendingUp, Clock, CheckCircle, PauseCircle, PlayCircle } from "lucide-react";
import { supabase, formatPrice } from "@/lib/supabase";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import type { Order, Product, StoreSettings } from "@/types";

function Dashboard() {
  const [stats, setStats] = useState({ totalOrders: 0, totalRevenue: 0, pendingOrders: 0, totalProducts: 0 });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(5),
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("settings").select("id, orders_paused").limit(1).maybeSingle(),
    ]).then(([ordersRes, productsRes, settingsRes]) => {
      const orders = (ordersRes.data || []) as Order[];
      const products = (productsRes.data || []) as Product[];
      const s = settingsRes.data as Pick<StoreSettings, "id" | "orders_paused"> | null;
      setRecentOrders(orders);
      setStats({ totalOrders: orders.length, totalRevenue: orders.filter((o) => ["paid","fulfilled","shipped","delivered"].includes(o.status)).reduce((sum, o) => sum + Number(o.total), 0), pendingOrders: orders.filter((o) => o.status === "pending").length, totalProducts: products.length });
      setRecentProducts(products.slice(0, 5));
      if (s) { setSettingsId(s.id); setPaused(!!s.orders_paused); }
      setLoading(false);
    });
  }, []);

  const togglePause = async () => {
    if (!settingsId) return;
    setPauseLoading(true);
    const next = !paused;
    await supabase.from("settings").update({ orders_paused: next }).eq("id", settingsId);
    setPaused(next);
    setPauseLoading(false);
  };

  const statCards = [
    { label: "Total Revenue", value: formatPrice(stats.totalRevenue), icon: DollarSign, color: "bg-success-50 text-success-600" },
    { label: "Total Orders", value: stats.totalOrders, icon: ShoppingBag, color: "bg-primary-50 text-primary-600" },
    { label: "Pending Orders", value: stats.pendingOrders, icon: Clock, color: "bg-warning-50 text-warning-600" },
    { label: "Total Products", value: stats.totalProducts, icon: Package, color: "bg-accent-50 text-accent-600" },
  ];

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div>;

  return (
    <div className="space-y-8">
      <div className={`flex items-center justify-between rounded-xl p-4 border ${paused ? "bg-red-50 border-red-200" : "bg-success-50 border-success-200"}`}>
        <div className="flex items-center gap-3">
          {paused ? <PauseCircle size={22} className="text-red-500" /> : <PlayCircle size={22} className="text-success-600" />}
          <div>
            <p className={`font-semibold text-sm ${paused ? "text-red-700" : "text-success-700"}`}>{paused ? "Orders are paused" : "Orders are open"}</p>
            <p className="text-xs text-secondary-500">{paused ? "Customers cannot checkout until you resume." : "Customers can place orders normally."}</p>
          </div>
        </div>
        <button onClick={togglePause} disabled={pauseLoading} className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors ${paused ? "bg-success-600 border-success-600 text-white hover:bg-success-700" : "bg-red-500 border-red-500 text-white hover:bg-red-600"}`}>
          {pauseLoading ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : paused ? <><PlayCircle size={16} />Resume Orders</> : <><PauseCircle size={16} />Pause Orders</>}
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-6 border border-secondary-100 shadow-sm">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${stat.color}`}><stat.icon size={24} /></div>
            <p className="text-2xl font-bold text-secondary-900">{stat.value}</p>
            <p className="text-sm text-secondary-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-secondary-100">
          <h2 className="font-semibold text-secondary-900">Recent Orders</h2>
          <Link href="/admin/orders" className="text-sm text-primary-600 hover:text-primary-700 font-medium">View All</Link>
        </div>
        {recentOrders.length === 0 ? (
          <div className="p-12 text-center text-secondary-400"><ShoppingBag size={40} className="mx-auto mb-3 text-secondary-200" />No orders yet</div>
        ) : (
          <div className="divide-y divide-secondary-50">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-4 hover:bg-secondary-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${order.status === "paid" ? "bg-success-50 text-success-600" : order.status === "pending" ? "bg-warning-50 text-warning-600" : "bg-secondary-100 text-secondary-500"}`}>
                    {order.status === "paid" ? <CheckCircle size={20} /> : <Clock size={20} />}
                  </div>
                  <div>
                    <p className="font-medium text-secondary-900">#{order.id.slice(-8).toUpperCase()}</p>
                    <p className="text-sm text-secondary-500">{order.shipping_name} - {order.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-secondary-900">{formatPrice(Number(order.total))}</p>
                  <p className="text-xs text-secondary-500 capitalize">{order.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
          <h2 className="font-semibold text-secondary-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link href="/admin/products" className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary-50 transition-colors"><span className="flex items-center gap-3 text-secondary-700"><Package size={20} className="text-primary-500" />Manage Products</span><TrendingUp size={18} className="text-secondary-300" /></Link>
            <Link href="/admin/orders" className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary-50 transition-colors"><span className="flex items-center gap-3 text-secondary-700"><ShoppingBag size={20} className="text-primary-500" />View Orders</span><TrendingUp size={18} className="text-secondary-300" /></Link>
            <Link href="/admin/settings" className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary-50 transition-colors"><span className="flex items-center gap-3 text-secondary-700"><DollarSign size={20} className="text-primary-500" />Store Settings</span><TrendingUp size={18} className="text-secondary-300" /></Link>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-secondary-900">Recent Products</h2>
            <Link href="/admin/products" className="text-sm text-primary-600 hover:text-primary-700 font-medium">Manage</Link>
          </div>
          {recentProducts.length === 0 ? <p className="text-secondary-400 text-center py-8">No products yet</p> : (
            <div className="space-y-2">
              {recentProducts.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary-50 transition-colors">
                  <img src={p.image_url || ""} alt={p.title} className="w-12 h-12 rounded-lg object-cover bg-secondary-100" />
                  <div className="flex-1 min-w-0"><p className="font-medium text-sm text-secondary-900 truncate">{p.title}</p><p className="text-xs text-secondary-500">{formatPrice(p.price)}</p></div>
                  <span className={`text-xs px-2 py-1 rounded-full ${p.status === "active" ? "bg-success-50 text-success-600" : "bg-secondary-100 text-secondary-500"}`}>{p.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return <ProtectedAdmin><Dashboard /></ProtectedAdmin>;
}
