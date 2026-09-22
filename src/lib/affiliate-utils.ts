const AFFILIATE_KEY = "affiliate_ref";
const AFFILIATE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

export function setAffiliateCode(code: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AFFILIATE_KEY, JSON.stringify({ code, expires: Date.now() + AFFILIATE_TTL }));
}

export function getAffiliateCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AFFILIATE_KEY);
    if (!raw) return null;
    const { code, expires } = JSON.parse(raw);
    if (Date.now() > expires) { localStorage.removeItem(AFFILIATE_KEY); return null; }
    return code;
  } catch { return null; }
}

export function clearAffiliateCode() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AFFILIATE_KEY);
}
