-- ============================================================================
-- EZ Marketing Agency — 005 · Payroll & Compensation
-- RUN AFTER: 004_subscriptions_recurring.sql
--
-- ACCESS: payroll is the most sensitive data in the system. Only roles holding
--         finance.view_payroll / finance.manage_payroll can read or write it —
--         agency_admin does NOT inherit these by default (see 002).
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. EMPLOYEE COMPENSATION (current standing salary)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_compensation (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id          UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  base_salary        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
  currency           TEXT NOT NULL DEFAULT 'EGP',
  employment_type    TEXT NOT NULL DEFAULT 'full_time'
                     CHECK (employment_type IN ('full_time','part_time','contractor','freelancer','intern')),
  payment_day        INTEGER NOT NULL DEFAULT 28 CHECK (payment_day BETWEEN 1 AND 31),
  allowances_default NUMERIC(14,2) NOT NULL DEFAULT 0,
  deductions_default NUMERIC(14,2) NOT NULL DEFAULT 0,

  effective_from     DATE NOT NULL DEFAULT CURRENT_DATE,
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  notes              TEXT,

  created_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One active compensation record per person.
  UNIQUE (user_id, effective_from)
);
CREATE INDEX IF NOT EXISTS comp_agency_idx ON employee_compensation (agency_id, status);
CREATE INDEX IF NOT EXISTS comp_user_idx   ON employee_compensation (user_id, status);

CREATE TRIGGER employee_compensation_updated_at
  BEFORE UPDATE ON employee_compensation
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 2. PAYROLL RUNS (one per month)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_runs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id    UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  year         INTEGER NOT NULL,
  month        INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),

  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','pending_approval','approved','paid','cancelled')),
  currency     TEXT NOT NULL DEFAULT 'EGP',
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  headcount    INTEGER NOT NULL DEFAULT 0,

  approved_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at  TIMESTAMPTZ,
  paid_at      TIMESTAMPTZ,
  notes        TEXT,

  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (agency_id, year, month)
);
CREATE INDEX IF NOT EXISTS payroll_runs_agency_idx ON payroll_runs (agency_id, year DESC, month DESC);

CREATE TRIGGER payroll_runs_updated_at
  BEFORE UPDATE ON payroll_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 3. PAYROLL ITEMS (one per employee per run)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_run_id  UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  agency_id       UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  base_salary     NUMERIC(14,2) NOT NULL DEFAULT 0,
  bonus           NUMERIC(14,2) NOT NULL DEFAULT 0,
  allowances      NUMERIC(14,2) NOT NULL DEFAULT 0,
  deductions      NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- Generated so it can never disagree with its components.
  net_salary      NUMERIC(14,2) GENERATED ALWAYS AS
                  (base_salary + bonus + allowances - deductions) STORED,
  currency        TEXT NOT NULL DEFAULT 'EGP',

  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','paid','held','cancelled')),
  payment_date    DATE,
  transaction_id  UUID REFERENCES finance_transactions(id) ON DELETE SET NULL,
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (payroll_run_id, user_id)
);
CREATE INDEX IF NOT EXISTS payroll_items_run_idx  ON payroll_items (payroll_run_id);
CREATE INDEX IF NOT EXISTS payroll_items_user_idx ON payroll_items (user_id);

CREATE TRIGGER payroll_items_updated_at
  BEFORE UPDATE ON payroll_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Wire the ledger FK declared in 003.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ftx_payroll_item_fk') THEN
    ALTER TABLE finance_transactions
      ADD CONSTRAINT ftx_payroll_item_fk FOREIGN KEY (payroll_item_id)
      REFERENCES payroll_items(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 4. KEEP RUN TOTALS IN SYNC WITH ITEMS
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_payroll_run_total()
RETURNS TRIGGER AS $$
DECLARE
  v_run UUID := COALESCE(NEW.payroll_run_id, OLD.payroll_run_id);
BEGIN
  UPDATE payroll_runs r
     SET total_amount = COALESCE((
           SELECT SUM(net_salary) FROM payroll_items
            WHERE payroll_run_id = v_run AND status <> 'cancelled'), 0),
         headcount = COALESCE((
           SELECT COUNT(*) FROM payroll_items
            WHERE payroll_run_id = v_run AND status <> 'cancelled'), 0)
   WHERE r.id = v_run;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_payroll_total_trigger ON payroll_items;
CREATE TRIGGER sync_payroll_total_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payroll_items
  FOR EACH ROW EXECUTE FUNCTION sync_payroll_run_total();

-- ─────────────────────────────────────────────────────────────
-- 5. BUILD A PAYROLL RUN FROM CURRENT COMPENSATION
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION build_payroll_run(p_agency UUID, p_year INT, p_month INT)
RETURNS UUID AS $$
DECLARE
  v_run_id UUID;
BEGIN
  IF NOT has_permission('finance.manage_payroll') THEN
    RAISE EXCEPTION 'You do not have permission to run payroll.';
  END IF;

  INSERT INTO payroll_runs (agency_id, year, month, status, created_by)
  VALUES (p_agency, p_year, p_month, 'draft', auth.uid())
  ON CONFLICT (agency_id, year, month) DO UPDATE SET updated_at = NOW()
  RETURNING id INTO v_run_id;

  -- Only add people who are not already on the run; never overwrite edits.
  INSERT INTO payroll_items (
    payroll_run_id, agency_id, user_id, base_salary, allowances, deductions, currency
  )
  SELECT v_run_id, c.agency_id, c.user_id, c.base_salary,
         c.allowances_default, c.deductions_default, c.currency
    FROM employee_compensation c
    JOIN profiles p ON p.id = c.user_id
   WHERE c.agency_id = p_agency
     AND c.status = 'active'
     AND p.status  = 'active'
  ON CONFLICT (payroll_run_id, user_id) DO NOTHING;

  RETURN v_run_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- 6. POST AN APPROVED RUN TO THE LEDGER
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION post_payroll_run(p_run_id UUID, p_account UUID DEFAULT NULL)
RETURNS INT AS $$
DECLARE
  it       RECORD;
  v_run    RECORD;
  v_cat    UUID;
  v_tx     UUID;
  v_count  INT := 0;
BEGIN
  IF NOT has_permission('finance.manage_payroll') THEN
    RAISE EXCEPTION 'You do not have permission to post payroll.';
  END IF;

  SELECT * INTO v_run FROM payroll_runs WHERE id = p_run_id;
  IF v_run IS NULL THEN RAISE EXCEPTION 'Payroll run not found.'; END IF;
  IF v_run.status NOT IN ('approved','paid') THEN
    RAISE EXCEPTION 'Payroll must be approved before it can be posted.';
  END IF;

  SELECT id INTO v_cat FROM finance_categories
   WHERE agency_id = v_run.agency_id AND is_payroll = TRUE LIMIT 1;

  FOR it IN
    SELECT * FROM payroll_items
     WHERE payroll_run_id = p_run_id
       AND status <> 'cancelled'
       AND transaction_id IS NULL
  LOOP
    INSERT INTO finance_transactions (
      agency_id, account_id, category_id, payroll_item_id,
      type, title, amount, currency, transaction_date,
      status, is_recurring, created_by
    ) VALUES (
      it.agency_id, p_account, v_cat, it.id,
      'expense',
      'Payroll ' || TO_CHAR(MAKE_DATE(v_run.year, v_run.month, 1), 'Mon YYYY'),
      it.net_salary, it.currency,
      COALESCE(it.payment_date, MAKE_DATE(v_run.year, v_run.month, 28)),
      'approved', TRUE, auth.uid()
    )
    RETURNING id INTO v_tx;

    UPDATE payroll_items SET transaction_id = v_tx, status = 'approved' WHERE id = it.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Audit every compensation and payroll change.
DROP TRIGGER IF EXISTS audit_employee_compensation ON employee_compensation;
CREATE TRIGGER audit_employee_compensation
  AFTER INSERT OR UPDATE OR DELETE ON employee_compensation
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

DROP TRIGGER IF EXISTS audit_payroll_runs ON payroll_runs;
CREATE TRIGGER audit_payroll_runs
  AFTER INSERT OR UPDATE OR DELETE ON payroll_runs
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

COMMIT;
