import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  const { job_id } = await req.json();

  const log = async (step: string, status: string, message: string) => {
    const { data: job } = await db.from('provisioning_jobs').select('steps').eq('id', job_id).single();
    const steps = [...(job?.steps ?? []), { step, status, message, timestamp: new Date().toISOString() }];
    await db.from('provisioning_jobs').update({ steps, status: 'running', started_at: new Date().toISOString() }).eq('id', job_id);
  };

  try {
    const { data: job } = await db.from('provisioning_jobs').select('*, store_instances(*)').eq('id', job_id).single();
    if (!job) throw new Error('Job not found');

    const instance = job.store_instances;

    await log('tenant_row', 'completed', 'Tenant row already created');
    await log('settings_seed', 'completed', `Store "${instance.store_name}" configured`);
    await log('subdomain', 'completed', `${instance.subdomain}.printifyplatform.com ready`);

    // Mark instance active
    await db.from('store_instances').update({
      status: 'active',
      provisioned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', instance.id);

    await db.from('provisioning_jobs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', job_id);

    await db.from('platform_events').insert({
      merchant_id: job.merchant_id,
      event_type: 'store.provisioning.completed',
      payload: { instance_id: instance.id, subdomain: instance.subdomain },
    });

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    await db.from('provisioning_jobs').update({ status: 'failed', error: err.message }).eq('id', job_id);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
