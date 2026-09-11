import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  const { instance_id, merchant_id } = await req.json();

  await db.from('store_instances')
    .update({ status: 'suspended', updated_at: new Date().toISOString() })
    .eq('id', instance_id);

  await db.from('platform_events').insert({
    merchant_id,
    event_type: 'store.suspended',
    payload: { instance_id },
  });

  return new Response(JSON.stringify({ suspended: true }), { headers: { 'Content-Type': 'application/json' } });
});
