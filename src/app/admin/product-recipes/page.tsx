"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit2, Copy, Archive, RotateCcw, Trash2, Loader2, ChevronRight, FlaskConical, Zap } from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import type { ProductRecipe } from "@/lib/catalog/recipe-engine";

type RecipeWithUsage = ProductRecipe & { usage_count: number };

const STATUS_COLORS: Record<string, string> = {
  active: "bg-success-50 text-success-600",
  draft: "bg-warning-50 text-warning-600",
  archived: "bg-secondary-100 text-secondary-500",
};

function RecipeLibrary() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<RecipeWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "archived">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch(`/api/recipes?status=${statusFilter}`);
    const d = await res.json();
    setRecipes(d.recipes ?? []);
    setLoading(false);
  };

  useEffect(() => { setLoading(true); load(); }, [statusFilter]); // eslint-disable-line

  const duplicate = async (id: string) => {
    setBusy(id);
    const res = await fetch(`/api/recipes/${id}/duplicate`, { method: "POST" });
    const d = await res.json();
    setBusy(null);
    if (!res.ok) { setMsg(d.error); return; }
    router.push(`/admin/product-recipes/${d.recipe.id}`);
  };

  const archive = async (id: string) => {
    if (!confirm("Archive this recipe? Existing products are not affected.")) return;
    setBusy(id);
    await fetch(`/api/recipes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    setBusy(null);
    load();
  };

  const restore = async (id: string) => {
    setBusy(id);
    await fetch(`/api/recipes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "draft" }),
    });
    setBusy(null);
    load();
  };

  const activate = async (id: string) => {
    if (!confirm("Run provider validation and activate this recipe for batch generation?")) return;
    setBusy(id);
    setMsg(null);
    const res = await fetch(`/api/recipes/${id}/activate`, { method: "POST" });
    const d = await res.json();
    setBusy(null);
    if (!res.ok || !d.activated) {
      const errs = d.validation?.errors?.join("; ") ?? d.error ?? "Activation failed";
      setMsg(`Activation failed: ${errs}`);
    } else {
      setMsg(`Recipe activated. ${d.validation.available_variants} variants available.`);
      load();
    }
  };

  const remove = async (id: string, usageCount: number) => {
    if (usageCount > 0) { setMsg("Cannot delete — recipe is used by products. Archive instead."); return; }
    if (!confirm("Permanently delete this recipe?")) return;
    setBusy(id);
    await fetch(`/api/recipes/${id}`, { method: "DELETE" });
    setBusy(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-secondary-100 p-1 rounded-lg w-fit">
          {(["all", "active", "draft", "archived"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${statusFilter === s ? "bg-white text-secondary-900 shadow-sm" : "text-secondary-500 hover:text-secondary-700"}`}>
              {s}
            </button>
          ))}
        </div>
        <button onClick={() => router.push("/admin/product-recipes/new")} className="btn-primary py-2">
          <Plus size={16} className="mr-2" />New Recipe
        </button>
      </div>

      {msg && (
        <div className="bg-error-50 border border-error-100 text-error-700 rounded-lg p-3 text-sm flex items-center justify-between">
          {msg}
          <button onClick={() => setMsg(null)} className="text-error-400 hover:text-error-700 ml-4">✕</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-secondary-300" /></div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-16 text-secondary-400 space-y-3">
          <FlaskConical size={40} className="mx-auto text-secondary-200" />
          <p>No recipes yet. Create your first product recipe.</p>
          <button onClick={() => router.push("/admin/product-recipes/new")} className="btn-primary py-2 text-sm">
            <Plus size={14} className="mr-1" />New Recipe
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
          <table className="w-full min-w-[700px]">
            <thead className="bg-secondary-50 border-b border-secondary-100">
              <tr>
                {["Recipe", "Blank", "Technique", "Pricing", "Status", "Products", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-secondary-600 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-50">
              {recipes.map((r) => (
                <tr key={r.id} className="hover:bg-secondary-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-secondary-900 text-sm">{r.name}</p>
                    <p className="text-xs font-mono text-secondary-400">{r.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-secondary-600">
                    Catalog {r.printful_catalog_id}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs bg-secondary-100 text-secondary-600 px-1.5 py-0.5 rounded w-fit">{r.technique}</span>
                      <span className="text-xs text-secondary-400">{r.placement}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-secondary-600">
                    {r.pricing_rules?.strategy === "FIXED_PRICE"
                      ? `$${r.pricing_rules.fixed_price?.toFixed(2)}`
                      : r.pricing_rules?.strategy === "COST_PLUS"
                        ? `Cost + $${r.pricing_rules.cost_plus_margin}`
                        : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] ?? ""}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-secondary-600">{r.usage_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => router.push(`/admin/product-recipes/${r.id}`)} title="Edit"
                        className="p-1.5 text-secondary-400 hover:text-secondary-900 hover:bg-secondary-100 rounded-lg transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => duplicate(r.id)} disabled={busy === r.id} title="Duplicate"
                        className="p-1.5 text-secondary-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-40">
                        {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                      </button>
                      {r.status === "draft" && (
                        <button onClick={() => activate(r.id)} disabled={busy === r.id} title="Activate (validate + enable for batch)"
                          className="p-1.5 text-secondary-400 hover:text-success-600 hover:bg-success-50 rounded-lg transition-colors disabled:opacity-40">
                          <Zap size={14} />
                        </button>
                      )}
                      {r.status !== "archived"
                        ? <button onClick={() => archive(r.id)} disabled={busy === r.id} title="Archive"
                            className="p-1.5 text-secondary-400 hover:text-warning-600 hover:bg-warning-50 rounded-lg transition-colors disabled:opacity-40">
                            <Archive size={14} />
                          </button>
                        : <button onClick={() => restore(r.id)} disabled={busy === r.id} title="Restore"
                            className="p-1.5 text-secondary-400 hover:text-success-600 hover:bg-success-50 rounded-lg transition-colors disabled:opacity-40">
                            <RotateCcw size={14} />
                          </button>}
                      {r.usage_count === 0 && r.status === "archived" && (
                        <button onClick={() => remove(r.id, r.usage_count)} disabled={busy === r.id} title="Delete"
                          className="p-1.5 text-secondary-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors disabled:opacity-40">
                          <Trash2 size={14} />
                        </button>
                      )}
                      <button onClick={() => router.push(`/admin/product-recipes/${r.id}`)}
                        className="p-1.5 text-secondary-400 hover:text-secondary-900 rounded-lg transition-colors">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminRecipesPage() {
  return <ProtectedAdmin><RecipeLibrary /></ProtectedAdmin>;
}
