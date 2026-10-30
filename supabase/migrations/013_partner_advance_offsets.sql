-- ============================================================================
-- EZ Marketing Agency — 013 · Advance drawings offset against profit payouts
-- RUN AFTER: 012_task_workflow.sql
--
-- Accounting model (unchanged from 011):
--   balance owed to partner = allocated profit − profit payouts − drawings
--
-- Problem fixed here: pay_profit_distribution paid every partner their FULL
-- share, even when they had already taken an advance (drawing). The advance
-- was never recovered and the partner went negative.
--
-- Fix: when paying a distribution, any OPEN advance of that partner (in that
-- currency) is settled first with a non-cash `advance_offset` entry linked to
-- the distribution; only the rest is paid out in cash.
--
--   • advance_offset moves NO cash (account must be empty) and does NOT enter
--     the balance formula — the drawing already reduced the balance once, so
--     counting the offset too would double-deduct.
--   • It DOES count towards settling the distribution line, so the
--     distribution reaches "paid" once share = payouts + offsets.
--   • Open advance = drawings − offsets already applied (all time), so the
--     same advance can never be recovered twice.
--   • Distribution rows are locked (FOR UPDATE) in approve / pay / cancel, so a
--     double click or two tabs can't post twice.
--
-- SAFETY: additive. One CHECK constraint is widened (new allowed value); no
-- data is changed or deleted.
-- ============================================================================

BEGIN;

ALTER TABLE partner_transactions DROP CONSTRAINT IF EXISTS partner_transactions_type_check;
ALTER TABLE partner_transactions ADD CONSTRAINT partner_transactions_type_check CHECK (type IN (
  'capital_contribution','capital_return','drawing','profit_payout','advance_offset'));

-- ─────────────────────────────────────────────────────────────
-- Guard: offsets are non-cash and always tied to a distribution line
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION partner_transactions_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_acc_currency TEXT;
  v_dist  profit_distributions%ROWTYPE;
  v_line  NUMERIC;
  v_paid  NUMERIC;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;

  IF NEW.type = 'advance_offset' THEN
    IF NEW.account_id IS NOT NULL THEN
      RAISE EXCEPTION 'An advance offset moves no cash — it cannot have an account.';
    END IF;
    IF NEW.distribution_id IS NULL THEN
      RAISE EXCEPTION 'An advance offset must belong to a profit distribution.';
    END IF;
  END IF;

  IF NEW.account_id IS NOT NULL THEN
    SELECT currency INTO v_acc_currency FROM finance_accounts WHERE id = NEW.account_id;
    IF v_acc_currency IS DISTINCT FROM NEW.currency THEN
      RAISE EXCEPTION 'Currency % does not match the account currency %.', NEW.currency, v_acc_currency;
    END IF;
  END IF;

  IF NEW.distribution_id IS NOT NULL THEN
    IF NEW.type NOT IN ('profit_payout','advance_offset') THEN
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
       AND type IN ('profit_payout','advance_offset')
       AND deleted_at IS NULL AND id <> NEW.id;
    IF v_paid + NEW.amount > v_line + 0.01 THEN
      RAISE EXCEPTION 'Payout exceeds the partner''s share (remaining %).', v_line - v_paid;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- A line is settled by cash payouts plus advance offsets.
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

-- Cash view never includes offsets (they have no account anyway — belt and braces).
CREATE OR REPLACE FUNCTION partner_cash_moves(p_agency UUID)
RETURNS TABLE (account_id UUID, transaction_date DATE, inflow NUMERIC, outflow NUMERIC) AS $$
  SELECT t.account_id, t.transaction_date,
         SUM(CASE WHEN t.type = 'capital_contribution' THEN t.amount ELSE 0 END),
         SUM(CASE WHEN t.type IN ('capital_return','drawing','profit_payout') THEN t.amount ELSE 0 END)
    FROM partner_transactions t
   WHERE t.agency_id = p_agency
     AND p_agency = get_my_agency_id()
     AND t.deleted_at IS NULL
     AND t.account_id IS NOT NULL
     AND t.type <> 'advance_offset'
   GROUP BY 1, 2;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Advances a partner has taken that no distribution has recovered yet.
CREATE OR REPLACE FUNCTION partner_open_advance(p_partner UUID, p_currency TEXT)
RETURNS NUMERIC AS $$
  SELECT GREATEST(
    COALESCE(SUM(CASE WHEN type = 'drawing'        THEN amount END), 0)
  - COALESCE(SUM(CASE WHEN type = 'advance_offset' THEN amount END), 0), 0)
    FROM partner_transactions
   WHERE partner_id = p_partner AND currency = p_currency AND deleted_at IS NULL;
$$ LANGUAGE SQL STABLE;

-- ─────────────────────────────────────────────────────────────
-- Pay: recover open advances first, pay the rest in cash. Row-locked.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pay_profit_distribution(
  p_id UUID, p_account UUID DEFAULT NULL, p_method TEXT DEFAULT 'bank_transfer', p_date DATE DEFAULT CURRENT_DATE
) RETURNS INT AS $$
DECLARE
  v profit_distributions%ROWTYPE;
  v_count INT := 0;
  v_offset NUMERIC;
  v_cash NUMERIC;
  r RECORD;
BEGIN
  SELECT * INTO v FROM profit_distributions WHERE id = p_id FOR UPDATE;
  IF v.id IS NULL OR v.agency_id IS DISTINCT FROM get_my_agency_id() OR NOT has_permission('partners.manage') THEN
    RAISE EXCEPTION 'You do not have permission to pay this distribution.';
  END IF;
  IF v.status <> 'approved' THEN RAISE EXCEPTION 'Only an approved, unpaid distribution can be paid.'; END IF;

  FOR r IN
    SELECT l.partner_id,
           l.amount - COALESCE((SELECT SUM(t.amount) FROM partner_transactions t
                                 WHERE t.distribution_id = l.distribution_id
                                   AND t.partner_id = l.partner_id
                                   AND t.type IN ('profit_payout','advance_offset')
                                   AND t.deleted_at IS NULL), 0) AS remaining
      FROM profit_distribution_lines l
     WHERE l.distribution_id = p_id
     ORDER BY l.partner_id
  LOOP
    IF r.remaining > 0.009 THEN
      v_offset := LEAST(partner_open_advance(r.partner_id, v.currency), r.remaining);
      v_cash   := ROUND(r.remaining - v_offset, 2);
      IF v_offset > 0.009 THEN
        INSERT INTO partner_transactions (agency_id, partner_id, type, amount, currency, transaction_date,
                                          distribution_id, notes, created_by)
        VALUES (v.agency_id, r.partner_id, 'advance_offset', ROUND(v_offset, 2), v.currency,
                COALESCE(p_date, CURRENT_DATE), p_id, 'Advance recovered from ' || v.title, auth.uid());
      END IF;
      IF v_cash > 0.009 THEN
        INSERT INTO partner_transactions (agency_id, partner_id, type, amount, currency, transaction_date,
                                          account_id, payment_method, distribution_id, notes, created_by)
        VALUES (v.agency_id, r.partner_id, 'profit_payout', v_cash, v.currency, COALESCE(p_date, CURRENT_DATE),
                p_account, p_method, p_id, v.title, auth.uid());
        v_count := v_count + 1;
      END IF;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION approve_profit_distribution(p_id UUID)
RETURNS VOID AS $$
DECLARE v profit_distributions%ROWTYPE;
BEGIN
  SELECT * INTO v FROM profit_distributions WHERE id = p_id FOR UPDATE;
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
  SELECT * INTO v FROM profit_distributions WHERE id = p_id FOR UPDATE;
  IF v.id IS NULL OR v.agency_id IS DISTINCT FROM get_my_agency_id() OR NOT has_permission('partners.manage') THEN
    RAISE EXCEPTION 'You do not have permission to cancel this distribution.';
  END IF;
  IF EXISTS (SELECT 1 FROM partner_transactions WHERE distribution_id = p_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Payouts were already recorded for this distribution. Delete them first.';
  END IF;
  UPDATE profit_distributions SET status = 'cancelled' WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- ============================================================================
-- VERIFY (example): partner with a 1,000 drawing and a 4,800 share →
--   pay_profit_distribution posts advance_offset 1,000 + profit_payout 3,800;
--   balance_due = 4,800 − 3,800 − 1,000 = 0; bank moves 1,000 then 3,800 once.
-- ============================================================================
