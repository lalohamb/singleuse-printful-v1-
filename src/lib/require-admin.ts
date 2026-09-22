import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Verifies the incoming request belongs to an authenticated admin.
 * Reads the Supabase session cookie, validates the JWT with the service role
 * client (so it cannot be spoofed), then checks the admins table.
 *
 * Returns null when the caller is a valid admin.
 * Returns a 401 NextResponse when the caller is not authenticated or not an admin.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const headersList = await headers();

  // Try Authorization header first (Bearer token)
  let token = "";
  const authHeader = headersList.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  // Fall back to cookie
  if (!token) {
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split("//")[1]?.split(".")[0];
    const cookieKey = `sb-${projectRef}-auth-token`;
    let raw = cookieStore.get(cookieKey)?.value ?? "";
    if (!raw) {
      let i = 0;
      while (true) {
        const chunk = cookieStore.get(`${cookieKey}.${i}`)?.value;
        if (!chunk) break;
        raw += chunk;
        i++;
      }
    }
    if (raw) {
      try {
        const parsed = JSON.parse(decodeURIComponent(raw));
        token = Array.isArray(parsed) ? parsed[0] : (parsed.access_token ?? parsed);
      } catch {
        token = raw;
      }
    }
  }

  if (!token) return unauthorized();

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return unauthorized();

  const { data } = await sb.from("admins").select("id").eq("id", user.id).maybeSingle();
  if (!data) return unauthorized();

  return null;
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
