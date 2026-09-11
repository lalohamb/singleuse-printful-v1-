"use client";
import { useState } from "react";
import { AlertTriangle, Trash2, RefreshCw, Loader2, CheckCircle } from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";

interface ResetOption {
  type: "soft" | "full";
  title: string;
  description: string;
  clears: string[];
  keeps: string[];
  confirmText: string;
  buttonLabel: string;
  color: "orange" | "red";
}

const OPTIONS: ResetOption[] = [
  {
    type: "soft",
    title: "Soft Reset",
    description: "Clears all orders, products, and email events. Resets Printify & Stripe connection flags. All settings, categories, and admin accounts are preserved.",
    clears: ["Orders", "Products", "Email events", "Printify / Stripe connection flags"],
    keeps: ["Settings & branding", "Categories", "SEO settings", "Policies", "Admins"],
    confirmText: "SOFT RESET",
    buttonLabel: "Soft Reset",
    color: "orange",
  },
  {
    type: "full",
    title: "Full Reset — New Store",
    description: "Wipes everything and restores all application defaults. Use this when handing the codebase to a new store owner.",
    clears: ["Orders", "Products", "Email events", "Categories (re-seeded with defaults)", "Policies content", "All settings & branding", "SEO settings"],
    keeps: ["Admin accounts (you stay logged in)"],
    confirmText: "FULL RESET",
    buttonLabel: "Full Reset",
    color: "red",
  },
];

function DangerPanel() {
  const [loading, setLoading] = useState<"soft" | "full" | null>(null);
  const [done, setDone] = useState<"soft" | "full" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmInput, setConfirmInput] = useState<Record<string, string>>({});

  const handleReset = async (option: ResetOption) => {
    if (confirmInput[option.type] !== option.confirmText) return;
    setLoading(option.type);
    setError(null);
    setDone(null);
    const res = await fetch("/api/admin/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: option.type }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Reset failed");
    } else {
      setDone(option.type);
      setConfirmInput((prev) => ({ ...prev, [option.type]: "" }));
    }
    setLoading(null);
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Warning banner */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-red-800">Danger Zone</p>
          <p className="text-sm text-red-700 mt-0.5">These actions are irreversible. There is no undo. Make sure you know what you are doing.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
      )}

      {OPTIONS.map((option) => {
        const isOrange = option.color === "orange";
        const borderCls = isOrange ? "border-orange-200" : "border-red-200";
        const headerCls = isOrange ? "bg-orange-50 border-orange-200" : "bg-red-50 border-red-200";
        const titleCls  = isOrange ? "text-orange-800" : "text-red-800";
        const btnCls    = isOrange
          ? "bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300"
          : "bg-red-600 hover:bg-red-700 disabled:bg-red-300";
        const inputFocusCls = isOrange ? "focus:ring-orange-400" : "focus:ring-red-400";

        return (
          <div key={option.type} className={`bg-white rounded-xl border ${borderCls} shadow-sm overflow-hidden`}>
            <div className={`px-6 py-4 border-b ${headerCls}`}>
              <div className="flex items-center gap-2">
                {isOrange ? <RefreshCw size={18} className="text-orange-600" /> : <Trash2 size={18} className="text-red-600" />}
                <h2 className={`font-semibold ${titleCls}`}>{option.title}</h2>
              </div>
              <p className="text-sm text-secondary-600 mt-1">{option.description}</p>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-secondary-700 mb-1">Clears</p>
                  <ul className="space-y-0.5">
                    {option.clears.map((item) => (
                      <li key={item} className="text-secondary-500 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />{item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-secondary-700 mb-1">Keeps</p>
                  <ul className="space-y-0.5">
                    {option.keeps.map((item) => (
                      <li key={item} className="text-secondary-500 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />{item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {done === option.type ? (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                  <CheckCircle size={16} />
                  Reset completed successfully.
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm text-secondary-600">
                    Type <span className="font-mono font-bold text-secondary-900">{option.confirmText}</span> to confirm
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={confirmInput[option.type] || ""}
                      onChange={(e) => setConfirmInput((prev) => ({ ...prev, [option.type]: e.target.value }))}
                      placeholder={option.confirmText}
                      className={`input-field font-mono text-sm flex-1 ${inputFocusCls}`}
                    />
                    <button
                      onClick={() => handleReset(option)}
                      disabled={confirmInput[option.type] !== option.confirmText || loading !== null}
                      className={`px-4 py-2 rounded-lg text-white text-sm font-semibold transition-colors ${btnCls} flex items-center gap-2`}
                    >
                      {loading === option.type ? <Loader2 size={16} className="animate-spin" /> : null}
                      {option.buttonLabel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminDangerPage() {
  return <ProtectedAdmin><DangerPanel /></ProtectedAdmin>;
}
