import { supabaseAdmin } from './supabase';

export interface ProvisionInput {
  merchantId: string;
  storeName: string;
  subdomain: string;
  printifyApiKey: string;
  printifyShopId: string;
}

/** Multi-tenant provisioning: 4 SQL inserts, ~3 seconds */
export async function provisionStore(input: ProvisionInput): Promise<{ jobId: string }> {
  const db = supabaseAdmin();

  // 1. Create store instance row
  const { data: instance, error: instanceErr } = await db
    .from('store_instances')
    .insert({
      merchant_id: input.merchantId,
      store_name: input.storeName,
      subdomain: input.subdomain,
      status: 'provisioning',
      printify_connected: false,
      stripe_connected: false,
    })
    .select('id')
    .single();

  if (instanceErr || !instance) throw new Error(instanceErr?.message ?? 'Failed to create instance');

  // 2. Create provisioning job
  const { data: job, error: jobErr } = await db
    .from('provisioning_jobs')
    .insert({
      instance_id: instance.id,
      merchant_id: input.merchantId,
      status: 'queued',
      steps: [],
    })
    .select('id')
    .single();

  if (jobErr || !job) throw new Error(jobErr?.message ?? 'Failed to create job');

  // 3. Log platform event
  await db.from('platform_events').insert({
    merchant_id: input.merchantId,
    event_type: 'store.provisioning.queued',
    payload: { instance_id: instance.id, subdomain: input.subdomain },
  });

  return { jobId: job.id };
}

export async function getProvisioningStatus(jobId: string) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('provisioning_jobs')
    .select('status, steps, error, completed_at')
    .eq('id', jobId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}
