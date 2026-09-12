export type SiteMenuSettings = {
  backgroundColor: string;
  textColor: string;
  fontFamily: "sans" | "display";
  fontSize: "small" | "medium" | "large";
  fontWeight: "normal" | "medium" | "semibold";
  letterSpacing: "normal" | "relaxed" | "wide";
  categorySlugs: string[];
};

export const DEFAULT_SITE_MENU_SETTINGS: SiteMenuSettings = {
  backgroundColor: "#ffffff",
  textColor: "#374151",
  fontFamily: "sans",
  fontSize: "medium",
  fontWeight: "medium",
  letterSpacing: "normal",
  categorySlugs: [],
};
