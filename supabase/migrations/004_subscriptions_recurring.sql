-- ============================================================================
-- EZ Marketing Agency — 004 · Subscriptions, Billing Cycles, Reminders,
--                              Recurring Expenses
-- RUN AFTER: 003_finance_core.sql
-- SAFETY: purely additive.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. CLIENT SUBSCRIPTIONS (monthly retainers)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_subscriptions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id           UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  package_id          UUID REFERENCES packages(id) ON DELETE SET NULL,
  service_id          UUID REFERENCES agency_services(id) ON DELETE SET NULL,

  name                TEXT NOT NULL,
  description         TEXT,
  amount              NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency            TEXT NOT NULL DEFAULT 'EGP',

  billing_frequency   TEXT NOT NULL DEFAULT 'monthly'
                      CHECK (billing_frequency IN ('weekly','monthly','quarterly','semi_annual','annual','custom')),
  -- For 'custom' frequency only.
  custom_interval_days INTEGER,

  start_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  next_billing_date   DATE NOT NULL,
  end_date            DATE,
  billing_day         INTEGER CHECK (billing_day BETWEEN 1 AND 31),

  auto_renew          BOOLEAN NOT NULL DEFAULT TRUE,
  auto_generate_invoice BOOLEAN NOT NULL DEFAULT FALSE,
  grace_period_days   INTEGER NOT NULL DEFAULT 0,
  reminder_days_before INTEGER[] NOT NULL DEFAULT ARRAY[7,3,1,0],

  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('draft','active','paused','overdue','cancelled','expired')),

  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subs_agency_status_idx ON client_subscriptions (agency_id, status);
CREATE INDEX IF NOT EXISTS subs_client_idx        ON client_subscriptions (client_id);
CREATE INDEX IF NOT EXISTS subs_next_billing_idx  ON client_subscriptions (agency_id, next_billing_date) WHERE status = 'active';

CREATE TRIGGER client_subscriptions_updated_at
  BEFORE UPDATE ON client_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 2. BILLING CYCLES
--    One row per billing period. History is never overwritten.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_cycles (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id  UUID NOT NULL REFERENCES client_subscriptions(id) ON DELETE CASCADE,
  agency_id        UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  period_start     DATE NOT NULL,
  period_end       DATE NOT NULL,
  due_date         DATE NOT NULL,

  amount           NUMERIC(14,2) NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'EGP',
  amount_paid      NUMERIC(14,2) NOT NULL DEFAULT 0,

  status           TEXT NOT NULL DEFAULT 'expected'
                   CHECK (status IN ('expected','invoiced','partially_paid','paid','overdue','cancelled','written_off')),

  invoice_id       UUID REFERENCES invoices(id) ON DELETE SET NULL,
  transaction_id   UUID REFERENCES finance_transactions(id) ON DELETE SET NULL,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Idempotency: a period can only ever be generated once per subscription.
  UNIQUE (subscription_id, period_start)
);

CREATE INDEX IF NOT EXISTS cycles_agency_due_idx  ON subscription_cycles (agency_id, due_date);
CREATE INDEX IF NOT EXISTS cycles_status_idx      ON subscription_cycles (agency_id, status);
CREATE INDEX IF NOT EXISTS cycles_client_idx      ON subscription_cycles (client_id);

CREATE TRIGGER subscription_cycles_updated_at
  BEFORE UPDATE ON subscription_cycles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 3. PAYMENT REMINDERS
--    dedupe_key guarantees a reminder is never sent twice, even if the cron
--    job runs multiple times or overlaps.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_reminders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id        UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id        UUID REFERENCES clients(id) ON DELETE CASCADE,
  subscription_id  UUID REFERENCES client_subscriptions(id) ON DELETE CASCADE,
  billing_cycle_id UUID REFERENCES subscription_cycles(id) ON DELETE CASCADE,
  invoice_id       UUID REFERENCES invoices(id) ON DELETE CASCADE,

  type             TEXT NOT NULL CHECK (type IN ('upcoming','due_today','overdue','final_notice')),
  days_offset      INTEGER,
  scheduled_for    DATE NOT NULL,

  channel          TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email','whatsapp','sms')),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled')),
  sent_at          TIMESTAMPTZ,
  error_message    TEXT,

  dedupe_key       TEXT NOT NULL UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reminders_due_idx    ON payment_reminders (status, scheduled_for);
CREATE INDEX IF NOT EXISTS reminders_agency_idx ON payment_reminders (agency_id, scheduled_for DESC);

-- ─────────────────────────────────────────────────────────────
-- 4. RECURRING EXPENSE TEMPLATES (rent, software, utilities…)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id            UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  category_id          UUID REFERENCES finance_categories(id) ON DELETE SET NULL,
  account_id           UUID REFERENCES finance_accounts(id) ON DELETE SET NULL,

  title                TEXT NOT NULL,
  vendor               TEXT,
  description          TEXT,
  amount               NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency             TEXT NOT NULL DEFAULT 'EGP',

  frequency            TEXT NOT NULL DEFAULT 'monthly'
                       CHECK (frequency IN ('weekly','monthly','quarterly','semi_annual','annual')),
  start_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  next_due_date        DATE NOT NULL,
  end_date             DATE,

  auto_generate        BOOLEAN NOT NULL DEFAULT TRUE,
  reminder_days_before INTEGER NOT NULL DEFAULT 3,
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','ended')),

  created_by           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recurring_exp_due_idx ON recurring_expenses (agency_id, next_due_date) WHERE status = 'active';

CREATE TRIGGER recurring_expenses_updated_at
  BEFORE UPDATE ON recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- 5. WIRE LEDGER FOREIGN KEYS declared in 003
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ftx_subscription_fk') THEN
    ALTER TABLE finance_transactions
      ADD CONSTRAINT ftx_subscription_fk FOREIGN KEY (subscription_id)
      REFERENCES client_subscriptions(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ftx_cycle_fk') THEN
    ALTER TABLE finance_transactions
      ADD CONSTRAINT ftx_cycle_fk FOREIGN KEY (billing_cycle_id)
      REFERENCES subscription_cycles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ftx_recurring_fk') THEN
    ALTER TABLE finance_transactions
      ADD CONSTRAINT ftx_recurring_fk FOREIGN KEY (recurring_source_id)
      REFERENCES recurring_expenses(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 6. ADVANCE-DATE HELPER
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION advance_billing_date(p_date DATE, p_freq TEXT, p_custom_days INT DEFAULT NULL)
RETURNS DATE AS $$
BEGIN
  RETURN CASE p_freq
    WHEN 'weekly'      THEN p_date + INTERVAL '1 week'
    WHEN 'monthly'     THEN p_date + INTERVAL '1 month'
    WHEN 'quarterly'   THEN p_date + INTERVAL '3 months'
    WHEN 'semi_annual' THEN p_date + INTERVAL '6 months'
    WHEN 'annual'      THEN p_date + INTERVAL '1 year'
    WHEN 'custom'      THEN p_date + (COALESCE(p_custom_days, 30) || ' days')::INTERVAL
    ELSE p_date + INTERVAL '1 month'
  END::DATE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ─────────────────────────────────────────────────────────────
-- 7. CYCLE + REMINDER GENERATION
--    Called by the cron endpoint. Idempotent: safe to run many times a day.
--    Generates cycles up to `p_horizon_days` ahead so forecasting has data.
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- 8. RECURRING EXPENSE GENERATION
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_recurring_expenses(p_horizon_days INT DEFAULT 7)
RETURNS INT AS $$
DECLARE
  e       RECORD;
  v_count INT := 0;
BEGIN
  FOR e IN
    SELECT * FROM recurring_expenses
     WHERE status = 'active' AND auto_generate = TRUE
       AND next_due_date <= CURRENT_DATE + p_horizon_days
       AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  LOOP
    -- recurring_source_id + date makes this naturally idempotent.
    IF NOT EXISTS (
      SELECT 1 FROM finance_transactions
       WHERE recurring_source_id = e.id
         AND transaction_date = e.next_due_date
         AND deleted_at IS NULL
    ) THEN
      INSERT INTO finance_transactions (
        agency_id, account_id, category_id, recurring_source_id,
        type, title, vendor, amount, currency,
        transaction_date, due_date, status, is_recurring, created_by
      ) VALUES (
        e.agency_id, e.account_id, e.category_id, e.id,
        'expense', e.title, e.vendor, e.amount, e.currency,
        e.next_due_date, e.next_due_date, 'expected', TRUE, e.created_by
      );
      v_count := v_count + 1;
    END IF;

    UPDATE recurring_expenses
       SET next_due_date = advance_billing_date(next_due_date, frequency)
     WHERE id = e.id;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
