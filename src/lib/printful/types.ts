// Generic API wrapper
export interface PrintfulApiResponse<T> {
  code: number;
  result: T;
  extra?: unknown;
  error?: string;
}

// ── Catalog ──────────────────────────────────────────────────────────────────

export interface PrintfulProduct {
  id: number;
  main_category_id: number;
  type: string;
  type_name: string;
  title: string;
  brand: string | null;
  model: string | null;
  image: string;
  variant_count: number;
  currency: string;
  is_discontinued: boolean;
  avg_fulfillment_time: number | null;
  description: string;
  techniques: PrintfulTechnique[];
  files: PrintfulFileSpec[];
  options: PrintfulOptionSpec[];
  dimensions: Record<string, unknown> | null;
}

export interface PrintfulTechnique {
  key: string;
  display_name: string;
  is_default: boolean;
}

export interface PrintfulFileSpec {
  id: string;
  type: string;
  title: string;
  additional_price: string | null;
  options: PrintfulOptionSpec[];
}

export interface PrintfulOptionSpec {
  id: string;
  title: string;
  type: string;
  values: Record<string, string>;
  additional_price_breakdown: Record<string, string>;
}

export interface PrintfulVariant {
  id: number;
  product_id: number;
  name: string;
  size: string;
  color: string;
  color_code: string | null;
  color_code2: string | null;
  image: string;
  price: string;
  in_stock: boolean;
  availability_regions: Record<string, string>;
  availability_status: { region: string; status: string }[];
  material: { name: string; percentage: number }[] | null;
}

// ── V2 catalog variant (live-proven fields from GET /v2/catalog-products/{id}/catalog-variants) ──
// Only fields observed in the actual live response are typed here.
// price, in_stock, availability_regions, availability_status are NOT present
// in the V2 catalog-variant object — they come from separate sub-endpoints.
export interface PrintfulCatalogVariantV2 {
  id: number;
  catalog_product_id: number;
  name: string;
  size: string;
  color: string;
  color_code: string | null;
  color_code2: string | null;
  image: string;
  // placement_dimensions present in live response but not needed by CountyBuys currently
  placement_dimensions?: Array<{ placement: string; height: number; width: number; orientation: string }>;
}

// ── CountyBuys normalized catalog variant ─────────────────────────────────────
// Derived from PrintfulCatalogVariantV2. Contains only authoritative provider
// identity and display fields. Commercial data (price, stock) is NOT included
// because it is not available from the V2 catalog-variant endpoint.
export interface CatalogVariant {
  /** Printful catalog variant ID — authoritative provider identity */
  id: number;
  /** Printful catalog product ID */
  catalog_product_id: number;
  name: string;
  size: string;
  color: string;
  color_code: string | null;
  image: string;
}

// ── Catalog variant retrieval result ─────────────────────────────────────────
// Wraps the variant array with an eligibility flag so callers can distinguish
// "zero variants" from "regionally unavailable".
export type CatalogVariantEligibility = "eligible" | "unavailable" | "error";

export interface CatalogVariantResult {
  eligibility: CatalogVariantEligibility;
  variants: CatalogVariant[];
  /** Human-readable reason when eligibility !== "eligible" */
  reason?: string;
}

// ── Print files ───────────────────────────────────────────────────────────────

export interface PrintfulPrintfileDetail {
  printfile_id: number;
  width: number;
  height: number;
  dpi: number;
  fill_mode: string;
  can_rotate: boolean;
}

export interface PrintfulVariantPrintfile {
  variant_id: number;
  placements: Record<string, number>; // placement → printfile_id
}

export interface PrintfulPrintfilesResponse {
  product_id: number;
  available_placements: Record<string, string>;
  printfiles: PrintfulPrintfileDetail[];
  variant_printfiles: PrintfulVariantPrintfile[];
  option_groups: string[];
  options: string[];
}

// ── Layout templates ──────────────────────────────────────────────────────────

export interface PrintfulLayoutTemplate {
  template_id: number;
  image_url: string;
  background_url: string | null;
  background_color: string | null;
  printfile_id: number;
  template_width: number;
  template_height: number;
  print_area_width: number;
  print_area_height: number;
  print_area_top: number;
  print_area_left: number;
  is_template_on_front: boolean;
  orientation: "horizontal" | "vertical" | "any";
}

export interface PrintfulVariantMapping {
  variant_id: number;
  templates: { template_id: number; placement: string }[];
}

export interface PrintfulTemplatesResponse {
  version: number;
  min_dpi: number;
  variant_mapping: PrintfulVariantMapping[];
  templates: PrintfulLayoutTemplate[];
  conflicting_placements: Record<string, string[]>;
}

// ── Mockup generation ─────────────────────────────────────────────────────────

export interface PrintfulPosition {
  area_width: number;
  area_height: number;
  width: number;
  height: number;
  top: number;
  left: number;
}

export interface PrintfulGenerationFile {
  placement: string;
  image_url: string;
  position: PrintfulPosition;
}

export interface PrintfulMockupTaskRequest {
  variant_ids: number[];
  format?: "jpg" | "png";
  width?: number;
  technique?: string;
  files: PrintfulGenerationFile[];
  options?: Record<string, string>[];
  option_groups?: string[];
}

export interface PrintfulMockupTask {
  task_key: string;
  status: "pending" | "completed" | "failed";
  error?: string;
  mockups?: PrintfulGeneratedMockup[];
  printfiles?: unknown[];
}

export interface PrintfulGeneratedMockup {
  placement: string;
  variant_ids: number[];
  mockup_url: string;
  extra: PrintfulExtraMockup[];
  option: string | null;
  option_group: string | null;
}

export interface PrintfulExtraMockup {
  title: string;
  url: string;
  option: string | null;
  option_group: string | null;
}
