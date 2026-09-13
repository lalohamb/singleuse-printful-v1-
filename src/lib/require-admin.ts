import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
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
  const cookieStore = cookies();

  // Supabase stores the access token in one of these cookie names depending on
  // the client version / SSR setup.
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split("//")[1]?.split(".")[0];
  const cookieKey = `sb-${projectRef}-auth-token`;

  // Reassemble chunked cookies (.0, .1, ...) or fall back to base key
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

  if (!raw) return unauthorized();

  let token: string;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    token = Array.isArray(parsed) ? parsed[0] : (parsed.access_token ?? parsed);
  } catch {
    token = raw;
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
