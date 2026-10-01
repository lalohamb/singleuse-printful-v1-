import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PrintfulGeneratedMockup } from "./types";

const BUCKET = "store-images";
const FOLDER = "mockups";

export interface PersistedMockup {
  placement: string;
  variant_ids: number[];
  stored_url: string;
  original_url: string;
  option: string | null;
  option_group: string | null;
}

/**
 * Downloads completed Printful mockup images server-side and stores them
 * permanently in Supabase Storage.
 *
 * Call this after a task reaches "completed" status.
 * Printful mockup URLs are temporary — do not store them as permanent references.
 *
 * V2 note: when migrating to Mockup Generator v2, only the shape of
 * PrintfulGeneratedMockup changes. This function's signature stays the same.
 */
export async function persistGeneratedMockups(
  mockups: PrintfulGeneratedMockup[],
  taskKey: string
): Promise<PersistedMockup[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results: PersistedMockup[] = [];

  for (let i = 0; i < mockups.length; i++) {
    const m = mockups[i];
    const stored_url = await downloadAndStore(supabase, m.mockup_url, taskKey, i);
    results.push({
      placement: m.placement,
      variant_ids: m.variant_ids,
      stored_url,
      original_url: m.mockup_url,
      option: m.option,
      option_group: m.option_group,
    });
  }

  return results;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function downloadAndStore(
  supabase: SupabaseClient<any>,
  url: string,
  taskKey: string,
  index: number
): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download mockup: ${res.status}`);

  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const ext = contentType.includes("png") ? "png" : "jpg";
  const safeKey = taskKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  const path = `${FOLDER}/${safeKey}-${index}.${ext}`;

  const buffer = Buffer.from(await res.arrayBuffer());

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
