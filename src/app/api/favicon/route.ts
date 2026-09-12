import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Allowlist: only proxy images hosted on these origins.
// Add your Supabase storage bucket hostname here if you use a custom domain.
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
    : null,
  "https://images.pexels.com",
  "https://images.unsplash.com",
].filter(Boolean) as string[];

function isAllowed(url: string): boolean {
  try {
    const { origin } = new URL(url);
    return ALLOWED_ORIGINS.some((o) => origin === o);
  } catch {
    return false;
  }
}

export async function GET() {
  const { data } = await supabase
    .from("settings")
    .select("favicon_url")
    .limit(1)
    .maybeSingle();

  const faviconUrl = data?.favicon_url;
  if (!faviconUrl) return new NextResponse(null, { status: 404 });

  if (!isAllowed(faviconUrl)) {
    console.warn("[favicon] Blocked disallowed URL:", faviconUrl);
    return new NextResponse(null, { status: 404 });
  }

  const upstream = await fetch(faviconUrl, { headers: { Accept: "image/*" } });
  if (!upstream.ok) return new NextResponse(null, { status: 404 });

  const contentType = upstream.headers.get("content-type") ?? "image/x-icon";
  if (!contentType.startsWith("image/")) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
