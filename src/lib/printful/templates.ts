import { printfulGet } from "./client";
import type { PrintfulLayoutTemplate, PrintfulPrintfilesResponse, PrintfulTemplatesResponse } from "./types";

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
 * Authoritative template resolution.
 *
 * The relationship between a placement and a template is encoded in
 * variant_mapping, NOT in PrintfulLayoutTemplate.placement (which may be null).
 *
 * Resolution path:
 *   variant_mapping.find(m => m.variant_id === variantId)
 *     → .templates.find(t => t.placement === placement)
 *     → .template_id
 *     → templates.find(t => t.template_id === template_id)
 *
 * Falls back to the first variant in variant_mapping when variantId is not
 * found — safe for products where all variants share the same template set.
 *
 * Returns null when:
 *   - variant_mapping is empty
 *   - the target placement has no entry in variant_mapping
 *   - the template_id from the mapping is not present in templates[]
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
