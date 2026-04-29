import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const settings = new Hono<{ Bindings: Bindings }>()

settings.get('/', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM settings WHERE id = 1').first()
  return c.json(row)
})

settings.put('/', async (c) => {
  const body = await c.req.json()
  await c.env.DB.prepare(`
    UPDATE settings SET
      business_name = ?,
      payroll_tax_pct = ?,
      workers_comp_pct = ?,
      fl_reemployment_pct = ?,
      other_burden_pct = ?,
      nr_labor_target = ?,
      gp_pct_target = ?,
      np_target = ?,
      np_pct_target = ?,
      gp_target = ?,
      nr_target = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).bind(
    body.business_name,
    body.payroll_tax_pct,
    body.workers_comp_pct,
    body.fl_reemployment_pct,
    body.other_burden_pct,
    body.nr_labor_target,
    body.gp_pct_target,
    body.np_target,
    body.np_pct_target,
    body.gp_target,
    body.nr_target
  ).run()
  const row = await c.env.DB.prepare('SELECT * FROM settings WHERE id = 1').first()
  return c.json(row)
})

export default settings
