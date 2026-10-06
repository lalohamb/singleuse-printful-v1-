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

// ── V2 artwork validation ────────────────────────────────────────────────────
// Validates artwork using V2 mockup-style physical dimensions + DPI.
// Does NOT use fill_mode (absent from V2 responses).
// Applies fit-scaling directly — live-proven equivalent to V1 fill_mode="fit"
// for the following bounded cases:
//   technique: dtfilm, dtg, embroidery
//   print_area_type: "simple" or null
// For any other technique or print_area_type, returns UNVERIFIED.
// For missing/invalid dimensions or DPI, returns UNVERIFIED.
// Never falls back to variantPrintfiles[0] or any V1 record.

// Techniques and print_area_types for which V2 fit-scaling is live-proven.
const V2_VERIFIED_TECHNIQUES = new Set(["dtfilm", "dtg", "embroidery"]);
const V2_VERIFIED_AREA_TYPES = new Set(["simple", null as unknown as string]);

export interface V2StyleSpec {
  print_area_width: number;   // inches
  print_area_height: number;  // inches
  dpi: number;
  print_area_type: string | null;
  technique: string;
}

export function validateArtworkFromV2Style(
  artworkWidth: number,
  artworkHeight: number,
  style: V2StyleSpec
): ArtworkValidationResult {
  const unverified: ArtworkValidationResult = {
    status: "UNVERIFIED",
    artworkWidth,
    artworkHeight,
    canvasWidth: 0,
    canvasHeight: 0,
    canvasDpi: 0,
    renderedWidthPx: 0,
    renderedHeightPx: 0,
    printWidthInches: 0,
    printHeightInches: 0,
    effectiveDpiX: 0,
    effectiveDpiY: 0,
    effectiveDpi: 0,
    minDpi: MIN_DPI,
    recommendedDpi: RECOMMENDED_DPI,
    message: "Artwork validation could not be completed — provider metadata unavailable.",
    detail: "DPI validation requires V2 mockup-style data for this placement and technique.",
  };

  // Guard: technique must be in the verified set
  if (!V2_VERIFIED_TECHNIQUES.has(style.technique.toLowerCase())) return unverified;

  // Guard: print_area_type must be in the verified set
  if (!V2_VERIFIED_AREA_TYPES.has(style.print_area_type as string)) return unverified;

  // Guard: dimensions and DPI must be finite positive numbers
  if (
    !Number.isFinite(style.print_area_width) || style.print_area_width <= 0 ||
    !Number.isFinite(style.print_area_height) || style.print_area_height <= 0 ||
    !Number.isFinite(style.dpi) || style.dpi <= 0
  ) return unverified;

  // Derive canvas pixel dimensions from physical dimensions × DPI.
  // Live-proven: 15.5in × 150dpi = 2325px (exact match to V1 printfile for product 679/dtfilm/front).
  const canvasW = Math.round(style.print_area_width * style.dpi);
  const canvasH = Math.round(style.print_area_height * style.dpi);

  // Apply fit-scaling (same algorithm as validateArtworkForPrintfile with fill_mode="fit").
  // Justified by live-proven equivalence across dtfilm, dtg, embroidery techniques.
  const spec: PrintfileSpec = {
    printfile_id: 0,
    width: canvasW,
    height: canvasH,
    dpi: style.dpi,
    fill_mode: "fit",
  };
  return validateArtworkForPrintfile(artworkWidth, artworkHeight, spec);
}

// ── LEGACY V1 — fetchPrintfileSpec ────────────────────────────────────────────
// LEGACY V1 ONLY — retained for ProductDesigner and other V1 callers.
// Uses variantPrintfiles[0] fallback which is unsafe for V2 catalog variant IDs.
// Do NOT call from the modern Catalog Builder path.
// Modern Catalog Builder uses validateArtworkFromV2Style() instead.
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
