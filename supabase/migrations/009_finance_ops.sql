-- ============================================================================
-- EZ Marketing Agency — 009 · Finance Operations RPCs, Cash Flow, Storage
-- RUN AFTER: 008_finance_defaults.sql
--
-- Adds the operational functions the finance UI calls directly:
--   • single-subscription cycle generation (manual "Generate next cycle")
--   • mark cycle paid (cycle + linked ledger row updated atomically)
--   • expense approval / rejection (permission-checked in the database)
--   • payroll pay-out posting (idempotent — never double-posts)
--   • cash flow per account for a period
--   • last-login stamping
--   • private storage bucket for receipts / payment proofs
--
-- SAFETY: additive + idempotent.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. LEDGER: rejection reason for the expense approval workflow
-- ─────────────────────────────────────────────────────────────
ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ─────────────────────────────────────────────────────────────
-- 2. MANUAL CYCLE GENERATION (one subscription, one step)
--    Same idempotency contract as the cron generator: a period can only ever
--    exist once per subscription.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_cycle_for_subscription(p_subscription UUID)
RETURNS UUID AS $$
DECLARE
  s           RECORD;
  v_cycle_id  UUID;
  v_period_end DATE;
  v_offset    INT;
BEGIN
  IF NOT has_permission('subscriptions.manage') THEN
    RAISE EXCEPTION 'You do not have permission to manage subscriptions.';
  END IF;

  SELECT * INTO s FROM client_subscriptions WHERE id = p_subscription;
  IF s IS NULL THEN RAISE EXCEPTION 'Subscription not found.'; END IF;
  IF s.status NOT IN ('active','overdue') THEN
    RAISE EXCEPTION 'Cycles can only be generated for active subscriptions.';
  END IF;

  v_period_end := advance_billing_date(s.next_billing_date, s.billing_frequency, s.custom_interval_days) - 1;

  INSERT INTO subscription_cycles (
    subscription_id, agency_id, client_id, period_start, period_end,
    due_date, amount, currency, status
  ) VALUES (
    s.id, s.agency_id, s.client_id, s.next_billing_date, v_period_end,
    s.next_billing_date + s.grace_period_days, s.amount, s.currency, 'expected'
  )
  ON CONFLICT (subscription_id, period_start) DO NOTHING
  RETURNING id INTO v_cycle_id;

  IF v_cycle_id IS NULL THEN
    RAISE EXCEPTION 'A billing cycle for % already exists.', TO_CHAR(s.next_billing_date, 'Mon YYYY');
  END IF;

  -- Expected revenue in the ledger, exactly like the cron generator.
  INSERT INTO finance_transactions (
    agency_id, client_id, subscription_id, billing_cycle_id, service_id,
    type, title, amount, currency, transaction_date, due_date,
    status, is_recurring, created_by
  ) VALUES (
    s.agency_id, s.client_id, s.id, v_cycle_id, s.service_id,
    'income', s.name || ' — ' || TO_CHAR(s.next_billing_date, 'Mon YYYY'),
    s.amount, s.currency, s.next_billing_date,
    s.next_billing_date + s.grace_period_days,
    'expected', TRUE, auth.uid()
  );

  -- Reminder ladder.
  FOREACH v_offset IN ARRAY s.reminder_days_before LOOP
    INSERT INTO payment_reminders (
      agency_id, client_id, subscription_id, billing_cycle_id,
      type, days_offset, scheduled_for, dedupe_key
    ) VALUES (
      s.agency_id, s.client_id, s.id, v_cycle_id,
      CASE WHEN v_offset > 0 THEN 'upcoming' ELSE 'due_today' END,
      v_offset,
      (s.next_billing_date + s.grace_period_days) - v_offset,
      v_cycle_id::TEXT || ':' || CASE WHEN v_offset > 0 THEN 'upcoming' ELSE 'due_today' END || ':' || v_offset::TEXT
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END LOOP;

  UPDATE client_subscriptions
     SET next_billing_date = advance_billing_date(next_billing_date, billing_frequency, custom_interval_days)
   WHERE id = s.id;

  RETURN v_cycle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- 3. MARK CYCLE PAID — cycle + linked ledger row move together
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mark_cycle_paid(
  p_cycle UUID,
  p_amount NUMERIC,
  p_account UUID DEFAULT NULL,
  p_method TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  c    RECORD;
  v_tx UUID;
BEGIN
  IF NOT has_permission('subscriptions.manage') THEN
    RAISE EXCEPTION 'You do not have permission to record subscription payments.';
  END IF;

  SELECT * INTO c FROM subscription_cycles WHERE id = p_cycle;
  IF c IS NULL THEN RAISE EXCEPTION 'Billing cycle not found.'; END IF;
  IF p_amount < 0 OR p_amount > c.amount THEN
    RAISE EXCEPTION 'Payment must be between 0 and the cycle amount.';
  END IF;

  UPDATE subscription_cycles
     SET amount_paid = p_amount,
         status = CASE
           WHEN p_amount >= amount THEN 'paid'
           WHEN p_amount > 0 THEN 'partially_paid'
           WHEN due_date < CURRENT_DATE THEN 'overdue'
           ELSE 'expected' END
   WHERE id = p_cycle;

  -- Find (or create) the ledger row for this cycle and settle it.
  SELECT id INTO v_tx FROM finance_transactions
   WHERE billing_cycle_id = p_cycle AND deleted_at IS NULL
   ORDER BY created_at LIMIT 1;

  IF v_tx IS NULL THEN
    INSERT INTO finance_transactions (
      agency_id, client_id, subscription_id, billing_cycle_id,
      type, title, amount, currency, transaction_date, due_date,
      status, is_recurring, created_by
    )
    SELECT c.agency_id, c.client_id, c.subscription_id, c.id,
           'income', s.name || ' — ' || TO_CHAR(c.period_start, 'Mon YYYY'),
           c.amount, c.currency, c.period_start, c.due_date,
           'expected', TRUE, auth.uid()
      FROM client_subscriptions s WHERE s.id = c.subscription_id
    RETURNING id INTO v_tx;
  END IF;

  UPDATE finance_transactions
     SET amount_paid = p_amount,
         account_id = COALESCE(p_account, account_id),
         payment_method = COALESCE(p_method, payment_method),
         paid_at = CASE WHEN p_amount > 0 THEN COALESCE(paid_at, NOW()) ELSE paid_at END,
         status = CASE
           WHEN p_amount >= amount THEN 'paid'
           WHEN p_amount > 0 THEN 'partially_paid'
           ELSE status END
   WHERE id = v_tx;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- 4. EXPENSE APPROVAL — decision recorded in the database
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION approve_expense(p_tx UUID)
RETURNS VOID AS $$
DECLARE t RECORD;
BEGIN
  IF NOT has_permission('finance.approve_expenses') THEN
    RAISE EXCEPTION 'You do not have permission to approve expenses.';
  END IF;

  SELECT * INTO t FROM finance_transactions WHERE id = p_tx AND deleted_at IS NULL;
  IF t IS NULL THEN RAISE EXCEPTION 'Transaction not found.'; END IF;
  IF t.type <> 'expense' THEN RAISE EXCEPTION 'Only expenses go through approval.'; END IF;
  IF t.status NOT IN ('draft','pending') THEN
    RAISE EXCEPTION 'Only draft or pending expenses can be approved.';
  END IF;
  IF t.created_by = auth.uid() AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'You cannot approve your own expense.';
  END IF;

  UPDATE finance_transactions
     SET status = 'approved', approved_by = auth.uid(), approved_at = NOW(),
         rejection_reason = NULL
   WHERE id = p_tx;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reject_expense(p_tx UUID, p_reason TEXT)
RETURNS VOID AS $$
DECLARE t RECORD;
BEGIN
  IF NOT has_permission('finance.approve_expenses') THEN
    RAISE EXCEPTION 'You do not have permission to reject expenses.';
  END IF;
  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A rejection reason is required.';
  END IF;

  SELECT * INTO t FROM finance_transactions WHERE id = p_tx AND deleted_at IS NULL;
  IF t IS NULL THEN RAISE EXCEPTION 'Transaction not found.'; END IF;
  IF t.status NOT IN ('draft','pending') THEN
    RAISE EXCEPTION 'Only draft or pending expenses can be rejected.';
  END IF;

  UPDATE finance_transactions
     SET status = 'cancelled', rejection_reason = TRIM(p_reason),
         approved_by = auth.uid(), approved_at = NOW()
   WHERE id = p_tx;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- 5. PAYROLL PAY-OUT — post (if needed) then settle. Idempotent:
--    items already carrying a transaction are settled, never re-posted.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mark_payroll_paid(p_run UUID, p_account UUID DEFAULT NULL)
RETURNS INT AS $$
DECLARE
  v_run   RECORD;
  v_count INT := 0;
BEGIN
  IF NOT has_permission('finance.manage_payroll') THEN
    RAISE EXCEPTION 'You do not have permission to pay payroll.';
  END IF;

  SELECT * INTO v_run FROM payroll_runs WHERE id = p_run;
  IF v_run IS NULL THEN RAISE EXCEPTION 'Payroll run not found.'; END IF;
  IF v_run.status NOT IN ('approved','paid') THEN
    RAISE EXCEPTION 'Payroll must be approved before it can be paid.';
  END IF;

  -- Ensure every item has its ledger row (post_payroll_run skips posted ones).
  PERFORM post_payroll_run(p_run, p_account);

  -- Settle the linked transactions.
  UPDATE finance_transactions ft
     SET amount_paid = ft.amount,
         account_id  = COALESCE(p_account, ft.account_id),
         paid_at     = COALESCE(ft.paid_at, NOW()),
         status      = 'paid'
   WHERE ft.payroll_item_id IN (
           SELECT id FROM payroll_items
            WHERE payroll_run_id = p_run AND status <> 'cancelled')
     AND ft.deleted_at IS NULL
     AND ft.amount_paid < ft.amount;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE payroll_items
     SET status = 'paid', payment_date = COALESCE(payment_date, CURRENT_DATE)
   WHERE payroll_run_id = p_run AND status <> 'cancelled';

  UPDATE payroll_runs
     SET status = 'paid', paid_at = COALESCE(paid_at, NOW())
   WHERE id = p_run;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- 6. CASH FLOW — per account, for a period. SECURITY INVOKER so the
--    RLS permission gates from 006 apply to the caller.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION finance_cashflow(p_agency UUID, p_from DATE, p_to DATE)
RETURNS TABLE (
  account_id UUID, account_name TEXT, type TEXT, currency TEXT,
  opening_balance NUMERIC, inflow NUMERIC, outflow NUMERIC,
  payroll_out NUMERIC, net_flow NUMERIC, closing_balance NUMERIC
) AS $$
  WITH tx AS (
    SELECT t.account_id, t.type AS ttype, t.amount_paid, t.transaction_date,
           (t.payroll_item_id IS NOT NULL OR COALESCE(c.is_payroll, FALSE)) AS is_payroll
      FROM finance_transactions t
      LEFT JOIN finance_categories c ON c.id = t.category_id
     WHERE t.agency_id = p_agency
       AND t.deleted_at IS NULL
       AND t.status NOT IN ('cancelled','draft')
       AND t.amount_paid > 0
  )
  SELECT
    a.id, a.name, a.type, a.currency,
    a.opening_balance
      + COALESCE(SUM(CASE WHEN tx.transaction_date < p_from AND tx.ttype = 'income'  THEN tx.amount_paid END), 0)
      - COALESCE(SUM(CASE WHEN tx.transaction_date < p_from AND tx.ttype = 'expense' THEN tx.amount_paid END), 0)
      AS opening_balance,
    COALESCE(SUM(CASE WHEN tx.transaction_date BETWEEN p_from AND p_to AND tx.ttype = 'income'  THEN tx.amount_paid END), 0) AS inflow,
    COALESCE(SUM(CASE WHEN tx.transaction_date BETWEEN p_from AND p_to AND tx.ttype = 'expense' THEN tx.amount_paid END), 0) AS outflow,
    COALESCE(SUM(CASE WHEN tx.transaction_date BETWEEN p_from AND p_to AND tx.ttype = 'expense' AND tx.is_payroll THEN tx.amount_paid END), 0) AS payroll_out,
    COALESCE(SUM(CASE WHEN tx.transaction_date BETWEEN p_from AND p_to AND tx.ttype = 'income'  THEN tx.amount_paid END), 0)
      - COALESCE(SUM(CASE WHEN tx.transaction_date BETWEEN p_from AND p_to AND tx.ttype = 'expense' THEN tx.amount_paid END), 0) AS net_flow,
    a.opening_balance
      + COALESCE(SUM(CASE WHEN tx.transaction_date <= p_to AND tx.ttype = 'income'  THEN tx.amount_paid END), 0)
      - COALESCE(SUM(CASE WHEN tx.transaction_date <= p_to AND tx.ttype = 'expense' THEN tx.amount_paid END), 0)
      AS closing_balance
  FROM finance_accounts a
  LEFT JOIN tx ON tx.account_id = a.id
  WHERE a.agency_id = p_agency AND a.status = 'active'
  GROUP BY a.id, a.name, a.type, a.currency, a.opening_balance
  ORDER BY a.name;
$$ LANGUAGE SQL STABLE;

-- ─────────────────────────────────────────────────────────────
-- 7. LAST LOGIN STAMP — called by the frontend after sign-in
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_last_login()
RETURNS VOID AS $$
BEGIN
  UPDATE profiles SET last_login_at = NOW() WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- 8. AUDIT the remaining finance-sensitive tables
-- ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS audit_client_subscriptions ON client_subscriptions;
CREATE TRIGGER audit_client_subscriptions
  AFTER INSERT OR UPDATE OR DELETE ON client_subscriptions
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

DROP TRIGGER IF EXISTS audit_subscription_cycles ON subscription_cycles;
CREATE TRIGGER audit_subscription_cycles
  AFTER INSERT OR UPDATE OR DELETE ON subscription_cycles
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

DROP TRIGGER IF EXISTS audit_recurring_expenses ON recurring_expenses;
CREATE TRIGGER audit_recurring_expenses
  AFTER INSERT OR UPDATE OR DELETE ON recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

DROP TRIGGER IF EXISTS audit_payroll_items ON payroll_items;
CREATE TRIGGER audit_payroll_items
  AFTER INSERT OR UPDATE OR DELETE ON payroll_items
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

-- ─────────────────────────────────────────────────────────────
-- 9. PRIVATE STORAGE for receipts, payment proofs and invoices.
--    Path convention: {agency_id}/{entity}/{filename}
--    Access requires finance permissions AND the caller's own agency prefix.
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'finance-attachments', 'finance-attachments', FALSE,
  20971520, -- 20MB
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "finance attachments read" ON storage.objects;
CREATE POLICY "finance attachments read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'finance-attachments'
    AND (storage.foldername(name))[1] = get_my_agency_id()::TEXT
    AND has_permission('finance.view')
  );

DROP POLICY IF EXISTS "finance attachments write" ON storage.objects;
CREATE POLICY "finance attachments write" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'finance-attachments'
    AND (storage.foldername(name))[1] = get_my_agency_id()::TEXT
    AND has_permission('finance.manage')
  );

DROP POLICY IF EXISTS "finance attachments delete" ON storage.objects;
CREATE POLICY "finance attachments delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'finance-attachments'
    AND (storage.foldername(name))[1] = get_my_agency_id()::TEXT
    AND has_permission('finance.manage')
  );

COMMIT;

-- ============================================================================
-- VERIFY:
--   SELECT proname FROM pg_proc WHERE proname IN
--     ('generate_cycle_for_subscription','mark_cycle_paid','approve_expense',
--      'reject_expense','mark_payroll_paid','finance_cashflow','touch_last_login');
--   SELECT id, public FROM storage.buckets WHERE id = 'finance-attachments';
-- ============================================================================
