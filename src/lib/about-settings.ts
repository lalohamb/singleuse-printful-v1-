export type AboutValueCard = { icon: string; title: string; desc: string };
export type AboutCultureCard = { emoji: string; title: string; desc: string };

export type AboutSettings = {
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroQuote: string;
  heroCredit: string;
  heroImageUrl: string;
  heroObjectPosition: string;
  heroImageScale: number;
  heroImageFlip: boolean;
  heroImageFit: string;
  heroGradientOpacity: number;
  heroGradientDir: string;
  heroBackground: string;
  heroTextColor: string;
  storyParagraph1: string;
  storyParagraph2: string;
  storyParagraph3: string;
  storyQuote: string;
  storyQuoteCredit: string;
  storyImageUrl: string;
  storyImageAlt: string;
  storyImageCaption: string;
  storyImageSubcaption: string;
  storyObjectPosition: string;
  storyImageScale: number;
  storyImageFlip: boolean;
  storyImageFit: string;
  missionEyebrow: string;
  missionTitle: string;
  missionBody: string;
  missionBackground: string;
  missionTextColor: string;
  missionCards: AboutValueCard[];
  cultureEyebrow: string;
  cultureTitle: string;
  cultureBody: string;
  cultureBackground: string;
  cultureTextColor: string;
  cultureCreed: string;
  cultureCards: AboutCultureCard[];
};

export const DEFAULT_MISSION_CARDS: AboutValueCard[] = [
  { icon: "Heart", title: "Self-Expression", desc: "Clothing that gives your point of view room to speak." },
  { icon: "Sparkles", title: "Thoughtful Design", desc: "Details created with intention, not noise." },
  { icon: "Users", title: "Every Body", desc: "A more welcoming approach to fit and personal style." },
  { icon: "Globe", title: "Less Waste", desc: "Made to order so every piece has a purpose." },
  { icon: "Sparkles", title: "Everyday Quality", desc: "Comfort and character in every drop." },
];

export const DEFAULT_CULTURE_CARDS: AboutCultureCard[] = [
  { emoji: "✊🏾", title: "Black Excellence", desc: "Every design is a declaration. We wear our heritage with pride, not apology." },
  { emoji: "🙏🏾", title: "Faith-Driven", desc: "Rooted in scripture and spiritual conviction — because what you believe shapes what you wear." },
  { emoji: "🌍", title: "Community First", desc: "From the aunties to the block — we design for the people who show up for each other." },
];

export const DEFAULT_ABOUT_SETTINGS: AboutSettings = {
  heroEyebrow: "Made for Every Body · Made to Order",
  heroTitle: "Our Story",
  heroSubtitle: "Empower yourself. Empower the Culture.",
  heroQuote: "Some things are meant to find you.",
  heroCredit: "Your Store Team",
  heroImageUrl: "/hero-placeholder.svg",
  heroObjectPosition: "50% 20%",
  heroImageScale: 100,
  heroImageFlip: false,
  heroImageFit: "cover",
  heroGradientOpacity: 40,
  heroGradientDir: "right",
  heroBackground: "#171717",
  heroTextColor: "#ffffff",
  storyParagraph1: "Your store began with a simple idea: clothing should help you feel more like yourself, not less. We create considered pieces that make room for different bodies, different styles, and different ways of showing up.",
  storyParagraph2: "What drives us is simple. What you wear can speak before you ever open your mouth. A statement piece can reflect who you are, what you stand for, and how you want to move through the world. Clothing is not just fabric. It is voice.",
  storyParagraph3: "At Your Store, you will find expressive everyday pieces designed to make you feel something when you put them on. Every design is made with intention and printed to order.",
  storyQuote: "Welcome to Your Store. Wear what feels like you.",
  storyQuoteCredit: "Your Store Team",
  storyImageUrl: "/hero-placeholder.svg",
  storyImageAlt: "Your Store",
  storyImageCaption: "Your Store",
  storyImageSubcaption: "Your Store",
  storyObjectPosition: "50% 20%",
  storyImageScale: 100,
  storyImageFlip: false,
  storyImageFit: "cover",
  missionEyebrow: "Why We Exist",
  missionTitle: "Our Mission",
  missionBody: "To create made-to-order apparel that celebrates identity and helps every person who wears it feel seen, comfortable, and confident.",
  missionBackground: "#f7f7f5",
  missionTextColor: "#171717",
  missionCards: DEFAULT_MISSION_CARDS,
  cultureEyebrow: "More Than a Brand",
  cultureTitle: "The Culture",
  cultureBody: "Your Store is for people who want their clothes to feel personal, expressive, and ready for real life.",
  cultureBackground: "#171717",
  cultureTextColor: "#ffffff",
  cultureCreed: "Wear what feels like you.",
  cultureCards: DEFAULT_CULTURE_CARDS,
};
