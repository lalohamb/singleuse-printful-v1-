-- Phase 7: Add missing settings columns queried by storefront components
-- newsletter_group_id: used by NewsletterSignup component
-- popup_settings: used by NewsletterPopup component

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS newsletter_group_id text,
  ADD COLUMN IF NOT EXISTS popup_settings jsonb;
