import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  const { license_key } = await req.json();

  const { data: purchase } = await db
    .from('download_purchases')
    .select('id, download_count, max_downloads, expires_at')
    .eq('license_key', license_key)
    .single();

  if (!purchase) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  if (purchase.download_count >= purchase.max_downloads) {
    return new Response(JSON.stringify({ error: 'Download limit reached' }), { status: 403 });
  }

  const bucket = Deno.env.get('STORE_RELEASE_BUCKET') ?? 'releases';
  const file = Deno.env.get('STORE_RELEASE_FILE') ?? 'printifyplatform-v1.0.0.zip';

  const { data: signed } = await db.storage.from(bucket).createSignedUrl(file, 3600);
  if (!signed?.signedUrl) return new Response(JSON.stringify({ error: 'Failed to sign URL' }), { status: 500 });

  await db.from('download_purchases')
    .update({ download_count: purchase.download_count + 1 })
    .eq('id', purchase.id);

  return new Response(JSON.stringify({ url: signed.signedUrl }), { headers: { 'Content-Type': 'application/json' } });
});
