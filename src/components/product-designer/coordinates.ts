import type { PrintfulLayoutTemplate, PrintfulPosition } from "@/lib/printful/types";

export interface CanvasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Convert canvas pixel coordinates (relative to the displayed template image)
 * into Printful position coordinates (relative to the print area).
 */
export function canvasToPrintfulCoordinates(
  canvasRect: CanvasRect,
  template: PrintfulLayoutTemplate,
  canvasWidth: number,
  canvasHeight: number
): PrintfulPosition {
  const scaleX = template.template_width / canvasWidth;
  const scaleY = template.template_height / canvasHeight;

  // Convert canvas px → template px
  const tX = canvasRect.x * scaleX;
  const tY = canvasRect.y * scaleY;
  const tW = canvasRect.width * scaleX;
  const tH = canvasRect.height * scaleY;

  // Offset relative to print area origin
  const left = tX - template.print_area_left;
  const top = tY - template.print_area_top;

  return {
    area_width: template.print_area_width,
    area_height: template.print_area_height,
    width: Math.max(1, Math.round(tW)),
    height: Math.max(1, Math.round(tH)),
    top: Math.round(top),
    left: Math.round(left),
  };
}

/**
 * Convert Printful position coordinates back to canvas pixel coordinates.
 */
export function printfulToCanvasCoordinates(
  position: PrintfulPosition,
  template: PrintfulLayoutTemplate,
  canvasWidth: number,
  canvasHeight: number
): CanvasRect {
  const scaleX = canvasWidth / template.template_width;
  const scaleY = canvasHeight / template.template_height;

  const tX = (position.left + template.print_area_left) * scaleX;
  const tY = (position.top + template.print_area_top) * scaleY;
  const tW = position.width * scaleX;
  const tH = position.height * scaleY;

  return {
    x: tX,
    y: tY,
    width: Math.max(1, tW),
    height: Math.max(1, tH),
  };
}

/**
 * Clamp artwork rect so it stays within the print area bounds on the canvas.
 */
export function clampToPrintArea(
  rect: CanvasRect,
  template: PrintfulLayoutTemplate,
  canvasWidth: number,
  canvasHeight: number
): CanvasRect {
  const scaleX = canvasWidth / template.template_width;
  const scaleY = canvasHeight / template.template_height;

  const areaX = template.print_area_left * scaleX;
  const areaY = template.print_area_top * scaleY;
  const areaW = template.print_area_width * scaleX;
  const areaH = template.print_area_height * scaleY;

  const x = Math.max(areaX, Math.min(rect.x, areaX + areaW - rect.width));
  const y = Math.max(areaY, Math.min(rect.y, areaY + areaH - rect.height));

  return { x, y, width: rect.width, height: rect.height };
}
