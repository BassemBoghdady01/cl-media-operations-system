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
