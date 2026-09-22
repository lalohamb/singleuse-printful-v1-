import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MAX_ADMINS = 3;

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getCallerAdmin(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!token) return null;
  const { data: { user } } = await sb().auth.getUser(token);
  if (!user) return null;
  const { data } = await sb().from("admins").select("id, role").eq("id", user.id).maybeSingle();
  return data ?? null;
}

// GET — list all admins
export async function GET(req: NextRequest) {
  const caller = await getCallerAdmin(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await sb().from("admins").select("id, email, role, created_at").order("created_at");
  return NextResponse.json({ admins: data ?? [] });
}

// POST — invite new admin or remove existing
export async function POST(req: NextRequest) {
  const caller = await getCallerAdmin(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (caller.role !== "super_admin") return NextResponse.json({ error: "Super admin only" }, { status: 403 });

  const body = await req.json();
  const action: string = body.action ?? "";

  // Sanitize inputs
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  const targetId: string = typeof body.id === "string" ? body.id.trim() : "";
  const role: string = body.role === "super_admin" ? "super_admin" : "admin";

  if (action === "invite") {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // Enforce max 3 admins
    const { count } = await sb().from("admins").select("id", { count: "exact" });
    if ((count ?? 0) >= MAX_ADMINS) {
      return NextResponse.json({ error: `Maximum of ${MAX_ADMINS} admins allowed` }, { status: 400 });
    }

    // Invite via Supabase Auth (sends magic link email)
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
    const { data: invited, error: inviteErr } = await sb().auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/admin/accept-invite`,
    });
    if (inviteErr || !invited.user) {
      return NextResponse.json({ error: inviteErr?.message ?? "Invite failed" }, { status: 500 });
    }

    // Insert into admins table
    const { error: insertErr } = await sb().from("admins").insert({ id: invited.user.id, email, role });
    if (insertErr) {
      // Clean up auth user if admins insert fails
      await sb().auth.admin.deleteUser(invited.user.id);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: `Invite sent to ${email}` });
  }

  if (action === "remove") {
    if (!targetId) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    // Cannot remove yourself
    if (targetId === caller.id) return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });

    await sb().from("admins").delete().eq("id", targetId);
    await sb().auth.admin.deleteUser(targetId);
    return NextResponse.json({ ok: true });
  }

  if (action === "change_role") {
    if (!targetId) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    if (targetId === caller.id) return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
    await sb().from("admins").update({ role }).eq("id", targetId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
