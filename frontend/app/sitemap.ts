import { MetadataRoute } from 'next';

const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://printifyplatform.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/how-it-works`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/pricing`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/demo`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/blog`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/blog/printify-vs-shopify`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/blog/how-to-increase-printify-conversion-rate`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/blog/printify-seo-guide`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
