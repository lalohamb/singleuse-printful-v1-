import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  const { code, referrer, user_agent } = await req.json();
  if (!code || typeof code !== "string") return NextResponse.json({ ok: false });

  // Verify code belongs to an active affiliate
  const { data } = await sb().from("affiliates").select("id").eq("code", code.trim()).eq("status", "active").maybeSingle();
  if (!data) return NextResponse.json({ ok: false });

  await sb().from("affiliate_clicks").insert({
    code: code.trim(),
    referrer: typeof referrer === "string" ? referrer.slice(0, 500) : null,
    user_agent: typeof user_agent === "string" ? user_agent.slice(0, 300) : null,
  });

  return NextResponse.json({ ok: true });
}
