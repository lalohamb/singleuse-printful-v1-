import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";
import { getErrorMessage } from "@/lib/errors";
import type { CustomerProfileRow, Order } from "@/types";

export const runtime = "nodejs";

type CustomerMetadata = {
  username?: string;
  full_name?: string;
  phone?: string;
  newsletter_opt_in?: boolean;
  address?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
};

type OrderStats = {
  order_count: number;
  total_spent: number;
  last_order_at: string | null;
};

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not set" }, { status: 500 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const [{ data: usersData, error: usersError }, profilesResult, { data: ordersData, error: ordersError }, { data: adminsData, error: adminsError }] = await Promise.all([
      sb.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      sb.from("customer_profiles").select("*").order("created_at", { ascending: false }),
      sb.from("orders").select("email,total,status,created_at").order("created_at", { ascending: false }),
      sb.from("admins").select("id"),
    ]);

    if (usersError) throw usersError;
    if (ordersError) throw ordersError;
    if (adminsError) throw adminsError;

    const profilesError = profilesResult.error;
    const profiles = profilesError ? [] : ((profilesResult.data || []) as CustomerProfileRow[]);
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    const adminIds = new Set((adminsData || []).map((admin) => admin.id));
    const statsByEmail = new Map<string, OrderStats>();
    const paidStatuses = new Set(["paid", "fulfilled", "shipped", "delivered"]);

    for (const order of (ordersData || []) as Pick<Order, "email" | "total" | "status" | "created_at">[]) {
      const key = order.email.toLowerCase();
      const current = statsByEmail.get(key) || { order_count: 0, total_spent: 0, last_order_at: null };
      current.order_count += 1;
      if (paidStatuses.has(order.status)) current.total_spent += Number(order.total || 0);
      if (!current.last_order_at || new Date(order.created_at) > new Date(current.last_order_at)) {
        current.last_order_at = order.created_at;
      }
      statsByEmail.set(key, current);
    }

    const customers = (usersData.users || []).filter((user) => !adminIds.has(user.id)).map((user) => {
      const metadata = (user.user_metadata || {}) as CustomerMetadata;
      const profile = profileById.get(user.id);
      const email = user.email || profile?.email || "";
      const stats = statsByEmail.get(email.toLowerCase()) || { order_count: 0, total_spent: 0, last_order_at: null };

      return {
        id: user.id,
        email,
        username: profile?.username || metadata.username || "",
        full_name: profile?.full_name || metadata.full_name || email.split("@")[0] || "Customer",
        phone: profile?.phone || metadata.phone || "",
        newsletter_opt_in: profile?.newsletter_opt_in ?? metadata.newsletter_opt_in ?? false,
        address: profile?.address || metadata.address || {},
        preferences: profile?.preferences || metadata.preferences || {},
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at || null,
        email_confirmed_at: user.email_confirmed_at || null,
        profile_updated_at: profile?.updated_at || null,
        has_profile: Boolean(profile),
        order_count: stats.order_count,
        total_spent: stats.total_spent,
        last_order_at: stats.last_order_at,
      };
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ customers, profile_table_available: !profilesError });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
