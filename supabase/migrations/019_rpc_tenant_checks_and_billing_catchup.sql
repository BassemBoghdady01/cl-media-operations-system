-- ============================================================================
-- EZ Marketing Agency — 019 · RPC tenant checks · billing catch-up
-- RUN AFTER: 018_egp_default_currency.sql
--
-- SECURITY (defense in depth)
--   Seven SECURITY DEFINER finance RPCs checked the caller's PERMISSION but
--   not that the record belongs to the caller's AGENCY. Every public sign-up
--   becomes agency_admin of its own new agency (with finance/subscription
--   permissions), so a stranger who learned a record id could, e.g., approve
--   an EZ expense or mark an EZ billing cycle paid. Each RPC now refuses
--   records (and payment accounts) outside get_my_agency_id().
--   Internal helpers that no browser should call are revoked from
--   anon/authenticated (the cron uses the service role; triggers and other
--   SECURITY DEFINER functions run as the owner and are unaffected).
--
-- BILLING
--   generate_subscription_cycles created only ONE cycle per subscription per
--   run, so a subscription whose cron had never run stayed months behind,
--   and it queued "due today"/"upcoming" reminders dated in the past. Now it
--   catches up every missed period within the horizon in one run (bounded),
--   and skips pre-due reminders whose date has already passed (the overdue
--   reminder covers those). Still idempotent: unique (subscription,
--   period_start) and unique reminder dedupe keys.
-- SAFETY: CREATE OR REPLACE (same signatures) + REVOKE. No data changed.
-- ============================================================================

-- ─── Expenses ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_expense(p_tx uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE t RECORD;
BEGIN
  IF NOT has_permission('finance.approve_expenses') THEN
    RAISE EXCEPTION 'You do not have permission to approve expenses.';
  END IF;
  SELECT * INTO t FROM finance_transactions WHERE id = p_tx AND deleted_at IS NULL FOR UPDATE;
  IF t IS NULL OR t.agency_id IS DISTINCT FROM get_my_agency_id() THEN RAISE EXCEPTION 'Transaction not found.'; END IF;
  IF t.type <> 'expense' THEN RAISE EXCEPTION 'Only expenses go through approval.'; END IF;
  IF t.status NOT IN ('draft','pending') THEN
    RAISE EXCEPTION 'Only draft or pending expenses can be approved.';
  END IF;
  IF t.created_by = auth.uid() AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'You cannot approve your own expense.';
  END IF;
  UPDATE finance_transactions
     SET status = 'approved', approved_by = auth.uid(), approved_at = NOW(), rejection_reason = NULL
   WHERE id = p_tx;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_expense(p_tx uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE t RECORD;
BEGIN
  IF NOT has_permission('finance.approve_expenses') THEN
    RAISE EXCEPTION 'You do not have permission to reject expenses.';
  END IF;
  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A rejection reason is required.';
  END IF;
  SELECT * INTO t FROM finance_transactions WHERE id = p_tx AND deleted_at IS NULL FOR UPDATE;
  IF t IS NULL OR t.agency_id IS DISTINCT FROM get_my_agency_id() THEN RAISE EXCEPTION 'Transaction not found.'; END IF;
  IF t.status NOT IN ('draft','pending') THEN
    RAISE EXCEPTION 'Only draft or pending expenses can be rejected.';
  END IF;
  UPDATE finance_transactions
     SET status = 'cancelled', rejection_reason = TRIM(p_reason), approved_by = auth.uid(), approved_at = NOW()
   WHERE id = p_tx;
END;
$function$;

-- ─── Subscription payments ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_cycle_paid(p_cycle uuid, p_amount numeric, p_account uuid DEFAULT NULL::uuid, p_method text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  c    RECORD;
  v_tx UUID;
BEGIN
  IF NOT has_permission('subscriptions.manage') THEN
    RAISE EXCEPTION 'You do not have permission to record subscription payments.';
  END IF;
  SELECT * INTO c FROM subscription_cycles WHERE id = p_cycle FOR UPDATE;
  IF c IS NULL OR c.agency_id IS DISTINCT FROM get_my_agency_id() THEN RAISE EXCEPTION 'Billing cycle not found.'; END IF;
  IF p_account IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM finance_accounts WHERE id = p_account AND agency_id = c.agency_id) THEN
    RAISE EXCEPTION 'Account not found.';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 OR p_amount > c.amount THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.generate_cycle_for_subscription(p_subscription uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  s            RECORD;
  v_cycle_id   UUID;
  v_period_end DATE;
  v_offset     INT;
  v_scheduled  DATE;
BEGIN
  IF NOT has_permission('subscriptions.manage') THEN
    RAISE EXCEPTION 'You do not have permission to manage subscriptions.';
  END IF;
  SELECT * INTO s FROM client_subscriptions WHERE id = p_subscription FOR UPDATE;
  IF s IS NULL OR s.agency_id IS DISTINCT FROM get_my_agency_id() THEN RAISE EXCEPTION 'Subscription not found.'; END IF;
  IF s.status NOT IN ('active','overdue') THEN
    RAISE EXCEPTION 'Cycles can only be generated for active subscriptions.';
  END IF;

  v_period_end := advance_billing_date(s.next_billing_date, s.billing_frequency, s.custom_interval_days) - 1;

  INSERT INTO subscription_cycles (
    subscription_id, agency_id, client_id, period_start, period_end, due_date, amount, currency, status
  ) VALUES (
    s.id, s.agency_id, s.client_id, s.next_billing_date, v_period_end,
    s.next_billing_date + s.grace_period_days, s.amount, s.currency, 'expected'
  )
  ON CONFLICT (subscription_id, period_start) DO NOTHING
  RETURNING id INTO v_cycle_id;

  IF v_cycle_id IS NULL THEN
    RAISE EXCEPTION 'A billing cycle for % already exists.', TO_CHAR(s.next_billing_date, 'Mon YYYY');
  END IF;

  INSERT INTO finance_transactions (
    agency_id, client_id, subscription_id, billing_cycle_id, service_id,
    type, title, amount, currency, transaction_date, due_date, status, is_recurring, created_by
  ) VALUES (
    s.agency_id, s.client_id, s.id, v_cycle_id, s.service_id,
    'income', s.name || ' — ' || TO_CHAR(s.next_billing_date, 'Mon YYYY'),
    s.amount, s.currency, s.next_billing_date, s.next_billing_date + s.grace_period_days,
    'expected', TRUE, auth.uid()
  );

  FOREACH v_offset IN ARRAY s.reminder_days_before LOOP
    v_scheduled := (s.next_billing_date + s.grace_period_days) - v_offset;
    CONTINUE WHEN v_scheduled < CURRENT_DATE;   -- never queue a reminder dated in the past
    INSERT INTO payment_reminders (
      agency_id, client_id, subscription_id, billing_cycle_id, type, days_offset, scheduled_for, dedupe_key
    ) VALUES (
      s.agency_id, s.client_id, s.id, v_cycle_id,
      CASE WHEN v_offset > 0 THEN 'upcoming' ELSE 'due_today' END,
      v_offset, v_scheduled,
      v_cycle_id::TEXT || ':' || CASE WHEN v_offset > 0 THEN 'upcoming' ELSE 'due_today' END || ':' || v_offset::TEXT
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END LOOP;

  UPDATE client_subscriptions
     SET next_billing_date = advance_billing_date(next_billing_date, billing_frequency, custom_interval_days)
   WHERE id = s.id;

  RETURN v_cycle_id;
END;
$function$;

-- ─── Cron generator: catch up all missed periods, no past-dated reminders ───
CREATE OR REPLACE FUNCTION public.generate_subscription_cycles(p_horizon_days integer DEFAULT 45)
RETURNS TABLE(cycles_created integer, reminders_created integer, overdue_marked integer)
LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  s            RECORD;
  v_next       DATE;
  v_cycle_id   UUID;
  v_period_end DATE;
  v_cycles     INT := 0;
  v_reminders  INT := 0;
  v_overdue    INT := 0;
  v_offset     INT;
  v_scheduled  DATE;
  v_key        TEXT;
  v_type       TEXT;
  v_guard      INT;
BEGIN
  FOR s IN
    SELECT * FROM client_subscriptions
     WHERE status = 'active'
       AND next_billing_date <= CURRENT_DATE + p_horizon_days
       AND (end_date IS NULL OR end_date >= CURRENT_DATE)
     FOR UPDATE SKIP LOCKED
  LOOP
    v_next  := s.next_billing_date;
    v_guard := 0;
    -- Catch up every period up to the horizon (at most 36 per run).
    WHILE v_next <= CURRENT_DATE + p_horizon_days
          AND (s.end_date IS NULL OR v_next <= s.end_date)
          AND v_guard < 36 LOOP
      v_guard := v_guard + 1;
      v_period_end := advance_billing_date(v_next, s.billing_frequency, s.custom_interval_days) - 1;
      v_cycle_id := NULL;

      INSERT INTO subscription_cycles (
        subscription_id, agency_id, client_id, period_start, period_end, due_date, amount, currency, status
      ) VALUES (
        s.id, s.agency_id, s.client_id, v_next, v_period_end,
        v_next + s.grace_period_days, s.amount, s.currency, 'expected'
      )
      ON CONFLICT (subscription_id, period_start) DO NOTHING
      RETURNING id INTO v_cycle_id;

      IF v_cycle_id IS NOT NULL THEN
        v_cycles := v_cycles + 1;

        INSERT INTO finance_transactions (
          agency_id, client_id, subscription_id, billing_cycle_id, service_id,
          type, title, amount, currency, transaction_date, due_date, status, is_recurring, created_by
        ) VALUES (
          s.agency_id, s.client_id, s.id, v_cycle_id, s.service_id,
          'income', s.name || ' — ' || TO_CHAR(v_next, 'Mon YYYY'),
          s.amount, s.currency, v_next, v_next + s.grace_period_days,
          'expected', TRUE, s.created_by
        );

        FOREACH v_offset IN ARRAY s.reminder_days_before LOOP
          v_scheduled := (v_next + s.grace_period_days) - v_offset;
          CONTINUE WHEN v_scheduled < CURRENT_DATE;   -- the overdue reminder covers missed dates
          v_type := CASE WHEN v_offset > 0 THEN 'upcoming' ELSE 'due_today' END;
          v_key  := v_cycle_id::TEXT || ':' || v_type || ':' || v_offset::TEXT;
          INSERT INTO payment_reminders (
            agency_id, client_id, subscription_id, billing_cycle_id, type, days_offset, scheduled_for, dedupe_key
          ) VALUES (
            s.agency_id, s.client_id, s.id, v_cycle_id, v_type, v_offset, v_scheduled, v_key
          )
          ON CONFLICT (dedupe_key) DO NOTHING;
          IF FOUND THEN v_reminders := v_reminders + 1; END IF;
        END LOOP;
      END IF;

      v_next := advance_billing_date(v_next, s.billing_frequency, s.custom_interval_days);
    END LOOP;

    UPDATE client_subscriptions SET next_billing_date = v_next WHERE id = s.id;
  END LOOP;

  -- Unpaid past-due cycles → overdue, with one overdue reminder each.
  WITH marked AS (
    UPDATE subscription_cycles
       SET status = 'overdue'
     WHERE status IN ('expected','invoiced','partially_paid')
       AND due_date < CURRENT_DATE
    RETURNING id, agency_id, client_id, subscription_id
  )
  INSERT INTO payment_reminders (
    agency_id, client_id, subscription_id, billing_cycle_id, type, scheduled_for, dedupe_key
  )
  SELECT agency_id, client_id, subscription_id, id, 'overdue', CURRENT_DATE, id::TEXT || ':overdue'
    FROM marked
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS v_overdue = ROW_COUNT;

  RETURN QUERY SELECT v_cycles, v_reminders, v_overdue;
END;
$function$;

-- ─── Payroll ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.build_payroll_run(p_agency uuid, p_year integer, p_month integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE v_run_id UUID;
BEGIN
  IF p_agency IS DISTINCT FROM get_my_agency_id() OR NOT has_permission('finance.manage_payroll') THEN
    RAISE EXCEPTION 'You do not have permission to run payroll.';
  END IF;
  INSERT INTO payroll_runs (agency_id, year, month, status, created_by)
  VALUES (p_agency, p_year, p_month, 'draft', auth.uid())
  ON CONFLICT (agency_id, year, month) DO UPDATE SET updated_at = NOW()
  RETURNING id INTO v_run_id;

  INSERT INTO payroll_items (payroll_run_id, agency_id, user_id, base_salary, allowances, deductions, currency)
  SELECT v_run_id, c.agency_id, c.user_id, c.base_salary, c.allowances_default, c.deductions_default, c.currency
    FROM employee_compensation c
    JOIN profiles p ON p.id = c.user_id
   WHERE c.agency_id = p_agency AND c.status = 'active' AND p.status = 'active'
  ON CONFLICT (payroll_run_id, user_id) DO NOTHING;

  RETURN v_run_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.post_payroll_run(p_run_id uuid, p_account uuid DEFAULT NULL::uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  it      RECORD;
  v_run   RECORD;
  v_cat   UUID;
  v_tx    UUID;
  v_count INT := 0;
BEGIN
  IF NOT has_permission('finance.manage_payroll') THEN
    RAISE EXCEPTION 'You do not have permission to post payroll.';
  END IF;
  SELECT * INTO v_run FROM payroll_runs WHERE id = p_run_id FOR UPDATE;
  IF v_run IS NULL OR v_run.agency_id IS DISTINCT FROM get_my_agency_id() THEN RAISE EXCEPTION 'Payroll run not found.'; END IF;
  IF p_account IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM finance_accounts WHERE id = p_account AND agency_id = v_run.agency_id) THEN
    RAISE EXCEPTION 'Account not found.';
  END IF;
  IF v_run.status NOT IN ('approved','paid') THEN
    RAISE EXCEPTION 'Payroll must be approved before it can be posted.';
  END IF;

  SELECT id INTO v_cat FROM finance_categories WHERE agency_id = v_run.agency_id AND is_payroll = TRUE LIMIT 1;

  FOR it IN
    SELECT * FROM payroll_items
     WHERE payroll_run_id = p_run_id AND status <> 'cancelled' AND transaction_id IS NULL
  LOOP
    INSERT INTO finance_transactions (
      agency_id, account_id, category_id, payroll_item_id, type, title, amount, currency,
      transaction_date, status, is_recurring, created_by
    ) VALUES (
      it.agency_id, p_account, v_cat, it.id, 'expense',
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
$function$;

CREATE OR REPLACE FUNCTION public.mark_payroll_paid(p_run uuid, p_account uuid DEFAULT NULL::uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  v_run   RECORD;
  v_count INT := 0;
BEGIN
  IF NOT has_permission('finance.manage_payroll') THEN
    RAISE EXCEPTION 'You do not have permission to pay payroll.';
  END IF;
  SELECT * INTO v_run FROM payroll_runs WHERE id = p_run FOR UPDATE;
  IF v_run IS NULL OR v_run.agency_id IS DISTINCT FROM get_my_agency_id() THEN RAISE EXCEPTION 'Payroll run not found.'; END IF;
  IF v_run.status NOT IN ('approved','paid') THEN
    RAISE EXCEPTION 'Payroll must be approved before it can be paid.';
  END IF;

  PERFORM post_payroll_run(p_run, p_account);

  UPDATE finance_transactions ft
     SET amount_paid = ft.amount, account_id = COALESCE(p_account, ft.account_id),
         paid_at = COALESCE(ft.paid_at, NOW()), status = 'paid'
   WHERE ft.payroll_item_id IN (SELECT id FROM payroll_items WHERE payroll_run_id = p_run AND status <> 'cancelled')
     AND ft.deleted_at IS NULL
     AND ft.amount_paid < ft.amount;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE payroll_items SET status = 'paid', payment_date = COALESCE(payment_date, CURRENT_DATE)
   WHERE payroll_run_id = p_run AND status <> 'cancelled';
  UPDATE payroll_runs SET status = 'paid', paid_at = COALESCE(paid_at, NOW()) WHERE id = p_run;
  RETURN v_count;
END;
$function$;

-- ─── Internal helpers: not callable from the browser ───────────────────────
-- (refresh_distribution_status stays callable: the invoker trigger
--  partner_transactions_after needs it, and it only recomputes a status.)
REVOKE EXECUTE ON FUNCTION public.generate_subscription_cycles(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_recurring_expenses(integer)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_task_user(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.task_final_approvers(uuid)             FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.generate_subscription_cycles(integer) TO service_role;
GRANT  EXECUTE ON FUNCTION public.generate_recurring_expenses(integer)  TO service_role;
