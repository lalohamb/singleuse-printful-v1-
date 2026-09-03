export interface ProductVariant {
  id: string;
  label: string;
  color: string;
  size?: string;
  price?: number;
}

export interface Product {
  id: string;
  printify_id: string | null;
  title: string;
  description: string | null;
  category_id: string | null;
  price: number;
  cost: number;
  image_url: string | null;
  images: string[];
  status: string;
  featured: boolean;
  print_provider_id: string | null;
  blueprint_id: string | null;
  variants: ProductVariant[];
  shipping_info: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

export interface CartItem {
  product_id: string;
  title: string;
  price: number;
  image_url: string;
  quantity: number;
  variant_id: string;
  variant_label: string;
  printify_id: string | null;
}

export interface StoreSettings {
  id: string;
  store_name: string;
  tagline: string;
  hero_image_url: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  announcement: string | null;
  announcement_active: boolean;
  shipping_free_threshold: number;
  default_shipping_cost: number;
  printify_connected: boolean;
  printify_shop_id: string | null;
  stripe_connected: boolean;
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
  printify_order_id: string | null;
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
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
}
