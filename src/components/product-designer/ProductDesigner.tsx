"use client";

import { useEffect, useRef, useState } from "react";
import type {
  PrintfulLayoutTemplate,
  PrintfulMockupTask,
  PrintfulPrintfilesResponse,
  PrintfulProduct,
  PrintfulTemplatesResponse,
  PrintfulVariant,
} from "@/lib/printful/types";
import { canvasToPrintfulCoordinates, type CanvasRect } from "./coordinates";
import { useArtworkUpload } from "./useArtworkUpload";
import DesignCanvas from "./DesignCanvas";
import MockupPreview from "./MockupPreview";
import MockupStatus from "./MockupStatus";
import OptionsSelector from "./OptionsSelector";
import PlacementSelector from "./PlacementSelector";
import ProductSelector from "./ProductSelector";
import TechniqueSelector from "./TechniqueSelector";
import VariantSelector from "./VariantSelector";

const CANVAS_W = 400;
const CANVAS_H = 400;

type Step = "product" | "variant" | "technique" | "placement" | "design" | "generating" | "done";

export default function ProductDesigner() {
  const [step, setStep] = useState<Step>("product");
  const [product, setProduct] = useState<PrintfulProduct | null>(null);
  const [variants, setVariants] = useState<PrintfulVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<PrintfulVariant | null>(null);
  const [technique, setTechnique] = useState<string | null>(null);
  const [printfiles, setPrintfiles] = useState<PrintfulPrintfilesResponse | null>(null);
  const [templates, setTemplates] = useState<PrintfulTemplatesResponse | null>(null);
  const [placement, setPlacement] = useState<string | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<PrintfulLayoutTemplate | null>(null);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [artworkRect, setArtworkRect] = useState<CanvasRect>({ x: 100, y: 100, width: 100, height: 100 });
  const [taskKey, setTaskKey] = useState<string | null>(null);
  const [completedTask, setCompletedTask] = useState<PrintfulMockupTask | null>(null);
  const [selectedOptionGroups, setSelectedOptionGroups] = useState<string[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, error: uploadError } = useArtworkUpload();

  // Load product variants
  useEffect(() => {
    if (!product) return;
    fetch(`/api/printful/products/${product.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setVariants(d.result?.variants ?? []);
      })
      .catch((e) => setError(e.message));
  }, [product]);

  // Load printfiles + templates when technique changes
  useEffect(() => {
    if (!product || !technique) return;
    setError(null);
    Promise.all([
      fetch(`/api/printful/printfiles/${product.id}?technique=${encodeURIComponent(technique)}`).then((r) => r.json()),
      fetch(`/api/printful/templates/${product.id}?technique=${technique}`).then((r) => r.json()),
    ])
      .then(([pf, tmpl]) => {
        if (pf.error) throw new Error(pf.error);
        if (tmpl.error) throw new Error(tmpl.error);
        setPrintfiles(pf.result);
        setTemplates(tmpl.result);
      })
      .catch((e) => setError(e.message));
  }, [product, technique]);

  // Resolve active template when variant + placement change
  useEffect(() => {
    if (!templates || !selectedVariant || !placement) return;
    const mapping = templates.variant_mapping.find((m) => m.variant_id === selectedVariant.id);
    if (!mapping) return;
    const entry = mapping.templates.find((t) => t.placement === placement);
    if (!entry) return;
    const tmpl = templates.templates.find((t) => t.template_id === entry.template_id);
    if (tmpl) {
      setActiveTemplate(tmpl);
      // Center artwork in print area on canvas
      const scaleX = CANVAS_W / tmpl.template_width;
      const scaleY = CANVAS_H / tmpl.template_height;
      const areaX = tmpl.print_area_left * scaleX;
      const areaY = tmpl.print_area_top * scaleY;
      const areaW = tmpl.print_area_width * scaleX;
      const areaH = tmpl.print_area_height * scaleY;
      const w = areaW * 0.5;
      const h = areaH * 0.5;
      setArtworkRect({ x: areaX + (areaW - w) / 2, y: areaY + (areaH - h) / 2, width: w, height: h });
    }
  }, [templates, selectedVariant, placement]);

  const conflictingPlacements = placement && templates?.conflicting_placements[placement]
    ? templates.conflicting_placements[placement]
    : [];

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await upload(file);
    if (result) setArtworkUrl(result.url);
  }

  async function handleGenerate() {
    if (!product || !selectedVariant || !activeTemplate || !artworkUrl || !placement) return;
    setGenerating(true);
    setError(null);

    const position = canvasToPrintfulCoordinates(artworkRect, activeTemplate, CANVAS_W, CANVAS_H);

    try {
      const res = await fetch("/api/printful/mockups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          variant_ids: [selectedVariant.id],
          technique: technique ?? undefined,
          files: [{ placement, image_url: artworkUrl, position }],
          ...(selectedOptionGroups.length > 0 && { option_groups: selectedOptionGroups }),
          ...(selectedOptions.length > 0 && { options: selectedOptions.map((o) => ({ id: o })) }),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTaskKey(data.result.task_key);
      setStep("generating");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start generation");
    } finally {
      setGenerating(false);
    }
  }

  function reset() {
    setStep("product");
    setProduct(null);
    setVariants([]);
    setSelectedVariant(null);
    setTechnique(null);
    setPrintfiles(null);
    setTemplates(null);
    setPlacement(null);
    setActiveTemplate(null);
    setArtworkUrl(null);
    setTaskKey(null);
    setCompletedTask(null);
    setSelectedOptionGroups([]);
    setSelectedOptions([]);
    setError(null);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <h2 className="text-lg font-semibold">Product Designer</h2>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {/* Step: select product */}
      {step === "product" && (
        <section className="space-y-2">
          <p className="text-sm font-medium">Select a product</p>
          <ProductSelector
            onSelect={(p) => {
              setProduct(p);
              setTechnique(p.techniques.find((t) => t.is_default)?.key ?? p.techniques[0]?.key ?? null);
              setStep("variant");
            }}
          />
        </section>
      )}

      {/* Step: select variant */}
      {step === "variant" && product && (
        <section className="space-y-2">
          <p className="text-sm font-medium">{product.title} — Select a variant</p>
          <VariantSelector
            variants={variants}
            selectedId={selectedVariant?.id ?? null}
            onSelect={(v) => {
              setSelectedVariant(v);
              setStep("technique");
            }}
          />
        </section>
      )}

      {/* Step: select technique */}
      {step === "technique" && product && (
        <section className="space-y-2">
          <p className="text-sm font-medium">Select printing technique</p>
          <TechniqueSelector
            techniques={product.techniques}
            selected={technique}
            onSelect={(k) => {
              setTechnique(k);
              setStep("placement");
            }}
          />
        </section>
      )}

      {/* Step: select placement */}
      {step === "placement" && printfiles && (
        <section className="space-y-2">
          <p className="text-sm font-medium">Select placement</p>
          <PlacementSelector
            placements={printfiles.available_placements}
            selected={placement}
            conflicting={conflictingPlacements}
            onSelect={(p) => {
              setPlacement(p);
              setStep("design");
            }}
          />
        </section>
      )}

      {/* Step: design */}
      {step === "design" && activeTemplate && (
        <section className="space-y-4">
          <p className="text-sm font-medium">Position your artwork</p>
          <DesignCanvas
            template={activeTemplate}
            artworkUrl={artworkUrl}
            artworkRect={artworkRect}
            onArtworkChange={setArtworkRect}
          />

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded border border-gray-300 px-4 py-2 text-sm hover:border-black disabled:opacity-50"
            >
              {uploading ? "Uploading…" : artworkUrl ? "Change artwork" : "Upload artwork"}
            </button>
            {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
          </div>

          {printfiles && (
            <OptionsSelector
              optionGroups={printfiles.option_groups}
              options={printfiles.options}
              selectedGroups={selectedOptionGroups}
              selectedOptions={selectedOptions}
              onGroupsChange={setSelectedOptionGroups}
              onOptionsChange={setSelectedOptions}
            />
          )}

          <button
            onClick={handleGenerate}
            disabled={!artworkUrl || generating}
            className="w-full rounded bg-black py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
          >
            {generating ? "Submitting…" : "Generate Mockup"}
          </button>
        </section>
      )}

      {/* Step: generating */}
      {step === "generating" && taskKey && (
        <MockupStatus
          taskKey={taskKey}
          onComplete={(task) => {
            setCompletedTask(task);
            setStep("done");
          }}
          onFailed={(msg) => {
            setError(msg);
            setStep("design");
          }}
        />
      )}

      {/* Step: done */}
      {step === "done" && completedTask && (
        <MockupPreview task={completedTask} onReset={reset} />
      )}

      {/* Back navigation */}
      {step !== "product" && step !== "generating" && step !== "done" && (
        <button
          onClick={() => {
            const prev: Record<Step, Step> = {
              product: "product",
              variant: "product",
              technique: "variant",
              placement: "technique",
              design: "placement",
              generating: "design",
              done: "design",
            };
            setStep(prev[step]);
          }}
          className="text-xs text-gray-400 underline hover:text-black"
        >
          ← Back
        </button>
      )}
    </div>
  );
}
