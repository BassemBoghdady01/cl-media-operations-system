-- ============================================================================
-- EZ Marketing Agency — 007 · Finance Aggregation Functions
-- RUN AFTER: 006_finance_rls.sql
--
-- SECURITY: every function here is SECURITY INVOKER (the default). RLS from 006
--   therefore applies to the caller, so a user without finance.view_expenses
--   gets zero expense rows inside the aggregate — the totals themselves are
--   permission-filtered. Do NOT convert these to SECURITY DEFINER.
--
-- CURRENCY: totals are grouped BY currency. Nothing ever sums EGP and USD into
--   a single figure. The UI renders one card per currency.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. PERIOD SUMMARY — the finance overview headline numbers
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION finance_summary(
  p_agency UUID, p_from DATE, p_to DATE
)
RETURNS TABLE (
  currency            TEXT,
  revenue_collected   NUMERIC,
  revenue_expected    NUMERIC,
  revenue_outstanding NUMERIC,
  revenue_overdue     NUMERIC,
  expenses_paid       NUMERIC,
  expenses_expected   NUMERIC,
  payroll_paid        NUMERIC,
  fixed_expenses      NUMERIC,
  variable_expenses   NUMERIC,
  net_profit          NUMERIC,
  profit_margin       NUMERIC,
  transaction_count   BIGINT
) AS $$
  WITH tx AS (
    SELECT t.*, c.cost_type, c.is_payroll
      FROM finance_transactions t
      LEFT JOIN finance_categories c ON c.id = t.category_id
     WHERE t.agency_id = p_agency
       AND t.deleted_at IS NULL
       AND t.status <> 'cancelled'
       AND t.transaction_date BETWEEN p_from AND p_to
  ),
  agg AS (
    SELECT
      tx.currency,
      COALESCE(SUM(CASE WHEN type='income'  THEN amount_paid END),0)             AS revenue_collected,
      COALESCE(SUM(CASE WHEN type='income'  THEN amount END),0)                  AS revenue_expected,
      COALESCE(SUM(CASE WHEN type='income'  THEN amount - amount_paid END),0)    AS revenue_outstanding,
      COALESCE(SUM(CASE WHEN type='income' AND status='overdue'
                        THEN amount - amount_paid END),0)                        AS revenue_overdue,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount_paid END),0)             AS expenses_paid,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount END),0)                  AS expenses_expected,
      COALESCE(SUM(CASE WHEN type='expense' AND is_payroll THEN amount END),0)   AS payroll_paid,
      COALESCE(SUM(CASE WHEN type='expense' AND cost_type='fixed'
                        THEN amount END),0)                                      AS fixed_expenses,
      COALESCE(SUM(CASE WHEN type='expense' AND cost_type='variable'
                        THEN amount END),0)                                      AS variable_expenses,
      COUNT(*)                                                                   AS transaction_count
    FROM tx GROUP BY tx.currency
  )
  SELECT
    a.currency,
    a.revenue_collected, a.revenue_expected, a.revenue_outstanding, a.revenue_overdue,
    a.expenses_paid, a.expenses_expected, a.payroll_paid,
    a.fixed_expenses, a.variable_expenses,
    a.revenue_collected - a.expenses_paid AS net_profit,
    CASE WHEN a.revenue_collected > 0
         THEN ROUND(((a.revenue_collected - a.expenses_paid) / a.revenue_collected) * 100, 2)
         ELSE 0 END AS profit_margin,
    a.transaction_count
  FROM agg a;
$$ LANGUAGE SQL STABLE;

-- ─────────────────────────────────────────────────────────────
-- 2. MONTHLY SERIES — revenue vs expenses vs profit trend
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION finance_monthly_series(
  p_agency UUID, p_months INT DEFAULT 12, p_currency TEXT DEFAULT NULL
)
RETURNS TABLE (
  month_start DATE, currency TEXT,
  revenue NUMERIC, expenses NUMERIC, profit NUMERIC
) AS $$
  SELECT
    DATE_TRUNC('month', t.transaction_date)::DATE AS month_start,
    t.currency,
    COALESCE(SUM(CASE WHEN t.type='income'  THEN t.amount_paid END),0) AS revenue,
    COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount_paid END),0) AS expenses,
    COALESCE(SUM(CASE WHEN t.type='income'  THEN t.amount_paid END),0)
      - COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount_paid END),0) AS profit
  FROM finance_transactions t
  WHERE t.agency_id = p_agency
    AND t.deleted_at IS NULL
    AND t.status <> 'cancelled'
    AND t.transaction_date >= (DATE_TRUNC('month', CURRENT_DATE) - (p_months || ' months')::INTERVAL)::DATE
    AND (p_currency IS NULL OR t.currency = p_currency)
  GROUP BY 1, 2
  ORDER BY 1;
$$ LANGUAGE SQL STABLE;

-- ─────────────────────────────────────────────────────────────
-- 3. MRR — active recurring subscriptions only, normalised to a month.
--    One-time payments are deliberately excluded.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION finance_mrr(p_agency UUID)
RETURNS TABLE (
  currency TEXT, mrr NUMERIC, active_subscriptions BIGINT,
  new_mrr NUMERIC, lost_mrr NUMERIC
) AS $$
  WITH normalised AS (
    SELECT s.currency, s.status, s.created_at, s.updated_at,
      s.amount / CASE s.billing_frequency
        WHEN 'weekly'      THEN 0.230137   -- ~1 week as a fraction of a month
        WHEN 'monthly'     THEN 1
        WHEN 'quarterly'   THEN 3
        WHEN 'semi_annual' THEN 6
        WHEN 'annual'      THEN 12
        WHEN 'custom'      THEN GREATEST(COALESCE(s.custom_interval_days,30) / 30.0, 0.01)
        ELSE 1 END AS monthly_value
    FROM client_subscriptions s
    WHERE s.agency_id = p_agency
  )
  SELECT
    n.currency,
    ROUND(COALESCE(SUM(CASE WHEN n.status='active' THEN n.monthly_value END),0), 2) AS mrr,
    COUNT(*) FILTER (WHERE n.status='active') AS active_subscriptions,
    ROUND(COALESCE(SUM(CASE WHEN n.status='active'
      AND n.created_at >= DATE_TRUNC('month', CURRENT_DATE)
      THEN n.monthly_value END),0), 2) AS new_mrr,
    ROUND(COALESCE(SUM(CASE WHEN n.status IN ('cancelled','expired')
      AND n.updated_at >= DATE_TRUNC('month', CURRENT_DATE)
      THEN n.monthly_value END),0), 2) AS lost_mrr
  FROM normalised n
  GROUP BY n.currency;
$$ LANGUAGE SQL STABLE;

-- ─────────────────────────────────────────────────────────────
-- 4. ACCOUNTS RECEIVABLE — per client
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION finance_receivables(p_agency UUID)
RETURNS TABLE (
  client_id UUID, client_name TEXT, currency TEXT,
  total_billed NUMERIC, total_paid NUMERIC, outstanding NUMERIC,
  overdue_amount NUMERIC, oldest_due_date DATE, days_overdue INT,
  open_items BIGINT
) AS $$
  SELECT
    t.client_id,
    c.name AS client_name,
    t.currency,
    COALESCE(SUM(t.amount),0)                    AS total_billed,
    COALESCE(SUM(t.amount_paid),0)               AS total_paid,
    COALESCE(SUM(t.amount - t.amount_paid),0)    AS outstanding,
    COALESCE(SUM(CASE WHEN t.due_date < CURRENT_DATE
                      THEN t.amount - t.amount_paid END),0) AS overdue_amount,
    MIN(t.due_date) FILTER (WHERE t.amount_paid < t.amount) AS oldest_due_date,
    COALESCE(GREATEST(CURRENT_DATE - MIN(t.due_date)
      FILTER (WHERE t.amount_paid < t.amount), 0), 0)::INT  AS days_overdue,
    COUNT(*) FILTER (WHERE t.amount_paid < t.amount)        AS open_items
  FROM finance_transactions t
  JOIN clients c ON c.id = t.client_id
  WHERE t.agency_id = p_agency
    AND t.type = 'income'
    AND t.deleted_at IS NULL
    AND t.status NOT IN ('cancelled','draft','refunded')
    AND t.amount_paid < t.amount
  GROUP BY t.client_id, c.name, t.currency
  ORDER BY outstanding DESC;
$$ LANGUAGE SQL STABLE;

-- ─────────────────────────────────────────────────────────────
-- 5. CLIENT PROFITABILITY
--    Cost = expenses explicitly attributed to the client (directly, or via one
--    of the client's projects). Unattributed overhead is NOT allocated — doing
--    so silently would invent numbers.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION finance_client_profitability(
  p_agency UUID, p_from DATE, p_to DATE
)
RETURNS TABLE (
  client_id UUID, client_name TEXT, currency TEXT,
  revenue NUMERIC, direct_cost NUMERIC, profit NUMERIC, margin NUMERIC,
  active_projects BIGINT, subscription_value NUMERIC
) AS $$
  WITH scoped AS (
    SELECT t.*, COALESCE(t.client_id, p.client_id) AS effective_client
      FROM finance_transactions t
      LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.agency_id = p_agency
       AND t.deleted_at IS NULL
       AND t.status NOT IN ('cancelled','draft')
       AND t.transaction_date BETWEEN p_from AND p_to
  ),
  rollup AS (
    SELECT effective_client AS cid, currency,
      COALESCE(SUM(CASE WHEN type='income'  THEN amount_paid END),0) AS revenue,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount END),0)      AS direct_cost
    FROM scoped WHERE effective_client IS NOT NULL
    GROUP BY 1, 2
  )
  SELECT
    r.cid, c.name, r.currency,
    r.revenue, r.direct_cost,
    r.revenue - r.direct_cost AS profit,
    CASE WHEN r.revenue > 0
         THEN ROUND(((r.revenue - r.direct_cost) / r.revenue) * 100, 2)
         ELSE 0 END AS margin,
    (SELECT COUNT(*) FROM projects p2
      WHERE p2.client_id = r.cid AND p2.status = 'active') AS active_projects,
    COALESCE((SELECT SUM(s.amount) FROM client_subscriptions s
      WHERE s.client_id = r.cid AND s.status = 'active'
        AND s.currency = r.currency), 0) AS subscription_value
  FROM rollup r
  JOIN clients c ON c.id = r.cid
  ORDER BY profit DESC;
$$ LANGUAGE SQL STABLE;

-- ─────────────────────────────────────────────────────────────
-- 6. PROJECT PROFITABILITY
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION finance_project_profitability(
  p_agency UUID, p_from DATE, p_to DATE
)
RETURNS TABLE (
  project_id UUID, project_name TEXT, client_name TEXT, status TEXT,
  currency TEXT, revenue NUMERIC, cost NUMERIC, profit NUMERIC, margin NUMERIC
) AS $$
  SELECT
    t.project_id, p.name, c.name, p.status, t.currency,
    COALESCE(SUM(CASE WHEN t.type='income'  THEN t.amount_paid END),0) AS revenue,
    COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount END),0)      AS cost,
    COALESCE(SUM(CASE WHEN t.type='income'  THEN t.amount_paid END),0)
      - COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount END),0)  AS profit,
    CASE WHEN COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount_paid END),0) > 0
      THEN ROUND(((COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount_paid END),0)
        - COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount END),0))
        / COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount_paid END),0)) * 100, 2)
      ELSE 0 END AS margin
  FROM finance_transactions t
  JOIN projects p ON p.id = t.project_id
  JOIN clients  c ON c.id = p.client_id
  WHERE t.agency_id = p_agency
    AND t.deleted_at IS NULL
    AND t.status NOT IN ('cancelled','draft')
    AND t.transaction_date BETWEEN p_from AND p_to
  GROUP BY t.project_id, p.name, c.name, p.status, t.currency
  ORDER BY profit DESC;
$$ LANGUAGE SQL STABLE;

-- ─────────────────────────────────────────────────────────────
-- 7. SERVICE PROFITABILITY
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION finance_service_profitability(
  p_agency UUID, p_from DATE, p_to DATE
)
RETURNS TABLE (
  service_id UUID, service_name TEXT, currency TEXT,
  revenue NUMERIC, cost NUMERIC, profit NUMERIC, margin NUMERIC
) AS $$
  SELECT
    t.service_id, s.name, t.currency,
    COALESCE(SUM(CASE WHEN t.type='income'  THEN t.amount_paid END),0),
    COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount END),0),
    COALESCE(SUM(CASE WHEN t.type='income'  THEN t.amount_paid END),0)
      - COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount END),0),
    CASE WHEN COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount_paid END),0) > 0
      THEN ROUND(((COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount_paid END),0)
        - COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount END),0))
        / COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount_paid END),0)) * 100, 2)
      ELSE 0 END
  FROM finance_transactions t
  JOIN agency_services s ON s.id = t.service_id
  WHERE t.agency_id = p_agency
    AND t.deleted_at IS NULL
    AND t.status NOT IN ('cancelled','draft')
    AND t.transaction_date BETWEEN p_from AND p_to
  GROUP BY t.service_id, s.name, t.currency
  ORDER BY 6 DESC;
$$ LANGUAGE SQL STABLE;

-- ─────────────────────────────────────────────────────────────
-- 8. EXPENSE BREAKDOWN BY CATEGORY
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION finance_expense_breakdown(
  p_agency UUID, p_from DATE, p_to DATE
)
RETURNS TABLE (
  category_id UUID, category_name TEXT, cost_type TEXT, color TEXT,
  currency TEXT, total NUMERIC, share_percent NUMERIC, item_count BIGINT
) AS $$
  WITH e AS (
    SELECT t.category_id, COALESCE(c.name,'Uncategorised') AS cname,
           COALESCE(c.cost_type,'variable') AS ctype,
           COALESCE(c.color,'#64748B') AS color,
           t.currency, t.amount
      FROM finance_transactions t
      LEFT JOIN finance_categories c ON c.id = t.category_id
     WHERE t.agency_id = p_agency AND t.type='expense'
       AND t.deleted_at IS NULL AND t.status NOT IN ('cancelled','draft')
       AND t.transaction_date BETWEEN p_from AND p_to
  ),
  totals AS (SELECT currency, SUM(amount) AS grand FROM e GROUP BY currency)
  SELECT e.category_id, e.cname, e.ctype, e.color, e.currency,
         SUM(e.amount) AS total,
         CASE WHEN t.grand > 0 THEN ROUND((SUM(e.amount)/t.grand)*100, 2) ELSE 0 END,
         COUNT(*)
    FROM e JOIN totals t ON t.currency = e.currency
   GROUP BY e.category_id, e.cname, e.ctype, e.color, e.currency, t.grand
   ORDER BY total DESC;
$$ LANGUAGE SQL STABLE;

-- ─────────────────────────────────────────────────────────────
-- 9. ACCOUNT BALANCES — derived, never stored
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION finance_account_balances(p_agency UUID)
RETURNS TABLE (
  account_id UUID, account_name TEXT, type TEXT, currency TEXT,
  opening_balance NUMERIC, inflow NUMERIC, outflow NUMERIC, current_balance NUMERIC
) AS $$
  SELECT
    a.id, a.name, a.type, a.currency, a.opening_balance,
    COALESCE(SUM(CASE WHEN t.type='income'  THEN t.amount_paid END),0) AS inflow,
    COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount_paid END),0) AS outflow,
    a.opening_balance
      + COALESCE(SUM(CASE WHEN t.type='income'  THEN t.amount_paid END),0)
      - COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount_paid END),0) AS current_balance
  FROM finance_accounts a
  LEFT JOIN finance_transactions t
    ON t.account_id = a.id AND t.deleted_at IS NULL AND t.status NOT IN ('cancelled','draft')
  WHERE a.agency_id = p_agency AND a.status = 'active'
  GROUP BY a.id, a.name, a.type, a.currency, a.opening_balance
  ORDER BY a.name;
$$ LANGUAGE SQL STABLE;

-- ─────────────────────────────────────────────────────────────
-- 10. BREAK-EVEN / BURN / RUNWAY
--     Returns has_sufficient_data=false rather than a misleading number when
--     there is not enough history. The UI must respect that flag.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION finance_break_even(p_agency UUID, p_currency TEXT DEFAULT 'EGP')
RETURNS TABLE (
  currency TEXT,
  monthly_fixed_cost NUMERIC,
  monthly_payroll NUMERIC,
  avg_monthly_revenue NUMERIC,
  committed_mrr NUMERIC,
  break_even_revenue NUMERIC,
  gap_to_break_even NUMERIC,
  coverage_percent NUMERIC,
  avg_monthly_burn NUMERIC,
  cash_available NUMERIC,
  runway_months NUMERIC,
  months_of_history INT,
  has_sufficient_data BOOLEAN
) AS $$
  WITH hist AS (
    SELECT DATE_TRUNC('month', transaction_date) AS m,
           SUM(CASE WHEN type='income'  THEN amount_paid ELSE 0 END) AS rev,
           SUM(CASE WHEN type='expense' THEN amount_paid ELSE 0 END) AS exp
      FROM finance_transactions
     WHERE agency_id = p_agency AND currency = p_currency
       AND deleted_at IS NULL AND status NOT IN ('cancelled','draft')
       AND transaction_date >= (CURRENT_DATE - INTERVAL '6 months')
     GROUP BY 1
  ),
  fixed AS (
    SELECT COALESCE(SUM(r.amount),0) AS fixed_recurring
      FROM recurring_expenses r
     WHERE r.agency_id = p_agency AND r.status='active' AND r.currency = p_currency
  ),
  pay AS (
    SELECT COALESCE(SUM(c.base_salary + c.allowances_default - c.deductions_default),0) AS payroll
      FROM employee_compensation c
     WHERE c.agency_id = p_agency AND c.status='active' AND c.currency = p_currency
  ),
  mrr AS (
    SELECT COALESCE(SUM(m.mrr),0) AS committed FROM finance_mrr(p_agency) m
     WHERE m.currency = p_currency
  ),
  cash AS (
    SELECT COALESCE(SUM(b.current_balance),0) AS available
      FROM finance_account_balances(p_agency) b WHERE b.currency = p_currency
  ),
  stats AS (
    SELECT COUNT(*)::INT AS months,
           COALESCE(AVG(rev),0) AS avg_rev,
           COALESCE(AVG(exp - rev),0) AS avg_burn
      FROM hist
  )
  SELECT
    p_currency,
    f.fixed_recurring + p.payroll,
    p.payroll,
    ROUND(s.avg_rev, 2),
    m.committed,
    f.fixed_recurring + p.payroll                                  AS break_even_revenue,
    GREATEST((f.fixed_recurring + p.payroll) - m.committed, 0)     AS gap_to_break_even,
    CASE WHEN (f.fixed_recurring + p.payroll) > 0
         THEN ROUND((m.committed / (f.fixed_recurring + p.payroll)) * 100, 2)
         ELSE 0 END                                                AS coverage_percent,
    ROUND(GREATEST(s.avg_burn, 0), 2)                              AS avg_monthly_burn,
    c.available,
    CASE WHEN s.avg_burn > 0 THEN ROUND(c.available / s.avg_burn, 1) ELSE NULL END,
    s.months,
    -- Need at least two months of history AND a known fixed cost base.
    (s.months >= 2 AND (f.fixed_recurring + p.payroll) > 0)
  FROM fixed f, pay p, mrr m, cash c, stats s;
$$ LANGUAGE SQL STABLE;

-- ─────────────────────────────────────────────────────────────
-- 11. FORECAST — committed vs projected, clearly separated
--     "Committed" = scheduled subscription cycles + already-booked expenses.
--     "Projected" = trailing 3-month average for everything else.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION finance_forecast(
  p_agency UUID, p_months INT DEFAULT 6, p_currency TEXT DEFAULT 'EGP'
)
RETURNS TABLE (
  month_start DATE,
  committed_revenue NUMERIC,
  projected_revenue NUMERIC,
  committed_expenses NUMERIC,
  projected_expenses NUMERIC,
  expected_net NUMERIC,
  is_actual BOOLEAN
) AS $$
  WITH months AS (
    SELECT (DATE_TRUNC('month', CURRENT_DATE) + (n || ' months')::INTERVAL)::DATE AS m
      FROM generate_series(0, GREATEST(p_months - 1, 0)) n
  ),
  baseline AS (
    SELECT
      COALESCE(AVG(rev),0) AS avg_rev,
      COALESCE(AVG(exp),0) AS avg_exp
    FROM (
      SELECT DATE_TRUNC('month', transaction_date) AS mm,
             SUM(CASE WHEN type='income'  THEN amount_paid ELSE 0 END) AS rev,
             SUM(CASE WHEN type='expense' THEN amount_paid ELSE 0 END) AS exp
        FROM finance_transactions
       WHERE agency_id = p_agency AND currency = p_currency
         AND deleted_at IS NULL AND status NOT IN ('cancelled','draft')
         AND transaction_date >= (CURRENT_DATE - INTERVAL '3 months')
         AND transaction_date <  DATE_TRUNC('month', CURRENT_DATE)
       GROUP BY 1
    ) h
  ),
  committed AS (
    SELECT DATE_TRUNC('month', c.due_date)::DATE AS m,
           SUM(c.amount - c.amount_paid) AS rev
      FROM subscription_cycles c
     WHERE c.agency_id = p_agency AND c.currency = p_currency
       AND c.status IN ('expected','invoiced','partially_paid','overdue')
     GROUP BY 1
  ),
  booked_exp AS (
    SELECT DATE_TRUNC('month', COALESCE(t.due_date, t.transaction_date))::DATE AS m,
           SUM(t.amount - t.amount_paid) AS exp
      FROM finance_transactions t
     WHERE t.agency_id = p_agency AND t.currency = p_currency
       AND t.type='expense' AND t.deleted_at IS NULL
       AND t.status IN ('expected','pending','approved','overdue','partially_paid')
     GROUP BY 1
  )
  SELECT
    mo.m,
    COALESCE(cm.rev, 0),
    GREATEST(ROUND(b.avg_rev, 2) - COALESCE(cm.rev, 0), 0) AS projected_revenue,
    COALESCE(be.exp, 0),
    GREATEST(ROUND(b.avg_exp, 2) - COALESCE(be.exp, 0), 0) AS projected_expenses,
    (COALESCE(cm.rev,0) + GREATEST(ROUND(b.avg_rev,2) - COALESCE(cm.rev,0), 0))
      - (COALESCE(be.exp,0) + GREATEST(ROUND(b.avg_exp,2) - COALESCE(be.exp,0), 0)) AS expected_net,
    FALSE AS is_actual
  FROM months mo
  CROSS JOIN baseline b
  LEFT JOIN committed  cm ON cm.m = mo.m
  LEFT JOIN booked_exp be ON be.m = mo.m
  ORDER BY mo.m;
$$ LANGUAGE SQL STABLE;

-- ─────────────────────────────────────────────────────────────
-- 12. UPCOMING MONEY — next N days, in and out
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION finance_upcoming(p_agency UUID, p_days INT DEFAULT 30)
RETURNS TABLE (
  kind TEXT, id UUID, title TEXT, client_name TEXT,
  amount NUMERIC, currency TEXT, due_date DATE, days_until INT, status TEXT
) AS $$
  SELECT 'income'::TEXT, t.id, t.title, c.name,
         t.amount - t.amount_paid, t.currency, t.due_date,
         (t.due_date - CURRENT_DATE)::INT, t.status
    FROM finance_transactions t
    LEFT JOIN clients c ON c.id = t.client_id
   WHERE t.agency_id = p_agency AND t.type='income'
     AND t.deleted_at IS NULL AND t.amount_paid < t.amount
     AND t.status NOT IN ('cancelled','draft','refunded')
     AND t.due_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE + p_days
  UNION ALL
  SELECT 'expense'::TEXT, t.id, t.title, NULL,
         t.amount - t.amount_paid, t.currency, COALESCE(t.due_date, t.transaction_date),
         (COALESCE(t.due_date, t.transaction_date) - CURRENT_DATE)::INT, t.status
    FROM finance_transactions t
   WHERE t.agency_id = p_agency AND t.type='expense'
     AND t.deleted_at IS NULL AND t.amount_paid < t.amount
     AND t.status NOT IN ('cancelled','draft','refunded')
     AND COALESCE(t.due_date, t.transaction_date) BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE + p_days
  ORDER BY 7;
$$ LANGUAGE SQL STABLE;

COMMIT;
