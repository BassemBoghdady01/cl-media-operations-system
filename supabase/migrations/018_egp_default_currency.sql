-- ============================================================================
-- EZ Marketing Agency — 018 · EGP is the default currency everywhere
-- RUN AFTER: 017_exact_partner_allocation.sql
--
-- packages.currency and invoices.currency still defaulted to 'USD' from the
-- original template, while every finance table (subscriptions, transactions,
-- payroll, partners…) defaults to 'EGP'. The old frontend never sent a
-- currency for packages/invoices, so rows created through it were stamped USD
-- by the database even when the amount was in EGP.
-- This changes the DEFAULT only. Existing rows are NOT relabelled — any row
-- that should be EGP is corrected individually, with the owner's approval.
-- SAFETY: two ALTER COLUMN … SET DEFAULT. No data changed.
-- ============================================================================

ALTER TABLE packages ALTER COLUMN currency SET DEFAULT 'EGP';
ALTER TABLE invoices ALTER COLUMN currency SET DEFAULT 'EGP';
