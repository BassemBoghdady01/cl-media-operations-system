-- ============================================================================
-- EZ Marketing — Partners + Task Review setup (run ONCE)
-- Supabase → project "cl-media-operations-system" → SQL Editor → New query →
-- paste this whole file → Run. Safe to re-run: every step is idempotent.
-- Adds tables/functions only — no data is deleted.
-- ============================================================================

-- ============================================================================
-- EZ Marketing Agency — 011 · Partners, Capital & Profit Distribution
-- RUN AFTER: 010_scoped_access.sql
--
-- What this adds
--   partners                    ownership structure, two levels:
--                                 individual partner (e.g. 33.33% of company)
--                                 group (e.g. "Capital", 66.67%) whose members
--                                 hold a share OF THE GROUP (e.g. 3 × 33.33%)
--   partner_transactions        the partners' equity ledger: capital in,
--                                 capital returned, drawings, profit payouts
--   profit_distributions(+lines) a period's net profit (computed from the
--                                 main ledger), less a reserve, split by
--                                 effective ownership
--   role `partner`              company owners: everything except role admin
--   permissions partners.view / partners.manage (sensitive)
--
-- Accounting rules
--   • Partner money is EQUITY, never an expense: drawings and payouts do not
--     touch the P&L, so net profit stays honest.
--   • It IS cash: movements tied to a finance account change that account's
--     balance and cash flow (finance_account_balances / finance_cashflow are
--     redefined below to include them).
--   • Balance due to a partner = allocated profit − payouts − drawings.
--     A negative balance means the partner drew ahead of profit.
--
-- SAFETY: additive. Existing tables/data untouched; two read functions are
-- replaced with versions that keep the exact same signature and output.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. PERMISSIONS + PARTNER ROLE
-- ─────────────────────────────────────────────────────────────
INSERT INTO permissions (key, module, action, description, is_sensitive) VALUES
  ('partners.view',   'partners', 'view',   'View partners, ownership, profit distribution and partner statements', TRUE),
  ('partners.manage', 'partners', 'manage', 'Manage partners, capital, drawings and profit distributions',          TRUE)
ON CONFLICT (key) DO NOTHING;

INSERT INTO roles (key, label, description, level, is_internal, is_system, scope) VALUES
  ('partner', 'Partner', 'Company owner. Full business visibility, profit distribution and own statement.', 5, TRUE, TRUE, 'agency')
ON CONFLICT (key) DO UPDATE
  SET label = EXCLUDED.label, description = EXCLUDED.description,
      level = EXCLUDED.level, scope = EXCLUDED.scope;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN (
  'super_admin','partner','agency_admin','finance_manager','hr_manager','operations',
  'accountant','marketing_manager','sales_manager','project_manager',
  'account_manager','client_success','content_strategist','social_media_manager',
  'media_buyer','sales','videographer','video_editor','graphic_designer',
  'content_creator','viewer','client',
  'owner','admin','social_manager','editor','creator'
));

-- Partners get every permission except editing the role matrix itself.
INSERT INTO role_permissions (role_key, permission_key)
SELECT 'partner', p.key FROM permissions p
 WHERE p.key NOT IN ('users.manage_roles', 'portal.access')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 2. PARTNERS (ownership structure)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partners (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id     UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES partners(id) ON DELETE RESTRICT,
  kind          TEXT NOT NULL DEFAULT 'individual' CHECK (kind IN ('individual','group')),
  name          TEXT NOT NULL,
  profile_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- login, if the partner has one
  email         TEXT,
  phone         TEXT,
  -- Top level: % of the company. Group member: % of the group.
  share_percent NUMERIC(7,4) NOT NULL CHECK (share_percent >= 0 AND share_percent <= 100),
  joined_on     DATE,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','exited')),
  notes         TEXT,
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT partner_group_is_top_level CHECK (NOT (kind = 'group' AND parent_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS partners_agency_idx ON partners (agency_id);
CREATE INDEX IF NOT EXISTS partners_parent_idx ON partners (parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS partners_profile_uidx ON partners (profile_id) WHERE profile_id IS NOT NULL;

DROP TRIGGER IF EXISTS partners_updated_at ON partners;
CREATE TRIGGER partners_updated_at BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- A member's parent must be a group of the same agency.
CREATE OR REPLACE FUNCTION partners_guard()
RETURNS TRIGGER AS $$
DECLARE v_parent partners%ROWTYPE;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT * INTO v_parent FROM partners WHERE id = NEW.parent_id;
    IF v_parent.id IS NULL OR v_parent.kind <> 'group' OR v_parent.agency_id <> NEW.agency_id THEN
      RAISE EXCEPTION 'A partner can only belong to a partner group of the same company.';
    END IF;
    IF NEW.id = NEW.parent_id THEN RAISE EXCEPTION 'A partner cannot belong to itself.'; END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.kind = 'individual' AND OLD.kind = 'group'
     AND EXISTS (SELECT 1 FROM partners WHERE parent_id = NEW.id) THEN
    RAISE EXCEPTION 'Remove the group members before turning the group into an individual.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS partners_guard_trg ON partners;
CREATE TRIGGER partners_guard_trg BEFORE INSERT OR UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION partners_guard();

-- ─────────────────────────────────────────────────────────────
-- 3. PROFIT DISTRIBUTIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profit_distributions (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id            UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  period_start         DATE NOT NULL,
  period_end           DATE NOT NULL,
  currency             TEXT NOT NULL DEFAULT 'EGP',
  -- Snapshot of the ledger when the distribution was created.
  revenue              NUMERIC(14,2) NOT NULL DEFAULT 0,
  expenses             NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_profit           NUMERIC(14,2) NOT NULL DEFAULT 0,
  reserve_percent      NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (reserve_percent >= 0 AND reserve_percent <= 100),
  distributable_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (distributable_amount >= 0),
  is_manual_amount     BOOLEAN NOT NULL DEFAULT FALSE,
  status               TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid','cancelled')),
  notes                TEXT,
  approved_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at          TIMESTAMPTZ,
  created_by           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT distribution_period_order CHECK (period_end >= period_start)
);
CREATE INDEX IF NOT EXISTS profit_distributions_agency_idx ON profit_distributions (agency_id, period_start DESC);
-- One live distribution per period+currency.
CREATE UNIQUE INDEX IF NOT EXISTS profit_distributions_period_uidx
  ON profit_distributions (agency_id, period_start, period_end, currency) WHERE status <> 'cancelled';

DROP TRIGGER IF EXISTS profit_distributions_updated_at ON profit_distributions;
CREATE TRIGGER profit_distributions_updated_at BEFORE UPDATE ON profit_distributions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS profit_distribution_lines (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id       UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  distribution_id UUID NOT NULL REFERENCES profit_distributions(id) ON DELETE CASCADE,
  partner_id      UUID NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
  share_percent   NUMERIC(7,4) NOT NULL,   -- effective % of the company at the time
  amount          NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  UNIQUE (distribution_id, partner_id)
);
CREATE INDEX IF NOT EXISTS pdl_partner_idx ON profit_distribution_lines (partner_id);

-- ─────────────────────────────────────────────────────────────
-- 4. PARTNER TRANSACTIONS (equity ledger)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partner_transactions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id        UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  partner_id       UUID NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
  -- capital_contribution → money IN to the company
  -- capital_return / drawing / profit_payout → money OUT to the partner
  type             TEXT NOT NULL CHECK (type IN ('capital_contribution','capital_return','drawing','profit_payout')),
  amount           NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency         TEXT NOT NULL DEFAULT 'EGP',
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  account_id       UUID REFERENCES finance_accounts(id) ON DELETE SET NULL,
  payment_method   TEXT CHECK (payment_method IS NULL OR payment_method IN (
                     'cash','bank_transfer','card','wallet','cheque','online','other')),
  reference        TEXT,
  notes            TEXT,
  attachment_url   TEXT,
  distribution_id  UUID REFERENCES profit_distributions(id) ON DELETE SET NULL,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ptx_agency_date_idx ON partner_transactions (agency_id, transaction_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ptx_partner_idx     ON partner_transactions (partner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ptx_account_idx     ON partner_transactions (account_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ptx_distribution_idx ON partner_transactions (distribution_id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS partner_transactions_updated_at ON partner_transactions;
CREATE TRIGGER partner_transactions_updated_at BEFORE UPDATE ON partner_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Integrity: currency matches the account; payouts stay within the allocation.
CREATE OR REPLACE FUNCTION partner_transactions_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_acc_currency TEXT;
  v_dist  profit_distributions%ROWTYPE;
  v_line  NUMERIC;
  v_paid  NUMERIC;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;

  IF NEW.account_id IS NOT NULL THEN
    SELECT currency INTO v_acc_currency FROM finance_accounts WHERE id = NEW.account_id;
    IF v_acc_currency IS DISTINCT FROM NEW.currency THEN
      RAISE EXCEPTION 'Currency % does not match the account currency %.', NEW.currency, v_acc_currency;
    END IF;
  END IF;

  IF NEW.distribution_id IS NOT NULL THEN
    IF NEW.type <> 'profit_payout' THEN
      RAISE EXCEPTION 'Only profit payouts can be linked to a profit distribution.';
    END IF;
    SELECT * INTO v_dist FROM profit_distributions WHERE id = NEW.distribution_id;
    IF v_dist.status NOT IN ('approved','paid') THEN
      RAISE EXCEPTION 'Approve the distribution before paying it out.';
    END IF;
    IF v_dist.currency <> NEW.currency THEN
      RAISE EXCEPTION 'Payout currency must match the distribution currency (%).', v_dist.currency;
    END IF;
    SELECT amount INTO v_line FROM profit_distribution_lines
     WHERE distribution_id = NEW.distribution_id AND partner_id = NEW.partner_id;
    IF v_line IS NULL THEN
      RAISE EXCEPTION 'This partner has no share in that distribution.';
    END IF;
    SELECT COALESCE(SUM(amount),0) INTO v_paid FROM partner_transactions
     WHERE distribution_id = NEW.distribution_id AND partner_id = NEW.partner_id
       AND deleted_at IS NULL AND id <> NEW.id;
    IF v_paid + NEW.amount > v_line + 0.01 THEN
      RAISE EXCEPTION 'Payout exceeds the partner''s share (remaining %).', v_line - v_paid;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS partner_transactions_guard_trg ON partner_transactions;
CREATE TRIGGER partner_transactions_guard_trg BEFORE INSERT OR UPDATE ON partner_transactions
  FOR EACH ROW EXECUTE FUNCTION partner_transactions_guard();

-- Keep the distribution status in step with its payouts.
CREATE OR REPLACE FUNCTION refresh_distribution_status(p_distribution UUID)
RETURNS VOID AS $$
DECLARE v_open BOOLEAN;
BEGIN
  IF p_distribution IS NULL THEN RETURN; END IF;
  SELECT EXISTS (
    SELECT 1 FROM profit_distribution_lines l
     WHERE l.distribution_id = p_distribution AND l.amount > 0
       AND l.amount - COALESCE((SELECT SUM(t.amount) FROM partner_transactions t
                                 WHERE t.distribution_id = l.distribution_id
                                   AND t.partner_id = l.partner_id
                                   AND t.deleted_at IS NULL), 0) > 0.01
  ) INTO v_open;

  UPDATE profit_distributions
     SET status = CASE WHEN v_open THEN 'approved' ELSE 'paid' END
   WHERE id = p_distribution AND status IN ('approved','paid');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION partner_transactions_after()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN PERFORM refresh_distribution_status(OLD.distribution_id); END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN PERFORM refresh_distribution_status(NEW.distribution_id); END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS partner_transactions_after_trg ON partner_transactions;
CREATE TRIGGER partner_transactions_after_trg AFTER INSERT OR UPDATE OR DELETE ON partner_transactions
  FOR EACH ROW EXECUTE FUNCTION partner_transactions_after();

-- ─────────────────────────────────────────────────────────────
-- 5. RLS
-- ─────────────────────────────────────────────────────────────
-- The partner record linked to the signed-in user (if any).
CREATE OR REPLACE FUNCTION my_partner_ids()
RETURNS SETOF UUID AS $$
  SELECT id FROM partners WHERE profile_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

ALTER TABLE partners                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE profit_distributions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE profit_distribution_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partners read" ON partners;
CREATE POLICY "partners read" ON partners FOR SELECT
  USING (agency_id = get_my_agency_id()
         AND (has_permission('partners.view') OR profile_id = auth.uid()));
DROP POLICY IF EXISTS "partners manage" ON partners;
CREATE POLICY "partners manage" ON partners FOR ALL
  USING (agency_id = get_my_agency_id() AND has_permission('partners.manage'))
  WITH CHECK (agency_id = get_my_agency_id() AND has_permission('partners.manage'));

DROP POLICY IF EXISTS "partner tx read" ON partner_transactions;
CREATE POLICY "partner tx read" ON partner_transactions FOR SELECT
  USING (agency_id = get_my_agency_id()
         AND (has_permission('partners.view') OR partner_id IN (SELECT my_partner_ids())));
DROP POLICY IF EXISTS "partner tx manage" ON partner_transactions;
CREATE POLICY "partner tx manage" ON partner_transactions FOR ALL
  USING (agency_id = get_my_agency_id() AND has_permission('partners.manage'))
  WITH CHECK (agency_id = get_my_agency_id() AND has_permission('partners.manage'));

DROP POLICY IF EXISTS "distributions read" ON profit_distributions;
CREATE POLICY "distributions read" ON profit_distributions FOR SELECT
  USING (agency_id = get_my_agency_id()
         AND (has_permission('partners.view')
              OR EXISTS (SELECT 1 FROM profit_distribution_lines l
                          WHERE l.distribution_id = profit_distributions.id
                            AND l.partner_id IN (SELECT my_partner_ids()))));
DROP POLICY IF EXISTS "distributions manage" ON profit_distributions;
CREATE POLICY "distributions manage" ON profit_distributions FOR ALL
  USING (agency_id = get_my_agency_id() AND has_permission('partners.manage'))
  WITH CHECK (agency_id = get_my_agency_id() AND has_permission('partners.manage'));

DROP POLICY IF EXISTS "distribution lines read" ON profit_distribution_lines;
CREATE POLICY "distribution lines read" ON profit_distribution_lines FOR SELECT
  USING (agency_id = get_my_agency_id()
         AND (has_permission('partners.view') OR partner_id IN (SELECT my_partner_ids())));
DROP POLICY IF EXISTS "distribution lines manage" ON profit_distribution_lines;
CREATE POLICY "distribution lines manage" ON profit_distribution_lines FOR ALL
  USING (agency_id = get_my_agency_id() AND has_permission('partners.manage'))
  WITH CHECK (agency_id = get_my_agency_id() AND has_permission('partners.manage'));

-- ─────────────────────────────────────────────────────────────
-- 6. READ FUNCTIONS
-- ─────────────────────────────────────────────────────────────
-- Effective ownership of every share-holding leaf: individuals, plus groups
-- that have no active members yet. Runs as the caller (RLS applies).
CREATE OR REPLACE FUNCTION partner_effective_shares(p_agency UUID)
RETURNS TABLE (
  partner_id UUID, name TEXT, group_id UUID, group_name TEXT,
  own_share NUMERIC, effective_percent NUMERIC
) AS $$
  SELECT p.id, p.name, g.id, g.name, p.share_percent,
         ROUND(CASE WHEN g.id IS NULL THEN p.share_percent
                    ELSE g.share_percent * p.share_percent / 100 END, 4)
    FROM partners p
    LEFT JOIN partners g ON g.id = p.parent_id
   WHERE p.agency_id = p_agency
     AND p.status = 'active'
     AND (g.id IS NULL OR g.status = 'active')
     AND NOT (p.kind = 'group' AND EXISTS (
           SELECT 1 FROM partners c WHERE c.parent_id = p.id AND c.status = 'active'))
   ORDER BY 6 DESC, 2;
$$ LANGUAGE SQL STABLE;

-- Problems with the ownership table, as readable messages (empty = valid).
CREATE OR REPLACE FUNCTION partner_structure_issues(p_agency UUID)
RETURNS TABLE (issue TEXT) AS $$
  WITH top AS (
    SELECT COALESCE(SUM(share_percent),0) AS total
      FROM partners WHERE agency_id = p_agency AND parent_id IS NULL AND status = 'active'
  ), grp AS (
    SELECT g.name, COALESCE(SUM(m.share_percent),0) AS total, COUNT(m.id) AS members
      FROM partners g
      LEFT JOIN partners m ON m.parent_id = g.id AND m.status = 'active'
     WHERE g.agency_id = p_agency AND g.kind = 'group' AND g.status = 'active'
     GROUP BY g.id, g.name
  )
  SELECT 'Company shares add up to ' || TRIM(TO_CHAR(total, 'FM990.99')) || '% — they must total 100%.'
    FROM top WHERE ABS(total - 100) > 0.05
  UNION ALL
  SELECT 'Members of "' || name || '" add up to ' || TRIM(TO_CHAR(total, 'FM990.99')) || '% of the group — they must total 100%.'
    FROM grp WHERE members > 0 AND ABS(total - 100) > 0.05;
$$ LANGUAGE SQL STABLE;

-- Per partner, per currency: capital, allocated profit, payouts, drawings, balance.
CREATE OR REPLACE FUNCTION partner_balances(p_agency UUID)
RETURNS TABLE (
  partner_id UUID, currency TEXT,
  capital_in NUMERIC, capital_out NUMERIC, net_capital NUMERIC,
  profit_allocated NUMERIC, profit_paid NUMERIC, drawings NUMERIC, balance_due NUMERIC
) AS $$
  WITH alloc AS (
    SELECT l.partner_id, d.currency, SUM(l.amount) AS allocated
      FROM profit_distribution_lines l
      JOIN profit_distributions d ON d.id = l.distribution_id
     WHERE d.agency_id = p_agency AND d.status IN ('approved','paid')
     GROUP BY 1, 2
  ), tx AS (
    SELECT t.partner_id, t.currency,
           SUM(CASE WHEN t.type = 'capital_contribution' THEN t.amount ELSE 0 END) AS cap_in,
           SUM(CASE WHEN t.type = 'capital_return'       THEN t.amount ELSE 0 END) AS cap_out,
           SUM(CASE WHEN t.type = 'profit_payout'        THEN t.amount ELSE 0 END) AS paid,
           SUM(CASE WHEN t.type = 'drawing'              THEN t.amount ELSE 0 END) AS draws
      FROM partner_transactions t
     WHERE t.agency_id = p_agency AND t.deleted_at IS NULL
     GROUP BY 1, 2
  ), keys AS (
    SELECT partner_id, currency FROM alloc UNION SELECT partner_id, currency FROM tx
  )
  SELECT k.partner_id, k.currency,
         COALESCE(tx.cap_in,0), COALESCE(tx.cap_out,0),
         COALESCE(tx.cap_in,0) - COALESCE(tx.cap_out,0),
         COALESCE(a.allocated,0), COALESCE(tx.paid,0), COALESCE(tx.draws,0),
         COALESCE(a.allocated,0) - COALESCE(tx.paid,0) - COALESCE(tx.draws,0)
    FROM keys k
    LEFT JOIN alloc a ON a.partner_id = k.partner_id AND a.currency = k.currency
    LEFT JOIN tx      ON tx.partner_id = k.partner_id AND tx.currency = k.currency;
$$ LANGUAGE SQL STABLE;

-- Aggregated partner cash per account and day. SECURITY DEFINER so that the
-- account balances stay correct for finance users without partners.view;
-- it exposes totals only, never who received the money.
CREATE OR REPLACE FUNCTION partner_cash_moves(p_agency UUID)
RETURNS TABLE (account_id UUID, transaction_date DATE, inflow NUMERIC, outflow NUMERIC) AS $$
  SELECT t.account_id, t.transaction_date,
         SUM(CASE WHEN t.type = 'capital_contribution' THEN t.amount ELSE 0 END),
         SUM(CASE WHEN t.type <> 'capital_contribution' THEN t.amount ELSE 0 END)
    FROM partner_transactions t
   WHERE t.agency_id = p_agency
     AND p_agency = get_my_agency_id()
     AND t.deleted_at IS NULL
     AND t.account_id IS NOT NULL
   GROUP BY 1, 2;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ─────────────────────────────────────────────────────────────
-- 7. ACCOUNT BALANCES + CASH FLOW now include partner money
--    (same signatures and columns as 007 / 009)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION finance_account_balances(p_agency UUID)
RETURNS TABLE (
  account_id UUID, account_name TEXT, type TEXT, currency TEXT,
  opening_balance NUMERIC, inflow NUMERIC, outflow NUMERIC, current_balance NUMERIC
) AS $$
  WITH mv AS (
    SELECT t.account_id,
           CASE WHEN t.type = 'income'  THEN t.amount_paid ELSE 0 END AS inflow,
           CASE WHEN t.type = 'expense' THEN t.amount_paid ELSE 0 END AS outflow
      FROM finance_transactions t
     WHERE t.agency_id = p_agency AND t.deleted_at IS NULL
       AND t.status NOT IN ('cancelled','draft')
    UNION ALL
    SELECT m.account_id, m.inflow, m.outflow FROM partner_cash_moves(p_agency) m
  )
  SELECT a.id, a.name, a.type, a.currency, a.opening_balance,
         COALESCE(SUM(mv.inflow),0)  AS inflow,
         COALESCE(SUM(mv.outflow),0) AS outflow,
         a.opening_balance + COALESCE(SUM(mv.inflow),0) - COALESCE(SUM(mv.outflow),0) AS current_balance
    FROM finance_accounts a
    LEFT JOIN mv ON mv.account_id = a.id
   WHERE a.agency_id = p_agency AND a.status = 'active'
   GROUP BY a.id, a.name, a.type, a.currency, a.opening_balance
   ORDER BY a.name;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION finance_cashflow(p_agency UUID, p_from DATE, p_to DATE)
RETURNS TABLE (
  account_id UUID, account_name TEXT, type TEXT, currency TEXT,
  opening_balance NUMERIC, inflow NUMERIC, outflow NUMERIC,
  payroll_out NUMERIC, net_flow NUMERIC, closing_balance NUMERIC
) AS $$
  WITH tx AS (
    SELECT t.account_id, t.transaction_date,
           CASE WHEN t.type = 'income'  THEN t.amount_paid ELSE 0 END AS amt_in,
           CASE WHEN t.type = 'expense' THEN t.amount_paid ELSE 0 END AS amt_out,
           CASE WHEN t.type = 'expense' AND (t.payroll_item_id IS NOT NULL OR COALESCE(c.is_payroll, FALSE))
                THEN t.amount_paid ELSE 0 END AS amt_payroll
      FROM finance_transactions t
      LEFT JOIN finance_categories c ON c.id = t.category_id
     WHERE t.agency_id = p_agency
       AND t.deleted_at IS NULL
       AND t.status NOT IN ('cancelled','draft')
       AND t.amount_paid > 0
    UNION ALL
    SELECT m.account_id, m.transaction_date, m.inflow, m.outflow, 0
      FROM partner_cash_moves(p_agency) m
  )
  SELECT
    a.id, a.name, a.type, a.currency,
    a.opening_balance
      + COALESCE(SUM(CASE WHEN tx.transaction_date < p_from THEN tx.amt_in - tx.amt_out END), 0) AS opening_balance,
    COALESCE(SUM(CASE WHEN tx.transaction_date BETWEEN p_from AND p_to THEN tx.amt_in END), 0)      AS inflow,
    COALESCE(SUM(CASE WHEN tx.transaction_date BETWEEN p_from AND p_to THEN tx.amt_out END), 0)     AS outflow,
    COALESCE(SUM(CASE WHEN tx.transaction_date BETWEEN p_from AND p_to THEN tx.amt_payroll END), 0) AS payroll_out,
    COALESCE(SUM(CASE WHEN tx.transaction_date BETWEEN p_from AND p_to THEN tx.amt_in - tx.amt_out END), 0) AS net_flow,
    a.opening_balance
      + COALESCE(SUM(CASE WHEN tx.transaction_date <= p_to THEN tx.amt_in - tx.amt_out END), 0)    AS closing_balance
  FROM finance_accounts a
  LEFT JOIN tx ON tx.account_id = a.id
  WHERE a.agency_id = p_agency AND a.status = 'active'
  GROUP BY a.id, a.name, a.type, a.currency, a.opening_balance
  ORDER BY a.name;
$$ LANGUAGE SQL STABLE;

-- ─────────────────────────────────────────────────────────────
-- 8. DISTRIBUTION RPCs
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_profit_distribution(
  p_agency UUID, p_from DATE, p_to DATE, p_currency TEXT,
  p_reserve_percent NUMERIC DEFAULT 0,
  p_amount_override NUMERIC DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_rev NUMERIC := 0; v_exp NUMERIC := 0; v_net NUMERIC := 0;
  v_dist NUMERIC;
  v_total_share NUMERIC;
  v_allocated NUMERIC;
  v_top UUID;
BEGIN
  IF p_agency IS DISTINCT FROM get_my_agency_id() OR NOT has_permission('partners.manage') THEN
    RAISE EXCEPTION 'You do not have permission to create profit distributions.';
  END IF;
  IF p_to < p_from THEN RAISE EXCEPTION 'The period end must be after its start.'; END IF;
  IF EXISTS (SELECT 1 FROM partner_structure_issues(p_agency)) THEN
    RAISE EXCEPTION 'Fix the ownership table first: %', (SELECT string_agg(issue, ' ') FROM partner_structure_issues(p_agency));
  END IF;

  SELECT COALESCE(SUM(share_percent),0) INTO v_total_share
    FROM partners WHERE agency_id = p_agency AND parent_id IS NULL AND status = 'active';
  IF v_total_share = 0 THEN RAISE EXCEPTION 'Add the partners and their shares first.'; END IF;

  SELECT s.revenue_collected, s.expenses_paid, s.net_profit
    INTO v_rev, v_exp, v_net
    FROM finance_summary(p_agency, p_from, p_to) s WHERE s.currency = p_currency;
  v_rev := COALESCE(v_rev, 0); v_exp := COALESCE(v_exp, 0); v_net := COALESCE(v_net, 0);

  IF p_amount_override IS NOT NULL THEN
    IF p_amount_override < 0 THEN RAISE EXCEPTION 'The amount cannot be negative.'; END IF;
    v_dist := ROUND(p_amount_override, 2);
  ELSE
    v_dist := GREATEST(ROUND(v_net * (1 - COALESCE(p_reserve_percent,0) / 100), 2), 0);
  END IF;

  INSERT INTO profit_distributions (
    agency_id, title, period_start, period_end, currency,
    revenue, expenses, net_profit, reserve_percent, distributable_amount,
    is_manual_amount, notes, created_by)
  VALUES (
    p_agency,
    COALESCE(NULLIF(TRIM(p_title), ''), 'Profit ' || TO_CHAR(p_from, 'Mon YYYY')
             || CASE WHEN DATE_TRUNC('month', p_from) <> DATE_TRUNC('month', p_to)
                     THEN ' – ' || TO_CHAR(p_to, 'Mon YYYY') ELSE '' END),
    p_from, p_to, p_currency,
    v_rev, v_exp, v_net, COALESCE(p_reserve_percent,0), v_dist,
    p_amount_override IS NOT NULL, p_notes, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO profit_distribution_lines (agency_id, distribution_id, partner_id, share_percent, amount)
  SELECT p_agency, v_id, s.partner_id, s.effective_percent,
         ROUND(v_dist * s.effective_percent / 100, 2)
    FROM partner_effective_shares(p_agency) s
   WHERE s.effective_percent > 0;

  -- Put any rounding cent on the largest holder so lines sum exactly.
  SELECT COALESCE(SUM(amount),0) INTO v_allocated FROM profit_distribution_lines WHERE distribution_id = v_id;
  IF v_allocated <> v_dist THEN
    SELECT id INTO v_top FROM profit_distribution_lines WHERE distribution_id = v_id
     ORDER BY share_percent DESC, id LIMIT 1;
    UPDATE profit_distribution_lines SET amount = GREATEST(amount + (v_dist - v_allocated), 0) WHERE id = v_top;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION approve_profit_distribution(p_id UUID)
RETURNS VOID AS $$
DECLARE v profit_distributions%ROWTYPE;
BEGIN
  SELECT * INTO v FROM profit_distributions WHERE id = p_id;
  IF v.id IS NULL OR v.agency_id IS DISTINCT FROM get_my_agency_id() OR NOT has_permission('partners.manage') THEN
    RAISE EXCEPTION 'You do not have permission to approve this distribution.';
  END IF;
  IF v.status <> 'draft' THEN RAISE EXCEPTION 'Only a draft distribution can be approved.'; END IF;
  UPDATE profit_distributions
     SET status = CASE WHEN distributable_amount = 0 THEN 'paid' ELSE 'approved' END,
         approved_by = auth.uid(), approved_at = NOW()
   WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cancel_profit_distribution(p_id UUID)
RETURNS VOID AS $$
DECLARE v profit_distributions%ROWTYPE;
BEGIN
  SELECT * INTO v FROM profit_distributions WHERE id = p_id;
  IF v.id IS NULL OR v.agency_id IS DISTINCT FROM get_my_agency_id() OR NOT has_permission('partners.manage') THEN
    RAISE EXCEPTION 'You do not have permission to cancel this distribution.';
  END IF;
  IF EXISTS (SELECT 1 FROM partner_transactions WHERE distribution_id = p_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Payouts were already recorded for this distribution. Delete them first.';
  END IF;
  UPDATE profit_distributions SET status = 'cancelled' WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pays every partner's remaining share in one go.
CREATE OR REPLACE FUNCTION pay_profit_distribution(
  p_id UUID, p_account UUID DEFAULT NULL, p_method TEXT DEFAULT 'bank_transfer', p_date DATE DEFAULT CURRENT_DATE
) RETURNS INT AS $$
DECLARE
  v profit_distributions%ROWTYPE;
  v_count INT := 0;
  r RECORD;
BEGIN
  SELECT * INTO v FROM profit_distributions WHERE id = p_id;
  IF v.id IS NULL OR v.agency_id IS DISTINCT FROM get_my_agency_id() OR NOT has_permission('partners.manage') THEN
    RAISE EXCEPTION 'You do not have permission to pay this distribution.';
  END IF;
  IF v.status <> 'approved' THEN RAISE EXCEPTION 'Only an approved, unpaid distribution can be paid.'; END IF;

  FOR r IN
    SELECT l.partner_id,
           l.amount - COALESCE((SELECT SUM(t.amount) FROM partner_transactions t
                                 WHERE t.distribution_id = l.distribution_id
                                   AND t.partner_id = l.partner_id AND t.deleted_at IS NULL), 0) AS remaining
      FROM profit_distribution_lines l
     WHERE l.distribution_id = p_id
  LOOP
    IF r.remaining > 0.009 THEN
      INSERT INTO partner_transactions (agency_id, partner_id, type, amount, currency, transaction_date,
                                        account_id, payment_method, distribution_id, notes, created_by)
      VALUES (v.agency_id, r.partner_id, 'profit_payout', ROUND(r.remaining, 2), v.currency, COALESCE(p_date, CURRENT_DATE),
              p_account, p_method, p_id, v.title, auth.uid());
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- 9. AUDIT
-- ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS audit_partners ON partners;
CREATE TRIGGER audit_partners AFTER INSERT OR UPDATE OR DELETE ON partners
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();
DROP TRIGGER IF EXISTS audit_partner_transactions ON partner_transactions;
CREATE TRIGGER audit_partner_transactions AFTER INSERT OR UPDATE OR DELETE ON partner_transactions
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();
DROP TRIGGER IF EXISTS audit_profit_distributions ON profit_distributions;
CREATE TRIGGER audit_profit_distributions AFTER INSERT OR UPDATE OR DELETE ON profit_distributions
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

COMMIT;

-- ============================================================================
-- VERIFY:
--   SELECT key FROM permissions WHERE module = 'partners';
--   SELECT * FROM partner_structure_issues(get_my_agency_id());   -- empty when valid
--   SELECT * FROM partner_effective_shares(get_my_agency_id());   -- totals 100
-- ============================================================================

-- ============================================================================
-- EZ Marketing Agency — 012 · Task Delivery & Two-Stage Review
-- RUN AFTER: 011_partners.sql
--
-- Flow
--   todo ─► in_progress ─► submitted ─► in_final_review ─► done
--             ▲                │  (team leader)   │  (owner / partner)
--             └── changes_requested ◄─────────────┘
--
--   • The assignee submits work: a note, links (Drive, Canva, Figma…) and
--     uploaded files (private bucket `task-files`). Every submission is a
--     numbered version; nothing is overwritten.
--   • Stage 1 — the task's reviewer (team leader) approves or requests changes.
--   • Stage 2 — someone with `tasks.approve` gives final approval.
--     A task without a reviewer goes straight to stage 2; a task with
--     requires_final_approval = false is done after stage 1.
--   • Nobody can approve their own submission.
--   • Review/submit transitions happen only through the RPCs below; a trigger
--     blocks setting those statuses by hand (except for `tasks.approve`).
--   • Every step writes an in-app notification to the next person.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. PERMISSION
-- ─────────────────────────────────────────────────────────────
INSERT INTO permissions (key, module, action, description, is_sensitive) VALUES
  ('tasks.approve', 'tasks', 'approve', 'Give final approval on submitted task work', TRUE)
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_key, permission_key) VALUES
  ('agency_admin', 'tasks.approve'),
  ('partner',      'tasks.approve')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 2. TASK COLUMNS + STATUSES
-- ─────────────────────────────────────────────────────────────
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN (
  'todo','in_progress','submitted','in_final_review','changes_requested','done','waiting','blocked'));

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reviewer_id UUID;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_reviewer_id_fkey') THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_reviewer_id_fkey
      FOREIGN KEY (reviewer_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS requires_final_approval BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS revision_count INT NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS started_at   TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_by  UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE tasks ALTER COLUMN created_by SET DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS tasks_reviewer_idx ON tasks (reviewer_id);

-- ─────────────────────────────────────────────────────────────
-- 3. SUBMISSIONS, FILES, REVIEWS, COMMENTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_submissions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id    UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  task_id      UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  version      INT  NOT NULL,
  submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  note         TEXT,
  links        JSONB NOT NULL DEFAULT '[]'::JSONB,   -- [{ "url": "...", "label": "..." }]
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','leader_approved','approved','changes_requested')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, version)
);
CREATE INDEX IF NOT EXISTS task_submissions_task_idx ON task_submissions (task_id, version DESC);

CREATE TABLE IF NOT EXISTS task_files (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id     UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES task_submissions(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL DEFAULT 'submission' CHECK (kind IN ('brief','submission')),
  storage_path  TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  size_bytes    BIGINT,
  mime_type     TEXT,
  uploaded_by   UUID DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS task_files_task_idx ON task_files (task_id);
CREATE INDEX IF NOT EXISTS task_files_submission_idx ON task_files (submission_id);

CREATE TABLE IF NOT EXISTS task_reviews (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id     UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES task_submissions(id) ON DELETE CASCADE,
  reviewer_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  stage         TEXT NOT NULL CHECK (stage IN ('leader','final')),
  decision      TEXT NOT NULL CHECK (decision IN ('approved','changes_requested')),
  comment       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS task_reviews_task_idx ON task_reviews (task_id, created_at);

CREATE TABLE IF NOT EXISTS task_comments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id  UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id  UUID DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  body       TEXT NOT NULL CHECK (LENGTH(TRIM(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS task_comments_task_idx ON task_comments (task_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- 4. VISIBILITY HELPER + TASK POLICIES
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION can_see_task(p_task UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tasks t
     WHERE t.id = p_task
       AND t.agency_id = get_my_agency_id()
       AND is_internal_user()
       AND (t.client_id IS NULL
            OR client_in_scope(t.client_id)
            OR t.assigned_to = auth.uid()
            OR t.reviewer_id = auth.uid()
            OR t.created_by  = auth.uid()
            OR has_permission('tasks.approve'))
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Internal users see tasks in scope" ON tasks;
CREATE POLICY "Internal users see tasks in scope" ON tasks FOR SELECT
  USING (agency_id = get_my_agency_id() AND is_internal_user()
         AND (client_id IS NULL
              OR client_in_scope(client_id)
              OR assigned_to = auth.uid()
              OR reviewer_id = auth.uid()
              OR created_by  = auth.uid()
              OR has_permission('tasks.approve')));

-- Writes: managers create/delete; managers, the assignee and the reviewer may
-- update (the guard trigger limits what non-managers can change).
DROP POLICY IF EXISTS "Team can manage tasks" ON tasks;
DROP POLICY IF EXISTS "Managers create tasks" ON tasks;
CREATE POLICY "Managers create tasks" ON tasks FOR INSERT
  WITH CHECK (agency_id = get_my_agency_id() AND has_permission('tasks.manage'));
DROP POLICY IF EXISTS "Task participants update tasks" ON tasks;
CREATE POLICY "Task participants update tasks" ON tasks FOR UPDATE
  USING (agency_id = get_my_agency_id() AND is_internal_user()
         AND (has_permission('tasks.manage') OR assigned_to = auth.uid() OR reviewer_id = auth.uid()))
  WITH CHECK (agency_id = get_my_agency_id());
DROP POLICY IF EXISTS "Managers delete tasks" ON tasks;
CREATE POLICY "Managers delete tasks" ON tasks FOR DELETE
  USING (agency_id = get_my_agency_id() AND has_permission('tasks.manage'));

-- ─────────────────────────────────────────────────────────────
-- 5. WORKFLOW GUARD
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION tasks_workflow_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_rpc BOOLEAN := COALESCE(current_setting('app.task_workflow', TRUE), '') = 'on';
BEGIN
  IF auth.uid() IS NULL OR v_rpc THEN RETURN NEW; END IF;   -- service role / workflow RPC

  -- Non-managers (assignee, reviewer) may only move the status.
  IF NOT has_permission('tasks.manage') AND (
       NEW.title       IS DISTINCT FROM OLD.title OR
       NEW.description IS DISTINCT FROM OLD.description OR
       NEW.assigned_to IS DISTINCT FROM OLD.assigned_to OR
       NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id OR
       NEW.due_date    IS DISTINCT FROM OLD.due_date OR
       NEW.priority    IS DISTINCT FROM OLD.priority OR
       NEW.client_id   IS DISTINCT FROM OLD.client_id OR
       NEW.requires_final_approval IS DISTINCT FROM OLD.requires_final_approval) THEN
    RAISE EXCEPTION 'Only a manager can edit task details.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT has_permission('tasks.approve') THEN
    IF NEW.status IN ('submitted','in_final_review','done','changes_requested')
       OR OLD.status IN ('submitted','in_final_review','done') THEN
      RAISE EXCEPTION 'Use Submit / Review for this step — the status "%" can''t be set by hand.', NEW.status;
    END IF;
  END IF;

  IF NEW.status = 'in_progress' AND OLD.status <> 'in_progress' AND NEW.started_at IS NULL THEN
    NEW.started_at := NOW();
  END IF;
  IF NEW.status = 'done' AND OLD.status <> 'done' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, NOW());
    NEW.approved_by  := COALESCE(NEW.approved_by, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tasks_workflow_guard_trg ON tasks;
CREATE TRIGGER tasks_workflow_guard_trg BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION tasks_workflow_guard();

-- ─────────────────────────────────────────────────────────────
-- 6. NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_task_user(p_user UUID, p_task UUID, p_title TEXT, p_message TEXT)
RETURNS VOID AS $$
  INSERT INTO notifications (agency_id, user_id, title, message, type, action_url)
  SELECT t.agency_id, p_user, p_title, p_message, 'task', '/app/tasks?task=' || t.id
    FROM tasks t
   WHERE t.id = p_task AND p_user IS NOT NULL AND p_user IS DISTINCT FROM auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Everyone who can give final approval (active, same agency).
CREATE OR REPLACE FUNCTION task_final_approvers(p_agency UUID)
RETURNS SETOF UUID AS $$
  SELECT p.id FROM profiles p
   WHERE p.agency_id = p_agency
     AND COALESCE(p.status, 'active') = 'active'
     AND (p.role = 'super_admin'
          OR COALESCE(
               (SELECT up.granted FROM user_permissions up
                 WHERE up.user_id = p.id AND up.permission_key = 'tasks.approve'),
               EXISTS (SELECT 1 FROM role_permissions rp
                        WHERE rp.role_key = p.role AND rp.permission_key = 'tasks.approve')));
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION tasks_assignment_notify()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN
    PERFORM notify_task_user(NEW.assigned_to, NEW.id, 'New task assigned',
      NEW.title || CASE WHEN NEW.due_date IS NOT NULL THEN ' · due ' || TO_CHAR(NEW.due_date, 'DD Mon') ELSE '' END);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tasks_assignment_notify_trg ON tasks;
CREATE TRIGGER tasks_assignment_notify_trg AFTER INSERT OR UPDATE OF assigned_to ON tasks
  FOR EACH ROW EXECUTE FUNCTION tasks_assignment_notify();

-- ─────────────────────────────────────────────────────────────
-- 7. RPCs
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION submit_task_work(
  p_task UUID, p_note TEXT DEFAULT NULL, p_links JSONB DEFAULT '[]'::JSONB, p_file_ids UUID[] DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  t tasks%ROWTYPE;
  v_sub UUID;
  v_version INT;
  v_next TEXT;
  v_name TEXT;
  v_files INT;
  r UUID;
BEGIN
  SELECT * INTO t FROM tasks WHERE id = p_task FOR UPDATE;
  IF t.id IS NULL OR NOT can_see_task(p_task) THEN RAISE EXCEPTION 'Task not found.'; END IF;
  IF auth.uid() IS DISTINCT FROM t.assigned_to AND NOT has_permission('tasks.manage') THEN
    RAISE EXCEPTION 'Only the person assigned to this task can submit it.';
  END IF;
  IF t.status IN ('submitted','in_final_review','done') THEN
    RAISE EXCEPTION 'This task is already % — wait for the review.', REPLACE(t.status, '_', ' ');
  END IF;

  SELECT COUNT(*) INTO v_files FROM task_files
   WHERE id = ANY(COALESCE(p_file_ids, '{}')) AND task_id = p_task AND submission_id IS NULL;
  IF COALESCE(TRIM(p_note), '') = '' AND jsonb_array_length(COALESCE(p_links, '[]'::JSONB)) = 0 AND v_files = 0 THEN
    RAISE EXCEPTION 'Add a file, a link or a note before submitting.';
  END IF;

  PERFORM set_config('app.task_workflow', 'on', TRUE);

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version FROM task_submissions WHERE task_id = p_task;
  INSERT INTO task_submissions (agency_id, task_id, version, submitted_by, note, links)
  VALUES (t.agency_id, p_task, v_version, auth.uid(), NULLIF(TRIM(p_note), ''), COALESCE(p_links, '[]'::JSONB))
  RETURNING id INTO v_sub;

  UPDATE task_files SET submission_id = v_sub, kind = 'submission'
   WHERE id = ANY(COALESCE(p_file_ids, '{}')) AND task_id = p_task AND submission_id IS NULL;

  v_next := CASE
              WHEN t.reviewer_id IS NOT NULL AND t.reviewer_id IS DISTINCT FROM auth.uid() THEN 'submitted'
              WHEN t.requires_final_approval THEN 'in_final_review'
              ELSE 'submitted' END;
  -- No reviewer and no final approval configured → still needs someone to look.
  IF v_next = 'submitted' AND t.reviewer_id IS NULL THEN v_next := 'in_final_review'; END IF;

  UPDATE tasks SET status = v_next, submitted_at = NOW(),
                   started_at = COALESCE(started_at, NOW())
   WHERE id = p_task;

  SELECT full_name INTO v_name FROM profiles WHERE id = auth.uid();
  IF v_next = 'submitted' THEN
    PERFORM notify_task_user(t.reviewer_id, p_task, 'Work submitted for your review',
      COALESCE(v_name, 'A team member') || ' submitted "' || t.title || '" (v' || v_version || ').');
  ELSE
    FOR r IN SELECT task_final_approvers(t.agency_id) LOOP
      PERFORM notify_task_user(r, p_task, 'Task waiting for final approval',
        COALESCE(v_name, 'A team member') || ' submitted "' || t.title || '" (v' || v_version || ').');
    END LOOP;
  END IF;
  RETURN v_sub;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION review_task_work(p_task UUID, p_decision TEXT, p_comment TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  t tasks%ROWTYPE;
  s task_submissions%ROWTYPE;
  v_stage TEXT;
  v_next TEXT;
  v_is_approver BOOLEAN := has_permission('tasks.approve');
  v_name TEXT;
  r UUID;
BEGIN
  IF p_decision NOT IN ('approved','changes_requested') THEN
    RAISE EXCEPTION 'Decision must be approved or changes_requested.';
  END IF;
  SELECT * INTO t FROM tasks WHERE id = p_task FOR UPDATE;
  IF t.id IS NULL OR NOT can_see_task(p_task) THEN RAISE EXCEPTION 'Task not found.'; END IF;
  IF t.status NOT IN ('submitted','in_final_review') THEN
    RAISE EXCEPTION 'There is no submission waiting for review on this task.';
  END IF;

  SELECT * INTO s FROM task_submissions WHERE task_id = p_task ORDER BY version DESC LIMIT 1;
  IF s.submitted_by = auth.uid() THEN
    RAISE EXCEPTION 'You can''t review your own submission.';
  END IF;

  IF t.status = 'submitted' THEN
    IF auth.uid() IS DISTINCT FROM t.reviewer_id AND NOT v_is_approver THEN
      RAISE EXCEPTION 'Only the task reviewer can review this stage.';
    END IF;
    -- An owner reviewing at stage 1 decides for both stages.
    v_stage := CASE WHEN auth.uid() = t.reviewer_id THEN 'leader' ELSE 'final' END;
  ELSE
    IF NOT v_is_approver THEN
      RAISE EXCEPTION 'Final approval needs the tasks.approve permission.';
    END IF;
    v_stage := 'final';
  END IF;

  IF p_decision = 'changes_requested' AND COALESCE(TRIM(p_comment), '') = '' THEN
    RAISE EXCEPTION 'Write what needs to change.';
  END IF;

  PERFORM set_config('app.task_workflow', 'on', TRUE);

  INSERT INTO task_reviews (agency_id, task_id, submission_id, reviewer_id, stage, decision, comment)
  VALUES (t.agency_id, p_task, s.id, auth.uid(), v_stage, p_decision, NULLIF(TRIM(p_comment), ''));

  SELECT full_name INTO v_name FROM profiles WHERE id = auth.uid();

  IF p_decision = 'changes_requested' THEN
    v_next := 'changes_requested';
    UPDATE task_submissions SET status = 'changes_requested' WHERE id = s.id;
    UPDATE tasks SET status = v_next, revision_count = revision_count + 1 WHERE id = p_task;
    PERFORM notify_task_user(t.assigned_to, p_task, 'Changes requested',
      COALESCE(v_name, 'Your reviewer') || ' asked for changes on "' || t.title || '": ' || LEFT(TRIM(p_comment), 140));
    IF v_stage = 'final' AND t.reviewer_id IS NOT NULL THEN
      PERFORM notify_task_user(t.reviewer_id, p_task, 'Final review sent back',
        '"' || t.title || '" needs changes: ' || LEFT(TRIM(p_comment), 140));
    END IF;
  ELSIF v_stage = 'leader' AND t.requires_final_approval THEN
    v_next := 'in_final_review';
    UPDATE task_submissions SET status = 'leader_approved' WHERE id = s.id;
    UPDATE tasks SET status = v_next WHERE id = p_task;
    FOR r IN SELECT task_final_approvers(t.agency_id) LOOP
      PERFORM notify_task_user(r, p_task, 'Task waiting for final approval',
        '"' || t.title || '" was approved by ' || COALESCE(v_name, 'the team leader') || '.');
    END LOOP;
  ELSE
    v_next := 'done';
    UPDATE task_submissions SET status = 'approved' WHERE id = s.id;
    UPDATE tasks SET status = 'done', completed_at = NOW(), approved_by = auth.uid() WHERE id = p_task;
    PERFORM notify_task_user(t.assigned_to, p_task, 'Task approved ✓',
      '"' || t.title || '" was approved by ' || COALESCE(v_name, 'management') || '.');
  END IF;

  RETURN v_next;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- 8. RLS ON THE NEW TABLES
--    Submissions and reviews are written only by the RPCs above.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_files       ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_reviews     ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read submissions" ON task_submissions;
CREATE POLICY "read submissions" ON task_submissions FOR SELECT USING (can_see_task(task_id));

DROP POLICY IF EXISTS "read reviews" ON task_reviews;
CREATE POLICY "read reviews" ON task_reviews FOR SELECT USING (can_see_task(task_id));

DROP POLICY IF EXISTS "read task files" ON task_files;
CREATE POLICY "read task files" ON task_files FOR SELECT USING (can_see_task(task_id));
DROP POLICY IF EXISTS "add task files" ON task_files;
CREATE POLICY "add task files" ON task_files FOR INSERT
  WITH CHECK (agency_id = get_my_agency_id() AND can_see_task(task_id)
              AND uploaded_by = auth.uid() AND submission_id IS NULL);
DROP POLICY IF EXISTS "remove task files" ON task_files;
CREATE POLICY "remove task files" ON task_files FOR DELETE
  USING (can_see_task(task_id)
         AND ((uploaded_by = auth.uid() AND submission_id IS NULL) OR has_permission('tasks.manage')));

DROP POLICY IF EXISTS "read comments" ON task_comments;
CREATE POLICY "read comments" ON task_comments FOR SELECT USING (can_see_task(task_id));
DROP POLICY IF EXISTS "add comments" ON task_comments;
CREATE POLICY "add comments" ON task_comments FOR INSERT
  WITH CHECK (agency_id = get_my_agency_id() AND can_see_task(task_id) AND author_id = auth.uid());
DROP POLICY IF EXISTS "delete own comments" ON task_comments;
CREATE POLICY "delete own comments" ON task_comments FOR DELETE
  USING (author_id = auth.uid() OR has_permission('tasks.manage'));

-- Comment → notify the other people on the task.
CREATE OR REPLACE FUNCTION task_comments_notify()
RETURNS TRIGGER AS $$
DECLARE t tasks%ROWTYPE; v_name TEXT; r UUID;
BEGIN
  SELECT * INTO t FROM tasks WHERE id = NEW.task_id;
  SELECT full_name INTO v_name FROM profiles WHERE id = NEW.author_id;
  FOR r IN SELECT DISTINCT u FROM UNNEST(ARRAY[t.assigned_to, t.reviewer_id, t.created_by]) u WHERE u IS NOT NULL LOOP
    PERFORM notify_task_user(r, t.id, 'New comment on "' || t.title || '"',
      COALESCE(v_name, 'Someone') || ': ' || LEFT(NEW.body, 140));
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS task_comments_notify_trg ON task_comments;
CREATE TRIGGER task_comments_notify_trg AFTER INSERT ON task_comments
  FOR EACH ROW EXECUTE FUNCTION task_comments_notify();

-- ─────────────────────────────────────────────────────────────
-- 9. STORAGE — private bucket, path {agency_id}/{task_id}/{file}
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('task-files', 'task-files', FALSE, 52428800)   -- 50MB; bigger files go as links
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "task files read" ON storage.objects;
CREATE POLICY "task files read" ON storage.objects FOR SELECT
  USING (bucket_id = 'task-files'
         AND (storage.foldername(name))[1] = get_my_agency_id()::TEXT
         AND can_see_task(((storage.foldername(name))[2])::UUID));

DROP POLICY IF EXISTS "task files write" ON storage.objects;
CREATE POLICY "task files write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'task-files'
              AND (storage.foldername(name))[1] = get_my_agency_id()::TEXT
              AND can_see_task(((storage.foldername(name))[2])::UUID));

DROP POLICY IF EXISTS "task files delete" ON storage.objects;
CREATE POLICY "task files delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'task-files'
         AND (storage.foldername(name))[1] = get_my_agency_id()::TEXT
         AND (owner = auth.uid() OR has_permission('tasks.manage')));

COMMIT;

-- ============================================================================
-- VERIFY:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'tasks_status_check';
--   SELECT proname FROM pg_proc WHERE proname IN ('submit_task_work','review_task_work','can_see_task');
--   SELECT id, public FROM storage.buckets WHERE id = 'task-files';
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- Make Bassem the owner account (Super Admin) so Partners & payroll are visible.
-- ─────────────────────────────────────────────────────────────
UPDATE profiles SET role = 'super_admin' WHERE email = 'bassem@cl.com';

-- Check: should list partners, task_submissions and your role = super_admin
SELECT to_regclass('public.partners') AS partners_table,
       to_regclass('public.task_submissions') AS task_submissions_table,
       (SELECT role FROM profiles WHERE email = 'bassem@cl.com') AS your_role;
