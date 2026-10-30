/**
 * Regression tests — currency handling (run: npm test).
 * Guards the EGP-default / never-mix-currencies rules.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BASE_CURRENCY, currencyOf, sumByCurrency, formatMoneyGroups, formatMoneyTotal, formatMoney,
} from '../src/lib/finance.ts'

test('base currency is EGP', () => {
  assert.equal(BASE_CURRENCY, 'EGP')
})

test('a record keeps its own currency; only a missing one falls back to EGP', () => {
  assert.equal(currencyOf({ currency: 'USD' }), 'USD')
  assert.equal(currencyOf({ currency: null }), 'EGP')
  assert.equal(currencyOf({}), 'EGP')
  assert.equal(currencyOf(null), 'EGP')
})

test('amounts in different currencies are never added together', () => {
  const rows = [
    { a: 10000, c: 'EGP' }, { a: 200, c: 'USD' }, { a: 0.1, c: 'EGP' }, { a: 0.2, c: 'EGP' }, { a: 5, c: undefined },
  ]
  const groups = sumByCurrency(rows, (r) => r.a, (r) => r.c)
  assert.deepEqual(groups.map((g) => g.currency), ['EGP', 'USD'])
  assert.equal(groups[0].amount, 10005.3) // float noise (0.1 + 0.2) rounded to cents
  assert.equal(groups[1].amount, 200)
  assert.match(formatMoneyGroups(groups).replace(/\s/g, ' '), /EGP 10,005\.30 · USD 200/)
})

test('an empty list shows EGP 0, not $0', () => {
  const out = formatMoneyTotal([] as { a: number }[], (r) => r.a, () => undefined)
  assert.match(out, /EGP/)
  assert.doesNotMatch(out, /\$/)
})

test('fractions always show two decimals', () => {
  assert.match(formatMoney(10.5, 'EGP'), /10\.50/)
})

test('foreign records show their currency code, never a bare "$"', () => {
  const usd = formatMoney(10000, 'USD').replace(/\s/g, ' ')
  assert.match(usd, /USD/)
  assert.doesNotMatch(usd, /\$/)
  assert.match(formatMoney(10000).replace(/\s/g, ' '), /^EGP 10,000$/)
})
