"use client";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import StoreInformation from "./sections/StoreInformation";
import Branding from "./sections/Branding";
import Footer from "./sections/Footer";
import HomepageHero from "./sections/HomepageHero";
import OurWhy from "./sections/OurWhy";
import WearYourStory from "./sections/WearYourStory";
import CustomerLove from "./sections/CustomerLove";
import NewArrivals from "./sections/NewArrivals";
import BrandValues from "./sections/BrandValues";
import AdminMenu from "./sections/AdminMenu";
import Social from "./sections/Social";
import Integrations from "./sections/Integrations";
import Announcements from "./sections/Announcements";
import NewsletterPopup from "./sections/NewsletterPopup";
import AboutHero from "./sections/AboutHero";
import AboutStory from "./sections/AboutStory";
import AboutMission from "./sections/AboutMission";
import AboutCulture from "./sections/AboutCulture";

const TITLES: Record<string, string> = {
  "store-information": "Store Information",
  branding:            "Branding",
  "homepage-hero":     "Homepage Hero",
  "new-arrivals":      "New Arrivals",
  "brand-values":      "Brand Values",
  "admin-menu":        "Menu Bar",
  "our-why":           "Our Why",
  "wear-your-story":   "Wear Your Story",
  "customer-love":     "Customer Love",
  announcements:       "Announcements",
  "newsletter-popup":  "Newsletter Popup",
  "about-hero":        "About — Hero",
  "about-story":       "About — Story",
  "about-mission":     "About — Mission",
  "about-culture":     "About — Culture",
  footer:              "Footer",
  integrations:        "Integrations",
  social:              "Social Links",
};

const SECTIONS: Record<string, React.ComponentType> = {
  "store-information": StoreInformation,
  branding:            Branding,
  "homepage-hero":     HomepageHero,
  "new-arrivals":      NewArrivals,
  "brand-values":      BrandValues,
  "admin-menu":        AdminMenu,
  "our-why":           OurWhy,
  "wear-your-story":   WearYourStory,
  "customer-love":     CustomerLove,
  announcements:       Announcements,
  "newsletter-popup":  NewsletterPopup,
  "about-hero":        AboutHero,
  "about-story":       AboutStory,
  "about-mission":     AboutMission,
  "about-culture":     AboutCulture,
  footer:              Footer,
  integrations:        Integrations,
  social:              Social,
};

export default function SettingsSectionClient({ section }: { section: string }) {
  const Component = SECTIONS[section];
  return (
    <ProtectedAdmin>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">{TITLES[section] || "Settings"}</h1>
          <p className="text-sm text-secondary-500 mt-1">Manage this settings group independently.</p>
        </div>
        {Component ? <Component /> : <p className="text-secondary-400">Section not found.</p>}
      </div>
    </ProtectedAdmin>
  );
}
