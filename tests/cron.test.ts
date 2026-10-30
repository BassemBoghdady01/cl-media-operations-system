/**
 * Regression tests — cron endpoint authorization and the billing kill switch.
 * No network and no database: with BILLING_CRON_ENABLED unset the handler
 * returns before creating a Supabase client.
 */
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/cron/finance-reminders.ts'

function call(req: { method?: string; headers?: Record<string, string>; query?: Record<string, string> }) {
  let status = 0
  let body: any = null
  const res = {
    status(code: number) { status = code; return res },
    json(b: unknown) { body = b },
  }
  return handler({ method: req.method ?? 'GET', headers: req.headers ?? {}, query: req.query ?? {} }, res as any)
    .then(() => ({ status, body }))
}

const SECRET = 'test-only-secret-value-0123456789abcdef'

beforeEach(() => {
  process.env.CRON_SECRET = SECRET
  delete process.env.BILLING_CRON_ENABLED
  process.env.VITE_SUPABASE_URL = 'https://example.invalid'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-real-key'
})

test('rejects other HTTP methods', async () => {
  assert.equal((await call({ method: 'PUT' })).status, 405)
})

test('fails closed when CRON_SECRET is not configured', async () => {
  delete process.env.CRON_SECRET
  assert.equal((await call({ headers: { authorization: `Bearer ${SECRET}` } })).status, 500)
})

test('rejects a missing or wrong secret', async () => {
  assert.equal((await call({})).status, 401)
  assert.equal((await call({ headers: { authorization: 'Bearer wrong' } })).status, 401)
})

test('does not accept the secret in the URL', async () => {
  assert.equal((await call({ query: { secret: SECRET } })).status, 401)
})

test('authorized call is a non-financial safe check while billing is disabled', async () => {
  const r = await call({ headers: { authorization: `Bearer ${SECRET}` } })
  assert.equal(r.status, 200)
  assert.equal(r.body.mode, 'safe-check')
  assert.equal(r.body.authorized, true)
  assert.equal(r.body.serverKeyConfigured, true)
})

test('only the exact value "true" enables billing', async () => {
  process.env.BILLING_CRON_ENABLED = 'yes'
  const r = await call({ headers: { authorization: `Bearer ${SECRET}` } })
  assert.equal(r.body.mode, 'safe-check')
})
