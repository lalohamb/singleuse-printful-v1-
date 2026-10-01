import { createClient } from "@supabase/supabase-js";
import type { Category } from "@/types";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: "no-store" }) } }
  );
}

export async function getCategories(): Promise<Category[]> {
  const sb = getClient();
  const { data } = await sb.from("categories").select("*").order("name");
  return (data ?? []) as Category[];
}
