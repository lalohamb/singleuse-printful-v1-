export type BrandValue = { stat: string; label: string; sub: string; icon?: string; enabled?: boolean };

export type BrandValuesSettings = {
  advanced: boolean;
  values: BrandValue[];
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  backgroundImage: string;
  cardBackgroundColor: string;
  cardBorderColor: string;
  dividerColor: string;
  columns: 1 | 2 | 3 | 4;
  alignment: "left" | "center";
  divider: "none" | "horizontal" | "vertical";
  padding: "compact" | "comfortable" | "spacious";
  animate: boolean;
};

export const DEFAULT_BRAND_VALUES_SETTINGS: BrandValuesSettings = {
  advanced: false,
  values: [
    { stat: "100%", label: "Made for Every Body", sub: "Clothing that meets you where you are", icon: "✨", enabled: true },
    { stat: "0 Waste", label: "Made to Order", sub: "Every piece printed fresh - nothing sits on a shelf", icon: "♻️", enabled: true },
    { stat: "XS-5XL", label: "Size Inclusive", sub: "Style without a size limit", icon: "💯", enabled: true },
  ],
  backgroundColor: "#171717",
  textColor: "#ffffff",
  accentColor: "#d4af37",
  backgroundImage: "",
  cardBackgroundColor: "transparent",
  cardBorderColor: "rgba(255,255,255,0.1)",
  dividerColor: "rgba(255,255,255,0.1)",
  columns: 3,
  alignment: "center",
  divider: "vertical",
  padding: "spacious",
  animate: true,
};
