"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, ShoppingBag, DollarSign, TrendingUp, Clock, CheckCircle, PauseCircle, PlayCircle, CreditCard, Users } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase, formatPrice } from "@/lib/supabase";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import { useAdminAuth } from "@/lib/admin-auth";
import type { Order, Product, StoreSettings } from "@/types";
import AppImage from "@/components/AppImage";

type DayBucket = { date: string; revenue: number; orders: number };

function buildDailyBuckets(orders: { created_at: string; total: number }[]): DayBucket[] {
  const now = new Date();
  const buckets: Record<string, DayBucket> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = { date: key, revenue: 0, orders: 0 };
  }
  for (const o of orders) {
    const key = o.created_at.slice(0, 10);
    if (buckets[key]) {
      buckets[key].revenue += Number(o.total);
      buckets[key].orders += 1;
    }
  }
  return Object.values(buckets).map(b => ({
    ...b,
    date: new Date(b.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));
}

const priceFormatter = (v: number) => `$${(v / 100).toFixed(0)}`;

function Dashboard() {
  const { session } = useAdminAuth();
  const [stats, setStats] = useState({ totalOrders: 0, totalRevenue: 0, awaitingFulfillment: 0, inProduction: 0, totalProducts: 0, totalCustomers: 0, avgOrderValue: 0 });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [topBySales, setTopBySales] = useState<{ title: string; image_url: string; units: number; revenue: number }[]>([]);
  const [dailyBuckets, setDailyBuckets] = useState<DayBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [stripeLive, setStripeLive] = useState<boolean | null>(null);

  const fetchStripeMode = () =>
    fetch("/api/stripe-mode", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(d => { if (d) setStripeLive(d.active_mode === "live"); });

  useEffect(() => {
    if (!session) return;
    Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(5),
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("settings").select("id, orders_paused").limit(1).maybeSingle(),
      supabase.from("orders").select("id, total, status", { count: "exact" }).neq("status", "cancelled").neq("status", "pending"),
      supabase.from("orders").select("id", { count: "exact" }).eq("status", "paid").is("printify_order_id", null),
      supabase.from("orders").select("id", { count: "exact" }).eq("fulfillment_status", "in-production"),
      supabase.from("customer_profiles").select("id", { count: "exact" }),
      supabase.from("orders").select("items").in("status", ["paid","fulfilled","shipped","delivered"]),
      supabase.from("orders").select("created_at, total").in("status", ["paid","fulfilled","shipped","delivered"]).gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    ]).then(([ordersRes, productsRes, settingsRes, countRes, awaitingRes, inProductionRes, customersRes, paidOrdersRes, chartRes]) => {
      const orders = (ordersRes.data || []) as Order[];
      const products = (productsRes.data || []) as Product[];
      const s = settingsRes.data as Pick<StoreSettings, "id" | "orders_paused"> | null;
      const allPaidOrders = (countRes.data || []) as { total: number; status: string }[];

      const salesMap = new Map<string, { title: string; image_url: string; units: number; revenue: number }>();
      for (const order of (paidOrdersRes.data || [])) {
        for (const item of (Array.isArray(order.items) ? order.items : [])) {
          const key = item.title || item.product_id || "unknown";
          const existing = salesMap.get(key);
          const units = Number(item.quantity) || 1;
          const revenue = (Number(item.price) || 0) * units;
          if (existing) { existing.units += units; existing.revenue += revenue; }
          else salesMap.set(key, { title: item.title || key, image_url: item.image_url || "", units, revenue });
        }
      }
      setTopBySales([...salesMap.values()].sort((a, b) => b.units - a.units).slice(0, 5));

      const totalRevenue = allPaidOrders.filter(o => ["paid","fulfilled","shipped","delivered"].includes(o.status)).reduce((sum, o) => sum + Number(o.total), 0);
      const totalOrders = countRes.count ?? 0;

      setRecentOrders(orders);
      setStats({
        totalOrders,
        totalRevenue,
        awaitingFulfillment: awaitingRes.count ?? 0,
        inProduction: inProductionRes.count ?? 0,
        totalProducts: products.length,
        totalCustomers: customersRes.count ?? 0,
        avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
      });
      setRecentProducts(products.slice(0, 5));
      if (s) { setSettingsId(s.id); setPaused(!!s.orders_paused); }
      setDailyBuckets(buildDailyBuckets((chartRes.data || []) as { created_at: string; total: number }[]));
      setLoading(false);
      fetchStripeMode();
    });

    const onVisible = () => { if (document.visibilityState === "visible") fetchStripeMode(); };
    const onModeChanged = (e: Event) => { setStripeLive((e as CustomEvent).detail === "live"); };
    const onFocus = () => fetchStripeMode();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("stripe-mode-changed", onModeChanged);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("stripe-mode-changed", onModeChanged);
      window.removeEventListener("focus", onFocus);
    };
  }, [session]);

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
    { label: "Total Customers", value: stats.totalCustomers, icon: Users, color: "bg-blue-50 text-blue-600" },
    { label: "Avg Order Value", value: formatPrice(stats.avgOrderValue), icon: TrendingUp, color: "bg-purple-50 text-purple-600" },
    { label: "Awaiting Fulfillment", value: stats.awaitingFulfillment, icon: Clock, color: stats.awaitingFulfillment > 0 ? "bg-amber-50 text-amber-600" : "bg-secondary-50 text-secondary-400" },
    { label: "In Production", value: stats.inProduction, icon: Package, color: "bg-primary-50 text-primary-600" },
  ];

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div>;

  const hasChartData = dailyBuckets.some(b => b.revenue > 0 || b.orders > 0);

  return (
    <div className="space-y-8">
      {stripeLive !== null && (
        <Link href="/admin/stripe" className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold w-fit border transition-colors hover:opacity-80 ${
          stripeLive ? "bg-success-50 border-success-200 text-success-700" : "bg-amber-50 border-amber-200 text-amber-700"
        }`}>
          <CreditCard size={14} />
          Stripe: {stripeLive ? "LIVE" : "TEST"}
        </Link>
      )}
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-6 border border-secondary-100 shadow-sm">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${stat.color}`}><stat.icon size={24} /></div>
            <p className="text-2xl font-bold text-secondary-900">{stat.value}</p>
            <p className="text-sm text-secondary-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
          <h2 className="font-semibold text-secondary-900 mb-1">Revenue — Last 30 Days</h2>
          <p className="text-xs text-secondary-400 mb-4">Paid, shipped &amp; delivered orders only</p>
          {!hasChartData ? (
            <div className="flex items-center justify-center h-48 text-secondary-300 text-sm">No revenue data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dailyBuckets} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={6} />
                <YAxis tickFormatter={priceFormatter} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={48} />
                <Tooltip formatter={(v) => [formatPrice(Number(v)), "Revenue"]} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Area type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} fill="url(#revGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
          <h2 className="font-semibold text-secondary-900 mb-1">Orders — Last 30 Days</h2>
          <p className="text-xs text-secondary-400 mb-4">Daily order volume trend</p>
          {!hasChartData ? (
            <div className="flex items-center justify-center h-48 text-secondary-300 text-sm">No order data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyBuckets} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={6} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={32} />
                <Tooltip formatter={(v) => [Number(v), "Orders"]} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="orders" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Orders */}
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
        {/* Top Products by Sales */}
        <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-gold-500" />
            <h2 className="font-semibold text-secondary-900">Top Products by Sales</h2>
          </div>
          {topBySales.length === 0 ? (
            <p className="text-secondary-400 text-center py-8 text-sm">No sales data yet</p>
          ) : (
            <div className="space-y-3">
              {topBySales.map((p, i) => (
                <div key={p.title} className="flex items-center gap-3">
                  <span className="text-lg font-display font-bold text-secondary-200 w-6 text-center">{i + 1}</span>
                  <AppImage src={p.image_url || ""} alt={p.title} width={44} height={44} className="w-11 h-11 rounded-lg object-cover bg-secondary-100 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-secondary-900 truncate">{p.title}</p>
                    <p className="text-xs text-secondary-500">{p.units} unit{p.units !== 1 ? "s" : ""} sold</p>
                  </div>
                  <span className="text-sm font-semibold text-success-600">{formatPrice(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions + Recent Products */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-secondary-900">Recent Products</h2>
              <Link href="/admin/products" className="text-sm text-primary-600 hover:text-primary-700 font-medium">Manage</Link>
            </div>
            {recentProducts.length === 0 ? <p className="text-secondary-400 text-center py-8">No products yet</p> : (
              <div className="space-y-2">
                {recentProducts.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary-50 transition-colors">
                    <AppImage src={p.image_url || ""} alt={p.title} width={48} height={48} className="w-12 h-12 rounded-lg object-cover bg-secondary-100" />
                    <div className="flex-1 min-w-0"><p className="font-medium text-sm text-secondary-900 truncate">{p.title}</p><p className="text-xs text-secondary-500">{formatPrice(p.price)}</p></div>
                    <span className={`text-xs px-2 py-1 rounded-full ${p.status === "active" ? "bg-success-50 text-success-600" : "bg-secondary-100 text-secondary-500"}`}>{p.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
            <h2 className="font-semibold text-secondary-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link href="/admin/products" className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary-50 transition-colors"><span className="flex items-center gap-3 text-secondary-700"><Package size={20} className="text-primary-500" />Manage Products</span><TrendingUp size={18} className="text-secondary-300" /></Link>
              <Link href="/admin/orders" className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary-50 transition-colors"><span className="flex items-center gap-3 text-secondary-700"><ShoppingBag size={20} className="text-primary-500" />View Orders</span><TrendingUp size={18} className="text-secondary-300" /></Link>
              <Link href="/admin/customers" className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary-50 transition-colors"><span className="flex items-center gap-3 text-secondary-700"><Users size={20} className="text-primary-500" />View Customers</span><TrendingUp size={18} className="text-secondary-300" /></Link>
              <Link href="/admin/settings" className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary-50 transition-colors"><span className="flex items-center gap-3 text-secondary-700"><DollarSign size={20} className="text-primary-500" />Store Settings</span><TrendingUp size={18} className="text-secondary-300" /></Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return <ProtectedAdmin><Dashboard /></ProtectedAdmin>;
}
