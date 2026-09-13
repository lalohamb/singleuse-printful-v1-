"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useSettings() {
  const [form, setForm] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("settings").select("*").limit(1).maybeSingle().then(({ data }) => {
      if (data) setForm(data);
      setLoading(false);
    });
  }, []);

  const set = (key: string, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = async (updates: Record<string, any>) => {
    setError("");
    const { error: err } = await supabase
      .from("settings")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", form.id);
    if (err) { setError(err.message); return false; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    fetch("/api/revalidate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths: ["/", "/about", "/shop"] }) });
    return true;
  };

  return { form, set, save, loading, saved, error };
}
