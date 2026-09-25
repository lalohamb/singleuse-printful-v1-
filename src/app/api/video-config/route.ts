import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data } = await supabase
    .from("settings")
    .select("video_enabled, video_tracks")
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    enabled: data?.video_enabled ?? false,
    tracks: (data?.video_tracks ?? []) as { id: string; name: string; url: string; enabled: boolean; thumb_url?: string }[],
  });
}
