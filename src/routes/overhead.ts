import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const overhead = new Hono<{ Bindings: Bindings }>()

// --- FIXED OVERHEAD ---

overhead.get('/fixed', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM overhead_fixed ORDER BY id ASC'
  ).all()
  return c.json(results)
})

overhead.post('/fixed', async (c) => {
  const body = await c.req.json()
  const result = await c.env.DB.prepare(
    'INSERT INTO overhead_fixed (name, amount, active, notes) VALUES (?, ?, ?, ?)'
  ).bind(body.name, body.amount ?? 0, body.active ?? 1, body.notes ?? '').run()
  const row = await c.env.DB.prepare(
    'SELECT * FROM overhead_fixed WHERE id = ?'
  ).bind(result.meta.last_row_id).first()
  return c.json(row, 201)
})

overhead.put('/fixed/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE overhead_fixed SET name = ?, amount = ?, active = ?, notes = ? WHERE id = ?'
  ).bind(body.name, body.amount ?? 0, body.active ?? 1, body.notes ?? '', id).run()
  const row = await c.env.DB.prepare(
    'SELECT * FROM overhead_fixed WHERE id = ?'
  ).bind(id).first()
  return c.json(row)
})

overhead.delete('/fixed/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM overhead_fixed WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// --- ONE-TIME OVERHEAD ---

overhead.get('/onetime', async (c) => {
  const month = c.req.query('month')
  if (month) {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM overhead_onetime WHERE month = ? ORDER BY id ASC'
    ).bind(month).all()
    return c.json(results)
  }
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM overhead_onetime ORDER BY month DESC, id ASC'
  ).all()
  return c.json(results)
})

overhead.post('/onetime', async (c) => {
  const body = await c.req.json()
  const result = await c.env.DB.prepare(
    'INSERT INTO overhead_onetime (month, name, amount) VALUES (?, ?, ?)'
  ).bind(body.month, body.name, body.amount ?? 0).run()
  const row = await c.env.DB.prepare(
    'SELECT * FROM overhead_onetime WHERE id = ?'
  ).bind(result.meta.last_row_id).first()
  return c.json(row, 201)
})

overhead.put('/onetime/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE overhead_onetime SET month = ?, name = ?, amount = ? WHERE id = ?'
  ).bind(body.month, body.name, body.amount ?? 0, id).run()
  const row = await c.env.DB.prepare(
    'SELECT * FROM overhead_onetime WHERE id = ?'
  ).bind(id).first()
  return c.json(row)
})

overhead.delete('/onetime/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM overhead_onetime WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// --- SUMMARY: total overhead for a given month (YYYY-MM) ---
overhead.get('/summary/:month', async (c) => {
  const month = c.req.param('month')
  const fixed = await c.env.DB.prepare(
    'SELECT COALESCE(SUM(amount),0) as total FROM overhead_fixed WHERE active = 1'
  ).first<{ total: number }>()
  const onetime = await c.env.DB.prepare(
    'SELECT COALESCE(SUM(amount),0) as total FROM overhead_onetime WHERE month = ?'
  ).bind(month).first<{ total: number }>()
  return c.json({
    month,
    fixed_total: fixed?.total ?? 0,
    onetime_total: onetime?.total ?? 0,
    grand_total: (fixed?.total ?? 0) + (onetime?.total ?? 0)
  })
})

export default overhead
