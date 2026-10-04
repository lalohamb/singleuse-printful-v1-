import { printfulGet } from "./client";
import type { PrintfulPrintfilesResponse, PrintfulTemplatesResponse } from "./types";

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
