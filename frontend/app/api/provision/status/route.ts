import { NextRequest, NextResponse } from 'next/server';
import { getProvisioningStatus } from '@/lib/provisioning';

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('job_id');
  if (!jobId) return NextResponse.json({ error: 'job_id required' }, { status: 400 });

  try {
    const status = await getProvisioningStatus(jobId);
    return NextResponse.json(status);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
