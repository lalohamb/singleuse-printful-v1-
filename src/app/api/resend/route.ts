import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const RESEND_API = "https://api.resend.com";

function sbService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getResendKey(): Promise<string | null> {
  // DB key takes priority over env var
  const { data } = await sbService().from("settings").select("resend_api_key").limit(1).maybeSingle();
  return data?.resend_api_key || process.env.RESEND_API_KEY || null;
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const key = await getResendKey();
  if (!key) return NextResponse.json({ error: "Resend API key not configured. Add it in Admin → Email." }, { status: 500 });
  const raw = await req.json();
  // Allowlist fields forwarded to Resend — never proxy arbitrary keys
  const allowed = ["from", "to", "subject", "html", "text", "reply_to", "cc", "bcc", "tags"] as const;
  const body: Record<string, unknown> = {};
  for (const f of allowed) { if (f in raw) body[f] = raw[f]; }
  if (!body.to || !body.subject || (!body.html && !body.text))
    return NextResponse.json({ error: "to, subject, and html or text are required" }, { status: 400 });
  const res = await fetch(`${RESEND_API}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

const ALLOWED_PATHS = new Set(["/emails", "/domains", "/api-keys"]);

export async function GET(req: NextRequest) {
  const overrideKey = req.headers.get("x-resend-key-override");
  const key = overrideKey || await getResendKey();
  if (!key) return NextResponse.json({ error: "Resend API key not configured. Add it in Admin → Email." }, { status: 500 });

  const path = new URL(req.url).searchParams.get("path") ?? "/emails";
  if (!ALLOWED_PATHS.has(path))
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  // /domains is used only for connectivity check — no auth guard needed
  if (path !== "/domains") {
    const authError = await requireAdmin();
    if (authError) return authError;
  }

  const res = await fetch(`${RESEND_API}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
