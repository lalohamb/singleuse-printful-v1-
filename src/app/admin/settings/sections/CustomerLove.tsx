"use client";
import { useSettings } from "./useSettings";
import { SaveBar } from "./SaveBar";

type Testimonial = { quote: string; name: string; location: string; product: string };

const DEFAULTS: Testimonial[] = [
  { quote: "I wore my shirt to a family reunion and got so many compliments. This brand truly gets us.", name: "Jasmine T.", location: "Atlanta, GA", product: "Culture First Tee" },
  { quote: "The quality is unmatched. Soft, true to size, and the design is everything. Will be ordering again.", name: "Marcus W.", location: "Houston, TX", product: "Faith Over Fear Hoodie" },
  { quote: "Finally a brand that celebrates who we are. Every piece feels intentional and powerful.", name: "Aaliyah R.", location: "Chicago, IL", product: "Heritage Collection" },
];

export default function CustomerLove() {
  const { form, set, save, saved, error } = useSettings();
  const testimonials: Testimonial[] = form.testimonials ?? DEFAULTS;

  const update = (i: number, field: keyof Testimonial, value: string) =>
    set("testimonials", testimonials.map((t, idx) => idx === i ? { ...t, [field]: value } : t));

  return (
    <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-6">
      <p className="text-sm text-secondary-500">Edit the testimonials shown in the &quot;What the Culture is Saying&quot; section.</p>
      {testimonials.map((t, i) => (
        <div key={i} className="space-y-3 p-4 bg-secondary-50 rounded-lg">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">Review {i + 1}</p>
            <button type="button" onClick={() => set("testimonials", testimonials.filter((_, idx) => idx !== i))} className="text-xs text-red-600 hover:text-red-800">Remove</button>
          </div>
          <div>
            <label className="label-text">Quote</label>
            <textarea value={t.quote} onChange={(e) => update(i, "quote", e.target.value)} className="input-field min-h-[80px]" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(["name","location","product"] as const).map((f) => (
              <div key={f}>
                <label className="label-text capitalize">{f}</label>
                <input value={t[f]} onChange={(e) => update(i, f, e.target.value)} className="input-field" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <button type="button" onClick={() => set("testimonials", [...testimonials, { quote: "", name: "", location: "", product: "" }])} className="btn-outline py-2 text-sm">Add Review</button>
      <SaveBar onSave={() => save({ testimonials })} saved={saved} error={error} />
    </div>
  );
}
