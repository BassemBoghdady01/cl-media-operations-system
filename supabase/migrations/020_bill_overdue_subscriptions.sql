-- ============================================================================
-- EZ Marketing Agency — 020 · Keep billing subscriptions that are overdue
-- RUN AFTER: 019_rpc_tenant_checks_and_billing_catchup.sql
--
-- The cron flags a subscription 'overdue' while one of its cycles is unpaid
-- past due. generate_subscription_cycles only billed status = 'active', so the
-- first overdue month silently STOPPED all future billing for that client.
-- It now bills 'active' and 'overdue' subscriptions (paused / cancelled stay
-- excluded). The cron (api/cron/finance-reminders.ts) flips the flag back to
-- 'active' once no cycle is overdue.
-- SAFETY: one CREATE OR REPLACE (same signature). No data changed.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_subscription_cycles(p_horizon_days integer DEFAULT 45)
RETURNS TABLE(cycles_created integer, reminders_created integer, overdue_marked integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
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
     WHERE status IN ('active','overdue')
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
