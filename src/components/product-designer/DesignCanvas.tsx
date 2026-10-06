"use client";

import { useEffect, useRef, useCallback } from "react";
import type { TemplateGeometry } from "@/lib/printful/types";
import { clampToPrintArea, type CanvasRect } from "./coordinates";

interface Props {
  template: TemplateGeometry;
  artworkUrl: string | null;
  artworkRect: CanvasRect;
  onArtworkChange: (rect: CanvasRect) => void;
}

const CANVAS_W = 400;
const CANVAS_H = 400;

export default function DesignCanvas({
  template,
  artworkUrl,
  artworkRect,
  onArtworkChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origRect: CanvasRect } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origRect: CanvasRect } | null>(null);

  const scaleX = CANVAS_W / template.template_width;
  const scaleY = CANVAS_H / template.template_height;

  const printAreaStyle = {
    left: template.print_area_left * scaleX,
    top: template.print_area_top * scaleY,
    width: template.print_area_width * scaleX,
    height: template.print_area_height * scaleY,
  };

  const onMouseDownDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origRect: { ...artworkRect },
      };
    },
    [artworkRect]
  );

  const onMouseDownResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origRect: { ...artworkRect },
      };
    },
    [artworkRect]
  );

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const next: CanvasRect = {
          ...dragRef.current.origRect,
          x: dragRef.current.origRect.x + dx,
          y: dragRef.current.origRect.y + dy,
        };
        onArtworkChange(clampToPrintArea(next, template, CANVAS_W, CANVAS_H));
      }
      if (resizeRef.current) {
        const dx = e.clientX - resizeRef.current.startX;
        const orig = resizeRef.current.origRect;
        const aspect = orig.width / orig.height;
        const newW = Math.max(20, orig.width + dx);
        const newH = newW / aspect;
        const next: CanvasRect = { ...orig, width: newW, height: newH };
        onArtworkChange(clampToPrintArea(next, template, CANVAS_W, CANVAS_H));
      }
    }
    function onMouseUp() {
      dragRef.current = null;
      resizeRef.current = null;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [template, onArtworkChange]);

  return (
    <div
      ref={containerRef}
      className="relative select-none overflow-hidden rounded border border-gray-200 bg-gray-50"
      style={{ width: CANVAS_W, height: CANVAS_H }}
    >
      {/* Template image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={template.image_url}
        alt="Product template"
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        draggable={false}
      />

      {/* Print area boundary */}
      <div
        className="pointer-events-none absolute rounded border-2 border-dashed border-blue-400"
        style={printAreaStyle}
      />

      {/* Artwork */}
      {artworkUrl && (
        <div
          className="absolute cursor-move"
          style={{
            left: artworkRect.x,
            top: artworkRect.y,
            width: artworkRect.width,
            height: artworkRect.height,
          }}
          onMouseDown={onMouseDownDrag}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={artworkUrl}
            alt="Your artwork"
            className="pointer-events-none h-full w-full object-contain"
            draggable={false}
          />
          {/* Resize handle */}
          <div
            className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize rounded-sm bg-black opacity-60"
            onMouseDown={onMouseDownResize}
          />
        </div>
      )}
    </div>
  );
}
