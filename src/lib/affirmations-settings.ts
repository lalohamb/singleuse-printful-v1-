export type AffirmationsSettings = {
  active: boolean;
  phrases: string[];
  backgroundColor: string;
  textColor: string;
  accentColor: string;
};

export const DEFAULT_AFFIRMATIONS_SETTINGS: AffirmationsSettings = {
  active: true,
  phrases: ["Wear What Feels Like You", "Made for Every Body", "Find Your Fit", "Style Without Limits", "Made to Order"],
  backgroundColor: "#171717",
  textColor: "#ffffff",
  accentColor: "#d4af37",
};
