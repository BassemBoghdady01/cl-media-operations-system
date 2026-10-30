-- ============================================================================
-- EZ Marketing Agency — 017 · Exact ownership & exact profit allocation
-- RUN AFTER: 016_last_super_admin_guard.sql
--
-- WHY
--   Ownership was stored only as 4-decimal percentages. One third cannot be
--   written exactly that way (33.3333 + 3 × 22.2222 = 99.9999), and the old
--   allocator rounded every line and pushed the whole leftover onto the
--   largest holder — a small but systematic bias.
--
-- WHAT
--   1. OWNERSHIP UNITS (optional, exact): partners.share_units. When every
--      active partner at one level (the company's direct holders, or the
--      members of one group) has units, the split at that level is
--      units / total units — exact for any fraction (you 1 : Capital 2 is
--      exactly ⅓ : ⅔; three members 1 : 1 : 1 are exactly ⅓ each).
--      share_percent is kept in sync automatically as a 4-dp display value.
--      Without units, percentages are used and must total exactly 100.
--   2. EXACT ALLOCATION (largest-remainder / Hamilton, in cents):
--      every partner first gets FLOOR(amount_cents × exact weight); the few
--      cents left over go one each to the largest fractional remainders.
--      Ties → larger ownership weight → partner created first → id.
--      The lines always sum to exactly the distributable amount, no line is
--      ever negative, and no holder is favoured by rounding.
--   3. The percentage tolerance is tightened from ±0.05 to exact (±0.0001),
--      so an ownership table can no longer be silently "normalised".
--
-- SAFETY: one nullable column, one sync trigger, CREATE OR REPLACE of four
-- functions (same signatures). No data changed; no partners exist yet.
-- ============================================================================

ALTER TABLE partners ADD COLUMN IF NOT EXISTS share_units NUMERIC(18,6)
  CHECK (share_units IS NULL OR share_units > 0);

COMMENT ON COLUMN partners.share_units IS
  'Optional exact ownership units. When all active siblings have units, the split at that level is units/sum(units); share_percent is then a synced display value.';

-- ─── Exact weight of each sibling within its level (unrounded) ─────────────
CREATE OR REPLACE FUNCTION partner_level_weights(p_agency UUID)
RETURNS TABLE (partner_id UUID, parent_id UUID, weight NUMERIC, uses_units BOOLEAN) AS $$
  WITH act AS (
    SELECT p.id, p.parent_id, p.share_percent, p.share_units
      FROM partners p
     WHERE p.agency_id = p_agency AND p.status = 'active'
  ), lvl AS (
    SELECT parent_id,
           BOOL_AND(share_units IS NOT NULL) AS uses_units,
           SUM(share_units)   AS units_total,
           SUM(share_percent) AS pct_total
      FROM act GROUP BY parent_id
  )
  SELECT a.id, a.parent_id,
         CASE
           WHEN l.uses_units AND l.units_total > 0 THEN a.share_units / l.units_total
           WHEN l.pct_total > 0 THEN a.share_percent / l.pct_total  -- totals are validated to be exactly 100
           ELSE 0
         END,
         l.uses_units
    FROM act a
    JOIN lvl l ON l.parent_id IS NOT DISTINCT FROM a.parent_id;
$$ LANGUAGE SQL STABLE;

-- ─── Effective ownership of each share-holding leaf ────────────────────────
-- Same signature as before; effective_percent is now derived from the exact
-- weights (rounded to 4 dp for display only). exact weight = effective/100
-- is recomputed by the allocator, never read back from this rounded value.
CREATE OR REPLACE FUNCTION partner_effective_shares(p_agency UUID)
RETURNS TABLE (
  partner_id UUID, name TEXT, group_id UUID, group_name TEXT,
  own_share NUMERIC, effective_percent NUMERIC
) AS $$
  SELECT p.id, p.name, g.id, g.name, p.share_percent,
         ROUND(100 * w.weight * COALESCE(gw.weight, 1), 4)
    FROM partners p
    JOIN partner_level_weights(p_agency) w ON w.partner_id = p.id
    LEFT JOIN partners g ON g.id = p.parent_id
    LEFT JOIN partner_level_weights(p_agency) gw ON gw.partner_id = g.id
   WHERE p.agency_id = p_agency
     AND p.status = 'active'
     AND (g.id IS NULL OR g.status = 'active')
     AND NOT (p.kind = 'group' AND EXISTS (
           SELECT 1 FROM partners c WHERE c.parent_id = p.id AND c.status = 'active'))
   ORDER BY 6 DESC, 2;
$$ LANGUAGE SQL STABLE;

-- ─── Ownership table problems (empty = valid) ──────────────────────────────
CREATE OR REPLACE FUNCTION partner_structure_issues(p_agency UUID)
RETURNS TABLE (issue TEXT) AS $$
  WITH act AS (
    SELECT * FROM partners WHERE agency_id = p_agency AND status = 'active'
  ), top AS (
    SELECT COALESCE(SUM(share_percent),0) AS total,
           COUNT(*) AS n,
           COALESCE(BOOL_AND(share_units IS NOT NULL), FALSE) AS uses_units,
           COUNT(*) FILTER (WHERE share_units IS NOT NULL) AS with_units
      FROM act WHERE parent_id IS NULL
  ), grp AS (
    SELECT g.name,
           COALESCE(SUM(m.share_percent),0) AS total,
           COUNT(m.id) AS members,
           COALESCE(BOOL_AND(m.share_units IS NOT NULL), FALSE) AS uses_units,
           COUNT(m.id) FILTER (WHERE m.share_units IS NOT NULL) AS with_units
      FROM act g
      LEFT JOIN act m ON m.parent_id = g.id
     WHERE g.kind = 'group'
     GROUP BY g.id, g.name
  )
  SELECT 'Company shares add up to ' || TRIM(TO_CHAR(total, 'FM990.0999')) || '% — they must total exactly 100% (or give every direct partner ownership units).'
    FROM top WHERE n > 0 AND NOT uses_units AND ABS(total - 100) > 0.0001
  UNION ALL
  SELECT 'Some direct partners have ownership units and some do not — use units for all of them or for none.'
    FROM top WHERE with_units > 0 AND NOT uses_units
  UNION ALL
  SELECT 'Members of "' || name || '" add up to ' || TRIM(TO_CHAR(total, 'FM990.0999')) || '% of the group — they must total exactly 100% (or give every member ownership units).'
    FROM grp WHERE members > 0 AND NOT uses_units AND ABS(total - 100) > 0.0001
  UNION ALL
  SELECT 'Some members of "' || name || '" have ownership units and some do not — use units for all of them or for none.'
    FROM grp WHERE with_units > 0 AND NOT uses_units;
$$ LANGUAGE SQL STABLE;

-- ─── Keep share_percent in sync for levels that use units ──────────────────
CREATE OR REPLACE FUNCTION partners_sync_unit_percents()
RETURNS TRIGGER AS $$
DECLARE
  v_agency UUID := COALESCE(NEW.agency_id, OLD.agency_id);
  v_parent UUID;
BEGIN
  -- Re-sync the level the row is in now, and the level it left (if moved).
  -- (UNNEST keeps a NULL element, so the direct-partner level is included.)
  FOR v_parent IN
    SELECT DISTINCT x FROM UNNEST(ARRAY[
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.parent_id END,
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.parent_id END]) x
  LOOP
    UPDATE partners p
       SET share_percent = ROUND(100 * w.weight, 4)
      FROM partner_level_weights(v_agency) w
     WHERE w.partner_id = p.id
       AND w.uses_units
       AND p.parent_id IS NOT DISTINCT FROM v_parent
       AND p.share_percent IS DISTINCT FROM ROUND(100 * w.weight, 4);
  END LOOP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS partners_sync_unit_percents ON partners;
CREATE TRIGGER partners_sync_unit_percents
  AFTER INSERT OR DELETE OR UPDATE OF share_units, parent_id, status ON partners
  FOR EACH ROW EXECUTE FUNCTION partners_sync_unit_percents();

-- ─── Distribution: exact largest-remainder allocation ──────────────────────
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
  v_cents BIGINT;
  v_leaves INTEGER;
  v_check NUMERIC;
BEGIN
  IF p_agency IS DISTINCT FROM get_my_agency_id() OR NOT has_permission('partners.manage') THEN
    RAISE EXCEPTION 'You do not have permission to create profit distributions.';
  END IF;
  IF p_to < p_from THEN RAISE EXCEPTION 'The period end must be after its start.'; END IF;
  IF p_reserve_percent IS NOT NULL AND (p_reserve_percent < 0 OR p_reserve_percent > 100) THEN
    RAISE EXCEPTION 'The reserve must be between 0%% and 100%%.';
  END IF;
  IF EXISTS (SELECT 1 FROM partner_structure_issues(p_agency)) THEN
    RAISE EXCEPTION 'Fix the ownership table first: %', (SELECT string_agg(issue, ' ') FROM partner_structure_issues(p_agency));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM partners WHERE agency_id = p_agency AND parent_id IS NULL AND status = 'active') THEN
    RAISE EXCEPTION 'Add the partners and their shares first.';
  END IF;

  SELECT s.revenue_collected, s.expenses_paid, s.net_profit
    INTO v_rev, v_exp, v_net
    FROM finance_summary(p_agency, p_from, p_to) s WHERE s.currency = p_currency;
  v_rev := COALESCE(v_rev, 0); v_exp := COALESCE(v_exp, 0); v_net := COALESCE(v_net, 0);

  IF p_amount_override IS NOT NULL THEN
    IF p_amount_override < 0 THEN RAISE EXCEPTION 'The amount cannot be negative.'; END IF;
    v_dist := ROUND(p_amount_override, 2);
  ELSE
    -- A loss month distributes nothing (never a negative payout).
    v_dist := GREATEST(ROUND(v_net * (1 - COALESCE(p_reserve_percent,0) / 100), 2), 0);
  END IF;
  v_cents := (v_dist * 100)::BIGINT;

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

  WITH leaves AS (
    SELECT p.id AS partner_id, p.created_at,
           w.weight * COALESCE(gw.weight, 1) AS weight
      FROM partners p
      JOIN partner_level_weights(p_agency) w ON w.partner_id = p.id
      LEFT JOIN partners g ON g.id = p.parent_id
      LEFT JOIN partner_level_weights(p_agency) gw ON gw.partner_id = g.id
     WHERE p.agency_id = p_agency AND p.status = 'active'
       AND (g.id IS NULL OR g.status = 'active')
       AND NOT (p.kind = 'group' AND EXISTS (
             SELECT 1 FROM partners c WHERE c.parent_id = p.id AND c.status = 'active'))
  ), base AS (
    SELECT partner_id, created_at, weight,
           FLOOR(v_cents * weight)::BIGINT AS cents,
           v_cents * weight - FLOOR(v_cents * weight) AS frac
      FROM leaves WHERE weight > 0
  ), ranked AS (
    SELECT b.*,
           ROW_NUMBER() OVER (ORDER BY frac DESC, weight DESC, created_at, partner_id) AS rnk,
           v_cents - SUM(cents) OVER () AS leftover
      FROM base b
  )
  INSERT INTO profit_distribution_lines (agency_id, distribution_id, partner_id, share_percent, amount)
  SELECT p_agency, v_id, partner_id, ROUND(100 * weight, 4),
         (cents + CASE WHEN rnk <= leftover THEN 1 ELSE 0 END)::NUMERIC / 100
    FROM ranked;

  GET DIAGNOSTICS v_leaves = ROW_COUNT;
  IF v_leaves = 0 THEN RAISE EXCEPTION 'No partner holds a share — nothing to allocate.'; END IF;

  -- Belt and braces: the lines must add up to the distributable amount exactly.
  SELECT COALESCE(SUM(amount), 0) INTO v_check FROM profit_distribution_lines WHERE distribution_id = v_id;
  IF v_check <> v_dist THEN
    RAISE EXCEPTION 'Allocation mismatch (% vs %) — nothing was saved.', v_check, v_dist;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Status: a single unpaid cent keeps a distribution open ────────────────
-- (was "> 0.01", which marked a distribution paid with 0.01 still owed)
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
                                   AND t.deleted_at IS NULL), 0) > 0
  ) INTO v_open;
  UPDATE profit_distributions
     SET status = CASE WHEN v_open THEN 'approved' ELSE 'paid' END
   WHERE id = p_distribution AND status IN ('approved','paid');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
