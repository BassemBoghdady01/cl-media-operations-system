-- ============================================================================
-- Regression test — Partners & Profits (exact allocation, advances, payouts)
--
-- Runs entirely inside ONE transaction that always ends in an exception, so
-- NOTHING is ever saved — safe to run against any database that has
-- migrations 011–017. Set the two settings first (a super_admin and their
-- agency), e.g. in the SQL editor:
--   SELECT set_config('test.user',   '<super-admin profile id>', false),
--          set_config('test.agency', '<agency id>', false);
-- Result: an error reading "ALL PARTNER TESTS PASSED (rolled back)" or
-- "PARTNER TEST FAILED: …".
-- ============================================================================
DO $T$
DECLARE
  U UUID := current_setting('test.user')::UUID;
  A UUID := current_setting('test.agency')::UUID;
  b UUID; g UUID; m1 UUID; m2 UUID; m3 UUID; d1 UUID; d4 UUID; d5 UUID; d6 UUID;
  n INT; x NUMERIC; s TEXT;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', U, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', U::text, true);
  SET LOCAL ROLE authenticated;

  -- Ownership in exact units: founder 1, Capital 2; three members 1 each
  INSERT INTO partners(agency_id,kind,name,share_percent,share_units) VALUES (A,'individual','T-Founder',0,1) RETURNING id INTO b;
  INSERT INTO partners(agency_id,kind,name,share_percent,share_units) VALUES (A,'group','T-Capital',0,2) RETURNING id INTO g;
  INSERT INTO partners(agency_id,kind,name,parent_id,share_percent,share_units) VALUES (A,'individual','T-M1',g,0,1) RETURNING id INTO m1;
  INSERT INTO partners(agency_id,kind,name,parent_id,share_percent,share_units) VALUES (A,'individual','T-M2',g,0,1) RETURNING id INTO m2;
  INSERT INTO partners(agency_id,kind,name,parent_id,share_percent,share_units) VALUES (A,'individual','T-M3',g,0,1) RETURNING id INTO m3;

  SELECT share_percent INTO x FROM partners WHERE id = b;
  IF x <> 33.3333 THEN RAISE EXCEPTION 'PARTNER TEST FAILED: synced %% = %', x; END IF;
  IF EXISTS (SELECT 1 FROM partner_structure_issues(A)) THEN RAISE EXCEPTION 'PARTNER TEST FAILED: structure issues'; END IF;

  -- E10 rounding remainder → lines sum exactly; extra cent to largest remainder
  d1 := create_profit_distribution(A,'2030-01-01','2030-01-31','EGP',0,1000.00,'T1',NULL);
  SELECT SUM(amount) INTO x FROM profit_distribution_lines WHERE distribution_id = d1;
  IF x <> 1000.00 THEN RAISE EXCEPTION 'PARTNER TEST FAILED: 1000 allocated as %', x; END IF;
  SELECT amount INTO x FROM profit_distribution_lines WHERE distribution_id = d1 AND partner_id = b;
  IF x <> 333.34 THEN RAISE EXCEPTION 'PARTNER TEST FAILED: founder line %', x; END IF;
  PERFORM 1 FROM profit_distribution_lines WHERE distribution_id = d1 AND partner_id IN (m1,m2,m3) AND amount <> 222.22;
  IF FOUND THEN RAISE EXCEPTION 'PARTNER TEST FAILED: member line not 222.22'; END IF;
  PERFORM create_profit_distribution(A,'2030-02-01','2030-02-28','EGP',0,0.05,'T2',NULL);
  SELECT SUM(l.amount) INTO x FROM profit_distribution_lines l JOIN profit_distributions d ON d.id = l.distribution_id WHERE d.title = 'T2' AND d.agency_id = A;
  IF x <> 0.05 THEN RAISE EXCEPTION 'PARTNER TEST FAILED: 0.05 allocated as %', x; END IF;

  -- E6 same period twice
  BEGIN
    PERFORM create_profit_distribution(A,'2030-01-01','2030-01-31','EGP',0,500,'dup',NULL);
    RAISE EXCEPTION 'PARTNER TEST FAILED: duplicate distribution allowed';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- E4 no profit → nothing distributable, never negative
  PERFORM create_profit_distribution(A,'2031-03-01','2031-03-31','EGP',0,NULL,'T3',NULL);
  SELECT distributable_amount INTO x FROM profit_distributions WHERE title = 'T3' AND agency_id = A;
  IF x < 0 THEN RAISE EXCEPTION 'PARTNER TEST FAILED: negative distributable'; END IF;

  -- E9 reserve out of range rejected
  BEGIN
    PERFORM create_profit_distribution(A,'2031-04-01','2031-04-30','EGP',150,NULL,'bad',NULL);
    RAISE EXCEPTION 'PARTNER TEST FAILED: reserve 150%% accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'PARTNER TEST FAILED%' THEN RAISE; END IF;
  END;

  -- E1 advance smaller than share (M1 100) / E2 larger (M2 500)
  INSERT INTO partner_transactions(agency_id,partner_id,type,amount,currency,transaction_date) VALUES (A,m1,'drawing',100,'EGP','2030-01-15');
  INSERT INTO partner_transactions(agency_id,partner_id,type,amount,currency,transaction_date) VALUES (A,m2,'drawing',500,'EGP','2030-01-15');

  -- E5 approved but not paid → no money moved
  PERFORM approve_profit_distribution(d1);
  SELECT COUNT(*) INTO n FROM partner_transactions WHERE distribution_id = d1;
  IF n <> 0 THEN RAISE EXCEPTION 'PARTNER TEST FAILED: approval moved money'; END IF;

  PERFORM pay_profit_distribution(d1, NULL, 'bank_transfer', '2030-02-05');
  SELECT amount INTO x FROM partner_transactions WHERE distribution_id = d1 AND partner_id = m1 AND type = 'profit_payout';
  IF x <> 122.22 THEN RAISE EXCEPTION 'PARTNER TEST FAILED: M1 cash %', x; END IF;
  IF EXISTS (SELECT 1 FROM partner_transactions WHERE distribution_id = d1 AND partner_id = m2 AND type = 'profit_payout') THEN
    RAISE EXCEPTION 'PARTNER TEST FAILED: M2 got cash while owing an advance';
  END IF;
  IF partner_open_advance(m2,'EGP') <> 277.78 THEN RAISE EXCEPTION 'PARTNER TEST FAILED: M2 open advance'; END IF;

  -- E7 retry → rejected, no duplicate postings
  SELECT COUNT(*) INTO n FROM partner_transactions WHERE distribution_id = d1;
  BEGIN
    PERFORM pay_profit_distribution(d1, NULL, 'bank_transfer', '2030-02-05');
    RAISE EXCEPTION 'PARTNER TEST FAILED: retry paid twice';
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'PARTNER TEST FAILED%' THEN RAISE; END IF;
  END;
  IF (SELECT COUNT(*) FROM partner_transactions WHERE distribution_id = d1) <> n THEN
    RAISE EXCEPTION 'PARTNER TEST FAILED: retry created postings';
  END IF;

  -- E3 recovery over several months, never more than the advance
  d4 := create_profit_distribution(A,'2030-03-01','2030-03-31','EGP',0,1000.00,'T4',NULL);
  PERFORM approve_profit_distribution(d4); PERFORM pay_profit_distribution(d4, NULL, 'bank_transfer', '2030-04-05');
  d5 := create_profit_distribution(A,'2030-05-01','2030-05-31','EGP',0,1000.00,'T5',NULL);
  PERFORM approve_profit_distribution(d5); PERFORM pay_profit_distribution(d5, NULL, 'bank_transfer', '2030-06-05');
  SELECT SUM(amount) INTO x FROM partner_transactions WHERE partner_id = m2 AND type = 'advance_offset';
  IF x <> 500.00 THEN RAISE EXCEPTION 'PARTNER TEST FAILED: M2 recovered % (expected exactly 500)', x; END IF;
  IF partner_open_advance(m2,'EGP') <> 0 THEN RAISE EXCEPTION 'PARTNER TEST FAILED: M2 advance not closed'; END IF;

  -- No zero/negative postings; balances all settled
  IF EXISTS (SELECT 1 FROM partner_transactions WHERE agency_id = A AND amount <= 0) THEN RAISE EXCEPTION 'PARTNER TEST FAILED: non-positive posting'; END IF;
  IF EXISTS (SELECT 1 FROM partner_balances(A) WHERE partner_id IN (b,m1,m2,m3) AND balance_due <> 0) THEN
    RAISE EXCEPTION 'PARTNER TEST FAILED: balances not settled';
  END IF;

  -- Over-payout rejected
  d6 := create_profit_distribution(A,'2030-07-01','2030-07-31','EGP',0,90.00,'T6',NULL);
  PERFORM approve_profit_distribution(d6);
  BEGIN
    INSERT INTO partner_transactions(agency_id,partner_id,type,amount,currency,distribution_id) VALUES (A,b,'profit_payout',50,'EGP',d6);
    RAISE EXCEPTION 'PARTNER TEST FAILED: over-payout allowed';
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'PARTNER TEST FAILED%' THEN RAISE; END IF;
  END;

  -- Audit trail written
  IF NOT EXISTS (SELECT 1 FROM audit_logs WHERE entity_type = 'partner_transactions' AND created_at >= now()) THEN
    RAISE EXCEPTION 'PARTNER TEST FAILED: no audit rows';
  END IF;

  RAISE EXCEPTION 'ALL PARTNER TESTS PASSED (rolled back)';
END $T$;
