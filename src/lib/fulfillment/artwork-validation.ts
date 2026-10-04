// Artwork validation for Printful manufacturing.
//
// Validates an artwork file against the Printful printfile specification
// for a given catalog product + placement.
//
// Rules:
//   - Dimensions must be >= printfile canvas (or artwork must render at >= 150 DPI)
//   - fill_mode=fit: artwork is scaled to fit within the canvas preserving aspect ratio
//   - Effective DPI = artwork_pixels / rendered_pixels * canvas_dpi
//   - PASS:         effective DPI >= 300 (recommended)
//   - PASS_WARNING: effective DPI >= 150 (Printful minimum) but < 300
//   - FAIL:         effective DPI < 150
//   - UNVERIFIED:   printfile spec could not be obtained

export type ArtworkValidationStatus = "PASS" | "PASS_WARNING" | "FAIL" | "UNVERIFIED";

export interface PrintfileSpec {
  printfile_id: number;
  width: number;   // px
  height: number;  // px
  dpi: number;
  fill_mode: string;
}

export interface ArtworkValidationResult {
  status: ArtworkValidationStatus;
  artworkWidth: number;
  artworkHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  canvasDpi: number;
  renderedWidthPx: number;
  renderedHeightPx: number;
  printWidthInches: number;
  printHeightInches: number;
  effectiveDpiX: number;
  effectiveDpiY: number;
  effectiveDpi: number;  // min(x, y) — conservative
  minDpi: number;
  recommendedDpi: number;
  message: string;
  detail: string;
}

const MIN_DPI = 150;
const RECOMMENDED_DPI = 300;

export function validateArtworkForPrintfile(
  artworkWidth: number,
  artworkHeight: number,
  spec: PrintfileSpec
): ArtworkValidationResult {
  const { width: canvasW, height: canvasH, dpi: canvasDpi } = spec;

  // fill_mode=fit: scale artwork to fit within canvas preserving aspect ratio
  const scaleX = canvasW / artworkWidth;
  const scaleY = canvasH / artworkHeight;
  const scale = Math.min(scaleX, scaleY);

  const renderedW = Math.round(artworkWidth * scale);
  const renderedH = Math.round(artworkHeight * scale);

  const printW = renderedW / canvasDpi;
  const printH = renderedH / canvasDpi;

  // Effective DPI: how many source pixels map to each rendered inch
  const effDpiX = artworkWidth / printW;
  const effDpiY = artworkHeight / printH;
  const effDpi = Math.min(effDpiX, effDpiY); // conservative

  let status: ArtworkValidationStatus;
  let message: string;
  let detail: string;

  if (effDpi >= RECOMMENDED_DPI) {
    status = "PASS";
    message = "Artwork meets recommended production quality.";
    detail = `${Math.round(effDpi)} DPI effective — meets ${RECOMMENDED_DPI} DPI recommended target.`;
  } else if (effDpi >= MIN_DPI) {
    status = "PASS_WARNING";
    message = "Artwork meets minimum requirements but is below recommended quality.";
    detail = `${Math.round(effDpi)} DPI effective — meets ${MIN_DPI} DPI minimum but below ${RECOMMENDED_DPI} DPI recommended. Consider using higher-resolution artwork for sharper printing.`;
  } else {
    status = "FAIL";
    message = "Artwork resolution is below Printful's minimum requirement.";
    detail = `${Math.round(effDpi)} DPI effective — below ${MIN_DPI} DPI minimum. Artwork will print at ${printW.toFixed(1)} × ${printH.toFixed(1)} inches. Upload higher-resolution artwork (minimum ${canvasW} × ${canvasH} px for this placement).`;
  }

  return {
    status,
    artworkWidth,
    artworkHeight,
    canvasWidth: canvasW,
    canvasHeight: canvasH,
    canvasDpi,
    renderedWidthPx: renderedW,
    renderedHeightPx: renderedH,
    printWidthInches: printW,
    printHeightInches: printH,
    effectiveDpiX: Math.round(effDpiX),
    effectiveDpiY: Math.round(effDpiY),
    effectiveDpi: Math.round(effDpi),
    minDpi: MIN_DPI,
    recommendedDpi: RECOMMENDED_DPI,
    message,
    detail,
  };
}

// Fetch the printfile spec for a given catalog product + placement from the
// existing /api/printful/printfiles/:productId endpoint.
// technique must be the currently selected production technique — passing the
// wrong technique returns placements for a different technique and produces
// an incorrect DPI result.
// Returns null if the spec cannot be obtained (UNVERIFIED).
export async function fetchPrintfileSpec(
  catalogProductId: number,
  technique: string,
  placement: string,
  variantId?: number
): Promise<PrintfileSpec | null> {
  try {
    const qs = `?technique=${encodeURIComponent(technique)}`;
    const res = await fetch(`/api/printful/printfiles/${catalogProductId}${qs}`);
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.result ?? data;

    // Find the printfile ID for this placement + variant
    const variantPrintfiles: Array<{ variant_id: number; placements: Record<string, number> }> =
      result.variant_printfiles ?? [];
    const printfiles: PrintfileSpec[] = result.printfiles ?? [];

    let printfileId: number | null = null;

    if (variantId) {
      const vp = variantPrintfiles.find((v) => v.variant_id === variantId);
      printfileId = vp?.placements?.[placement] ?? null;
    }

    // Fallback: use first variant's placement mapping
    if (printfileId === null && variantPrintfiles.length > 0) {
      printfileId = variantPrintfiles[0]?.placements?.[placement] ?? null;
    }

    if (printfileId === null) return null;

    const spec = printfiles.find((pf) => pf.printfile_id === printfileId);
    return spec ?? null;
  } catch {
    return null;
  }
}
