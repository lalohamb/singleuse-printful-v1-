"use client";
import { useState, useEffect } from "react";
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
import { BlankSelector, DesignPicker, ArtworkValidationPanel } from "./StageComponents";
import {
  CreationModeSelector, ProductCard, VariantMatrix, PricingPreview, BuildSummary,
  MultiDryRunPanel, StickyWizardNav, prefetchSummaries,
  type MultiDryRunEntry,
} from "./Phase11AComponents";
import { initialBuilderState, type BuilderStage, type CatalogBuilderState, type BuiltMockup, type VariantPricing } from "./types";
import type { PrintfulProduct } from "@/lib/printful/types";
import type { ArtworkValidationResult } from "@/lib/fulfillment/artwork-validation";

const CANVAS_W = 400;
const CANVAS_H = 400;

const STAGE_LABELS: Record<BuilderStage, string> = {
  mode: "Creation Mode",
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

const STAGES: BuilderStage[] = ["mode","blank","variants","design","production","designer","mockups","details","pricing","review"];


export default function CatalogBuilder({ editProductId }: { editProductId?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "edit">(editProductId ? "edit" : "create");
  const [editLoading, setEditLoading] = useState(!!editProductId);
  const [editError, setEditError] = useState<string | null>(null);
  const [editUpdatedAt, setEditUpdatedAt] = useState<string | null>(null);
  const [stage, setStage] = useState<BuilderStage>(editProductId ? "blank" : "mode");
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
  const [multiDryRunEntries, setMultiDryRunEntries] = useState<MultiDryRunEntry[]>([]);
  const [multiDryRunning, setMultiDryRunning] = useState(false);

  const { upload, uploading, error: uploadError } = useArtworkUpload();

  const update = (patch: Partial<CatalogBuilderState>) =>
    setState((s) => ({ ...s, ...patch }));

  const go = (s: BuilderStage) => { setError(null); setStage(s); };

  // ── EDIT MODE: load existing product state ────────────────────────────────
  useState(() => {
    if (!editProductId) return;
    (async () => {
      try {
        const res = await fetch(`/api/catalog-builder/load?product_id=${editProductId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load product");

        const { product, variants, product_designs, images } = data;
        const primaryDesign = product_designs.find((pd: Record<string,unknown>) => pd.is_primary) ?? product_designs[0];
        const design = primaryDesign?.designs;

        setEditUpdatedAt(product.updated_at);

        // Reconstruct builder state from persisted data
        update({
          title: product.title ?? "",
          slug: product.slug ?? "",
          description: product.description ?? "",
          shortDescription: product.short_description ?? "",
          brand: product.brand ?? "",
          productType: product.product_type ?? "",
          categoryId: product.category_id ?? "",
          metaTitle: product.meta_title ?? "",
          metaDescription: product.meta_description ?? "",
          design: design ? { id: primaryDesign.design_id, name: design.name, slug: design.slug, artwork_url: design.artwork_url, storage_path: design.storage_path, file_name: design.file_name, width: design.width, height: design.height, status: design.status, file_size: design.file_size, tags: [], description: null, created_by: null, created_at: "", updated_at: "", file_type: null } : null,
          artworkUrl: design?.artwork_url ?? null,
          placement: primaryDesign?.placement ?? null,
          technique: primaryDesign?.technique ?? null,
          designConfiguration: (primaryDesign?.configuration as Record<string,unknown>) ?? {},
          variantPricing: variants.map((v: Record<string,unknown>) => ({
            printful_variant_id: String(v.printful_variant_id),
            label: String(v.label),
            color: (v.color as string | null),
            size: (v.size as string | null),
            provider_cost: Number(v.provider_cost ?? 0),
            retail_price: Number(v.retail_price),
          })),
          persistedMockups: images.map((img: Record<string,unknown>, i: number) => ({
            placement: primaryDesign?.placement ?? "front",
            stored_url: String(img.image_url),
            original_url: String(img.image_url),
            storage_path: String(img.storage_path ?? ""),
            mockup_task_key: (img.mockup_task_key as string | null),
            is_primary: Boolean(img.is_primary),
            display_order: Number(img.display_order ?? i),
          })),
          selectedMockupIndices: images.map((_: unknown, i: number) => i),
        });

        // Jump to review stage in edit mode
        setStage("review");
      } catch (e) {
        setEditError(e instanceof Error ? e.message : "Failed to load product for editing");
      } finally {
        setEditLoading(false);
      }
    })();
  });

  // ── Stage: production — load printfiles + templates ───────────────────────
  // Issue E fix: always clear printfiles/templates/placement/activeTemplate before
  // fetching so the UI never shows stale data. On error, restore to empty (not null)
  // so the spinner clears and the operator sees the error with a retry path.
  async function loadProduction(catalogProductId: number, technique: string) {
    setError(null);
    // Clear stale state immediately — prevents Continue staying enabled with old template
    setPrintfiles(null);
    setTemplates(null);
    update({ placement: null, activeTemplate: null, printfileId: null });
    try {
      const [pf, tmpl] = await Promise.all([
        fetch(`/api/printful/printfiles/${catalogProductId}`).then((r) => r.json()),
        fetch(`/api/printful/templates/${catalogProductId}?technique=${technique}`).then((r) => r.json()),
      ]);
      if (pf.error) throw new Error(pf.error);
      if (tmpl.error) throw new Error(tmpl.error);
      setPrintfiles(pf.result);
      setTemplates(tmpl.result);
    } catch (e) {
      // Set empty objects so the spinner clears — error is shown, operator can retry
      setPrintfiles({ product_id: catalogProductId, available_placements: {}, printfiles: [], variant_printfiles: [], option_groups: [], options: [] });
      setTemplates(null);
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

    if (!design || !placement || !technique || !title || !slug) {
      setError("Missing required fields"); return;
    }

    const price = Math.min(...variantPricing.map((v) => v.retail_price).filter((p) => p > 0));
    if (!isFinite(price) || price <= 0) { setError("Set pricing for all variants"); return; }

    const selectedMockups = selectedMockupIndices.map((i) => persistedMockups[i]).filter(Boolean);

    setSaving(true);
    setError(null);
    try {
      if (mode === "edit" && editProductId) {
        // ── EDIT MODE: update existing product ────────────────────────────────
        const updateRes = await fetch("/api/catalog-builder/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id: editProductId,
            updated_at_check: editUpdatedAt,
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
            variants: variantPricing.map((vp) => ({
              printful_variant_id: vp.printful_variant_id,
              retail_price: vp.retail_price,
            })),
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
        const updateData = await updateRes.json();
        if (updateData.conflict) throw new Error(updateData.error);
        if (updateData.error) throw new Error(updateData.error);
        setProductId(editProductId);
        go("review");
      } else {
        // ── CREATE MODE: create new product ───────────────────────────────────
        if (!catalogProduct) { setError("Missing required fields"); return; }
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

        setPublishing(true);
        const pubRes = await fetch("/api/catalog-builder/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: pid }),
        });
        const pubData = await pubRes.json();
        if (pubData.error) throw new Error(pubData.error);
        if (pubData.warnings?.length) setError(pubData.warnings.join(" "));
        else setError(null);

        go("review");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save product");
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  }

  // ── Multi-mode: remove one product from dry-run candidates ────────────────
  function handleRemoveFromDryRun(productId: number) {
    update({ multiSelectedProducts: state.multiSelectedProducts.filter((p) => p.id !== productId) });
    setMultiDryRunEntries((prev) => prev.filter((e) => e.product.id !== productId));
  }

  // ── Multi-mode: proceed to design stage ──────────────────────────────────
  function handleMultiProceed() {
    go("design");
  }

  // ── Multi-mode: run dry-run validation for all selected products ──────────
  async function handleMultiDryRun() {
    const { multiSelectedProducts, design, technique, placement, variantPricing } = state;
    if (!design || !multiSelectedProducts.length) return;
    setMultiDryRunning(true);

    // Initialise entries as running
    const initial: MultiDryRunEntry[] = multiSelectedProducts.map((p) => ({
      product: p,
      variantCount: 0,
      minCost: null, maxCost: null, minRetail: null, maxRetail: null,
      dpiResult: null,
      dryRunResult: "running",
      errors: [],
    }));
    setMultiDryRunEntries(initial);

    const updated = [...initial];
    await Promise.all(
      multiSelectedProducts.map(async (p, idx) => {
        try {
          // Fetch variants for this product
          const vRes = await fetch(`/api/printful/products/${p.id}`);
          const vData = await vRes.json();
          const variants: Array<{ id: number; price: string; in_stock: boolean; color: string; size: string; name: string }> =
            vData.result?.variants ?? [];
          const available = variants.filter((v) => v.in_stock);
          const costs = available.map((v) => parseFloat(v.price)).filter((c) => c > 0);

          // Build a minimal spec for dry-run
          const defaultTechnique = technique ?? p.techniques.find((t) => t.is_default)?.key ?? p.techniques[0]?.key ?? "";
          const defaultPlacement = placement ?? "front";
          const basePrice = costs.length ? Math.min(...costs) * 2.5 : 0;

          const spec = {
            printful_catalog_id: p.id,
            variants: available.slice(0, 5).map((v) => ({
              printful_variant_id: String(v.id),
              label: v.name,
              color: v.color || null,
              size: v.size || null,
              retail_price: Math.ceil(parseFloat(v.price) * 2.5),
              provider_cost: parseFloat(v.price),
              image_url: null,
            })),
            design_id: design.id,
            placement: defaultPlacement,
            technique: defaultTechnique,
            printfile_id: null,
            design_configuration: { artworkUrl: design.artwork_url },
            title: `${p.title} — Draft`,
            slug: `${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-draft-${p.id}`,
            description: null, short_description: null, brand: null,
            product_type: null, category_id: null, meta_title: null, meta_description: null,
            price: basePrice > 0 ? Math.ceil(basePrice * 100) / 100 : 1,
            mockups: [],
            publication_mode: "draft" as const,
            idempotency_key: `multi-dryrun-${p.id}-${Date.now()}`,
          };

          const drRes = await fetch("/api/catalog-builder/dry-run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(spec),
          });
          const drData = await drRes.json();

          const minCost = costs.length ? Math.min(...costs) : null;
          const maxCost = costs.length ? Math.max(...costs) : null;
          const retailPrices = spec.variants.map((v) => v.retail_price);
          const minRetail = retailPrices.length ? Math.min(...retailPrices) : null;
          const maxRetail = retailPrices.length ? Math.max(...retailPrices) : null;

          updated[idx] = {
            product: p,
            variantCount: available.length,
            minCost, maxCost, minRetail, maxRetail,
            dpiResult: artworkValidation?.status ?? null,
            dryRunResult: drData.valid ? (artworkValidation?.status === "PASS_WARNING" ? "WARNING" : "PASS") : "FAIL",
            errors: drData.valid ? [] : (drData.errors ?? []).map((e: { message: string }) => e.message),
          };
        } catch (e) {
          updated[idx] = {
            ...updated[idx],
            dryRunResult: "FAIL",
            errors: [e instanceof Error ? e.message : "Validation failed"],
          };
        }
        setMultiDryRunEntries([...updated]);
      })
    );
    setMultiDryRunning(false);
  }

  // ── Progress bar ──────────────────────────────────────────────────────────
  const stageIdx = STAGES.indexOf(stage);

  if (editLoading) return (
    <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-secondary-300" /></div>
  );

  const showSummary = !["mode", "blank", "review"].includes(stage) && !!(state.catalogProduct || (state.creationMode === "multi" && state.multiSelectedProducts.length > 0));

  // ── Sticky nav config per stage ───────────────────────────────────────────────
  // mode and review stages manage their own navigation inline.
  interface NavConfig {
    stepLabel: string; stepIndex: number; totalSteps: number;
    onBack?: () => void; onContinue?: () => void;
    continueLabel?: string; continueDisabled?: boolean;
    continueDisabledReason?: string; statusText?: string; loading?: boolean;
  }
  const stickyNav = ((): NavConfig | null => {
    const stageIdx = STAGES.indexOf(stage);
    const base = { stepLabel: STAGE_LABELS[stage], stepIndex: stageIdx, totalSteps: STAGES.length };
    switch (stage) {
      case "blank":
        return null; // blank uses card-click navigation, no Continue needed
      case "variants": {
        const n = state.selectedVariants.length;
        return {
          ...base,
          onBack: () => go("blank"),
          onContinue: () => go("design"),
          continueLabel: `Continue (${n} selected)`,
          continueDisabled: n === 0,
          continueDisabledReason: n === 0 ? "Select at least one available variant." : undefined,
          statusText: n > 0 ? `${n} variant${n !== 1 ? "s" : ""} selected` : undefined,
        };
      }
      case "design":
        return { ...base, onBack: () => go(state.creationMode === "multi" ? "blank" : "variants") };
      case "production": {
        const ready = !!state.placement && !!state.activeTemplate;
        return {
          ...base,
          onBack: () => go("design"),
          onContinue: () => go("designer"),
          continueDisabled: !ready,
          continueDisabledReason: !state.placement ? "Select a placement to continue." : !state.activeTemplate ? "No template found for this placement." : undefined,
        };
      }
      case "designer":
        return {
          ...base,
          onBack: () => go("production"),
          onContinue: handleGenerate,
          continueLabel: generating ? "Submitting…" : "Generate Mockups",
          continueDisabled: !state.artworkUrl || generating || uploading,
          continueDisabledReason: !state.artworkUrl ? "Position your artwork first." : undefined,
          loading: generating,
        };
      case "mockups":
        return { ...base, onBack: () => { go("designer"); } };
      case "details": {
        const ready = !!state.title && !!state.slug;
        return {
          ...base,
          onBack: () => go("mockups"),
          onContinue: () => {
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
          },
          continueDisabled: !ready,
          continueDisabledReason: !state.title ? "Enter a product title." : !state.slug ? "Enter a product slug." : undefined,
        };
      }
      case "pricing": {
        const invalid = state.variantPricing.some((v) => v.retail_price <= 0);
        return {
          ...base,
          onBack: () => go("details"),
          onContinue: () => go("review"),
          continueLabel: "Review",
          continueDisabled: invalid,
          continueDisabledReason: invalid ? "Set a price > $0 for all variants." : undefined,
        };
      }
      default:
        return null;
    }
  })();

  return (
    <div className="max-w-5xl mx-auto pb-20">
    <div className={`gap-6 ${showSummary ? "grid grid-cols-1 lg:grid-cols-[1fr_220px]" : ""}`}>
    <div className="space-y-6">
      {editError && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-lg p-3 text-sm">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>Failed to load product for editing: {editError}</span>
        </div>
      )}
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

      {/* Stage: mode */}
      {stage === "mode" && (
        <section>
          <CreationModeSelector onSelect={(m) => {
            update({ creationMode: m });
            go("blank");
          }} />
        </section>
      )}

      {/* Stage: blank — multi mode */}
      {stage === "blank" && state.creationMode === "multi" && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Select blanks</h2>
          <MultiBlankSelector
            selected={state.multiSelectedProducts}
            onChange={(products) => update({ multiSelectedProducts: products })}
          />
          <div className="flex justify-between pt-2">
            <button onClick={() => go("mode")} className="text-sm text-secondary-400 underline">← Back</button>
            <button
              disabled={state.multiSelectedProducts.length === 0}
              onClick={handleMultiProceed}
              className="btn-primary px-5 py-2 text-sm disabled:opacity-40"
            >Continue ({state.multiSelectedProducts.length} selected)</button>
          </div>
        </section>
      )}
      {/* Stage: blank — single mode */}
      {stage === "blank" && state.creationMode !== "multi" && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Choose a blank product</h2>
          <BlankSelector onSelect={(p) => {
            update({
              catalogProduct: p,
              technique: p.techniques.find((t) => t.is_default)?.key ?? p.techniques[0]?.key ?? null,
            });
            go("variants");
          }} />
          <button onClick={() => go("mode")} className="text-sm text-secondary-400 underline">← Back</button>
        </section>
      )}

      {/* Stage: variants */}
      {stage === "variants" && state.catalogProduct && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">{state.catalogProduct.title} — Select variants</h2>
          <VariantMatrix
            catalogProductId={state.catalogProduct.id}
            selected={state.selectedVariants}
            onChange={(v) => update({ selectedVariants: v })}
          />
        </section>
      )}

      {/* Stage: design — multi mode skips variants/production/designer/mockups */}
      {stage === "design" && state.creationMode === "multi" && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Choose a design for all products</h2>
          <DesignPicker
            selected={state.design}
            onSelect={(d, validation) => {
              setArtworkValidation(validation);
              update({ design: d, artworkUrl: d.artwork_url });
              // Multi mode: go straight to review/dry-run
              setMultiDryRunEntries([]);
              go("review");
            }}
          />
          <button onClick={() => go("blank")} className="text-sm text-secondary-400 underline">← Back</button>
        </section>
      )}

      {/* Stage: design — single mode */}
      {stage === "design" && state.creationMode !== "multi" && (
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
        </section>
      )}
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
        </section>
      )}

      {/* Stage: pricing */}
      {stage === "pricing" && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Set pricing</h2>
          <PricingPreview variantPricing={state.variantPricing} />
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
        </section>
      )}

      {/* Stage: review — multi mode: dry-run matrix, no DB writes */}
      {stage === "review" && state.creationMode === "multi" && (
        <section className="space-y-4">
          <MultiDryRunPanel
            entries={multiDryRunEntries.length > 0 ? multiDryRunEntries : state.multiSelectedProducts.map((p) => ({
              product: p,
              variantCount: 0,
              minCost: null, maxCost: null, minRetail: null, maxRetail: null,
              dpiResult: null,
              dryRunResult: "pending" as const,
              errors: [],
            }))}
            onRunAll={handleMultiDryRun}
            onRemove={handleRemoveFromDryRun}
            running={multiDryRunning}
          />
          {/* Post-validation actions — only shown after at least one run */}
          {multiDryRunEntries.length > 0 && !multiDryRunning && (() => {
            const passing = multiDryRunEntries.filter((e) => e.dryRunResult === "PASS" || e.dryRunResult === "WARNING");
            const failing = multiDryRunEntries.filter((e) => e.dryRunResult === "FAIL");
            return (
              <div className="space-y-3">
                {failing.length > 0 && (
                  <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-lg p-3 text-sm">
                    <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                    <span>
                      {failing.length} product{failing.length !== 1 ? "s" : ""} failed validation and will be skipped.
                      Fix the errors above and re-run validation, or deselect those products.
                    </span>
                  </div>
                )}
                {passing.length > 0 && (
                  <div className="flex items-center justify-between bg-secondary-50 rounded-xl p-4">
                    <div>
                      <p className="text-sm font-semibold text-secondary-900">
                        {passing.length} product{passing.length !== 1 ? "s" : ""} ready to build
                      </p>
                      <p className="text-xs text-secondary-500 mt-0.5">
                        Each product will be built individually through the single-product flow.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        // Seed the first passing product into single-product flow and restart
                        const first = passing[0].product;
                        update({
                          creationMode: "single",
                          catalogProduct: first,
                          technique: first.techniques?.find((t: { is_default: boolean }) => t.is_default)?.key
                            ?? first.techniques?.[0]?.key ?? null,
                          multiSelectedProducts: [],
                        });
                        go("variants");
                      }}
                      className="btn-primary px-5 py-2 text-sm flex-shrink-0"
                    >
                      Build {passing[0].product.title.split(" ").slice(0, 2).join(" ")} →
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
          <div className="flex justify-between pt-2">
            <button onClick={() => go("design")} className="text-sm text-secondary-400 underline">← Back</button>
          </div>
        </section>
      )}

      {/* Stage: review — single mode */}
      {stage === "review" && state.creationMode !== "multi" && (
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
              <h2 className="text-base font-semibold">{mode === "edit" ? "Review & Save Changes" : "Review & Publish"}</h2>
              {mode === "edit" && (
                <div className="bg-primary-50 border border-primary-100 text-primary-700 rounded-lg p-3 text-sm">
                  Editing existing product. Store UUIDs and provider mappings are preserved. Changes affect future orders only.
                </div>
              )}
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
                  {saving ? "Saving…" : publishing ? "Publishing…" : mode === "edit" ? "Save Changes" : "Publish Product"}
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
    {showSummary && (
      <aside className="hidden lg:block">
        <BuildSummary
          mode={state.creationMode}
          product={state.catalogProduct}
          multiProducts={state.multiSelectedProducts}
          variantCount={state.selectedVariants.length}
          designName={state.design?.name ?? null}
          technique={state.technique}
          placement={state.placement}
          variantPricing={state.variantPricing}
          dpiResult={artworkValidation?.status ?? null}
        />
      </aside>
    )}
    </div>
    {/* Sticky wizard nav — Issue B fix */}
    {stickyNav && (
      <StickyWizardNav
        stepLabel={stickyNav.stepLabel}
        stepIndex={stickyNav.stepIndex}
        totalSteps={stickyNav.totalSteps}
        onBack={stickyNav.onBack}
        onContinue={stickyNav.onContinue}
        continueLabel={stickyNav.continueLabel}
        continueDisabled={stickyNav.continueDisabled}
        continueDisabledReason={stickyNav.continueDisabledReason}
        statusText={stickyNav.statusText}
        loading={stickyNav.loading}
      />
    )}
    </div>
  );
}

// ── Multi-blank selector (used only in multi mode) ────────────────────────────
function MultiBlankSelector({
  selected,
  onChange,
}: {
  selected: PrintfulProduct[];
  onChange: (products: PrintfulProduct[]) => void;
}) {
  const [products, setProducts] = useState<PrintfulProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/printful/products")
      .then((r) => r.json())
      .then(async (d) => {
        const list: PrintfulProduct[] = d.result ?? [];
        setProducts(list);
        // Batch-prefetch all summaries in one request (max 20 per call)
        const ids = list.map((p) => p.id);
        for (let i = 0; i < ids.length; i += 20) {
          await prefetchSummaries(ids.slice(i, i + 20));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = products.filter((p) =>
    !search || p.title.toLowerCase().includes(search.toLowerCase())
  );
  const selectedIds = new Set(selected.map((p) => p.id));

  const toggle = (p: PrintfulProduct) => {
    if (selectedIds.has(p.id)) onChange(selected.filter((s) => s.id !== p.id));
    else onChange([...selected, p]);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-secondary-300" /></div>;

  return (
    <div className="space-y-4">
      <div className="relative">
        <svg className="absolute left-3 top-2.5 text-secondary-400 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search blanks…" className="input-field pl-9 py-2" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((p) => (
          <ProductCard key={p.id} product={p} selected={selectedIds.has(p.id)} onSelect={toggle} prefetched />
        ))}
      </div>
    </div>
  );
}
