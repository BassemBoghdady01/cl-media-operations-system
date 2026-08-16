-- ============================================================================
-- EZ Marketing Agency — 006 · Finance Row Level Security
-- RUN AFTER: 005_payroll.sql
--
-- PRINCIPLE: the frontend hiding a menu item is not security. Every finance
--   table is gated here by permission AND agency. A marketing user typing
--   /app/finance/payroll receives zero rows from the database itself.
--
--   Clients are handled separately: they may read ONLY their own invoices and
--   subscription cycles, never the ledger, never costs, never other clients.
-- ============================================================================

BEGIN;

ALTER TABLE agency_services         ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_accounts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_periods       ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_finance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_cycles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reminders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_expenses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_compensation   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_items           ENABLE ROW LEVEL SECURITY;

-- Helper: the client record linked to the signed-in portal user.
CREATE OR REPLACE FUNCTION my_client_id()
RETURNS UUID AS $$
  SELECT client_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ─────────────────────────────────────────────────────────────
-- SERVICES — readable by anyone who can see clients; managed by finance/admin
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "read services" ON agency_services;
CREATE POLICY "read services" ON agency_services FOR SELECT
  USING (agency_id = get_my_agency_id() AND has_permission('clients.view'));

DROP POLICY IF EXISTS "manage services" ON agency_services;
CREATE POLICY "manage services" ON agency_services FOR ALL
  USING (agency_id = get_my_agency_id() AND has_permission('finance.manage'))
  WITH CHECK (agency_id = get_my_agency_id() AND has_permission('finance.manage'));

-- ─────────────────────────────────────────────────────────────
-- ACCOUNTS & CATEGORIES
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "read accounts" ON finance_accounts;
CREATE POLICY "read accounts" ON finance_accounts FOR SELECT
  USING (agency_id = get_my_agency_id() AND has_permission('finance.view'));

DROP POLICY IF EXISTS "manage accounts" ON finance_accounts;
CREATE POLICY "manage accounts" ON finance_accounts FOR ALL
  USING (agency_id = get_my_agency_id() AND has_permission('finance.manage'))
  WITH CHECK (agency_id = get_my_agency_id() AND has_permission('finance.manage'));

DROP POLICY IF EXISTS "read categories" ON finance_categories;
CREATE POLICY "read categories" ON finance_categories FOR SELECT
  USING (agency_id = get_my_agency_id() AND has_permission('finance.view'));

DROP POLICY IF EXISTS "manage categories" ON finance_categories;
CREATE POLICY "manage categories" ON finance_categories FOR ALL
  USING (agency_id = get_my_agency_id() AND has_permission('finance.manage'))
  WITH CHECK (agency_id = get_my_agency_id() AND has_permission('finance.manage'));

-- ─────────────────────────────────────────────────────────────
-- TRANSACTION LEDGER
--   Income rows need finance.view_revenue; expense rows need
--   finance.view_expenses. This is what stops an accountant-without-revenue
--   or an HR manager from reading the whole ledger.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "read transactions" ON finance_transactions;
CREATE POLICY "read transactions" ON finance_transactions FOR SELECT
  USING (
    agency_id = get_my_agency_id()
    AND has_permission('finance.view')
    AND (
      CASE
        WHEN type = 'income'  THEN has_permission('finance.view_revenue')
        WHEN type = 'expense' THEN has_permission('finance.view_expenses')
        ELSE has_permission('finance.view_cashflow')
      END
    )
    -- Payroll-linked rows require the payroll permission specifically.
    AND (payroll_item_id IS NULL OR has_permission('finance.view_payroll'))
  );

DROP POLICY IF EXISTS "insert transactions" ON finance_transactions;
CREATE POLICY "insert transactions" ON finance_transactions FOR INSERT
  WITH CHECK (agency_id = get_my_agency_id() AND has_permission('finance.manage'));

DROP POLICY IF EXISTS "update transactions" ON finance_transactions;
CREATE POLICY "update transactions" ON finance_transactions FOR UPDATE
  USING (agency_id = get_my_agency_id() AND has_permission('finance.manage'))
  WITH CHECK (agency_id = get_my_agency_id() AND has_permission('finance.manage'));

-- No hard DELETE policy: deletion is a soft delete via deleted_at, so the
-- audit trail and period totals stay intact.

-- ─────────────────────────────────────────────────────────────
-- PERIODS & SETTINGS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "read periods" ON financial_periods;
CREATE POLICY "read periods" ON financial_periods FOR SELECT
  USING (agency_id = get_my_agency_id() AND has_permission('finance.view'));

DROP POLICY IF EXISTS "manage periods" ON financial_periods;
CREATE POLICY "manage periods" ON financial_periods FOR ALL
  USING (agency_id = get_my_agency_id() AND has_permission('finance.close_period'))
  WITH CHECK (agency_id = get_my_agency_id() AND has_permission('finance.close_period'));

DROP POLICY IF EXISTS "read finance settings" ON agency_finance_settings;
CREATE POLICY "read finance settings" ON agency_finance_settings FOR SELECT
  USING (agency_id = get_my_agency_id() AND has_permission('finance.view'));

DROP POLICY IF EXISTS "manage finance settings" ON agency_finance_settings;
CREATE POLICY "manage finance settings" ON agency_finance_settings FOR ALL
  USING (agency_id = get_my_agency_id() AND has_permission('settings.manage'))
  WITH CHECK (agency_id = get_my_agency_id() AND has_permission('settings.manage'));

-- ─────────────────────────────────────────────────────────────
-- AUDIT LOGS — read-only to holders of audit.view; nobody may edit them
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "read audit logs" ON audit_logs;
CREATE POLICY "read audit logs" ON audit_logs FOR SELECT
  USING (agency_id = get_my_agency_id() AND has_permission('audit.view'));

-- ─────────────────────────────────────────────────────────────
-- SUBSCRIPTIONS — internal manage; clients read only their own
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "read subscriptions" ON client_subscriptions;
CREATE POLICY "read subscriptions" ON client_subscriptions FOR SELECT
  USING (
    (agency_id = get_my_agency_id() AND has_permission('subscriptions.view'))
    OR (client_id = my_client_id() AND has_permission('portal.access'))
  );

DROP POLICY IF EXISTS "manage subscriptions" ON client_subscriptions;
CREATE POLICY "manage subscriptions" ON client_subscriptions FOR ALL
  USING (agency_id = get_my_agency_id() AND has_permission('subscriptions.manage'))
  WITH CHECK (agency_id = get_my_agency_id() AND has_permission('subscriptions.manage'));

DROP POLICY IF EXISTS "read cycles" ON subscription_cycles;
CREATE POLICY "read cycles" ON subscription_cycles FOR SELECT
  USING (
    (agency_id = get_my_agency_id() AND has_permission('subscriptions.view'))
    OR (client_id = my_client_id() AND has_permission('portal.access'))
  );

DROP POLICY IF EXISTS "manage cycles" ON subscription_cycles;
CREATE POLICY "manage cycles" ON subscription_cycles FOR ALL
  USING (agency_id = get_my_agency_id() AND has_permission('subscriptions.manage'))
  WITH CHECK (agency_id = get_my_agency_id() AND has_permission('subscriptions.manage'));

DROP POLICY IF EXISTS "read reminders" ON payment_reminders;
CREATE POLICY "read reminders" ON payment_reminders FOR SELECT
  USING (agency_id = get_my_agency_id() AND has_permission('subscriptions.view'));

DROP POLICY IF EXISTS "manage reminders" ON payment_reminders;
CREATE POLICY "manage reminders" ON payment_reminders FOR ALL
  USING (agency_id = get_my_agency_id() AND has_permission('subscriptions.manage'))
  WITH CHECK (agency_id = get_my_agency_id() AND has_permission('subscriptions.manage'));

-- ─────────────────────────────────────────────────────────────
-- RECURRING EXPENSES
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "read recurring expenses" ON recurring_expenses;
CREATE POLICY "read recurring expenses" ON recurring_expenses FOR SELECT
  USING (agency_id = get_my_agency_id() AND has_permission('finance.view_expenses'));

DROP POLICY IF EXISTS "manage recurring expenses" ON recurring_expenses;
CREATE POLICY "manage recurring expenses" ON recurring_expenses FOR ALL
  USING (agency_id = get_my_agency_id() AND has_permission('finance.manage'))
  WITH CHECK (agency_id = get_my_agency_id() AND has_permission('finance.manage'));

-- ─────────────────────────────────────────────────────────────
-- PAYROLL — the tightest gate in the system.
--   Employees may read their OWN compensation and payslip. Nothing else.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "read compensation" ON employee_compensation;
CREATE POLICY "read compensation" ON employee_compensation FOR SELECT
  USING (
    (agency_id = get_my_agency_id() AND has_permission('finance.view_payroll'))
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "manage compensation" ON employee_compensation;
CREATE POLICY "manage compensation" ON employee_compensation FOR ALL
  USING (agency_id = get_my_agency_id() AND has_permission('finance.manage_payroll'))
  WITH CHECK (agency_id = get_my_agency_id() AND has_permission('finance.manage_payroll'));

DROP POLICY IF EXISTS "read payroll runs" ON payroll_runs;
CREATE POLICY "read payroll runs" ON payroll_runs FOR SELECT
  USING (agency_id = get_my_agency_id() AND has_permission('finance.view_payroll'));

DROP POLICY IF EXISTS "manage payroll runs" ON payroll_runs;
CREATE POLICY "manage payroll runs" ON payroll_runs FOR ALL
  USING (agency_id = get_my_agency_id() AND has_permission('finance.manage_payroll'))
  WITH CHECK (agency_id = get_my_agency_id() AND has_permission('finance.manage_payroll'));

DROP POLICY IF EXISTS "read payroll items" ON payroll_items;
CREATE POLICY "read payroll items" ON payroll_items FOR SELECT
  USING (
    (agency_id = get_my_agency_id() AND has_permission('finance.view_payroll'))
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "manage payroll items" ON payroll_items;
CREATE POLICY "manage payroll items" ON payroll_items FOR ALL
  USING (agency_id = get_my_agency_id() AND has_permission('finance.manage_payroll'))
  WITH CHECK (agency_id = get_my_agency_id() AND has_permission('finance.manage_payroll'));

-- ─────────────────────────────────────────────────────────────
-- CLIENT PORTAL — invoices scoped to the signed-in client
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Clients read own invoices" ON invoices;
CREATE POLICY "Clients read own invoices" ON invoices FOR SELECT
  USING (
    (agency_id = get_my_agency_id() AND has_permission('invoices.view'))
    OR (client_id = my_client_id() AND has_permission('portal.access'))
  );

COMMIT;
