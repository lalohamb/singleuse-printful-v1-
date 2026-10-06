import { printfulGet, printfulGetV2 } from "./client";
import type {
  PrintfulLayoutTemplate,
  PrintfulPrintfilesResponse,
  PrintfulTemplatesResponse,
  V2MockupTemplate,
  V2MockupStyle,
} from "./types";

// ── V2 mockup templates ───────────────────────────────────────────────────────
// GET /v2/catalog-products/{id}/mockup-templates
// Live-proven: paginated, paging.total authoritative, all pages must be accumulated.
// Returns flat array of V2MockupTemplate — no variant_mapping, no template_id.
// Used by Catalog Builder for production geometry and placement discovery.
export async function getMockupTemplates(productId: number): Promise<V2MockupTemplate[]> {
  const PAGE_SIZE = 20;
  const accumulated: V2MockupTemplate[] = [];
  let offset = 0;
  let total: number | null = null;
  const MAX_PAGES = 50;
  let pageCount = 0;

  do {
    const path = `/v2/catalog-products/${productId}/mockup-templates?limit=${PAGE_SIZE}&offset=${offset}`;
    const envelope = await printfulGetV2<V2MockupTemplate[]>(path);
    const page = Array.isArray(envelope.data) ? envelope.data : [];
    accumulated.push(...page);

    if (total === null) {
      total = typeof envelope.paging?.total === "number" ? envelope.paging.total : page.length;
    }
    if (!envelope.paging || typeof envelope.paging.total !== "number") break;

    offset += PAGE_SIZE;
    pageCount++;
  } while (accumulated.length < (total ?? 0) && pageCount < MAX_PAGES);

  return accumulated;
}

// ── V2 mockup styles ──────────────────────────────────────────────────────────
// GET /v2/catalog-products/{id}/mockup-styles
// Live-proven: paging.total=4 for product 679, all records in one page.
// Provides placement display names, DPI, physical print-area dimensions, style IDs.
// NOT the source of pixel-level geometry — that comes from mockup-templates.
export async function getMockupStyles(productId: number): Promise<V2MockupStyle[]> {
  const PAGE_SIZE = 20;
  const accumulated: V2MockupStyle[] = [];
  let offset = 0;
  let total: number | null = null;
  const MAX_PAGES = 20;
  let pageCount = 0;

  do {
    const path = `/v2/catalog-products/${productId}/mockup-styles?limit=${PAGE_SIZE}&offset=${offset}`;
    const envelope = await printfulGetV2<V2MockupStyle[]>(path);
    const page = Array.isArray(envelope.data) ? envelope.data : [];
    accumulated.push(...page);

    if (total === null) {
      total = typeof envelope.paging?.total === "number" ? envelope.paging.total : page.length;
    }
    if (!envelope.paging || typeof envelope.paging.total !== "number") break;

    offset += PAGE_SIZE;
    pageCount++;
  } while (accumulated.length < (total ?? 0) && pageCount < MAX_PAGES);

  return accumulated;
}

// ── V2 template resolver ──────────────────────────────────────────────────────
// Pure function. Deterministic. No API calls.
//
// Resolves exactly one primary V2 mockup-template for a given:
//   catalogVariantId — V2 CatalogVariant.id (same namespace as getCatalogVariants())
//   technique        — case-insensitive match
//   placement        — exact string match
//
// Resolution outcomes:
//   exactly 1 primary match → resolved (returns the template)
//   0 primary matches       → unresolved (returns null)
//   >1 primary matches      → ambiguous (returns null)
//
// Rules:
//   - Never uses variant_mapping or variant_mapping[0]
//   - Never uses templates[0] as a fallback
//   - Never translates V2 IDs to V1 IDs
//   - Technique comparison is case-insensitive (V2 returns lowercase, V1 uppercase)
export type V2TemplateResolution =
  | { status: "resolved"; template: V2MockupTemplate }
  | { status: "unresolved" }
  | { status: "ambiguous"; count: number };

export function resolveV2Template(
  templates: V2MockupTemplate[],
  catalogVariantId: number,
  technique: string,
  placement: string
): V2TemplateResolution {
  const techNorm = technique.toLowerCase();
  const matches = templates.filter(
    (t) =>
      t.catalog_variant_ids.includes(catalogVariantId) &&
      t.technique.toLowerCase() === techNorm &&
      t.placement === placement &&
      t.role === "primary"
  );

  if (matches.length === 1) return { status: "resolved", template: matches[0] };
  if (matches.length === 0) return { status: "unresolved" };
  return { status: "ambiguous", count: matches.length };
}

// ── LEGACY V1 ONLY — DO NOT CALL WITH V2 CATALOG VARIANT IDS ─────────────────
// The following functions use V1 identity (variant_mapping.variant_id) which is
// a different namespace from V2 CatalogVariant.id. They are retained for:
//   - ProductDesigner (uses V1 PrintfulVariant.id)
//   - printful_sync workflows
//   - batch/recipe paths
//   - conflicting_placements (now superseded by V2 product detail for Catalog Builder)
// Do NOT call these from the modern Catalog Builder path.

export async function getPrintfiles(productId: number, technique?: string): Promise<PrintfulPrintfilesResponse> {
  const qs = technique ? `?technique=${encodeURIComponent(technique)}` : "";
  return printfulGet<PrintfulPrintfilesResponse>(
    `/mockup-generator/printfiles/${productId}${qs}`
  );
}

export async function getLayoutTemplates(
  productId: number,
  options: { technique?: string; orientation?: string } = {}
): Promise<PrintfulTemplatesResponse> {
  const params = new URLSearchParams();
  if (options.technique) params.set("technique", options.technique);
  if (options.orientation) params.set("orientation", options.orientation);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const raw = await printfulGet<PrintfulTemplatesResponse & { conflicting_placements: unknown }>(
    `/mockup-generator/templates/${productId}${qs}`
  );
  // Printful returns conflicting_placements as either:
  //   Array: [{placement: string, conflicts: string[]}]
  //   Object: Record<string, string[]>
  // Normalise to Record<string, string[]> so callers can use consistent indexing.
  if (Array.isArray(raw.conflicting_placements)) {
    const normalised: Record<string, string[]> = {};
    for (const entry of raw.conflicting_placements as { placement: string; conflicts: string[] }[]) {
      normalised[entry.placement] = entry.conflicts;
    }
    return { ...raw, conflicting_placements: normalised };
  }
  return raw as PrintfulTemplatesResponse;
}

/**
 * LEGACY V1 ONLY — DO NOT CALL WITH V2 CATALOG VARIANT IDS.
 *
 * Resolves a V1 layout template using variant_mapping.
 * Safe only when variantId is a V1 PrintfulVariant.id (from GET /products/{id}).
 * The variant_mapping[0] fallback is intentional for V1-only callers where all
 * variants share the same template set.
 *
 * This function MUST NOT be used with V2 CatalogVariant.id values — the ID
 * namespaces are different and the lookup will always fall back to [0].
 * Use resolveV2Template() for Catalog Builder production geometry.
 */
export function resolveLayoutTemplateForVariantPlacement(
  response: PrintfulTemplatesResponse,
  placement: string,
  variantId?: number
): PrintfulLayoutTemplate | null {
  const { variant_mapping, templates } = response;
  if (!variant_mapping?.length || !templates?.length) return null;

  // Find the mapping entry for the requested variant, or fall back to first.
  let mapping = variantId
    ? variant_mapping.find((m) => m.variant_id === variantId)
    : undefined;
  if (!mapping) mapping = variant_mapping[0];
  if (!mapping) return null;

  // Find the placement entry within this variant's template list.
  const entry = mapping.templates.find((t) => t.placement === placement);
  if (!entry) return null;

  // Look up the actual template object by template_id.
  return templates.find((t) => t.template_id === entry.template_id) ?? null;
}
