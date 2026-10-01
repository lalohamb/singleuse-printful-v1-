// Storefront catalog types.
// These are provider-neutral. Printful-specific types live in src/lib/printful/.

export type PublicationStatus = "active" | "draft" | "archived";

// Full storefront product — all fields including admin-only ones.
export interface CatalogProduct {
  id: string;
  slug: string | null;
  title: string;
  short_description: string | null;
  description: string | null;
  category_id: string | null;
  brand: string | null;
  product_type: string | null;
  // Pricing
  price: number;                   // base/display retail price (storefront-owned)
  compare_at_price: number | null; // optional was-price for merchandising
  cost: number | null;             // provider cost — admin only, never public
  // Images
  image_url: string | null;
  images: string[];
  // Publication
  status: PublicationStatus;
  published_at: string | null;
  // SEO
  meta_title: string | null;
  meta_description: string | null;
  // Merchandising flags
  featured: boolean;
  is_new_arrival: boolean;
  is_trending: boolean;
  is_bestseller: boolean;
  is_on_sale: boolean;
  is_personalizable: boolean;
  personalization_label: string | null;
  content_locked: boolean;
  // Display
  display_order: number;
  // Provider mapping (not product identity)
  printful_id: string | null;           // Printful STORE/SYNC product ID
  printful_catalog_id: number | null;   // Printful CATALOG product ID — required for mockup generation
  catalog_source?: "printful_sync" | "catalog_builder" | "manual" | null; // product origin
  // Timestamps
  created_at: string;
  updated_at: string;
}

// Public-safe product shape — excludes cost and admin-only fields.
export type PublicProduct = Omit<CatalogProduct, "cost">;

// Derives the primary display image for a product.
// Priority: normalized product_images (passed in) → image_url → images[0] → placeholder.
export function getPrimaryImage(
  product: Pick<CatalogProduct, "image_url" | "images">,
  normalizedImages?: { image_url: string; is_primary: boolean }[]
): string {
  if (normalizedImages && normalizedImages.length > 0) {
    const primary = normalizedImages.find((i) => i.is_primary) ?? normalizedImages[0];
    return primary.image_url;
  }
  if (product.image_url) return product.image_url;
  if (Array.isArray(product.images) && product.images.length > 0) return product.images[0];
  return "/product-placeholder.svg";
}

// Derives the effective meta title with fallback chain.
export function getMetaTitle(product: Pick<CatalogProduct, "meta_title" | "title">): string {
  return product.meta_title || product.title;
}

// Derives the effective meta description with fallback chain.
export function getMetaDescription(
  product: Pick<CatalogProduct, "meta_description" | "short_description" | "description">
): string | undefined {
  return product.meta_description || product.short_description || product.description || undefined;
}

// Generates a URL-safe slug from a title string.
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Returns true if a product is purchasable:
// active status + at least one available variant with a provider mapping.
export function isProductPurchasable(
  product: Pick<CatalogProduct, "status">,
  variants: { available: boolean; printful_variant_id: string | null }[]
): boolean {
  if (product.status !== "active") return false;
  return variants.some((v) => v.available && v.printful_variant_id !== null);
}
