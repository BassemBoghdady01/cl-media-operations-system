-- ============================================================================
-- EZ Marketing Agency — ROLLBACK for migrations 016–020   (DO NOT RUN casually)
--
-- Restores the function definitions that were live before 016–020, taken
-- verbatim from the earlier migration files. Rolling back RE-OPENS the
-- security gaps those migrations closed (cross-agency finance RPCs, browser-
-- callable cron helpers, last-Super-Admin self-deactivation) and the billing
-- bugs (one cycle per run, past-dated reminders, overdue stops billing).
-- Prefer rolling back only the APP (Vercel Instant Rollback): the app at
-- 49947be works with the 016–020 database.
--
-- Run as one transaction in the Supabase SQL editor. Data is not touched,
-- except: the share_units column is dropped ONLY if no partner uses it.
-- ============================================================================
BEGIN;

-- protect_super_admin  (from migrations/002_roles_permissions.sql)
CREATE OR REPLACE FUNCTION protect_super_admin()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_is_super BOOLEAN := is_super_admin();
  v_super_count    INTEGER;
BEGIN
  -- Allow unauthenticated/service-role paths (migrations, triggers, admin API).
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'super_admin' THEN
      RAISE EXCEPTION 'A Super Admin profile cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Promotion into super_admin requires super_admin.
    IF NEW.role = 'super_admin' AND OLD.role <> 'super_admin' AND NOT v_actor_is_super THEN
      RAISE EXCEPTION 'Only a Super Admin can grant the Super Admin role.';
    END IF;

    -- Modifying an existing super_admin requires super_admin.
    IF OLD.role = 'super_admin' AND NEW.role <> 'super_admin' THEN
      IF NOT v_actor_is_super THEN
        RAISE EXCEPTION 'Only a Super Admin can change a Super Admin role.';
      END IF;

      SELECT COUNT(*) INTO v_super_count FROM profiles WHERE role = 'super_admin';
      IF v_super_count <= 1 THEN
        RAISE EXCEPTION 'Cannot demote the last remaining Super Admin.';
      END IF;
    END IF;

    -- Never let a super_admin be deactivated by anyone else.
    IF OLD.role = 'super_admin'
       AND NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status <> 'active'
       AND NOT v_actor_is_super THEN
      RAISE EXCEPTION 'Only a Super Admin can deactivate a Super Admin.';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.role = 'super_admin' AND NOT v_actor_is_super THEN
    -- Permit the very first super_admin (bootstrapping an empty system).
    SELECT COUNT(*) INTO v_super_count FROM profiles WHERE role = 'super_admin';
    IF v_super_count > 0 THEN
      RAISE EXCEPTION 'Only a Super Admin can create another Super Admin.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- generate_subscription_cycles  (from migrations/004_subscriptions_recurring.sql)
CREATE OR REPLACE FUNCTION generate_subscription_cycles(p_horizon_days INT DEFAULT 45)
RETURNS TABLE (cycles_created INT, reminders_created INT, overdue_marked INT) AS $$
DECLARE
  s                RECORD;
  v_cycle_id       UUID;
  v_period_end     DATE;
  v_cycles         INT := 0;
  v_reminders      INT := 0;
  v_overdue        INT := 0;
  v_offset         INT;
  v_scheduled      DATE;
  v_key            TEXT;
  v_type           TEXT;
BEGIN
  FOR s IN
    SELECT * FROM client_subscriptions
     WHERE status = 'active'
       AND next_billing_date <= CURRENT_DATE + p_horizon_days
       AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  LOOP
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

    IF v_cycle_id IS NOT NULL THEN
      v_cycles := v_cycles + 1;

      -- Expected revenue lands in the ledger so forecasts see it immediately.
      INSERT INTO finance_transactions (
        agency_id, client_id, subscription_id, billing_cycle_id, service_id,
        type, title, amount, currency, transaction_date, due_date,
        status, is_recurring, created_by
      ) VALUES (
        s.agency_id, s.client_id, s.id, v_cycle_id, s.service_id,
        'income', s.name || ' — ' || TO_CHAR(s.next_billing_date, 'Mon YYYY'),
        s.amount, s.currency, s.next_billing_date,
        s.next_billing_date + s.grace_period_days,
        'expected', TRUE, s.created_by
      );

      -- Reminder ladder.
      FOREACH v_offset IN ARRAY s.reminder_days_before LOOP
        v_scheduled := (s.next_billing_date + s.grace_period_days) - v_offset;
        v_type := CASE WHEN v_offset > 0 THEN 'upcoming' ELSE 'due_today' END;
        v_key  := v_cycle_id::TEXT || ':' || v_type || ':' || v_offset::TEXT;

        INSERT INTO payment_reminders (
          agency_id, client_id, subscription_id, billing_cycle_id,
          type, days_offset, scheduled_for, dedupe_key
        ) VALUES (
          s.agency_id, s.client_id, s.id, v_cycle_id,
          v_type, v_offset, v_scheduled, v_key
        )
        ON CONFLICT (dedupe_key) DO NOTHING;

        IF FOUND THEN v_reminders := v_reminders + 1; END IF;
      END LOOP;
    END IF;

    -- Roll the subscription forward.
    UPDATE client_subscriptions
       SET next_billing_date = advance_billing_date(next_billing_date, billing_frequency, custom_interval_days)
     WHERE id = s.id;
  END LOOP;

  -- Mark unpaid past-due cycles overdue and queue an overdue reminder.
  WITH marked AS (
    UPDATE subscription_cycles
       SET status = 'overdue'
     WHERE status IN ('expected','invoiced','partially_paid')
       AND due_date < CURRENT_DATE
    RETURNING id, agency_id, client_id, subscription_id
  )
  INSERT INTO payment_reminders (
    agency_id, client_id, subscription_id, billing_cycle_id,
    type, scheduled_for, dedupe_key
  )
  SELECT agency_id, client_id, subscription_id, id,
         'overdue', CURRENT_DATE, id::TEXT || ':overdue:' || CURRENT_DATE::TEXT
    FROM marked
  ON CONFLICT (dedupe_key) DO NOTHING;

  GET DIAGNOSTICS v_overdue = ROW_COUNT;

  RETURN QUERY SELECT v_cycles, v_reminders, v_overdue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- generate_cycle_for_subscription  (from migrations/009_finance_ops.sql)
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

-- approve_expense  (from migrations/009_finance_ops.sql)
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

-- reject_expense  (from migrations/009_finance_ops.sql)
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

-- mark_cycle_paid  (from migrations/009_finance_ops.sql)
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

-- build_payroll_run  (from migrations/005_payroll.sql)
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

-- post_payroll_run  (from migrations/005_payroll.sql)
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

-- mark_payroll_paid  (from migrations/009_finance_ops.sql)
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

-- refresh_distribution_status  (from migrations/013_partner_advance_offsets.sql)
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
                                   AND t.type IN ('profit_payout','advance_offset')
                                   AND t.deleted_at IS NULL), 0) > 0.01
  ) INTO v_open;
  UPDATE profit_distributions
     SET status = CASE WHEN v_open THEN 'approved' ELSE 'paid' END
   WHERE id = p_distribution AND status IN ('approved','paid');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- partner_effective_shares  (from migrations/011_partners.sql)
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

-- partner_structure_issues  (from migrations/011_partners.sql)
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

-- create_profit_distribution  (from migrations/011_partners.sql)
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

-- 017: exact-units objects
DROP TRIGGER IF EXISTS partners_sync_unit_percents ON partners;
DROP FUNCTION IF EXISTS partners_sync_unit_percents();
DROP FUNCTION IF EXISTS partner_level_weights(UUID);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM partners WHERE share_units IS NOT NULL) THEN
    RAISE NOTICE 'partners.share_units is in use — column kept. Convert those partners to percentages first.';
  ELSE
    ALTER TABLE partners DROP COLUMN IF EXISTS share_units;
  END IF;
END $$;

-- 019: re-grant what was revoked (default PUBLIC execute)
GRANT EXECUTE ON FUNCTION public.generate_subscription_cycles(integer)    TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_recurring_expenses(integer)     TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_task_user(uuid, uuid, text, text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.task_final_approvers(uuid)               TO PUBLIC;

-- 018 is deliberately NOT reverted (USD default was the bug). To revert anyway:
--   ALTER TABLE packages ALTER COLUMN currency SET DEFAULT 'USD';
--   ALTER TABLE invoices ALTER COLUMN currency SET DEFAULT 'USD';

COMMIT;
