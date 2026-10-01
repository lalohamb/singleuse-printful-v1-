// StoreVariant — storefront-owned variant with stable UUID.
// This is the canonical variant identity used in cart, checkout, and orders.
// provider_* fields are for fulfillment resolution only — never for storefront identity.
export interface StoreVariant {
  id: string;                        // store UUID — stable across syncs
  product_id: string;
  provider: string;                  // e.g. 'printful'
  printful_variant_id: string | null; // provider mapping — used only at fulfillment
  label: string;
  color: string | null;
  size: string | null;
  retail_price: number;
  image_url: string | null;
  available: boolean;
}

// ProductVariant — LEGACY shape from products.variants JSONB.
// DO NOT USE FOR NEW CODE. Use StoreVariant instead.
// Kept for backward compatibility during transition.
export interface ProductVariant {
  id: string;
  label: string;
  color: string;
  size?: string;
  price?: number;
  image_url?: string | null;
}

export type PublicationStatus = "active" | "draft" | "archived";

// ── Phase 4 design/mockup types ───────────────────────────────────────────────

export interface Design {
  id: string;                    // stable store UUID
  name: string;
  slug: string | null;
  description: string | null;
  artwork_url: string;           // public URL in Supabase Storage
  storage_path: string;          // path within store-images bucket
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  status: "active" | "archived";
  tags: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductDesign {
  id: string;
  product_id: string;
  design_id: string;
  provider: string;
  placement: string;
  technique: string | null;
  printfile_id: string | null;
  is_primary: boolean;
  needs_regeneration: boolean;
  configuration: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  product_variant_id: string | null;
  source: "printful_mockup" | "manual" | "provider";
  storage_path: string | null;
  image_url: string;
  alt_text: string | null;
  is_primary: boolean;
  display_order: number;
  mockup_task_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface MockupTask {
  id: string;
  product_id: string;
  product_design_id: string | null;
  provider: string;
  provider_task_key: string;
  status: "pending" | "processing" | "completed" | "failed";
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Product {
  id: string;
  // Phase 3 catalog fields (store-owned)
  slug: string | null;
  short_description: string | null;
  meta_title: string | null;
  meta_description: string | null;
  compare_at_price: number | null;
  brand: string | null;
  product_type: string | null;
  published_at: string | null;
  display_order: number;
  // Core
  printful_id: string | null;          // Printful STORE/SYNC product ID (e.g. 476330305)
  printful_catalog_id: number | null;   // Printful CATALOG product ID (e.g. 903) — required for mockup generation
  catalog_source?: "printful_sync" | "catalog_builder" | "manual" | null; // product origin
  title: string;
  description: string | null;
  category_id: string | null;
  price: number;               // base/display retail price (store-owned)
  cost: number;                // provider cost (admin only)
  image_url: string | null;
  images: string[];
  status: PublicationStatus;
  featured: boolean;
  is_new_arrival: boolean;
  is_trending: boolean;
  is_bestseller: boolean;
  is_on_sale: boolean;
  content_locked: boolean;
  is_personalizable: boolean;
  personalization_label: string | null;
  variants: ProductVariant[];  // LEGACY JSONB — do not use for new code
  shipping_info: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  gradient_opacity: number | null;
  gradient_dir: string | null;
  category_image_url: string | null;
  created_at: string;
}

export interface CartItem {
  product_id: string;       // store product UUID
  variant_id: string;       // store variant UUID (product_variants.id)
  title: string;
  variant_label: string;
  color: string | null;
  size: string | null;
  price: number;
  image_url: string;
  quantity: number;
  printful_id: string | null; // product-level Printful sync ID (display/tracing only)
  personalization_text?: string;
}

export interface StoreSettings {
  id: string;
  store_name: string;
  tagline: string;
  hero_image_url: string | null;
  story_image_url: string | null;
  story_object_position: string | null;
  story_image_scale: number | null;
  story_image_flip: boolean | null;
  story_image_fit: string | null;
  story_gradient_opacity: number | null;
  story_gradient_dir: string | null;
  logo_url: string | null;
  logo_size: number | null;
  favicon_url: string | null;
  footer_text: string | null;
  footer_bottom_message: string | null;
  footer_logo_url: string | null;
  footer_logo_size: number | null;
  about_settings: Record<string, unknown> | null;
  affirmations_settings: Record<string, unknown> | null;
  new_arrivals_settings: Record<string, unknown> | null;
  brand_values_settings: Record<string, unknown> | null;
  feature_strip_settings: Record<string, unknown> | null;
  site_menu_settings: Record<string, unknown> | null;
  promo_banner_active: boolean;
  promo_banner_title: string | null;
  promo_banner_body: string | null;
  promo_banner_cta_label: string | null;
  promo_banner_cta_url: string | null;
  promo_banner_bg_color: string | null;
  testimonials: { quote: string; name: string; location: string; product: string }[] | null;
  hero_object_position: string | null;
  our_why_image_url: string | null;
  our_why_object_position: string | null;
  hero_height_vh: number | null;
  hero_image_flip: boolean | null;
  hero_image_scale: number | null;
  hero_gradient_opacity: number | null;
  hero_gradient_dir: string | null;
  hero_image_fit: string | null;
  our_why_height_vh: number | null;
  our_why_label: string | null;
  our_why_quote: string | null;
  our_why_body: string | null;
  our_why_image_scale: number | null;
  our_why_image_flip: boolean | null;
  our_why_image_fit: string | null;
  our_why_gradient_opacity: number | null;
  our_why_gradient_dir: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  announcement: string | null;
  announcement_active: boolean;
  orders_paused: boolean;
  shipping_free_threshold: number;
  default_shipping_cost: number;
  printful_connected: boolean;
  printful_store_id: string | null;
  stripe_connected: boolean;
  music_url: string | null;
  music_enabled: boolean;
  music_tracks: { id: string; name: string; url: string; enabled: boolean; cover_url?: string }[];
  music_shuffle: boolean;
  video_enabled: boolean;
  video_tracks: { id: string; name: string; url: string; enabled: boolean; thumb_url?: string }[];
  social_links: {
    instagram: { url: string; enabled: boolean };
    tiktok:    { url: string; enabled: boolean };
    facebook:  { url: string; enabled: boolean };
    youtube:   { url: string; enabled: boolean };
    pinterest: { url: string; enabled: boolean };
    snapchat:  { url: string; enabled: boolean };
    threads:   { url: string; enabled: boolean };
    email:     { url: string; enabled: boolean };
  };
}

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface Order {
  id: string;
  printful_order_id: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  email: string;
  shipping_name: string;
  shipping_address: ShippingAddress;
  shipping_method: string | null;
  shipping_cost: number;
  subtotal: number;
  total: number;
  currency: string;
  status: string;
  fulfillment_status: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  items: CartItem[];
  livemode: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
}

export interface CustomerProfileRow {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  phone: string | null;
  newsletter_opt_in: boolean;
  address: Record<string, unknown>;
  preferences: Record<string, unknown>;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}
