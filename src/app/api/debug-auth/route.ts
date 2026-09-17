import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const all = cookieStore.getAll();
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

  let token: string | null = null;
  let parseError: string | null = null;
  let userId: string | null = null;
  let adminRow: unknown = null;

  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    token = Array.isArray(parsed) ? parsed[0] : (parsed.access_token ?? parsed);
  } catch (e) {
    parseError = String(e);
    token = raw || null;
  }

  if (token) {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: { user }, error: userError } = await sb.auth.getUser(token);
    userId = user?.id ?? null;
    if (user) {
      const { data } = await sb.from("admins").select("id").eq("id", user.id).maybeSingle();
      adminRow = data;
    }
  }

  return NextResponse.json({
    projectRef,
    cookieKey,
    cookieNames: all.map(c => c.name),
    rawLength: raw.length,
    parseError,
    tokenPrefix: token ? token.slice(0, 20) + "..." : null,
    userId,
    adminRow,
  });
}
