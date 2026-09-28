import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// In-memory rate limit store: ip -> { count, windowStart }
// Resets per deployment — good enough for a single-server setup.
// For multi-instance deploys, swap this Map for a Redis/Upstash counter.
const attempts = new Map<string, { count: number; windowStart: number }>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_WINDOW = 5;          // max OTP requests per IP per hour

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= MAX_PER_WINDOW) return true;

  entry.count++;
  return false;
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before requesting another sign-in link." },
      { status: 429 }
    );
  }

  try {
    const { email, mode, data: userData } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    // Basic email format check — reject obviously fake patterns
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    // Reject emails with excessive dots in the local part (bot pattern: a.b.c.d.e@gmail.com)
    const localPart = email.split("@")[0];
    if ((localPart.match(/\./g) || []).length > 3) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: email.toLowerCase().trim(),
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/account`,
        data: mode === "signup" ? userData : undefined,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
