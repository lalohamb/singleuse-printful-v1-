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

// Shared geometry interface — used by DesignCanvas and coordinates.ts.
// Both PrintfulLayoutTemplate (V1) and V2MockupTemplate satisfy this interface.
export interface TemplateGeometry {
  template_width: number;
  template_height: number;
  print_area_width: number;
  print_area_height: number;
  print_area_top: number;
  print_area_left: number;
  image_url: string;
}

export interface PrintfulLayoutTemplate extends TemplateGeometry {
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

// ── V2 normalized catalog product ───────────────────────────────────────────
// Returned by getCatalogProductsV2() and getCatalogProductV2().
// Contains only fields that V2 actually provides.
// currency, files[], and options[] are intentionally absent — V2 does not
// provide them and they must not be fabricated to satisfy the V1 PrintfulProduct
// interface. Callers that genuinely need those fields must use V1 helpers.
export interface V2CatalogProduct {
  id: number;
  main_category_id: number;
  type: string;
  type_name: string;                   // normalized from V2 `type`
  title: string;                       // normalized from V2 `name`
  brand: string | null;
  model: string | null;
  image: string;
  variant_count: number;
  is_discontinued: boolean;
  avg_fulfillment_time: null;          // not provided by V2
  description: string;
  techniques: PrintfulTechnique[];
  placements: V2CatalogProductPlacement[];
  dimensions: null;                    // not provided by V2
}

// ── Normalized mockup poll result ─────────────────────────────────────────────
// Adapter type used by MockupStatus and its callers.
// Both V1 (PrintfulMockupTask) and V2 (V2MockupTask) polling results are
// adapted into this shape before being passed to the UI layer.
// This prevents the UI from reading V1-only fields (task_key, mockups[]) or
// V2-only fields (failure_reasons[], catalog_variant_mockups[]) directly.
export interface MockupPollResult {
  /** "v1" | "v2" — identifies which provider path produced this result */
  source: "v1" | "v2";
  status: "pending" | "completed" | "failed";
  /** Error message when status === "failed" */
  failureReason: string | null;
  /** V1 raw task — present only when source === "v1" and status === "completed" */
  v1Task: PrintfulMockupTask | null;
  /** V2 raw task — present only when source === "v2" and status === "completed" */
  v2Task: V2MockupTask | null;
}

// ── V2 catalog product raw (live-proven fields from GET /v2/catalog-products and GET /v2/catalog-products/{id}) ──
// V2 uses `name` where V1 used `title`. Normalized to `title` by getCatalogProductsV2/getCatalogProductV2.
// V2 includes `placements[]` with conflicting_placements inline — no separate templates call needed.
// V2 does NOT include `files[]`, `options[]`, or `currency` — do not fabricate them.
export interface V2CatalogProductPlacement {
  placement: string;
  technique: string;
  layers: Array<{ type: string; layer_options: unknown[] }>;
  placement_options: unknown[];
  conflicting_placements: string[];
}

export interface V2CatalogProductRaw {
  id: number;
  type: string;
  main_category_id: number;
  name: string;                        // V2 uses name; normalized to title
  brand: string | null;
  model: string | null;
  image: string;
  variant_count: number;
  is_discontinued: boolean;
  description: string;
  sizes: string[];
  colors: Array<{ name: string; value: string }>;
  techniques: PrintfulTechnique[];     // same shape as V1
  placements: V2CatalogProductPlacement[];
  product_options: unknown[];
}

// ── V2 mockup template (live-proven fields from GET /v2/catalog-products/{id}/mockup-templates) ──
export interface V2MockupTemplate {
  catalog_variant_ids: number[];       // V2 catalog variant IDs — same namespace as CatalogVariant.id
  placement: string;
  technique: string;                   // lowercase, e.g. "dtfilm"
  print_area_width: number;            // pixels
  print_area_height: number;           // pixels
  print_area_top: number;              // pixels
  print_area_left: number;             // pixels
  template_width: number;              // pixels
  template_height: number;             // pixels
  image_url: string;
  background_url: string | null;
  background_color: string;
  printfile_id: number;
  orientation: string;
  template_positioning: string;
  template_type: string | null;
  role: "primary" | "template";
}

// ── V2 mockup style (live-proven fields from GET /v2/catalog-products/{id}/mockup-styles) ──
export interface V2MockupStyleEntry {
  id: number;
  category_name: string;
  view_name: string;
  restricted_to_variants: number[] | null;
}

export interface V2MockupStyle {
  placement: string;
  display_name: string;
  technique: string;
  print_area_width: number;            // inches
  print_area_height: number;           // inches
  print_area_type: string | null;      // "simple", "color_group", null
  dpi: number;
  mockup_styles: V2MockupStyleEntry[];
}

// ── V2 mockup task (live-proven from POST /v2/mockup-tasks and GET /v2/mockup-tasks?id=) ──
export interface V2MockupTaskMockup {
  placement: string;
  display_name: string;
  technique: string;
  style_id: number;
  mockup_url: string;
  view: string;
}

export interface V2CatalogVariantMockup {
  catalog_variant_id: number;          // V2 catalog variant ID
  mockups: V2MockupTaskMockup[];
}

export interface V2MockupTask {
  id: number;                          // numeric integer — NOT a string task_key
  status: "pending" | "completed" | "failed";
  catalog_variant_mockups: V2CatalogVariantMockup[];
  failure_reasons: string[];
}
