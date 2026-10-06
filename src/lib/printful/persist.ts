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

// V2 mockup entry — used when persisting directly from a completed V2MockupTask.
// No provider re-fetch required: mockup_url is already available in the V2 result.
export interface V2MockupEntry {
  placement: string;
  mockup_url: string;
  catalog_variant_id: number;   // V2 catalog variant ID — preserved as-is, not translated
}

/**
 * Downloads completed Printful mockup images server-side and stores them
 * permanently in Supabase Storage.
 *
 * V1 path: accepts PrintfulGeneratedMockup[] (from V1 task result).
 * Call this after a V1 task reaches "completed" status.
 * Printful mockup URLs are temporary — do not store them as permanent references.
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

/**
 * V2 path: persists mockup URLs directly from a completed V2MockupTask result.
 * No provider re-fetch. No V1 endpoint called.
 * catalog_variant_id remains in V2 identity space — not translated.
 */
export async function persistV2Mockups(
  mockups: V2MockupEntry[],
  taskId: number
): Promise<PersistedMockup[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const taskKey = String(taskId);
  const results: PersistedMockup[] = [];

  for (let i = 0; i < mockups.length; i++) {
    const m = mockups[i];
    const stored_url = await downloadAndStore(supabase, m.mockup_url, taskKey, i);
    results.push({
      placement: m.placement,
      variant_ids: [m.catalog_variant_id],   // V2 catalog variant ID preserved
      stored_url,
      original_url: m.mockup_url,
      option: null,
      option_group: null,
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
