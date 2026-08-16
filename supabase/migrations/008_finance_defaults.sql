-- ============================================================================
-- EZ Marketing Agency — 008 · Default Finance Configuration
-- RUN AFTER: 007_finance_functions.sql
--
-- Seeds CONFIGURATION only — expense categories, service templates, a finance
-- settings row, and the current accounting period. It creates NO transactions,
-- NO invoices, NO clients and NO fake money. Every figure in the app comes from
-- data you enter.
-- ============================================================================

BEGIN;

-- One settings row per agency.
INSERT INTO agency_finance_settings (agency_id, base_currency)
SELECT a.id, 'EGP' FROM agencies a
ON CONFLICT (agency_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- EXPENSE CATEGORIES
--   cost_type drives break-even: 'fixed' costs are counted as the monthly base
--   the agency must cover; 'variable' costs are not.
-- ─────────────────────────────────────────────────────────────
INSERT INTO finance_categories (agency_id, name, kind, cost_type, is_payroll, color, is_system)
SELECT a.id, v.name, 'expense', v.cost_type, v.is_payroll, v.color, TRUE
FROM agencies a
CROSS JOIN (VALUES
  ('Salaries',        'fixed',    TRUE,  '#8B5CF6'),
  ('Freelancers',     'variable', FALSE, '#A78BFA'),
  ('Office Rent',     'fixed',    FALSE, '#3B82F6'),
  ('Utilities',       'fixed',    FALSE, '#0EA5E9'),
  ('Internet',        'fixed',    FALSE, '#06B6D4'),
  ('Software',        'fixed',    FALSE, '#14B8A6'),
  ('Advertising',     'variable', FALSE, '#F59E0B'),
  ('Production',      'variable', FALSE, '#EF4444'),
  ('Equipment',       'variable', FALSE, '#F97316'),
  ('Transportation',  'variable', FALSE, '#EAB308'),
  ('Studio',          'variable', FALSE, '#EC4899'),
  ('Photography',     'variable', FALSE, '#D946EF'),
  ('Videography',     'variable', FALSE, '#C026D3'),
  ('Maintenance',     'variable', FALSE, '#64748B'),
  ('Legal',           'fixed',    FALSE, '#475569'),
  ('Accounting',      'fixed',    FALSE, '#334155'),
  ('Taxes',           'variable', FALSE, '#DC2626'),
  ('Hospitality',     'variable', FALSE, '#FB923C'),
  ('Subscriptions',   'fixed',    FALSE, '#22D3EE'),
  ('Bank Fees',       'variable', FALSE, '#94A3B8'),
  ('Other',           'variable', FALSE, '#6B7280')
) AS v(name, cost_type, is_payroll, color)
ON CONFLICT (agency_id, name, kind) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- INCOME CATEGORIES
-- ─────────────────────────────────────────────────────────────
INSERT INTO finance_categories (agency_id, name, kind, cost_type, color, is_system)
SELECT a.id, v.name, 'income', 'none', v.color, TRUE
FROM agencies a
CROSS JOIN (VALUES
  ('Monthly Retainer',   '#10B981'),
  ('Video Production',   '#3B82F6'),
  ('Content Creation',   '#8B5CF6'),
  ('Paid Ads Management','#F59E0B'),
  ('Photography',        '#EC4899'),
  ('Shooting Session',   '#EF4444'),
  ('Branding',           '#14B8A6'),
  ('Web / System Work',  '#0EA5E9'),
  ('Consulting',         '#A78BFA'),
  ('Other Income',       '#64748B')
) AS v(name, color)
ON CONFLICT (agency_id, name, kind) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- SERVICE CATALOGUE TEMPLATES (no prices — you set those)
-- ─────────────────────────────────────────────────────────────
INSERT INTO agency_services (agency_id, name, category, currency, status)
SELECT a.id, v.name, v.category, 'EGP', 'active'
FROM agencies a
CROSS JOIN (VALUES
  ('Social Media Management', 'Retainer'),
  ('Video Production',        'Production'),
  ('Content Creation',        'Production'),
  ('Paid Ads Management',     'Performance'),
  ('Media Buying',            'Performance'),
  ('Branding',                'Creative'),
  ('Photography',             'Production'),
  ('Videography',             'Production'),
  ('Website Development',     'Technology'),
  ('System Development',      'Technology'),
  ('Marketing Retainer',      'Retainer'),
  ('Creative Strategy',       'Creative')
) AS v(name, category)
ON CONFLICT (agency_id, name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- OPEN THE CURRENT ACCOUNTING PERIOD
-- ─────────────────────────────────────────────────────────────
INSERT INTO financial_periods (agency_id, year, month, status)
SELECT a.id,
       EXTRACT(YEAR  FROM CURRENT_DATE)::INT,
       EXTRACT(MONTH FROM CURRENT_DATE)::INT,
       'open'
FROM agencies a
ON CONFLICT (agency_id, year, month) DO NOTHING;

COMMIT;

-- ============================================================================
-- VERIFY:
--   SELECT kind, COUNT(*) FROM finance_categories GROUP BY kind;  -- 21 expense, 10 income
--   SELECT COUNT(*) FROM agency_services;                         -- 12 per agency
--   SELECT COUNT(*) FROM finance_transactions;                    -- 0 — no fake money
-- ============================================================================
