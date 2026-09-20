export type FeatureStripItem = { icon: string; title: string; desc: string; enabled: boolean };

export type FeatureStripSettings = {
  active: boolean;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  items: FeatureStripItem[];
};

export const DEFAULT_FEATURE_STRIP_SETTINGS: FeatureStripSettings = {
  active: true,
  backgroundColor: "#171717",
  textColor: "#ffffff",
  accentColor: "#d4af37",
  items: [
    { icon: "🚚", title: "Made to Order",       desc: "Printed fresh for you",            enabled: true },
    { icon: "❤️", title: "Made With Intention", desc: "Built for real life",              enabled: true },
    { icon: "🛡️", title: "Size Inclusive",      desc: "Empowerment has no size limit",   enabled: true },
    { icon: "✨", title: "Style Without Limits", desc: "Designed for self-expression",    enabled: true },
  ],
};
