import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";

export const runtime = "nodejs";

const RESEND_API = "https://api.resend.com";
const key = process.env.RESEND_API_KEY;

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  if (!key) return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });
  const body = await req.json();
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
  if (!key) return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });

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
