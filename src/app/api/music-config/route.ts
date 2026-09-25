import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data } = await supabase
    .from("settings")
    .select("music_enabled, music_tracks, music_shuffle")
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    enabled: data?.music_enabled ?? false,
    tracks: (data?.music_tracks ?? []) as { id: string; name: string; url: string; enabled: boolean }[],
    shuffle: data?.music_shuffle ?? false,
  });
}
