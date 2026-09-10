import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const RESEND_API = "https://api.resend.com";
const key = process.env.RESEND_API_KEY;

export async function POST(req: NextRequest) {
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

export async function GET(req: NextRequest) {
  if (!key) return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") || "/emails";
  const res = await fetch(`${RESEND_API}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
