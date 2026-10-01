import { printfulGet } from "./client";
import type { PrintfulPrintfilesResponse, PrintfulTemplatesResponse } from "./types";

export async function getPrintfiles(productId: number): Promise<PrintfulPrintfilesResponse> {
  return printfulGet<PrintfulPrintfilesResponse>(
    `/mockup-generator/printfiles/${productId}`
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
  return printfulGet<PrintfulTemplatesResponse>(
    `/mockup-generator/templates/${productId}${qs}`
  );
}
