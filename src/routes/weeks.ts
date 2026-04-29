import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const weeks = new Hono<{ Bindings: Bindings }>()

// GET all weekly entries (for history)
weeks.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM weekly_entries ORDER BY week_start DESC'
  ).all()
  return c.json(results)
})

// GET single entry
weeks.get('/:id', async (c) => {
  const id = c.req.param('id')
  const row = await c.env.DB.prepare(
    'SELECT * FROM weekly_entries WHERE id = ?'
  ).bind(id).first()
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

// POST create new weekly entry
weeks.post('/', async (c) => {
  const body = await c.req.json()
  const result = await c.env.DB.prepare(`
    INSERT INTO weekly_entries
      (week_start, notes, gross_revenue, materials, subcontractors,
       direct_labor_wages, direct_labor_hours,
       indirect_labor_wages, indirect_labor_hours,
       labor_burden, additional_benefits, fixed_overhead_snapshot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.week_start,
    body.notes ?? '',
    body.gross_revenue ?? 0,
    body.materials ?? 0,
    body.subcontractors ?? 0,
    body.direct_labor_wages ?? 0,
    body.direct_labor_hours ?? 0,
    body.indirect_labor_wages ?? 0,
    body.indirect_labor_hours ?? 0,
    body.labor_burden ?? 0,
    body.additional_benefits ?? 0,
    body.fixed_overhead_snapshot ?? 0
  ).run()
  const row = await c.env.DB.prepare(
    'SELECT * FROM weekly_entries WHERE id = ?'
  ).bind(result.meta.last_row_id).first()
  return c.json(row, 201)
})

// PUT update existing entry
weeks.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  await c.env.DB.prepare(`
    UPDATE weekly_entries SET
      week_start = ?,
      notes = ?,
      gross_revenue = ?,
      materials = ?,
      subcontractors = ?,
      direct_labor_wages = ?,
      direct_labor_hours = ?,
      indirect_labor_wages = ?,
      indirect_labor_hours = ?,
      labor_burden = ?,
      additional_benefits = ?,
      fixed_overhead_snapshot = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    body.week_start,
    body.notes ?? '',
    body.gross_revenue ?? 0,
    body.materials ?? 0,
    body.subcontractors ?? 0,
    body.direct_labor_wages ?? 0,
    body.direct_labor_hours ?? 0,
    body.indirect_labor_wages ?? 0,
    body.indirect_labor_hours ?? 0,
    body.labor_burden ?? 0,
    body.additional_benefits ?? 0,
    body.fixed_overhead_snapshot ?? 0,
    id
  ).run()
  const row = await c.env.DB.prepare(
    'SELECT * FROM weekly_entries WHERE id = ?'
  ).bind(id).first()
  return c.json(row)
})

// DELETE entry
weeks.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM weekly_entries WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

export default weeks
