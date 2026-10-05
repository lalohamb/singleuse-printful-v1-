"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, AlertCircle } from "lucide-react";
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
  ProductCard, VariantMatrix, PricingPreview, BuildSummary,
  MultiDryRunPanel, StickyWizardNav, BuilderStepSidebar, MobileStepHeader,
  type MultiDryRunEntry, type SidebarStep, type StageStatus,
} from "./Phase11AComponents";
import { initialBuilderState, type BuilderStage, type CatalogBuilderState, type BuiltMockup, type VariantPricing } from "./types";
import type { ArtworkValidationResult } from "@/lib/fulfillment/artwork-validation";
import { fetchPrintfileSpec, validateArtworkForPrintfile } from "@/lib/fulfillment/artwork-validation";
import { resolveProviderCost, type CatalogProductPricing } from "@/lib/printful/pricing";

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

// Concise sidebar labels
const SIDEBAR_LABELS: Record<BuilderStage, string> = {
  blank: "Choose Blank",
  variants: "Variants",
  design: "Design",
  production: "Production",
  designer: "Position",
  mockups: "Mockups",
  details: "Details",
  pricing: "Pricing",
  review: "Review",
};

// Downstream dependency map
const DOWNSTREAM: Partial<Record<BuilderStage, BuilderStage[]>> = {
  blank:      ["variants","design","production","designer","mockups","details","pricing","review"],
  variants:   ["production","designer","mockups","pricing","review"],
  design:     ["designer","mockups","review"],
  production: ["designer","mockups","review"],
  designer:   ["mockups","review"],
  mockups:    ["details","pricing","review"],
  details:    ["pricing","review"],
  pricing:    ["review"],
};

// Single-product stage sequence (active for this release)
const SINGLE_STAGES: BuilderStage[] = ["blank","variants","design","production","designer","mockups","details","pricing","review"];
// Edit mode stage sequence
const EDIT_STAGES: BuilderStage[] = ["details","pricing","review"];

const STAGES: BuilderStage[] = SINGLE_STAGES;


export default function CatalogBuilder({ editProductId }: { editProductId?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "edit">(editProductId ? "edit" : "create");
  const [editLoading, setEditLoading] = useState(!!editProductId);
  const [editError, setEditError] = useState<string | null>(null);
  const [editUpdatedAt, setEditUpdatedAt] = useState<string | null>(null);
  const [stage, setStage] = useState<BuilderStage>(editProductId ? "details" : "blank");
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
  const [completedStages, setCompletedStages] = useState<Set<BuilderStage>>(new Set());
  const [pricingData, setPricingData] = useState<CatalogProductPricing | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  const { upload, uploading, error: uploadError } = useArtworkUpload();

  const update = (patch: Partial<CatalogBuilderState>) =>
    setState((s) => ({ ...s, ...patch }));

  // go() — navigate to a stage, mark current as complete, invalidate downstream
  const go = (next: BuilderStage) => {
    setError(null);
    setCompletedStages((prev) => {
      const updated = new Set(prev);
      // Mark current stage complete when advancing forward
      updated.add(stage);
      // If navigating backward, remove downstream completed stages
      const downstream = DOWNSTREAM[next] ?? [];
      for (const d of downstream) updated.delete(d);
      return updated;
    });
    setStage(next);
  };

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
            provider_cost: v.provider_cost != null ? Number(v.provider_cost) : null,
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

  // ── Fetch provider pricing and apply to variantPricing ─────────────────────
  // Called when entering the pricing stage with a known product, technique, placement.
  // Invalidated (pricingData set to null) when technique or placement changes.
  async function fetchAndApplyCost(
    catalogProductId: number,
    technique: string,
    placement: string,
    variants: CatalogBuilderState["selectedVariants"],
    currentPricing: CatalogBuilderState["variantPricing"]
  ) {
    setPricingLoading(true);
    try {
      const res = await fetch(`/api/printful/prices/${catalogProductId}`);
      if (!res.ok) throw new Error("Failed to fetch pricing");
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Reconstruct CatalogProductPricing from serialized response
      const pricing: CatalogProductPricing = {
        catalog_product_id: data.catalog_product_id,
        currency: data.currency,
        placements: data.placements,
        variantPrices: new Map(
          (data.variants as { id: number; techniques: unknown[] }[]).map((v) => [v.id, v.techniques as CatalogProductPricing["variantPrices"] extends Map<number, infer T> ? T : never])
        ),
      };
      setPricingData(pricing);

      // Apply resolved cost to each variant in variantPricing
      const updated = currentPricing.map((vp) => {
        const variantId = parseInt(vp.printful_variant_id, 10);
        const result = resolveProviderCost(pricing, variantId, technique, placement);
        return {
          ...vp,
          provider_cost: result.status === "resolved" ? result.cost : null,
        };
      });
      update({ variantPricing: updated });
    } catch {
      // Cost fetch failed — leave provider_cost as null, do not block retail pricing
      setPricingData(null);
    } finally {
      setPricingLoading(false);
    }
  }

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
        fetch(`/api/printful/printfiles/${catalogProductId}?technique=${encodeURIComponent(technique)}`).then((r) => r.json()),
        fetch(`/api/printful/templates/${catalogProductId}?technique=${encodeURIComponent(technique)}`).then((r) => r.json()),
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
          const variants: Array<{ id: number; color: string; size: string; name: string }> =
            vData.result?.variants ?? [];
          // V2 catalog variants have no price or in_stock — all are identity records
          const available = variants;
          const costs: number[] = [];

          // Build a minimal spec for dry-run
          const defaultTechnique = technique ?? p.techniques.find((t) => t.is_default)?.key ?? p.techniques[0]?.key ?? "";
          const defaultPlacement = placement ?? "front";

          const spec = {
            printful_catalog_id: p.id,
            variants: available.slice(0, 5).map((v) => ({
              printful_variant_id: String(v.id),
              label: v.name,
              color: v.color || null,
              size: v.size || null,
              retail_price: 0,
              provider_cost: null,
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
            price: 1,
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
  if (editLoading) return (
    <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-secondary-300" /></div>
  );

  const showSummary = !["blank", "review"].includes(stage) && !!state.catalogProduct;

  const activeStages = mode === "edit" ? EDIT_STAGES : SINGLE_STAGES;

  const currentIdx = activeStages.indexOf(stage);
  const sidebarSteps: SidebarStep[] = activeStages.map((s, idx) => {
    const isDone = completedStages.has(s);
    const isCurrent = s === stage;
    const status: StageStatus =
      isCurrent ? "current"
      : isDone ? "complete"
      : idx < currentIdx ? "available"
      : "future";
    const clickable = status === "complete" || status === "available";
    return { stage: s, label: SIDEBAR_LABELS[s] ?? s, status, onClick: clickable ? () => go(s) : undefined };
  });

  // ── Sticky nav config per stage ───────────────────────────────────────────────
  interface NavConfig {
    stepLabel: string; stepIndex: number; totalSteps: number;
    onBack?: () => void; onContinue?: () => void;
    continueLabel?: string; continueDisabled?: boolean;
    continueDisabledReason?: string; statusText?: string; loading?: boolean;
  }
  const stickyNav = ((): NavConfig | null => {
    const stageIdx = activeStages.indexOf(stage);
    const base = { stepLabel: SIDEBAR_LABELS[stage] ?? stage, stepIndex: stageIdx, totalSteps: activeStages.length };
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
        return { ...base, onBack: () => go("variants") };
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
            let pricing = state.variantPricing;
            if (pricing.length === 0) {
              pricing = state.selectedVariants.map((v) => ({
                printful_variant_id: String(v.id),
                label: v.name,
                color: v.color || null,
                size: v.size || null,
                provider_cost: null,
                retail_price: 0,
              }));
              update({ variantPricing: pricing });
            }
            go("pricing");
            // Fetch authoritative provider cost when entering pricing stage.
            // Only fetch if product, technique, and placement are all known.
            if (state.catalogProduct && state.technique && state.placement) {
              fetchAndApplyCost(
                state.catalogProduct.id,
                state.technique,
                state.placement,
                state.selectedVariants,
                pricing
              );
            }
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
    <div className="min-h-screen">
    {/* Mobile step header */}
    <MobileStepHeader
      steps={sidebarSteps}
      currentLabel={SIDEBAR_LABELS[stage] ?? stage}
      stepIndex={currentIdx}
      totalSteps={activeStages.length}
    />
    <div className="flex min-h-screen">
    {/* Desktop sidebar */}
    <BuilderStepSidebar steps={sidebarSteps} />
    {/* Main workspace */}
    <div className="flex-1 min-w-0">
    <div className={`mx-auto max-w-3xl px-4 py-6 pb-24 ${showSummary ? "lg:grid lg:grid-cols-[1fr_220px] lg:gap-6 lg:items-start" : ""}`}>
    <div className="space-y-6">
      {editError && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-lg p-3 text-sm">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>Failed to load product for editing: {editError}</span>
        </div>
      )}
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
          <VariantMatrix
            catalogProductId={state.catalogProduct.id}
            selected={state.selectedVariants}
            onChange={(v) => update({ selectedVariants: v })}
          />
        </section>
      )}

      {/* Stage: design */}
      {stage === "design" && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Choose a design</h2>
          <DesignPicker
            selected={state.design}
            catalogProductId={state.catalogProduct?.id}
            technique={state.technique}
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
                    // Invalidate artwork validation and stale provider cost.
                    setArtworkValidation(null);
                    setPricingData(null);
                    update({ variantPricing: state.variantPricing.map((vp) => ({ ...vp, provider_cost: null })) });
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
                    // Invalidate stale provider cost — placement changed.
                    setPricingData(null);
                    update({ variantPricing: state.variantPricing.map((vp) => ({ ...vp, provider_cost: null })) });
                    // Revalidate artwork against the newly selected placement + current technique.
                    // Clears any stale validation from a previous placement or technique.
                    if (state.design?.width && state.design?.height && state.catalogProduct && state.technique) {
                      setArtworkValidation(null); // clear stale result immediately
                      fetchPrintfileSpec(state.catalogProduct.id, state.technique, p, state.selectedVariants[0]?.id)
                        .then((spec) => {
                          if (!spec) return;
                          setArtworkValidation(validateArtworkForPrintfile(state.design!.width!, state.design!.height!, spec));
                        })
                        .catch(() => { /* non-fatal */ });
                    }
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
          {pricingLoading && (
            <p className="text-xs text-secondary-400">Fetching provider cost…</p>
          )}
          <PricingPreview variantPricing={state.variantPricing} />
          <div className="space-y-2">
            {state.variantPricing.map((vp, i) => (
              <div key={vp.printful_variant_id} className="flex items-center gap-3 p-3 bg-secondary-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-secondary-900 truncate">{vp.label}</p>
                  <p className="text-xs text-secondary-400">
                    {pricingLoading ? "Cost: fetching…" : vp.provider_cost != null ? `Cost: $${vp.provider_cost.toFixed(2)}` : "Cost unavailable"}
                  </p>
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
          mode="single"
          product={state.catalogProduct}
          multiProducts={[]}
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
    </div>
    </div>
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

