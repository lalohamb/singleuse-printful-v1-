-- =============================================================================
-- Printify POD Storefront — Destroy Script
-- Drops all tables, policies, and indexes.
-- Run in Supabase SQL Editor or via install scripts.
-- =============================================================================

DROP TABLE IF EXISTS email_events   CASCADE;
DROP TABLE IF EXISTS customer_profiles CASCADE;
DROP TABLE IF EXISTS orders         CASCADE;
DROP TABLE IF EXISTS products       CASCADE;
DROP TABLE IF EXISTS categories     CASCADE;
DROP TABLE IF EXISTS policies       CASCADE;
DROP TABLE IF EXISTS seo_settings   CASCADE;
DROP TABLE IF EXISTS settings       CASCADE;
DROP TABLE IF EXISTS admins         CASCADE;
