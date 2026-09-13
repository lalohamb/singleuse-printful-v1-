"use client";
import { Save, Check } from "lucide-react";

export function SaveBar({ onSave, saved, error, label = "Save Settings" }: {
  onSave: () => void;
  saved: boolean;
  error?: string;
  label?: string;
}) {
  return (
    <div className="flex justify-end items-center gap-3 pt-4 border-t border-secondary-100">
      {error && <span className="text-sm text-red-600">{error}</span>}
      <button onClick={onSave} className={`btn-primary ${saved ? "!bg-green-600 hover:!bg-green-600" : ""}`}>
        {saved ? <><Check size={18} className="mr-2" />Saved</> : <><Save size={18} className="mr-2" />{label}</>}
      </button>
    </div>
  );
}
