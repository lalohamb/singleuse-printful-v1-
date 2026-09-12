export type AboutSettings = {
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroQuote: string;
  heroCredit: string;
  heroImageUrl: string;
  heroBackground: string;
  heroTextColor: string;
  storyImageUrl: string;
  storyImageAlt: string;
  missionEyebrow: string;
  missionTitle: string;
  missionBody: string;
  missionBackground: string;
  missionTextColor: string;
  cultureEyebrow: string;
  cultureTitle: string;
  cultureBody: string;
  cultureBackground: string;
  cultureTextColor: string;
  cultureCreed: string;
};

export const DEFAULT_ABOUT_SETTINGS: AboutSettings = {
  heroEyebrow: "Made for Every Body · Made to Order",
  heroTitle: "Our Story",
  heroSubtitle: "Empower yourself. Empower the Culture.",
  heroQuote: "Some things are meant to find you.",
  heroCredit: "The Gender Apparel Team",
  heroImageUrl: "/genderapparel.png",
  heroBackground: "#171717",
  heroTextColor: "#ffffff",
  storyImageUrl: "/genderapparel.png",
  storyImageAlt: "Gender Apparel",
  missionEyebrow: "Why We Exist",
  missionTitle: "Our Mission",
  missionBody: "To create made-to-order apparel that celebrates identity and helps every person who wears it feel seen, comfortable, and confident.",
  missionBackground: "#f7f7f5",
  missionTextColor: "#171717",
  cultureEyebrow: "More Than a Brand",
  cultureTitle: "The Culture",
  cultureBody: "Gender Apparel is for people who want their clothes to feel personal, expressive, and ready for real life.",
  cultureBackground: "#171717",
  cultureTextColor: "#ffffff",
  cultureCreed: "Wear what feels like you.",
};
