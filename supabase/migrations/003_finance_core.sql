-- ============================================================================
-- EZ Marketing Agency — 003 · Finance Core
--   Services catalogue · Accounts · Categories · Unified transaction ledger
--   Accounting periods · Finance settings & targets · Audit log
--
-- RUN AFTER: 002_roles_permissions.sql
-- SAFETY: purely additive. Creates new tables only. Existing invoices,
--         packages and bookings are referenced, never modified or replaced.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. SERVICES / REVENUE STREAMS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agency_services (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT,
  description TEXT,
  -- Optional list price, used to pre-fill forms. Never a source of truth.
  default_price NUMERIC(14,2),
  currency    TEXT NOT NULL DEFAULT 'EGP',
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, name)
);
CREATE INDEX IF NOT EXISTS agency_services_agency_idx ON agency_services (agency_id, status);

-- ─────────────────────────────────────────────────────────────
-- 2. FINANCIAL ACCOUNTS
--    current_balance is NOT stored — it is derived in the balance view so it
--    can never drift from the ledger.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finance_accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id       UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'bank'
                  CHECK (type IN ('cash','bank','card','wallet','gateway','other')),
  currency        TEXT NOT NULL DEFAULT 'EGP',
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  institution     TEXT,
  account_ref     TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, name)
);
CREATE INDEX IF NOT EXISTS finance_accounts_agency_idx ON finance_accounts (agency_id, status);

-- ─────────────────────────────────────────────────────────────
-- 3. TRANSACTION CATEGORIES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finance_categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('income','expense')),
  -- Fixed costs feed break-even; variable costs do not.
  cost_type   TEXT NOT NULL DEFAULT 'variable' CHECK (cost_type IN ('fixed','variable','none')),
  is_payroll  BOOLEAN NOT NULL DEFAULT FALSE,
  color       TEXT DEFAULT '#3B82F6',
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, name, kind)
);
CREATE INDEX IF NOT EXISTS finance_categories_agency_idx ON finance_categories (agency_id, kind, status);

-- ─────────────────────────────────────────────────────────────
-- 4. ACCOUNTING PERIODS (monthly close)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_periods (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  month       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  closed_at   TIMESTAMPTZ,
  reopened_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reopened_at TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, year, month)
);

-- ─────────────────────────────────────────────────────────────
-- 5. UNIFIED TRANSACTION LEDGER
--    Every movement of money lives here: income, expense, transfer, refund,
--    adjustment. Invoices/subscriptions/payroll reference it, not duplicate it.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finance_transactions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id           UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  account_id          UUID REFERENCES finance_accounts(id) ON DELETE SET NULL,
  category_id         UUID REFERENCES finance_categories(id) ON DELETE SET NULL,

  client_id           UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
  service_id          UUID REFERENCES agency_services(id) ON DELETE SET NULL,
  invoice_id          UUID REFERENCES invoices(id) ON DELETE SET NULL,

  -- Filled by later migrations; declared here so the ledger shape is final.
  subscription_id     UUID,
  billing_cycle_id    UUID,
  payroll_item_id     UUID,
  recurring_source_id UUID,

  type                TEXT NOT NULL CHECK (type IN ('income','expense','transfer','refund','adjustment')),
  title               TEXT NOT NULL,
  description         TEXT,

  amount              NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency            TEXT NOT NULL DEFAULT 'EGP',
  -- Portion actually settled. Drives receivables and partial payments.
  amount_paid         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),

  transaction_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date            DATE,
  paid_at             TIMESTAMPTZ,

  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                        'draft','expected','pending','approved','paid',
                        'partially_paid','overdue','cancelled','refunded')),

  payment_method      TEXT CHECK (payment_method IS NULL OR payment_method IN (
                        'cash','bank_transfer','card','wallet','cheque','online','other')),
  reference           TEXT,
  vendor              TEXT,
  attachment_url      TEXT,
  is_recurring        BOOLEAN NOT NULL DEFAULT FALSE,

  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at         TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,  -- soft delete; queries filter on this

  CONSTRAINT paid_not_over_amount CHECK (amount_paid <= amount + 0.01)
);

-- Indexes chosen for the actual query shapes: agency+date range scans,
-- per-client/project/service rollups, and receivable lookups by due date.
CREATE INDEX IF NOT EXISTS ftx_agency_date_idx    ON finance_transactions (agency_id, transaction_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ftx_agency_type_idx    ON finance_transactions (agency_id, type, status)          WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ftx_client_idx         ON finance_transactions (client_id)                        WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ftx_project_idx        ON finance_transactions (project_id)                       WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ftx_service_idx        ON finance_transactions (service_id)                       WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ftx_account_idx        ON finance_transactions (account_id)                       WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ftx_due_date_idx       ON finance_transactions (agency_id, due_date)              WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ftx_invoice_idx        ON finance_transactions (invoice_id)                       WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ftx_subscription_idx   ON finance_transactions (subscription_id)                  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ftx_created_at_idx     ON finance_transactions (agency_id, created_at DESC);

CREATE TRIGGER finance_transactions_updated_at
  BEFORE UPDATE ON finance_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER finance_accounts_updated_at
  BEFORE UPDATE ON finance_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER agency_services_updated_at
  BEFORE UPDATE ON agency_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 6. DERIVE STATUS + BLOCK EDITS IN CLOSED PERIODS
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION finance_transaction_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_period_status TEXT;
  v_check_date    DATE;
BEGIN
  -- Keep status honest with respect to amount_paid / due_date.
  IF NEW.status NOT IN ('draft','cancelled','refunded','expected') THEN
    IF NEW.amount_paid >= NEW.amount AND NEW.amount > 0 THEN
      NEW.status := 'paid';
      NEW.paid_at := COALESCE(NEW.paid_at, NOW());
    ELSIF NEW.amount_paid > 0 THEN
      NEW.status := 'partially_paid';
    ELSIF NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE THEN
      NEW.status := 'overdue';
    END IF;
  END IF;

  -- A closed month is immutable for anyone without finance.close_period.
  v_check_date := COALESCE(NEW.transaction_date, OLD.transaction_date);
  IF auth.uid() IS NOT NULL AND v_check_date IS NOT NULL THEN
    SELECT status INTO v_period_status
      FROM financial_periods
     WHERE agency_id = NEW.agency_id
       AND year  = EXTRACT(YEAR  FROM v_check_date)::INT
       AND month = EXTRACT(MONTH FROM v_check_date)::INT;

    IF v_period_status = 'closed' AND NOT has_permission('finance.close_period') THEN
      RAISE EXCEPTION 'This accounting period is closed. Ask Finance to reopen it.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS finance_transaction_guard_trigger ON finance_transactions;
CREATE TRIGGER finance_transaction_guard_trigger
  BEFORE INSERT OR UPDATE ON finance_transactions
  FOR EACH ROW EXECUTE FUNCTION finance_transaction_guard();

-- ─────────────────────────────────────────────────────────────
-- 7. FINANCE SETTINGS & TARGETS (one row per agency)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agency_finance_settings (
  agency_id              UUID PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE,
  base_currency          TEXT NOT NULL DEFAULT 'EGP',
  fiscal_year_start_month INTEGER NOT NULL DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  monthly_revenue_target NUMERIC(14,2),
  monthly_profit_target  NUMERIC(14,2),
  mrr_target             NUMERIC(14,2),
  new_client_target      INTEGER,
  -- Cash on hand at setup, used for runway until accounts are reconciled.
  default_reminder_days  INTEGER[] NOT NULL DEFAULT ARRAY[7,3,1,0],
  require_expense_approval BOOLEAN NOT NULL DEFAULT FALSE,
  expense_approval_threshold NUMERIC(14,2) DEFAULT 0,
  onboarding_completed   BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_steps       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 8. AUDIT LOG (separate from operational activity_logs)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id   UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_email TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  old_value   JSONB,
  new_value   JSONB,
  metadata    JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_agency_idx  ON audit_logs (agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx  ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx   ON audit_logs (actor_id, created_at DESC);

-- Generic audit trigger. Attached to the tables that matter.
CREATE OR REPLACE FUNCTION write_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_agency UUID;
  v_email  TEXT;
BEGIN
  v_agency := COALESCE(
    (to_jsonb(NEW) ->> 'agency_id')::UUID,
    (to_jsonb(OLD) ->> 'agency_id')::UUID
  );
  IF v_agency IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT email INTO v_email FROM profiles WHERE id = auth.uid();

  INSERT INTO audit_logs (agency_id, actor_id, actor_email, action, entity_type, entity_id, old_value, new_value)
  VALUES (
    v_agency,
    auth.uid(),
    v_email,
    TG_OP,
    TG_TABLE_NAME,
    COALESCE((to_jsonb(NEW) ->> 'id')::UUID, (to_jsonb(OLD) ->> 'id')::UUID),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Auditing must never block the business operation.
  RAISE WARNING 'audit log failed for %.%: %', TG_TABLE_NAME, TG_OP, SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_finance_transactions ON finance_transactions;
CREATE TRIGGER audit_finance_transactions
  AFTER INSERT OR UPDATE OR DELETE ON finance_transactions
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

DROP TRIGGER IF EXISTS audit_financial_periods ON financial_periods;
CREATE TRIGGER audit_financial_periods
  AFTER INSERT OR UPDATE OR DELETE ON financial_periods
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

COMMIT;
