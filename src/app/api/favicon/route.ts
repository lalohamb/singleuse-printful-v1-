import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data } = await supabase
    .from("settings")
    .select("favicon_url")
    .limit(1)
    .maybeSingle();

  if (data?.favicon_url) {
    return NextResponse.redirect(data.favicon_url, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  }

  return new NextResponse(null, { status: 404 });
}
