import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

const attempts = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 3;

function getIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) { attempts.set(ip, { count: 1, windowStart: now }); return false; }
  if (entry.count >= MAX_PER_WINDOW) return true;
  entry.count++;
  return false;
}

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function generateCode(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}${suffix}`;
}

export async function POST(req: NextRequest) {
  if (isRateLimited(getIp(req))) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  try {
    const { name, email, platform_url, follower_count, total_views, payout_method, payout_handle } = await req.json();

    if (!name || !email || !platform_url || !payout_method || !payout_handle)
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });

    // Check program is enabled
    const { data: settings } = await sb().from("settings").select("affiliate_program_enabled").limit(1).maybeSingle();
    if (settings?.affiliate_program_enabled === false)
      return NextResponse.json({ error: "The affiliate program is not currently accepting applications." }, { status: 403 });

    // Check duplicate
    const { data: existing } = await sb().from("affiliates").select("id").eq("email", email.toLowerCase()).maybeSingle();
    if (existing) return NextResponse.json({ error: "An application with this email already exists." }, { status: 409 });

    // Generate unique code
    let code = generateCode(name);
    let attempts = 0;
    while (attempts < 5) {
      const { data: clash } = await sb().from("affiliates").select("id").eq("code", code).maybeSingle();
      if (!clash) break;
      code = generateCode(name);
      attempts++;
    }

    await sb().from("affiliates").insert({
      name: name.trim().slice(0, 100),
      email: email.toLowerCase().trim(),
      code,
      platform_url: platform_url.trim().slice(0, 500),
      follower_count: Number(follower_count) || 0,
      total_views: Number(total_views) || 0,
      payout_method,
      payout_handle: payout_handle.trim().slice(0, 100),
      status: "pending",
      commission_rate: 0.10,
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
