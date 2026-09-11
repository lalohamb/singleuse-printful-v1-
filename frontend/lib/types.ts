export interface PricingTier {
  name: string;
  price: number;
  stores: string;
  popular?: boolean;
  features: { label: string; included: boolean }[];
}

export interface Testimonial {
  quote: string;
  author: string;
  role: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
}

export interface OnboardingStep {
  step: number;
  title: string;
  description: string;
}

// Platform types
export type MerchantPlan = 'trial' | 'starter' | 'pro' | 'agency' | 'download';
export type PlanStatus = 'active' | 'past_due' | 'cancelled' | 'trialing';
export type StoreStatus = 'provisioning' | 'active' | 'suspended' | 'deprovisioned';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface Merchant {
  id: string;
  auth_user_id: string;
  email: string;
  full_name?: string;
  company_name?: string;
  plan: MerchantPlan;
  plan_status: PlanStatus;
  trial_ends_at?: string;
  stripe_customer_id?: string;
  stripe_sub_id?: string;
  created_at: string;
  updated_at: string;
}

export interface StoreInstance {
  id: string;
  merchant_id: string;
  store_name: string;
  subdomain: string;
  custom_domain?: string;
  status: StoreStatus;
  supabase_project_ref?: string;
  supabase_project_url?: string;
  supabase_anon_key?: string;
  droplet_id?: string;
  droplet_ip?: string;
  vercel_project_id?: string;
  printify_shop_id?: string;
  printify_connected: boolean;
  stripe_connected: boolean;
  provisioned_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ProvisioningJob {
  id: string;
  instance_id: string;
  merchant_id: string;
  status: JobStatus;
  steps: { step: string; status: string; message: string; timestamp: string }[];
  error?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface DownloadPurchase {
  id: string;
  merchant_id?: string;
  email: string;
  stripe_session_id?: string;
  license_key: string;
  license_type: 'single' | 'unlimited';
  download_url?: string;
  download_count: number;
  max_downloads: number;
  expires_at?: string;
  activated_at?: string;
  created_at: string;
}
