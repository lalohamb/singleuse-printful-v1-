"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Check, Loader2, AlertCircle } from "lucide-react";
import { generateSlug } from "@/lib/catalog/types";
import type { PrintfulLayoutTemplate, PrintfulMockupTask, PrintfulPrintfilesResponse, PrintfulTemplatesResponse } from "@/lib/printful/types";
import type { CanvasRect } from "@/components/product-designer/coordinates";
import { canvasToPrintfulCoordinates } from "@/components/product-designer/coordinates";
import { useArtworkUpload } from "@/components/product-designer/useArtworkUpload";
import DesignCanvas from "@/components/product-designer/DesignCanvas";
import MockupStatus from "@/components/product-designer/MockupStatus";
import PlacementSelector from "@/components/product-designer/PlacementSelector";
import TechniqueSelector from "@/components/product-designer/TechniqueSelector";
import OptionsSelector from "@/components/product-designer/OptionsSelector";
import { BlankSelector, VariantPicker, DesignPicker, ArtworkValidationPanel } from "./StageComponents";
import { initialBuilderState, type BuilderStage, type CatalogBuilderState, type BuiltMockup, type VariantPricing } from "./types";
import type { ArtworkValidationResult } from "@/lib/fulfillment/artwork-validation";

const CANVAS_W = 400;
const CANVAS_H = 400;

const STAGE_LABELS: Record<BuilderStage, string> = {
  blank: "Choose Blank",
  variants: "Pick Variants",
  design: "Choose Design",
  production: "Production",
  designer: "Position Artwork",
  mockups: "Generate Mockups",
  details: "Product Details",
  pricing: "Pricing",
  review: "Review & Publish",
};

const STAGES: BuilderStage[] = ["blank","variants","design","production","designer","mockups","details","pricing","review"];


export default function CatalogBuilder() {
  const router = useRouter();
  const [stage, setStage] = useState<BuilderStage>("blank");
  const [state, setState] = useState<CatalogBuilderState>(initialBuilderState);
  const [printfiles, setPrintfiles] = useState<PrintfulPrintfilesResponse | null>(null);
  const [templates, setTemplates] = useState<PrintfulTemplatesResponse | null>(null);
  const [artworkRect, setArtworkRect] = useState<CanvasRect>({ x: 100, y: 100, width: 100, height: 100 });
  const [selectedOptionGroups, setSelectedOptionGroups] = useState<string[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [artworkValidation, setArtworkValidation] = useState<ArtworkValidationResult | null>(null);

  const { upload, uploading, error: uploadError } = useArtworkUpload();

  const update = (patch: Partial<CatalogBuilderState>) =>
    setState((s) => ({ ...s, ...patch }));

  const go = (s: BuilderStage) => { setError(null); setStage(s); };

  // ── Stage: production — load printfiles + templates ───────────────────────
  async function loadProduction(productId: number, technique: string) {
    setError(null);
    try {
      const [pf, tmpl] = await Promise.all([
        fetch(`/api/printful/printfiles/${productId}`).then((r) => r.json()),
        fetch(`/api/printful/templates/${productId}?technique=${technique}`).then((r) => r.json()),
      ]);
      if (pf.error) throw new Error(pf.error);
      if (tmpl.error) throw new Error(tmpl.error);
      setPrintfiles(pf.result);
      setTemplates(tmpl.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load production data");
    }
  }

  // ── Resolve active template when placement changes ────────────────────────
  function resolveTemplate(placement: string): PrintfulLayoutTemplate | null {
    if (!templates || !state.selectedVariants[0]) return null;
    const variantId = state.selectedVariants[0].id;
    const mapping = templates.variant_mapping.find((m) => m.variant_id === variantId);
    if (!mapping) return null;
    const entry = mapping.templates.find((t) => t.placement === placement);
    if (!entry) return null;
    const tmpl = templates.templates.find((t) => t.template_id === entry.template_id) ?? null;
    if (tmpl) {
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
    return tmpl;
  }

  // ── Generate mockup ───────────────────────────────────────────────────────
  async function handleGenerate() {
    const { catalogProduct, selectedVariants, activeTemplate, artworkUrl, placement, technique } = state;
    if (!catalogProduct || !selectedVariants.length || !activeTemplate || !artworkUrl || !placement) return;
    setGenerating(true);
    setError(null);
    const position = canvasToPrintfulCoordinates(artworkRect, activeTemplate, CANVAS_W, CANVAS_H);
    const body = JSON.stringify({
      productId: catalogProduct.id,
      variant_ids: selectedVariants.map((v) => v.id),
      technique: technique ?? undefined,
      files: [{ placement, image_url: artworkUrl, position }],
    });
    // Retry up to 4 times on 429 with exponential backoff (2s, 4s, 8s, 16s)
    let lastError = "";
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) {
        const delay = 2000 * Math.pow(2, attempt - 1);
        setError(`Rate limited — retrying in ${delay / 1000}s… (attempt ${attempt + 1}/4)`);
        await new Promise((r) => setTimeout(r, delay));
        setError(null);
      }
      try {
        const res = await fetch("/api/printful/mockups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (res.status === 429) { lastError = "Printful rate limit reached."; continue; }
        const data = await res.json();
        if (data.error) { lastError = data.error; break; }
        update({ mockupTaskKey: data.result.task_key, designConfiguration: { position, placement, technique, artworkUrl } });
        setGenerating(false);
        go("mockups");
        return;
      } catch (e) {
        lastError = e instanceof Error ? e.message : "Failed to start mockup generation";
        break;
      }
    }
    setError(lastError || "Failed to start mockup generation");
    setGenerating(false);
  }

  // ── Persist mockups ───────────────────────────────────────────────────────
  async function handleMockupComplete(task: PrintfulMockupTask) {
    update({ completedTask: task });
    if (!task.mockups?.length) { go("details"); return; }
    // Persist all mockups to Supabase Storage
    try {
      const res = await fetch("/api/printful/mockups/persist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskKey: task.task_key }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const persisted: BuiltMockup[] = (data.result ?? data.mockups ?? []).map((m: BuiltMockup, i: number) => ({
        ...m,
        is_primary: i === 0,
        display_order: i,
      }));
      update({
        persistedMockups: persisted,
        selectedMockupIndices: persisted.map((_, i) => i),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to persist mockups");
    }
    go("details");
  }

  // ── Save draft + publish ──────────────────────────────────────────────────
  async function handleSaveAndPublish() {
    const { catalogProduct, selectedVariants, design, placement, technique, printfileId,
      designConfiguration, title, slug, description, shortDescription, brand, productType,
      categoryId, metaTitle, metaDescription, variantPricing, persistedMockups,
      selectedMockupIndices, idempotencyKey } = state;

    if (!catalogProduct || !design || !placement || !technique || !title || !slug) {
      setError("Missing required fields"); return;
    }

    const price = Math.min(...variantPricing.map((v) => v.retail_price).filter((p) => p > 0));
    if (!isFinite(price) || price <= 0) { setError("Set pricing for all variants"); return; }

    const selectedMockups = selectedMockupIndices.map((i) => persistedMockups[i]).filter(Boolean);

    setSaving(true);
    setError(null);
    try {
      // 1. Create draft
      const createRes = await fetch("/api/catalog-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printful_catalog_id: catalogProduct.id,
          variants: selectedVariants.map((v) => {
            const pricing = variantPricing.find((p) => p.printful_variant_id === String(v.id));
            return {
              printful_variant_id: String(v.id),
              label: v.name,
              color: v.color || null,
              size: v.size || null,
              retail_price: pricing?.retail_price ?? price,
              provider_cost: pricing?.provider_cost ?? null,
              image_url: v.image || null,
            };
          }),
          design_id: design.id,
          placement,
          technique,
          printfile_id: printfileId,
          design_configuration: designConfiguration,
          title: title.trim(),
          slug,
          description: description || null,
          short_description: shortDescription || null,
          brand: brand || null,
          product_type: productType || null,
          category_id: categoryId || null,
          meta_title: metaTitle || null,
          meta_description: metaDescription || null,
          price,
          mockups: selectedMockups.map((m) => ({
            storage_path: m.storage_path,
            image_url: m.stored_url,
            mockup_task_key: m.mockup_task_key,
            is_primary: m.is_primary,
            display_order: m.display_order,
            variant_ids: m.variant_ids,
          })),
          idempotency_key: idempotencyKey,
        }),
      });
      const createData = await createRes.json();
      if (createData.error) throw new Error(createData.error);
      const pid = createData.product_id;
      setProductId(pid);

      // 2. Publish
      setPublishing(true);
      const pubRes = await fetch("/api/catalog-builder/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: pid }),
      });
      const pubData = await pubRes.json();
      if (pubData.error) throw new Error(pubData.error);
      // Surface any non-blocking warnings (e.g. no mockups)
      if (pubData.warnings?.length) setError(pubData.warnings.join(" "));
      else setError(null);

      go("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save product");
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  }

  // ── Progress bar ──────────────────────────────────────────────────────────
  const stageIdx = STAGES.indexOf(stage);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STAGES.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-shrink-0">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
              i < stageIdx ? "bg-green-100 text-green-700" :
              i === stageIdx ? "bg-secondary-900 text-white" :
              "bg-secondary-100 text-secondary-400"
            }`}>
              {i < stageIdx ? <Check size={10} /> : <span>{i + 1}</span>}
              <span className="hidden sm:inline">{STAGE_LABELS[s]}</span>
            </div>
            {i < STAGES.length - 1 && <ChevronRight size={12} className="text-secondary-300 flex-shrink-0" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-lg p-3 text-sm">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stage: blank */}
      {stage === "blank" && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Choose a blank product</h2>
          <BlankSelector onSelect={(p) => {
            update({
              catalogProduct: p,
              technique: p.techniques.find((t) => t.is_default)?.key ?? p.techniques[0]?.key ?? null,
            });
            go("variants");
          }} />
        </section>
      )}

      {/* Stage: variants */}
      {stage === "variants" && state.catalogProduct && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">{state.catalogProduct.title} — Select variants</h2>
          <VariantPicker
            catalogProductId={state.catalogProduct.id}
            selected={state.selectedVariants}
            onChange={(v) => update({ selectedVariants: v })}
          />
          <div className="flex justify-between pt-2">
            <button onClick={() => go("blank")} className="text-sm text-secondary-400 underline">← Back</button>
            <button
              disabled={state.selectedVariants.length === 0}
              onClick={() => go("design")}
              className="btn-primary px-5 py-2 text-sm disabled:opacity-40"
            >Continue ({state.selectedVariants.length} selected)</button>
          </div>
        </section>
      )}

      {/* Stage: design */}
      {stage === "design" && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Choose a design</h2>
          <DesignPicker
            selected={state.design}
            catalogProductId={state.catalogProduct?.id}
            placement={state.placement}
            variantId={state.selectedVariants[0]?.id}
            onSelect={(d, validation) => {
              setArtworkValidation(validation);
              update({ design: d, artworkUrl: d.artwork_url });
              go("production");
              if (state.catalogProduct && state.technique)
                loadProduction(state.catalogProduct.id, state.technique);
            }}
          />
          <button onClick={() => go("variants")} className="text-sm text-secondary-400 underline">← Back</button>
        </section>
      )}

      {/* Stage: production */}
      {stage === "production" && state.catalogProduct && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Production settings</h2>
          {!printfiles ? (
            <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-secondary-300" /></div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium text-secondary-700">Technique</p>
                <TechniqueSelector
                  techniques={state.catalogProduct.techniques}
                  selected={state.technique}
                  onSelect={(k) => {
                    update({ technique: k });
                    loadProduction(state.catalogProduct!.id, k);
                  }}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-secondary-700">Placement</p>
                <PlacementSelector
                  placements={printfiles.available_placements}
                  selected={state.placement}
                  conflicting={state.placement && templates?.conflicting_placements[state.placement] ? templates.conflicting_placements[state.placement] : []}
                  onSelect={(p) => {
                    const tmpl = resolveTemplate(p);
                    update({ placement: p, activeTemplate: tmpl, printfileId: null });
                  }}
                />
              </div>
            </>
          )}
          <div className="flex justify-between pt-2">
            <button onClick={() => go("design")} className="text-sm text-secondary-400 underline">← Back</button>
            <button
              disabled={!state.placement || !state.activeTemplate}
              onClick={() => go("designer")}
              className="btn-primary px-5 py-2 text-sm disabled:opacity-40"
            >Continue</button>
          </div>
        </section>
      )}

      {/* Stage: designer */}
      {stage === "designer" && state.activeTemplate && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Position your artwork</h2>
          <DesignCanvas
            template={state.activeTemplate}
            artworkUrl={state.artworkUrl}
            artworkRect={artworkRect}
            onArtworkChange={setArtworkRect}
          />
          {/* OptionsSelector intentionally omitted in Catalog Builder — option_groups/options
              filter which variants get mockups and frequently cause 400 errors when combined
              with a single variant. Users can use the standalone Product Designer for advanced options. */}
          {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
          <div className="flex justify-between pt-2">
            <button onClick={() => go("production")} className="text-sm text-secondary-400 underline">← Back</button>
            <button
              disabled={!state.artworkUrl || generating || uploading}
              onClick={handleGenerate}
              className="btn-primary px-5 py-2 text-sm disabled:opacity-40 flex items-center gap-2"
            >
              {generating && <Loader2 size={14} className="animate-spin" />}
              {generating ? "Submitting…" : "Generate Mockups"}
            </button>
          </div>
        </section>
      )}

      {/* Stage: mockups */}
      {stage === "mockups" && state.mockupTaskKey && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Generating mockups…</h2>
          <MockupStatus
            taskKey={state.mockupTaskKey}
            onComplete={handleMockupComplete}
            onFailed={(msg) => { setError(msg); go("designer"); }}
          />
        </section>
      )}

      {/* Stage: details */}
      {stage === "details" && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Product details</h2>

          {/* Mockup selection */}
          {state.persistedMockups.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-secondary-700">Select mockups to publish</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {state.persistedMockups.map((m, i) => {
                  const selected = state.selectedMockupIndices.includes(i);
                  return (
                    <button key={i} onClick={() => {
                      const next = selected
                        ? state.selectedMockupIndices.filter((x) => x !== i)
                        : [...state.selectedMockupIndices, i];
                      update({ selectedMockupIndices: next });
                    }} className={`relative rounded-lg border-2 overflow-hidden aspect-square transition-all ${selected ? "border-secondary-900" : "border-secondary-200"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.stored_url} alt={m.placement} className="w-full h-full object-cover" />
                      {selected && <div className="absolute top-1 right-1 bg-secondary-900 rounded-full p-0.5"><Check size={10} className="text-white" /></div>}
                      {i === 0 && <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1 rounded">Primary</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-secondary-700 mb-1">Title *</label>
              <input value={state.title} onChange={(e) => {
                const t = e.target.value;
                update({ title: t, slug: state.slug || generateSlug(t), metaTitle: state.metaTitle || t });
              }} className="input-field" placeholder="Product title" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-secondary-700 mb-1">Slug *</label>
              <input value={state.slug} onChange={(e) => update({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} className="input-field font-mono text-sm" placeholder="product-slug" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-secondary-700 mb-1">Description</label>
              <textarea value={state.description} onChange={(e) => update({ description: e.target.value })} rows={3} className="input-field resize-none" placeholder="Full product description" />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-700 mb-1">Brand</label>
              <input value={state.brand} onChange={(e) => update({ brand: e.target.value })} className="input-field" placeholder="Brand name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-700 mb-1">Product type</label>
              <input value={state.productType} onChange={(e) => update({ productType: e.target.value })} className="input-field" placeholder="e.g. T-Shirt" />
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button onClick={() => go("mockups")} className="text-sm text-secondary-400 underline">← Back</button>
            <button
              disabled={!state.title || !state.slug}
              onClick={() => {
                // Init pricing from selected variants
                if (state.variantPricing.length === 0) {
                  update({ variantPricing: state.selectedVariants.map((v) => ({
                    printful_variant_id: String(v.id),
                    label: v.name,
                    color: v.color || null,
                    size: v.size || null,
                    provider_cost: parseFloat(v.price) || 0,
                    retail_price: Math.ceil(parseFloat(v.price) * 2.5),
                  })) });
                }
                go("pricing");
              }}
              className="btn-primary px-5 py-2 text-sm disabled:opacity-40"
            >Continue</button>
          </div>
        </section>
      )}

      {/* Stage: pricing */}
      {stage === "pricing" && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Set pricing</h2>
          <div className="space-y-2">
            {state.variantPricing.map((vp, i) => (
              <div key={vp.printful_variant_id} className="flex items-center gap-3 p-3 bg-secondary-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-secondary-900 truncate">{vp.label}</p>
                  <p className="text-xs text-secondary-400">Cost: ${vp.provider_cost?.toFixed(2) ?? "—"}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-secondary-500">$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={vp.retail_price}
                    onChange={(e) => {
                      const next = [...state.variantPricing];
                      next[i] = { ...next[i], retail_price: parseFloat(e.target.value) || 0 };
                      update({ variantPricing: next });
                    }}
                    className="input-field w-24 text-right"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => go("details")} className="text-sm text-secondary-400 underline">← Back</button>
            <button
              disabled={state.variantPricing.some((v) => v.retail_price <= 0)}
              onClick={() => go("review")}
              className="btn-primary px-5 py-2 text-sm disabled:opacity-40"
            >Review</button>
          </div>
        </section>
      )}

      {/* Stage: review */}
      {stage === "review" && (
        <section className="space-y-4">
          {productId ? (
            <div className="text-center space-y-4 py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Check size={32} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-secondary-900">Product published!</h2>
                <p className="text-sm text-secondary-500 mt-1">{state.title}</p>
              </div>
              <div className="flex justify-center gap-3">
                <a href={`/product/${state.slug}`} target="_blank" rel="noopener noreferrer"
                  className="btn-secondary px-4 py-2 text-sm">View product →</a>
                <button onClick={() => router.push("/admin/products")} className="btn-primary px-4 py-2 text-sm">
                  Go to Products
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold">Review & Publish</h2>
              <div className="bg-secondary-50 rounded-xl p-4 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-secondary-500">Blank</span><span className="font-medium">{state.catalogProduct?.title}</span></div>
                <div className="flex justify-between"><span className="text-secondary-500">Variants</span><span className="font-medium">{state.selectedVariants.length} selected</span></div>
                <div className="flex justify-between"><span className="text-secondary-500">Design</span><span className="font-medium">{state.design?.name}</span></div>
                <div className="flex justify-between"><span className="text-secondary-500">Technique</span><span className="font-medium">{state.technique}</span></div>
                <div className="flex justify-between"><span className="text-secondary-500">Placement</span><span className="font-medium">{state.placement}</span></div>
                <div className="flex justify-between"><span className="text-secondary-500">Mockups</span><span className="font-medium">{state.selectedMockupIndices.length} selected</span></div>
                <div className="flex justify-between"><span className="text-secondary-500">Title</span><span className="font-medium">{state.title}</span></div>
                <div className="flex justify-between"><span className="text-secondary-500">Slug</span><span className="font-mono text-xs">{state.slug}</span></div>
                <div className="flex justify-between"><span className="text-secondary-500">Base price</span>
                  <span className="font-medium">${Math.min(...state.variantPricing.map((v) => v.retail_price).filter((p) => p > 0)).toFixed(2)}</span>
                </div>
              </div>
              {artworkValidation && <ArtworkValidationPanel result={artworkValidation} />}
              <div className="flex justify-between pt-2">
                <button onClick={() => go("pricing")} className="text-sm text-secondary-400 underline">← Back</button>
                <button
                  disabled={saving || publishing}
                  onClick={handleSaveAndPublish}
                  className="btn-primary px-6 py-2 text-sm disabled:opacity-40 flex items-center gap-2"
                >
                  {(saving || publishing) && <Loader2 size={14} className="animate-spin" />}
                  {saving ? "Saving…" : publishing ? "Publishing…" : "Publish Product"}
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
