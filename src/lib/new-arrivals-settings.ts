export type NewArrivalsSettings = {
  eyebrow: string;
  dropLabel: string;
  shopButtonLabel: string;
  viewAllLabel: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  showAccent: boolean;
};

export const DEFAULT_NEW_ARRIVALS_SETTINGS: NewArrivalsSettings = {
  eyebrow: "New Arrival",
  dropLabel: "Drop",
  shopButtonLabel: "Shop Now",
  viewAllLabel: "View All Arrivals",
  backgroundColor: "#171717",
  textColor: "#ffffff",
  accentColor: "#d4af37",
  showAccent: true,
};
