// Deterministic Positioning Engine
//
// Single source of truth for converting artwork dimensions + Printful print area
// into a valid PrintfulPosition. Used by:
//   - Catalog Builder (client-side, via canvasToPrintfulCoordinates wrapper)
//   - Batch Generator (server-side, auto-position from recipe + design + template)
//   - Recipe activation validation
//
// Strategy: CENTER_FIT
//   Scale artwork to fill the print area (preserving aspect ratio, fit mode),
//   then center it within the print area. This matches Printful's fill_mode=fit
//   behavior and produces the same result as a user centering artwork in the
//   Product Designer canvas.
//
// All inputs are in Printful template pixels. Output is a PrintfulPosition
// ready to be frozen into ProductSpecification.design_configuration.position.

import type { PrintfulPosition } from "@/lib/printful/types";

export interface PrintAreaSpec {
  // From PrintfulLayoutTemplate or PrintfulPrintfileDetail
  area_width: number;   // print area width in template px
  area_height: number;  // print area height in template px
}

export interface ArtworkDimensions {
  width: number;   // artwork pixel width
  height: number;  // artwork pixel height
}

export type PositioningStrategy = "CENTER_FIT";

export interface PositioningResult {
  position: PrintfulPosition;
  strategy: PositioningStrategy;
  scale: number;           // scale factor applied to artwork
  effective_dpi: number;   // conservative DPI estimate (min of x/y)
  canvas_dpi: number;      // Printful canvas DPI for this printfile
  validation: "PASS" | "PASS_WARNING" | "FAIL";
  validation_message: string;
}

const MIN_DPI = 150;
const RECOMMENDED_DPI = 300;

/**
 * Compute a centered, fit-scaled PrintfulPosition for artwork within a print area.
 *
 * This is the canonical positioning function. Both the Catalog Builder and
 * Batch Generator call this (directly or via wrappers) to produce positions
 * that are frozen into ProductSpecification.design_configuration.position.
 */
export function computeCenterFitPosition(
  artwork: ArtworkDimensions,
  printArea: PrintAreaSpec,
  canvasDpi: number
): PositioningResult {
  const { area_width, area_height } = printArea;
  const { width: artW, height: artH } = artwork;

  // Scale to fit within print area preserving aspect ratio
  const scaleX = area_width / artW;
  const scaleY = area_height / artH;
  const scale = Math.min(scaleX, scaleY);

  const scaledW = Math.round(artW * scale);
  const scaledH = Math.round(artH * scale);

  // Center within print area
  const left = Math.round((area_width - scaledW) / 2);
  const top = Math.round((area_height - scaledH) / 2);

  const position: PrintfulPosition = {
    area_width,
    area_height,
    width: Math.max(1, scaledW),
    height: Math.max(1, scaledH),
    top,
    left,
  };

  // Effective DPI: source pixels per rendered inch
  const printWInches = scaledW / canvasDpi;
  const printHInches = scaledH / canvasDpi;
  const effDpiX = artW / printWInches;
  const effDpiY = artH / printHInches;
  const effectiveDpi = Math.round(Math.min(effDpiX, effDpiY));

  let validation: PositioningResult["validation"];
  let validation_message: string;

  if (effectiveDpi >= RECOMMENDED_DPI) {
    validation = "PASS";
    validation_message = `${effectiveDpi} DPI — meets ${RECOMMENDED_DPI} DPI recommended target`;
  } else if (effectiveDpi >= MIN_DPI) {
    validation = "PASS_WARNING";
    validation_message = `${effectiveDpi} DPI — meets ${MIN_DPI} DPI minimum but below ${RECOMMENDED_DPI} DPI recommended`;
  } else {
    validation = "FAIL";
    validation_message = `${effectiveDpi} DPI — below ${MIN_DPI} DPI minimum. Upload higher-resolution artwork.`;
  }

  return {
    position,
    strategy: "CENTER_FIT",
    scale,
    effective_dpi: effectiveDpi,
    canvas_dpi: canvasDpi,
    validation,
    validation_message,
  };
}

/**
 * Compute position from a Printful layout template.
 * The template's print_area_width/height define the print area in template pixels.
 * canvasDpi comes from the matching PrintfulPrintfileDetail.
 */
export function computePositionFromTemplate(
  artwork: ArtworkDimensions,
  template: {
    print_area_width: number;
    print_area_height: number;
  },
  canvasDpi: number
): PositioningResult {
  return computeCenterFitPosition(
    artwork,
    { area_width: template.print_area_width, area_height: template.print_area_height },
    canvasDpi
  );
}

/**
 * Validate that a position is non-trivial (not zero-area).
 * Used as a guard before submitting mockup tasks.
 */
export function isValidPosition(position: PrintfulPosition | null | undefined): boolean {
  if (!position) return false;
  return (
    position.area_width > 0 &&
    position.area_height > 0 &&
    position.width > 0 &&
    position.height > 0
  );
}
