import type { Product } from "@/types";

// Single source of truth for curation flags. Adding a new badge/flag is one
// line here (plus the DB column) — the admin editor, bulk toolbar, product
// list, and storefront ProductCard all iterate ACTIVE_FLAGS.
export interface FlagDef {
  key: keyof Product; // boolean column on products, e.g. "is_new_arrival"
  label: string; // admin checkbox / button label
  badge: string; // storefront badge text
  badgeClass: string; // Tailwind classes for the badge chip
  enabled: boolean; // surface in the UI now?
}

export const PRODUCT_FLAGS: FlagDef[] = [
  { key: "featured", label: "Featured", badge: "Featured", badgeClass: "bg-gold-500 text-secondary-900", enabled: true },
  { key: "is_new_arrival", label: "New Arrival", badge: "New", badgeClass: "bg-primary-500 text-white", enabled: true },
  { key: "is_trending", label: "Trending", badge: "Trending", badgeClass: "bg-secondary-900 text-white", enabled: true },
  { key: "is_bestseller", label: "Best Seller", badge: "Best Seller", badgeClass: "bg-success-600 text-white", enabled: false },
  { key: "is_on_sale", label: "On Sale", badge: "Sale", badgeClass: "bg-error-500 text-white", enabled: false },
];

// Flags currently shown in admin + storefront. Flip `enabled` above to add one.
export const ACTIVE_FLAGS: FlagDef[] = PRODUCT_FLAGS.filter((f) => f.enabled);
