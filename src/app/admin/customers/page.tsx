"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle, Eye, Loader2, Mail, MapPin, Package, Phone, RefreshCw, Search, Trash2, UserCircle, Users, X } from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import { formatPrice } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/errors";

type AdminCustomer = {
  id: string;
  email: string;
  username: string;
  full_name: string;
  phone: string;
  newsletter_opt_in: boolean;
  address: Record<string, unknown>;
  preferences: Record<string, unknown>;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  profile_updated_at: string | null;
  has_profile: boolean;
  order_count: number;
  total_spent: number;
  last_order_at: string | null;
};

type CustomersResponse = {
  customers: AdminCustomer[];
  profile_table_available: boolean;
};

function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString();
}

function formatAddress(address: Record<string, unknown>): string {
  const parts = [
    textValue(address.line1),
    textValue(address.line2),
    [textValue(address.city), textValue(address.state), textValue(address.zip)].filter(Boolean).join(", "),
    textValue(address.country),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "No saved address";
}

function CustomerAdmin() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [selected, setSelected] = useState<AdminCustomer | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "unconfirmed">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [profileTableAvailable, setProfileTableAvailable] = useState(true);

  const fetchCustomers = async () => {
    setRefreshing(true);
    setError("");
    try {
      const res = await fetch("/api/admin/customers", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load customers");
      const payload = data as CustomersResponse;
      setCustomers(payload.customers || []);
      setProfileTableAvailable(payload.profile_table_available);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchCustomers();
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return customers
      .filter((c) => {
        if (statusFilter === "confirmed") return !!c.email_confirmed_at;
        if (statusFilter === "unconfirmed") return !c.email_confirmed_at;
        return true;
      })
      .filter((c) =>
        !needle || [c.email, c.full_name, c.username, c.phone, c.id].some((v) => v.toLowerCase().includes(needle))
      );
  }, [customers, search, statusFilter]);

  const deleteCustomer = async (customer: AdminCustomer) => {
    setDeleting(customer.id);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: customer.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
      if (selected?.id === customer.id) setSelected(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeleting(null);
    }
  };

  const stats = useMemo(() => ({
    totalCustomers: customers.length,
    newsletterCount: customers.filter((customer) => customer.newsletter_opt_in).length,
    orderingCustomers: customers.filter((customer) => customer.order_count > 0).length,
    totalRevenue: customers.reduce((sum, customer) => sum + customer.total_spent, 0),
  }), [customers]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-secondary-400" /></div>;
  }

  return (
    <div className="space-y-6">
      {!profileTableAvailable && (
        <div className="bg-warning-50 border border-warning-100 rounded-lg p-4 text-sm text-warning-700">
          Customer profile table is not available yet. Run the customer profile SQL migration so saved addresses and preferences appear here.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Account creators" value={stats.totalCustomers.toString()} icon={Users} />
        <StatCard label="With orders" value={stats.orderingCustomers.toString()} icon={Package} />
        <StatCard label="Newsletter opt-ins" value={stats.newsletterCount.toString()} icon={Mail} />
        <StatCard label="Tracked revenue" value={formatPrice(stats.totalRevenue)} icon={CheckCircle} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={18} className="absolute left-3 top-2.5 text-secondary-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers by name, email, phone, or ID..." className="input-field pl-10 py-2" />
        </div>
        <div className="flex gap-1 bg-secondary-100 p-1 rounded-lg">
          {(["all", "confirmed", "unconfirmed"] as const).map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              statusFilter === f ? "bg-white text-secondary-900 shadow-sm" : "text-secondary-500 hover:text-secondary-700"
            }`}>
              {f === "all" ? `All (${customers.length})` : f === "confirmed" ? `Confirmed (${customers.filter(c => !!c.email_confirmed_at).length})` : `Unconfirmed (${customers.filter(c => !c.email_confirmed_at).length})`}
            </button>
          ))}
        </div>
        <button onClick={fetchCustomers} disabled={refreshing} className="flex items-center gap-2 text-sm text-secondary-500 hover:text-secondary-900 transition-colors">
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && <div className="bg-error-50 border border-error-100 rounded-lg p-4 text-sm text-error-700">{error}</div>}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-secondary-100 shadow-sm text-center py-16">
          <UserCircle size={42} className="mx-auto mb-3 text-secondary-200" />
          <p className="text-secondary-400">No customer accounts found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary-50 border-b border-secondary-100">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700">Customer</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700 hidden md:table-cell">Contact</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700 hidden lg:table-cell">Created</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700">Orders</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700 hidden sm:table-cell">Profile</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-secondary-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {filtered.map((customer) => (
                  <tr key={customer.id} className="hover:bg-secondary-50 transition-colors cursor-pointer" onClick={() => setSelected(customer)}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-secondary-900">{customer.full_name}</p>
                      <p className="text-xs text-secondary-500">{customer.username || "No username"}</p>
                      {!customer.email_confirmed_at && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Unconfirmed</span>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-sm text-secondary-700">{customer.email}</p>
                      <p className="text-xs text-secondary-500">{customer.phone || "No phone"}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary-600 hidden lg:table-cell">{formatDate(customer.created_at)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-secondary-900">{customer.order_count}</p>
                      <p className="text-xs text-secondary-500">{formatPrice(customer.total_spent)}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs px-2 py-1 rounded-full ${customer.has_profile ? "bg-success-50 text-success-700" : "bg-secondary-100 text-secondary-500"}`}>
                        {customer.has_profile ? "Synced" : "Auth only"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setSelected(customer); }} className="p-2 text-secondary-500 hover:text-secondary-900 hover:bg-secondary-100 rounded-lg transition-colors" aria-label={`View ${customer.full_name}`}>
                          <Eye size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteCustomer(customer); }} disabled={deleting === customer.id} className="p-2 text-error-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors disabled:opacity-40" aria-label={`Delete ${customer.full_name}`}>
                          {deleting === customer.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && <CustomerModal customer={selected} onClose={() => setSelected(null)} onDelete={deleteCustomer} />}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-secondary-100 shadow-sm">
      <div className="w-11 h-11 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center mb-3">
        <Icon size={22} />
      </div>
      <p className="text-2xl font-bold text-secondary-900">{value}</p>
      <p className="text-sm text-secondary-500 mt-1">{label}</p>
    </div>
  );
}

function CustomerModal({ customer, onClose, onDelete }: { customer: AdminCustomer; onClose: () => void; onDelete: (c: AdminCustomer) => void }) {
  const preferences = customer.preferences;
  const preferenceRows = [
    ["Tee size", textValue(preferences.teeSize)],
    ["Hoodie size", textValue(preferences.hoodieSize)],
    ["Fit", textValue(preferences.fit)],
    ["Favorite category", textValue(preferences.favoriteCategory)],
    ["Contact", textValue(preferences.preferredContact)],
    ["Personalization", textValue(preferences.personalizationText)],
  ].filter(([, value]) => value);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-secondary-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-secondary-100 sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-secondary-900">{customer.full_name}</h2>
            <p className="text-sm text-secondary-500">{customer.email}</p>
            {!customer.email_confirmed_at && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Unconfirmed</span>}
          </div>
          <div className="flex items-center gap-2">
            <a href={`/admin/orders?search=${encodeURIComponent(customer.email)}`} className="btn-outline py-1.5 text-xs flex items-center gap-1.5">
              <Package size={13} />View Orders
            </a>
            <button onClick={() => { onDelete(customer); onClose(); }} className="btn-outline py-1.5 text-xs text-error-600 border-error-200 hover:bg-error-50 flex items-center gap-1.5">
              <Trash2 size={13} />Delete
            </button>
            <button onClick={onClose} className="p-2 text-secondary-400 hover:text-secondary-900"><X size={20} /></button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <InfoTile icon={Package} label="Orders" value={`${customer.order_count}`} detail={formatPrice(customer.total_spent)} />
            <InfoTile icon={Calendar} label="Last order" value={formatDate(customer.last_order_at)} />
            <InfoTile icon={CheckCircle} label="Email" value={customer.email_confirmed_at ? "Confirmed" : "Unconfirmed"} />
          </div>

          <section className="bg-secondary-50 rounded-lg p-4">
            <h3 className="font-semibold text-secondary-900 mb-3">Contact</h3>
            <div className="space-y-2 text-sm text-secondary-600">
              <p className="flex items-center gap-2"><Mail size={16} />{customer.email}</p>
              <p className="flex items-center gap-2"><Phone size={16} />{customer.phone || "No phone saved"}</p>
              <p className="flex items-start gap-2"><MapPin size={16} className="mt-0.5" />{formatAddress(customer.address)}</p>
            </div>
          </section>

          <section className="bg-secondary-50 rounded-lg p-4">
            <h3 className="font-semibold text-secondary-900 mb-3">Profile Details</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <Detail label="Username" value={customer.username || "No username"} />
              <Detail label="Newsletter" value={customer.newsletter_opt_in ? "Opted in" : "Not opted in"} />
              <Detail label="Created" value={formatDate(customer.created_at)} />
              <Detail label="Last sign in" value={formatDate(customer.last_sign_in_at)} />
              <Detail label="Profile source" value={customer.has_profile ? "customer_profiles" : "Auth metadata"} />
              <Detail label="Profile updated" value={formatDate(customer.profile_updated_at)} />
            </dl>
          </section>

          <section className="bg-secondary-50 rounded-lg p-4">
            <h3 className="font-semibold text-secondary-900 mb-3">Preferences</h3>
            {preferenceRows.length === 0 ? (
              <p className="text-sm text-secondary-500">No apparel preferences saved yet.</p>
            ) : (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {preferenceRows.map(([label, value]) => <Detail key={label} label={label} value={value} />)}
              </dl>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value, detail }: { icon: typeof Package; label: string; value: string; detail?: string }) {
  return (
    <div className="bg-white border border-secondary-100 rounded-lg p-4">
      <Icon size={18} className="text-primary-500 mb-2" />
      <p className="text-xs text-secondary-500">{label}</p>
      <p className="font-semibold text-secondary-900">{value}</p>
      {detail && <p className="text-xs text-secondary-500 mt-1">{detail}</p>}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-secondary-400">{label}</dt>
      <dd className="font-medium text-secondary-800 break-words">{value}</dd>
    </div>
  );
}

export default function AdminCustomersPage() {
  return <ProtectedAdmin><CustomerAdmin /></ProtectedAdmin>;
}
