# Known Bugs

Tracked bugs found during flow traces. Fixed bugs are marked ✅.

---

## `/admin/policies`

| # | Severity | Status | File | Description |
|---|---|---|---|---|
| P-1 | 🔴 Critical | ✅ Fixed `1b1727b4` | `supabase/sql/01_schema.sql` | `policies` table was missing from schema entirely. Saves silently failed; editors loaded empty falling back to defaults. Table created in Supabase and added to schema. |
| P-2 | 🟡 Medium | ✅ Fixed `1b1727b4` | `src/app/terms-of-service/page.tsx`, `src/app/privacy-policy/page.tsx`, `src/app/refund-policy/page.tsx` | All 3 public policy pages had `const EMAIL = "hello@your-store.example"` hardcoded. Contact Us block now reads from `social_links` settings and only renders if email is enabled. |
| P-3 | 🟡 Low | ✅ Fixed `dc05f230` | `src/app/terms-of-service/page.tsx`, `src/app/privacy-policy/page.tsx`, `src/app/refund-policy/page.tsx` | No `export const dynamic = "force-dynamic"` — pages were statically cached at build time and relied solely on `/api/revalidate` to show updates. Added to all 3 pages. |

---

## `/admin/mailerlite`

| # | Severity | Status | File | Description |
|---|---|---|---|---|
| ML-1 | 🔴 Critical | ⬜ Open | `src/app/admin/mailerlite/page.tsx` | `CreateCampaignModal` default state has `from_email: "orders@your-store.example"`. Admin will send campaigns from a fake address unless they manually change it every time. Should default to empty string or read from store settings. |
| ML-2 | 🟡 Medium | ⬜ Open | `src/app/admin/mailerlite/page.tsx` + `src/app/api/mailerlite/route.ts` | Subscriber pagination uses `next_cursor` / `prev_cursor` from `subMeta`, but MailerLite Classic API v2 uses offset-based pagination (`offset` + `limit`), not cursor-based. Prev/Next buttons never work. |
| ML-3 | 🟡 Medium | ⬜ Open | `src/app/api/mailerlite/route.ts` | `update_subscriber` sends `{ name: body.fields?.name }` but `body.fields` is an array of `{ key, value }` objects — `body.fields?.name` is always `undefined`. Subscriber name never actually updates. Should be `body.fields?.find(f => f.key === "name")?.value`. |
| ML-4 | 🟡 Low | ⬜ Open | `src/app/admin/mailerlite/page.tsx` | "Active (this page)" stat card counts only the current page of 25 subscribers, not the account total. Misleading — shows e.g. `3` when account has hundreds of active subscribers. |
