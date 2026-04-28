import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import settingsRoutes from './routes/settings'
import weeksRoutes from './routes/weeks'
import overheadRoutes from './routes/overhead'

type Bindings = { DB: D1Database }

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

// DB init middleware — ensures tables exist on cold start
app.use('/api/*', async (c, next) => {
  await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      business_name TEXT NOT NULL DEFAULT 'NuWave Composites',
      payroll_tax_pct REAL NOT NULL DEFAULT 7.65,
      workers_comp_pct REAL NOT NULL DEFAULT 4.00,
      fl_reemployment_pct REAL NOT NULL DEFAULT 0.50,
      other_burden_pct REAL NOT NULL DEFAULT 0.00,
      nr_labor_target REAL NOT NULL DEFAULT 2.0,
      gp_pct_target REAL NOT NULL DEFAULT 40.0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run()
  await c.env.DB.prepare(`INSERT OR IGNORE INTO settings (id) VALUES (1)`).run()
  await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS weekly_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start DATE NOT NULL UNIQUE,
      notes TEXT,
      gross_revenue REAL NOT NULL DEFAULT 0,
      cogs REAL NOT NULL DEFAULT 0,
      direct_labor_wages REAL NOT NULL DEFAULT 0,
      direct_labor_hours REAL NOT NULL DEFAULT 0,
      indirect_labor_wages REAL NOT NULL DEFAULT 0,
      indirect_labor_hours REAL NOT NULL DEFAULT 0,
      labor_burden REAL NOT NULL DEFAULT 0,
      additional_benefits REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run()
  await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS overhead_fixed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run()
  await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS overhead_onetime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run()
  await next()
})

// API routes
app.route('/api/settings', settingsRoutes)
app.route('/api/weeks', weeksRoutes)
app.route('/api/overhead', overheadRoutes)

// Static assets
app.use('/static/*', serveStatic({ root: './' }))

// SPA fallback — serve index.html for all non-API routes
app.get('*', async (c) => {
  // In Cloudflare Pages, index.html in public/ is served automatically
  // For the worker we return it directly
  return c.html(getHTML())
})

function getHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NuWave Composites KPI Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    /* ===== CSS RESET & BASE ===== */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 16px; }
    body {
      font-family: 'Inter', sans-serif;
      background: #f0f2f5;
      color: #1a1d23;
      min-height: 100vh;
      display: flex;
    }

    /* ===== SIDEBAR ===== */
    #sidebar {
      width: 240px;
      min-height: 100vh;
      background: #1a1d23;
      display: flex;
      flex-direction: column;
      position: fixed;
      left: 0; top: 0; bottom: 0;
      z-index: 100;
      transition: transform 0.3s ease;
    }
    #sidebar .brand {
      padding: 24px 20px 20px;
      border-bottom: 1px solid #2d3139;
    }
    #sidebar .brand h1 {
      font-size: 15px;
      font-weight: 700;
      color: #fff;
      line-height: 1.3;
    }
    #sidebar .brand span {
      font-size: 11px;
      color: #6b7280;
      font-weight: 400;
      display: block;
      margin-top: 2px;
    }
    #sidebar nav {
      flex: 1;
      padding: 12px 0;
    }
    #sidebar nav a {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 20px;
      color: #9ca3af;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      border-radius: 0;
      transition: all 0.15s;
      cursor: pointer;
      border-left: 3px solid transparent;
    }
    #sidebar nav a:hover { background: #22262e; color: #e5e7eb; }
    #sidebar nav a.active {
      background: #22262e;
      color: #4f6ef7;
      border-left-color: #4f6ef7;
    }
    #sidebar nav a i { width: 18px; text-align: center; font-size: 15px; }
    #sidebar .sidebar-footer {
      padding: 16px 20px;
      border-top: 1px solid #2d3139;
      font-size: 12px;
      color: #4b5563;
    }

    /* ===== MAIN CONTENT ===== */
    #main {
      margin-left: 240px;
      flex: 1;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    #topbar {
      background: #fff;
      border-bottom: 1px solid #e5e7eb;
      padding: 0 28px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    #topbar h2 { font-size: 18px; font-weight: 700; color: #111827; }
    #topbar .topbar-right { display: flex; align-items: center; gap: 12px; }
    #mobile-menu-btn {
      display: none;
      background: none;
      border: none;
      font-size: 20px;
      color: #374151;
      cursor: pointer;
    }

    #content { padding: 28px; flex: 1; }

    /* ===== VIEWS ===== */
    .view { display: none; }
    .view.active { display: block; }

    /* ===== KPI CARDS ===== */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .kpi-card {
      background: #fff;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #e5e7eb;
      position: relative;
      overflow: hidden;
    }
    .kpi-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: #e5e7eb;
    }
    .kpi-card.green::before { background: #10b981; }
    .kpi-card.yellow::before { background: #f59e0b; }
    .kpi-card.red::before { background: #ef4444; }
    .kpi-card.blue::before { background: #4f6ef7; }
    .kpi-card .label {
      font-size: 11px;
      font-weight: 600;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
    .kpi-card .value {
      font-size: 26px;
      font-weight: 800;
      color: #111827;
      line-height: 1.1;
    }
    .kpi-card .sub {
      font-size: 12px;
      color: #6b7280;
      margin-top: 4px;
    }
    .kpi-card .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 999px;
      margin-top: 8px;
    }
    .badge.green { background: #d1fae5; color: #065f46; }
    .badge.yellow { background: #fef3c7; color: #92400e; }
    .badge.red { background: #fee2e2; color: #991b1b; }
    .badge.blue { background: #dbeafe; color: #1d4ed8; }

    /* ===== WEEK PILLS ===== */
    .week-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 20px;
    }
    .week-pill {
      padding: 6px 14px;
      border-radius: 999px;
      border: 1.5px solid #e5e7eb;
      background: #fff;
      font-size: 13px;
      font-weight: 500;
      color: #6b7280;
      cursor: pointer;
      transition: all 0.15s;
    }
    .week-pill:hover { border-color: #4f6ef7; color: #4f6ef7; }
    .week-pill.active {
      background: #4f6ef7;
      border-color: #4f6ef7;
      color: #fff;
    }

    /* ===== CHARTS ===== */
    .charts-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 24px;
    }
    .chart-card {
      background: #fff;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #e5e7eb;
    }
    .chart-card h3 {
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .chart-card canvas { max-height: 220px; }

    /* ===== FORMS ===== */
    .card {
      background: #fff;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      padding: 24px;
      margin-bottom: 20px;
    }
    .card h3 {
      font-size: 15px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 18px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .card h3 i { color: #4f6ef7; }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .form-group.full { grid-column: 1 / -1; }
    .form-group label {
      font-size: 12px;
      font-weight: 600;
      color: #374151;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .form-group input,
    .form-group textarea,
    .form-group select {
      padding: 9px 12px;
      border: 1.5px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      color: #111827;
      background: #fff;
      transition: border-color 0.15s;
      outline: none;
    }
    .form-group input:focus,
    .form-group textarea:focus,
    .form-group select:focus {
      border-color: #4f6ef7;
      box-shadow: 0 0 0 3px rgba(79,110,247,0.1);
    }
    .form-group textarea { resize: vertical; min-height: 72px; }
    .form-divider {
      grid-column: 1 / -1;
      height: 1px;
      background: #f3f4f6;
      margin: 4px 0;
    }
    .form-section-label {
      grid-column: 1 / -1;
      font-size: 11px;
      font-weight: 700;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding-top: 4px;
    }
    .calculated-field {
      padding: 9px 12px;
      border: 1.5px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      background: #f9fafb;
      color: #374151;
      font-weight: 600;
    }

    /* ===== LIVE KPI PREVIEW ===== */
    #kpi-preview {
      background: linear-gradient(135deg, #1a1d23 0%, #22262e 100%);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }
    #kpi-preview h3 {
      color: #9ca3af;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 16px;
    }
    .preview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 12px;
    }
    .preview-item .plabel {
      font-size: 10px;
      color: #6b7280;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 4px;
    }
    .preview-item .pvalue {
      font-size: 20px;
      font-weight: 800;
      color: #fff;
    }
    .preview-item .pvalue.green { color: #34d399; }
    .preview-item .pvalue.yellow { color: #fbbf24; }
    .preview-item .pvalue.red { color: #f87171; }

    /* ===== BUTTONS ===== */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 18px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      border: none;
      transition: all 0.15s;
    }
    .btn-primary {
      background: #4f6ef7;
      color: #fff;
    }
    .btn-primary:hover { background: #3b5ae8; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(79,110,247,0.3); }
    .btn-secondary {
      background: #f3f4f6;
      color: #374151;
    }
    .btn-secondary:hover { background: #e5e7eb; }
    .btn-danger {
      background: #fee2e2;
      color: #dc2626;
    }
    .btn-danger:hover { background: #fecaca; }
    .btn-sm { padding: 5px 12px; font-size: 12px; }
    .btn-icon {
      width: 32px; height: 32px;
      padding: 0;
      justify-content: center;
      border-radius: 6px;
    }
    .btn-success { background: #d1fae5; color: #065f46; }
    .btn-success:hover { background: #a7f3d0; }

    /* ===== TABLES ===== */
    .table-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid #e5e7eb; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead { background: #f9fafb; }
    th {
      padding: 10px 16px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #e5e7eb;
    }
    td {
      padding: 12px 16px;
      border-bottom: 1px solid #f3f4f6;
      color: #374151;
      vertical-align: middle;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f9fafb; }

    /* ===== OVERHEAD ===== */
    .oh-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

    /* ===== HISTORY SEARCH ===== */
    .search-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      align-items: center;
    }
    .search-bar input {
      flex: 1;
      padding: 9px 14px;
      border: 1.5px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      outline: none;
    }
    .search-bar input:focus { border-color: #4f6ef7; }

    /* ===== SETTINGS ===== */
    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px;
    }

    /* ===== TOAST ===== */
    #toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #111827;
      color: #fff;
      padding: 12px 20px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.3s;
      z-index: 9999;
      pointer-events: none;
    }
    #toast.show { opacity: 1; transform: translateY(0); }
    #toast.success { background: #065f46; }
    #toast.error { background: #991b1b; }

    /* ===== MODAL ===== */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 200;
      display: none;
      align-items: center;
      justify-content: center;
    }
    .modal-overlay.open { display: flex; }
    .modal {
      background: #fff;
      border-radius: 14px;
      padding: 28px;
      width: 90%;
      max-width: 560px;
      max-height: 90vh;
      overflow-y: auto;
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .modal-header h3 { font-size: 16px; font-weight: 700; }
    .modal-header button {
      background: none;
      border: none;
      font-size: 18px;
      color: #9ca3af;
      cursor: pointer;
    }

    /* ===== EMPTY STATE ===== */
    .empty-state {
      text-align: center;
      padding: 48px 20px;
      color: #9ca3af;
    }
    .empty-state i { font-size: 40px; margin-bottom: 12px; display: block; }
    .empty-state p { font-size: 14px; }

    /* ===== SIDEBAR OVERLAY (mobile) ===== */
    #sidebar-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 99;
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 768px) {
      #sidebar {
        transform: translateX(-240px);
      }
      #sidebar.open {
        transform: translateX(0);
      }
      #sidebar-overlay.open { display: block; }
      #main { margin-left: 0; }
      #mobile-menu-btn { display: block; }
      .charts-grid { grid-template-columns: 1fr; }
      .oh-panels { grid-template-columns: 1fr; }
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      #content { padding: 16px; }
    }
    @media (max-width: 480px) {
      .kpi-grid { grid-template-columns: 1fr 1fr; }
      .kpi-card .value { font-size: 20px; }
    }

    /* ===== LOADING ===== */
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid #e5e7eb;
      border-top-color: #4f6ef7;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      margin: 40px auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading-center { text-align: center; }
  </style>
</head>
<body>

<!-- Sidebar overlay (mobile) -->
<div id="sidebar-overlay"></div>

<!-- Sidebar -->
<aside id="sidebar">
  <div class="brand">
    <h1 id="sidebar-biz-name">NuWave Composites</h1>
    <span>KPI Dashboard</span>
  </div>
  <nav>
    <a data-view="dashboard" class="active">
      <i class="fas fa-chart-line"></i> Dashboard
    </a>
    <a data-view="entry">
      <i class="fas fa-edit"></i> Weekly Entry
    </a>
    <a data-view="overhead">
      <i class="fas fa-building"></i> Overhead
    </a>
    <a data-view="history">
      <i class="fas fa-history"></i> History
    </a>
    <a data-view="settings">
      <i class="fas fa-cog"></i> Settings
    </a>
  </nav>
  <div class="sidebar-footer">v1.0 &bull; Cloudflare D1</div>
</aside>

<!-- Main -->
<div id="main">
  <header id="topbar">
    <div style="display:flex;align-items:center;gap:12px">
      <button id="mobile-menu-btn"><i class="fas fa-bars"></i></button>
      <h2 id="page-title">Dashboard</h2>
    </div>
    <div class="topbar-right">
      <span id="topbar-week" style="font-size:13px;color:#6b7280;"></span>
    </div>
  </header>

  <main id="content">

    <!-- ========== DASHBOARD VIEW ========== -->
    <div id="view-dashboard" class="view active">
      <div class="week-pills" id="dash-week-pills"></div>
      <div class="kpi-grid" id="dash-kpi-grid">
        <div class="loading-center"><div class="spinner"></div></div>
      </div>
      <div class="charts-grid">
        <div class="chart-card">
          <h3><i class="fas fa-chart-line" style="color:#4f6ef7;margin-right:6px"></i>NR / Labor Cost Trend</h3>
          <canvas id="chart-nr-labor"></canvas>
        </div>
        <div class="chart-card">
          <h3><i class="fas fa-chart-bar" style="color:#4f6ef7;margin-right:6px"></i>Net Revenue vs Gross Profit</h3>
          <canvas id="chart-nr-gp"></canvas>
        </div>
      </div>
    </div>

    <!-- ========== WEEKLY ENTRY VIEW ========== -->
    <div id="view-entry" class="view">
      <!-- Live KPI Preview -->
      <div id="kpi-preview">
        <h3><i class="fas fa-bolt"></i> Live KPI Preview</h3>
        <div class="preview-grid">
          <div class="preview-item">
            <div class="plabel">Net Revenue</div>
            <div class="pvalue" id="prev-nr">$0</div>
          </div>
          <div class="preview-item">
            <div class="plabel">NR / Labor</div>
            <div class="pvalue" id="prev-nrlabor">0.00x</div>
          </div>
          <div class="preview-item">
            <div class="plabel">Gross Profit</div>
            <div class="pvalue" id="prev-gp">$0</div>
          </div>
          <div class="preview-item">
            <div class="plabel">GP %</div>
            <div class="pvalue" id="prev-gppct">0.0%</div>
          </div>
          <div class="preview-item">
            <div class="plabel">Labor Cost</div>
            <div class="pvalue" id="prev-labor">$0</div>
          </div>
          <div class="preview-item">
            <div class="plabel">NR / Dir Hr</div>
            <div class="pvalue" id="prev-nrhour">$0</div>
          </div>
        </div>
      </div>

      <form id="entry-form">
        <input type="hidden" id="entry-id" value="" />
        <div class="card">
          <h3><i class="fas fa-calendar-week"></i> Week Info</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>Week Start Date *</label>
              <input type="date" id="f-week-start" required />
            </div>
            <div class="form-group">
              <label>Notes</label>
              <input type="text" id="f-notes" placeholder="Optional notes for this week..." />
            </div>
          </div>
        </div>

        <div class="card">
          <h3><i class="fas fa-dollar-sign"></i> Revenue & COGS</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>Gross Revenue ($)</label>
              <input type="number" id="f-gross-revenue" step="0.01" min="0" placeholder="0.00" />
            </div>
            <div class="form-group">
              <label>Cost of Goods Sold ($)</label>
              <input type="number" id="f-cogs" step="0.01" min="0" placeholder="0.00" />
            </div>
          </div>
        </div>

        <div class="card">
          <h3><i class="fas fa-users"></i> Labor</h3>
          <div class="form-grid">
            <div class="form-section-label">Direct Labor</div>
            <div class="form-group">
              <label>Direct Wages ($)</label>
              <input type="number" id="f-dl-wages" step="0.01" min="0" placeholder="0.00" />
            </div>
            <div class="form-group">
              <label>Direct Hours</label>
              <input type="number" id="f-dl-hours" step="0.1" min="0" placeholder="0.0" />
            </div>
            <div class="form-divider"></div>
            <div class="form-section-label">Indirect Labor</div>
            <div class="form-group">
              <label>Indirect Wages ($)</label>
              <input type="number" id="f-il-wages" step="0.01" min="0" placeholder="0.00" />
            </div>
            <div class="form-group">
              <label>Indirect Hours</label>
              <input type="number" id="f-il-hours" step="0.1" min="0" placeholder="0.0" />
            </div>
            <div class="form-divider"></div>
            <div class="form-section-label">Burden &amp; Benefits</div>
            <div class="form-group">
              <label>Labor Burden (auto-calc)</label>
              <div class="calculated-field" id="f-burden-display">$0.00</div>
              <input type="hidden" id="f-labor-burden" value="0" />
            </div>
            <div class="form-group">
              <label>Additional Benefits ($)</label>
              <input type="number" id="f-add-benefits" step="0.01" min="0" placeholder="0.00" />
            </div>
          </div>
        </div>

        <div style="display:flex;gap:12px;justify-content:flex-end;flex-wrap:wrap">
          <button type="button" class="btn btn-secondary" id="entry-clear-btn">
            <i class="fas fa-times"></i> Clear
          </button>
          <button type="submit" class="btn btn-primary" id="entry-submit-btn">
            <i class="fas fa-save"></i> Save Entry
          </button>
        </div>
      </form>
    </div>

    <!-- ========== OVERHEAD VIEW ========== -->
    <div id="view-overhead" class="view">
      <div class="oh-panels">
        <!-- Fixed Overhead -->
        <div class="card">
          <h3><i class="fas fa-thumbtack"></i> Fixed Monthly Overhead</h3>
          <div style="margin-bottom:14px">
            <p style="font-size:13px;color:#6b7280">These items apply automatically every month.</p>
          </div>
          <div id="fixed-oh-list"></div>
          <div style="margin-top:14px;padding-top:14px;border-top:1px solid #f3f4f6">
            <div style="display:flex;gap:8px;margin-bottom:12px">
              <input type="text" id="new-fixed-name" placeholder="Item name" style="flex:1;padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:14px;font-family:inherit;outline:none" />
              <input type="number" id="new-fixed-amount" placeholder="$0.00" step="0.01" min="0" style="width:110px;padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:14px;font-family:inherit;outline:none" />
            </div>
            <button class="btn btn-primary btn-sm" id="add-fixed-btn">
              <i class="fas fa-plus"></i> Add Item
            </button>
          </div>
          <div style="margin-top:14px;padding-top:14px;border-top:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:13px;color:#6b7280;font-weight:600">Monthly Fixed Total</span>
            <span style="font-size:18px;font-weight:800;color:#111827" id="fixed-oh-total">$0.00</span>
          </div>
        </div>

        <!-- One-time Overhead -->
        <div class="card">
          <h3><i class="fas fa-receipt"></i> One-Time Items</h3>
          <div style="margin-bottom:14px;display:flex;gap:8px;align-items:center">
            <label style="font-size:13px;font-weight:600;color:#374151">Month:</label>
            <input type="month" id="onetime-month-picker" style="padding:7px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:14px;font-family:inherit;outline:none" />
          </div>
          <div id="onetime-oh-list"></div>
          <div style="margin-top:14px;padding-top:14px;border-top:1px solid #f3f4f6">
            <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
              <input type="text" id="new-ot-name" placeholder="Item name" style="flex:1;min-width:120px;padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:14px;font-family:inherit;outline:none" />
              <input type="number" id="new-ot-amount" placeholder="$0.00" step="0.01" min="0" style="width:110px;padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:14px;font-family:inherit;outline:none" />
            </div>
            <button class="btn btn-primary btn-sm" id="add-ot-btn">
              <i class="fas fa-plus"></i> Add Item
            </button>
          </div>
          <div style="margin-top:14px;padding-top:14px;border-top:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:13px;color:#6b7280;font-weight:600">One-Time Total</span>
            <span style="font-size:18px;font-weight:800;color:#111827" id="onetime-oh-total">$0.00</span>
          </div>
        </div>
      </div>

      <!-- Monthly overhead summary -->
      <div class="card">
        <h3><i class="fas fa-calculator"></i> Monthly Overhead Summary</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px">
          <div>
            <div style="font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Fixed</div>
            <div style="font-size:22px;font-weight:800;color:#111827" id="summ-fixed">$0.00</div>
          </div>
          <div>
            <div style="font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">One-Time</div>
            <div style="font-size:22px;font-weight:800;color:#111827" id="summ-onetime">$0.00</div>
          </div>
          <div>
            <div style="font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Total This Month</div>
            <div style="font-size:22px;font-weight:800;color:#4f6ef7" id="summ-total">$0.00</div>
          </div>
          <div>
            <div style="font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Weekly Avg (÷4.33)</div>
            <div style="font-size:22px;font-weight:800;color:#374151" id="summ-weekly">$0.00</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== HISTORY VIEW ========== -->
    <div id="view-history" class="view">
      <div class="search-bar">
        <input type="text" id="history-search" placeholder="Search by date or notes..." />
        <button class="btn btn-secondary btn-sm" id="history-refresh-btn">
          <i class="fas fa-sync-alt"></i> Refresh
        </button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Week Start</th>
              <th>Gross Rev</th>
              <th>Net Rev</th>
              <th>NR/Labor</th>
              <th>GP %</th>
              <th>Dir Hours</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="history-tbody">
            <tr><td colspan="8"><div class="spinner"></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ========== SETTINGS VIEW ========== -->
    <div id="view-settings" class="view">
      <div class="card">
        <h3><i class="fas fa-building"></i> Business Info</h3>
        <div class="settings-grid">
          <div class="form-group">
            <label>Business Name</label>
            <input type="text" id="s-biz-name" placeholder="NuWave Composites" />
          </div>
        </div>
      </div>
      <div class="card">
        <h3><i class="fas fa-percent"></i> Labor Burden Rates</h3>
        <div class="settings-grid">
          <div class="form-group">
            <label>Payroll Tax (%)</label>
            <input type="number" id="s-payroll-tax" step="0.01" min="0" max="100" />
          </div>
          <div class="form-group">
            <label>Workers Comp (%)</label>
            <input type="number" id="s-workers-comp" step="0.01" min="0" max="100" />
          </div>
          <div class="form-group">
            <label>FL Reemployment Tax (%)</label>
            <input type="number" id="s-fl-reempl" step="0.01" min="0" max="100" />
          </div>
          <div class="form-group">
            <label>Other Burden (%)</label>
            <input type="number" id="s-other-burden" step="0.01" min="0" max="100" />
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>Total Burden Rate</label>
            <div class="calculated-field" id="s-total-burden">0.00%</div>
          </div>
        </div>
      </div>
      <div class="card">
        <h3><i class="fas fa-bullseye"></i> KPI Targets</h3>
        <div class="settings-grid">
          <div class="form-group">
            <label>NR / Labor Target (x)</label>
            <input type="number" id="s-nr-labor-target" step="0.1" min="0" />
          </div>
          <div class="form-group">
            <label>Gross Profit % Target</label>
            <input type="number" id="s-gp-pct-target" step="0.1" min="0" max="100" />
          </div>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end">
        <button class="btn btn-primary" id="save-settings-btn">
          <i class="fas fa-save"></i> Save Settings
        </button>
      </div>
    </div>

  </main>
</div>

<!-- Edit Entry Modal -->
<div class="modal-overlay" id="edit-modal">
  <div class="modal">
    <div class="modal-header">
      <h3>Edit Weekly Entry</h3>
      <button onclick="closeEditModal()"><i class="fas fa-times"></i></button>
    </div>
    <div id="edit-modal-body"></div>
  </div>
</div>

<!-- Toast -->
<div id="toast"></div>

<script>
// ======================================================
// APP STATE
// ======================================================
const state = {
  settings: null,
  weeks: [],
  selectedWeekId: null,
  overheadFixed: [],
  overheadOnetime: [],
  charts: { nrLabor: null, nrGp: null },
  editingId: null,
  historyRaw: []
}

// ======================================================
// UTILS
// ======================================================
const fmt$ = (v) => {
  const n = Number(v) || 0
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}
const fmt$d = (v) => {
  const n = Number(v) || 0
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}
const fmtPct = (v) => (Number(v) || 0).toFixed(1) + '%'
const fmtX = (v) => (Number(v) || 0).toFixed(2) + 'x'
const fmtDate = (d) => {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return \`\${m}/\${day}/\${y}\`
}
const getMonthStr = (d = new Date()) => {
  return d.toISOString().slice(0, 7)
}
const getMondayOfWeek = () => {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}

// ======================================================
// TOAST
// ======================================================
let toastTimer
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast')
  t.textContent = msg
  t.className = 'show ' + type
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { t.className = '' }, 3000)
}

// ======================================================
// API HELPERS
// ======================================================
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch('/api' + path, opts)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ======================================================
// NAVIGATION
// ======================================================
const viewTitles = {
  dashboard: 'Dashboard',
  entry: 'Weekly Entry',
  overhead: 'Overhead',
  history: 'History',
  settings: 'Settings'
}
function navigateTo(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'))
  document.querySelectorAll('#sidebar nav a').forEach(a => a.classList.remove('active'))
  document.getElementById('view-' + view).classList.add('active')
  document.querySelector(\`[data-view="\${view}"]\`).classList.add('active')
  document.getElementById('page-title').textContent = viewTitles[view]
  closeSidebar()
  if (view === 'dashboard') loadDashboard()
  if (view === 'overhead') loadOverhead()
  if (view === 'history') loadHistory()
  if (view === 'settings') loadSettings()
}

// Sidebar nav click
document.querySelectorAll('#sidebar nav a').forEach(a => {
  a.addEventListener('click', () => navigateTo(a.dataset.view))
})

// Mobile sidebar
document.getElementById('mobile-menu-btn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open')
  document.getElementById('sidebar-overlay').classList.toggle('open')
})
document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar)
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open')
  document.getElementById('sidebar-overlay').classList.remove('open')
}

// ======================================================
// SETTINGS
// ======================================================
async function loadSettings() {
  try {
    const s = await api('GET', '/settings')
    state.settings = s
    document.getElementById('s-biz-name').value = s.business_name || 'NuWave Composites'
    document.getElementById('s-payroll-tax').value = s.payroll_tax_pct ?? 7.65
    document.getElementById('s-workers-comp').value = s.workers_comp_pct ?? 4.00
    document.getElementById('s-fl-reempl').value = s.fl_reemployment_pct ?? 0.50
    document.getElementById('s-other-burden').value = s.other_burden_pct ?? 0.00
    document.getElementById('s-nr-labor-target').value = s.nr_labor_target ?? 2.0
    document.getElementById('s-gp-pct-target').value = s.gp_pct_target ?? 40
    updateTotalBurden()
    document.getElementById('sidebar-biz-name').textContent = s.business_name || 'NuWave Composites'
  } catch(e) { showToast('Failed to load settings', 'error') }
}

function updateTotalBurden() {
  const total = (
    (parseFloat(document.getElementById('s-payroll-tax').value) || 0) +
    (parseFloat(document.getElementById('s-workers-comp').value) || 0) +
    (parseFloat(document.getElementById('s-fl-reempl').value) || 0) +
    (parseFloat(document.getElementById('s-other-burden').value) || 0)
  )
  document.getElementById('s-total-burden').textContent = total.toFixed(2) + '%'
}
['s-payroll-tax','s-workers-comp','s-fl-reempl','s-other-burden'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateTotalBurden)
})

document.getElementById('save-settings-btn').addEventListener('click', async () => {
  try {
    const s = await api('PUT', '/settings', {
      business_name: document.getElementById('s-biz-name').value,
      payroll_tax_pct: parseFloat(document.getElementById('s-payroll-tax').value) || 0,
      workers_comp_pct: parseFloat(document.getElementById('s-workers-comp').value) || 0,
      fl_reemployment_pct: parseFloat(document.getElementById('s-fl-reempl').value) || 0,
      other_burden_pct: parseFloat(document.getElementById('s-other-burden').value) || 0,
      nr_labor_target: parseFloat(document.getElementById('s-nr-labor-target').value) || 2.0,
      gp_pct_target: parseFloat(document.getElementById('s-gp-pct-target').value) || 40
    })
    state.settings = s
    document.getElementById('sidebar-biz-name').textContent = s.business_name
    showToast('Settings saved!', 'success')
  } catch(e) { showToast('Failed to save settings', 'error') }
})

// ======================================================
// KPI CALCULATION
// ======================================================
function calcKPIs(entry, weeklyOverhead = 0) {
  const gross_revenue = Number(entry.gross_revenue) || 0
  const cogs = Number(entry.cogs) || 0
  const dl_wages = Number(entry.direct_labor_wages) || 0
  const il_wages = Number(entry.indirect_labor_wages) || 0
  const burden = Number(entry.labor_burden) || 0
  const benefits = Number(entry.additional_benefits) || 0
  const dl_hours = Number(entry.direct_labor_hours) || 0

  const net_revenue = gross_revenue - cogs
  const total_labor = dl_wages + il_wages + burden + benefits
  const gross_profit = net_revenue - total_labor
  const gp_pct = net_revenue > 0 ? (gross_profit / net_revenue) * 100 : 0
  const nr_labor_ratio = total_labor > 0 ? net_revenue / total_labor : 0
  const net_profit = gross_profit - weeklyOverhead
  const np_pct = net_revenue > 0 ? (net_profit / net_revenue) * 100 : 0
  const nr_per_dir_hr = dl_hours > 0 ? net_revenue / dl_hours : 0

  return {
    net_revenue, total_labor, gross_profit, gp_pct,
    nr_labor_ratio, net_profit, np_pct, nr_per_dir_hr,
    weeklyOverhead
  }
}

function kpiColor(value, target, higherIsBetter = true) {
  if (target === 0) return 'blue'
  const ratio = value / target
  if (higherIsBetter) {
    if (ratio >= 0.9) return 'green'
    if (ratio >= 0.7) return 'yellow'
    return 'red'
  } else {
    if (ratio <= 1.1) return 'green'
    if (ratio <= 1.3) return 'yellow'
    return 'red'
  }
}

// ======================================================
// DASHBOARD
// ======================================================
async function loadDashboard() {
  if (!state.settings) {
    try { state.settings = await api('GET', '/settings') } catch(e) {}
  }
  try {
    const weeks = await api('GET', '/weeks')
    state.weeks = weeks
    renderWeekPills(weeks)
    if (weeks.length > 0) {
      const id = state.selectedWeekId || weeks[0].id
      state.selectedWeekId = id
      await renderDashKPIs(id)
    } else {
      document.getElementById('dash-kpi-grid').innerHTML = \`
        <div class="empty-state" style="grid-column:1/-1">
          <i class="fas fa-chart-line"></i>
          <p>No entries yet. <a href="#" onclick="navigateTo('entry');return false" style="color:#4f6ef7">Add your first week →</a></p>
        </div>\`
    }
    renderCharts(weeks)
  } catch(e) { showToast('Failed to load dashboard', 'error') }
}

function renderWeekPills(weeks) {
  const el = document.getElementById('dash-week-pills')
  if (!weeks.length) { el.innerHTML = ''; return }
  el.innerHTML = weeks.slice(0, 10).map(w => \`
    <button class="week-pill \${w.id === state.selectedWeekId ? 'active' : ''}"
      onclick="selectWeek(\${w.id})">\${fmtDate(w.week_start)}</button>
  \`).join('')
}

async function selectWeek(id) {
  state.selectedWeekId = id
  document.querySelectorAll('.week-pill').forEach(p => p.classList.remove('active'))
  document.querySelector(\`.week-pill[onclick="selectWeek(\${id})"]\`)?.classList.add('active')
  await renderDashKPIs(id)
}

async function renderDashKPIs(id) {
  const entry = state.weeks.find(w => w.id === id)
  if (!entry) return
  document.getElementById('topbar-week').textContent = 'Week of ' + fmtDate(entry.week_start)

  // get overhead for this week's month
  const month = entry.week_start.slice(0, 7)
  let weeklyOverhead = 0
  try {
    const oh = await api('GET', \`/overhead/summary/\${month}\`)
    weeklyOverhead = (oh.grand_total || 0) / 4.33
  } catch(e) {}

  const s = state.settings || {}
  const t = state.settings || {}
  const kpi = calcKPIs(entry, weeklyOverhead)

  const nrLaborColor = kpiColor(kpi.nr_labor_ratio, t.nr_labor_target || 2.0)
  const gpColor = kpiColor(kpi.gp_pct, t.gp_pct_target || 40)

  document.getElementById('dash-kpi-grid').innerHTML = \`
    <div class="kpi-card \${nrLaborColor}">
      <div class="label">NR / Labor Cost</div>
      <div class="value">\${fmtX(kpi.nr_labor_ratio)}</div>
      <div class="sub">Target: \${fmtX(t.nr_labor_target || 2.0)}</div>
      <span class="badge \${nrLaborColor}"><i class="fas fa-\${nrLaborColor==='green'?'check':nrLaborColor==='yellow'?'exclamation':'times'}"></i> Primary KPI</span>
    </div>
    <div class="kpi-card blue">
      <div class="label">Net Revenue</div>
      <div class="value">\${fmt$(kpi.net_revenue)}</div>
      <div class="sub">Gross: \${fmt$(entry.gross_revenue)}</div>
    </div>
    <div class="kpi-card \${gpColor}">
      <div class="label">Gross Profit</div>
      <div class="value">\${fmt$(kpi.gross_profit)}</div>
      <div class="sub">GP%: \${fmtPct(kpi.gp_pct)} (target \${fmtPct(t.gp_pct_target || 40)})</div>
      <span class="badge \${gpColor}">\${fmtPct(kpi.gp_pct)}</span>
    </div>
    <div class="kpi-card \${kpi.net_profit >= 0 ? 'green' : 'red'}">
      <div class="label">Net Profit</div>
      <div class="value">\${fmt$(kpi.net_profit)}</div>
      <div class="sub">NP%: \${fmtPct(kpi.np_pct)}</div>
    </div>
    <div class="kpi-card blue">
      <div class="label">Total Labor Cost</div>
      <div class="value">\${fmt$(kpi.total_labor)}</div>
      <div class="sub">Burden: \${fmt$d(entry.labor_burden)}</div>
    </div>
    <div class="kpi-card blue">
      <div class="label">Weekly Overhead</div>
      <div class="value">\${fmt$(kpi.weeklyOverhead)}</div>
      <div class="sub">Monthly ÷ 4.33</div>
    </div>
    <div class="kpi-card \${kpi.nr_per_dir_hr > 0 ? 'green' : 'blue'}">
      <div class="label">NR / Direct Hour</div>
      <div class="value">\${fmt$(kpi.nr_per_dir_hr)}</div>
      <div class="sub">Dir hours: \${Number(entry.direct_labor_hours).toFixed(1)}</div>
    </div>
  \`
}

// ======================================================
// CHARTS
// ======================================================
function renderCharts(weeks) {
  const last8 = [...weeks].reverse().slice(-8)
  const labels = last8.map(w => fmtDate(w.week_start))
  const nrLaborData = last8.map(w => {
    const kpi = calcKPIs(w)
    return parseFloat(kpi.nr_labor_ratio.toFixed(2))
  })
  const nrData = last8.map(w => Number(w.gross_revenue) - Number(w.cogs))
  const gpData = last8.map(w => {
    const kpi = calcKPIs(w)
    return parseFloat(kpi.gross_profit.toFixed(0))
  })
  const target = state.settings?.nr_labor_target || 2.0

  // Chart 1: NR/Labor trend
  const ctx1 = document.getElementById('chart-nr-labor').getContext('2d')
  if (state.charts.nrLabor) state.charts.nrLabor.destroy()
  state.charts.nrLabor = new Chart(ctx1, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'NR / Labor',
          data: nrLaborData,
          borderColor: '#4f6ef7',
          backgroundColor: 'rgba(79,110,247,0.1)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#4f6ef7',
          pointRadius: 4
        },
        {
          label: 'Target (' + target + 'x)',
          data: last8.map(() => target),
          borderColor: '#10b981',
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { font: { family: 'Inter', size: 12 } } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 } } }
      }
    }
  })

  // Chart 2: NR vs GP bar
  const ctx2 = document.getElementById('chart-nr-gp').getContext('2d')
  if (state.charts.nrGp) state.charts.nrGp.destroy()
  state.charts.nrGp = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Net Revenue', data: nrData, backgroundColor: '#4f6ef7', borderRadius: 4 },
        { label: 'Gross Profit', data: gpData, backgroundColor: '#10b981', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { font: { family: 'Inter', size: 12 } } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: {
          grid: { color: '#f3f4f6' },
          ticks: {
            font: { size: 11 },
            callback: v => '\$' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v)
          }
        }
      }
    }
  })
}

// ======================================================
// WEEKLY ENTRY FORM
// ======================================================
function calcBurden() {
  if (!state.settings) return 0
  const s = state.settings
  const totalWages = (parseFloat(document.getElementById('f-dl-wages').value) || 0) +
                     (parseFloat(document.getElementById('f-il-wages').value) || 0)
  const rate = (s.payroll_tax_pct + s.workers_comp_pct + s.fl_reemployment_pct + s.other_burden_pct) / 100
  return totalWages * rate
}

function updateLivePreview() {
  const burden = calcBurden()
  document.getElementById('f-labor-burden').value = burden.toFixed(2)
  document.getElementById('f-burden-display').textContent = fmt$d(burden)

  const entry = {
    gross_revenue: parseFloat(document.getElementById('f-gross-revenue').value) || 0,
    cogs: parseFloat(document.getElementById('f-cogs').value) || 0,
    direct_labor_wages: parseFloat(document.getElementById('f-dl-wages').value) || 0,
    direct_labor_hours: parseFloat(document.getElementById('f-dl-hours').value) || 0,
    indirect_labor_wages: parseFloat(document.getElementById('f-il-wages').value) || 0,
    indirect_labor_hours: parseFloat(document.getElementById('f-il-hours').value) || 0,
    labor_burden: burden,
    additional_benefits: parseFloat(document.getElementById('f-add-benefits').value) || 0
  }
  const kpi = calcKPIs(entry)
  const s = state.settings || {}
  const nrTarget = s.nr_labor_target || 2.0
  const gpTarget = s.gp_pct_target || 40

  const nrLaborEl = document.getElementById('prev-nrlabor')
  const nrColor = kpi.nr_labor_ratio >= nrTarget ? 'green' : kpi.nr_labor_ratio >= nrTarget * 0.7 ? 'yellow' : 'red'
  const gpColor = kpi.gp_pct >= gpTarget ? 'green' : kpi.gp_pct >= gpTarget * 0.7 ? 'yellow' : 'red'

  document.getElementById('prev-nr').textContent = fmt$(kpi.net_revenue)
  nrLaborEl.textContent = fmtX(kpi.nr_labor_ratio)
  nrLaborEl.className = 'pvalue ' + nrColor
  document.getElementById('prev-gp').textContent = fmt$(kpi.gross_profit)
  const gpPctEl = document.getElementById('prev-gppct')
  gpPctEl.textContent = fmtPct(kpi.gp_pct)
  gpPctEl.className = 'pvalue ' + gpColor
  document.getElementById('prev-labor').textContent = fmt$(kpi.total_labor)
  document.getElementById('prev-nrhour').textContent = fmt$(kpi.nr_per_dir_hr)
}

// Attach live preview listeners
['f-gross-revenue','f-cogs','f-dl-wages','f-dl-hours','f-il-wages','f-il-hours','f-add-benefits'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateLivePreview)
})

// Set default week start to Monday
document.getElementById('f-week-start').value = getMondayOfWeek()

// Entry form submit
document.getElementById('entry-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const id = document.getElementById('entry-id').value
  const burden = parseFloat(document.getElementById('f-labor-burden').value) || 0
  const payload = {
    week_start: document.getElementById('f-week-start').value,
    notes: document.getElementById('f-notes').value,
    gross_revenue: parseFloat(document.getElementById('f-gross-revenue').value) || 0,
    cogs: parseFloat(document.getElementById('f-cogs').value) || 0,
    direct_labor_wages: parseFloat(document.getElementById('f-dl-wages').value) || 0,
    direct_labor_hours: parseFloat(document.getElementById('f-dl-hours').value) || 0,
    indirect_labor_wages: parseFloat(document.getElementById('f-il-wages').value) || 0,
    indirect_labor_hours: parseFloat(document.getElementById('f-il-hours').value) || 0,
    labor_burden: burden,
    additional_benefits: parseFloat(document.getElementById('f-add-benefits').value) || 0
  }
  try {
    if (id) {
      await api('PUT', '/weeks/' + id, payload)
      showToast('Entry updated!', 'success')
    } else {
      await api('POST', '/weeks', payload)
      showToast('Entry saved!', 'success')
    }
    clearEntryForm()
    navigateTo('dashboard')
  } catch(e) {
    showToast('Error saving entry: ' + e.message, 'error')
  }
})

function clearEntryForm() {
  document.getElementById('entry-id').value = ''
  document.getElementById('entry-form').reset()
  document.getElementById('f-week-start').value = getMondayOfWeek()
  updateLivePreview()
  document.getElementById('entry-submit-btn').innerHTML = '<i class="fas fa-save"></i> Save Entry'
}
document.getElementById('entry-clear-btn').addEventListener('click', clearEntryForm)

// ======================================================
// OVERHEAD
// ======================================================
async function loadOverhead() {
  // Set month picker to current month
  const mp = document.getElementById('onetime-month-picker')
  if (!mp.value) mp.value = getMonthStr()
  await Promise.all([loadFixedOverhead(), loadOnetimeOverhead()])
  updateOverheadSummary()
}

async function loadFixedOverhead() {
  try {
    const items = await api('GET', '/overhead/fixed')
    state.overheadFixed = items
    renderFixedList()
  } catch(e) {}
}

function renderFixedList() {
  const el = document.getElementById('fixed-oh-list')
  if (!state.overheadFixed.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-thumbtack"></i><p>No fixed items yet</p></div>'
    document.getElementById('fixed-oh-total').textContent = '$0.00'
    return
  }
  el.innerHTML = state.overheadFixed.map(item => \`
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f3f4f6" id="foh-\${item.id}">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex:0 0 auto">
        <input type="checkbox" \${item.active ? 'checked' : ''} onchange="toggleFixed(\${item.id},this.checked)" style="accent-color:#4f6ef7" />
      </label>
      <span style="flex:1;font-size:14px;color:\${item.active?'#111827':'#9ca3af'};text-decoration:\${item.active?'none':'line-through'}">\${item.name}</span>
      <span style="font-size:14px;font-weight:600;color:#374151">\${fmt$d(item.amount)}</span>
      <button class="btn btn-danger btn-icon btn-sm" onclick="deleteFixed(\${item.id})"><i class="fas fa-trash"></i></button>
    </div>
  \`).join('')
  const total = state.overheadFixed.filter(i => i.active).reduce((s, i) => s + i.amount, 0)
  document.getElementById('fixed-oh-total').textContent = fmt$d(total)
}

async function toggleFixed(id, active) {
  const item = state.overheadFixed.find(i => i.id === id)
  if (!item) return
  try {
    await api('PUT', '/overhead/fixed/' + id, { ...item, active: active ? 1 : 0 })
    item.active = active ? 1 : 0
    renderFixedList()
    updateOverheadSummary()
  } catch(e) { showToast('Error', 'error') }
}

async function deleteFixed(id) {
  if (!confirm('Delete this item?')) return
  try {
    await api('DELETE', '/overhead/fixed/' + id)
    state.overheadFixed = state.overheadFixed.filter(i => i.id !== id)
    renderFixedList()
    updateOverheadSummary()
    showToast('Deleted', 'success')
  } catch(e) { showToast('Error', 'error') }
}

document.getElementById('add-fixed-btn').addEventListener('click', async () => {
  const name = document.getElementById('new-fixed-name').value.trim()
  const amount = parseFloat(document.getElementById('new-fixed-amount').value) || 0
  if (!name) { showToast('Enter item name', 'error'); return }
  try {
    const item = await api('POST', '/overhead/fixed', { name, amount, active: 1 })
    state.overheadFixed.push(item)
    renderFixedList()
    updateOverheadSummary()
    document.getElementById('new-fixed-name').value = ''
    document.getElementById('new-fixed-amount').value = ''
    showToast('Item added', 'success')
  } catch(e) { showToast('Error', 'error') }
})

async function loadOnetimeOverhead() {
  const month = document.getElementById('onetime-month-picker').value || getMonthStr()
  try {
    const items = await api('GET', '/overhead/onetime?month=' + month)
    state.overheadOnetime = items
    renderOnetimeList()
  } catch(e) {}
}

document.getElementById('onetime-month-picker').addEventListener('change', async () => {
  await loadOnetimeOverhead()
  updateOverheadSummary()
})

function renderOnetimeList() {
  const el = document.getElementById('onetime-oh-list')
  if (!state.overheadOnetime.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><p>No one-time items this month</p></div>'
    document.getElementById('onetime-oh-total').textContent = '$0.00'
    return
  }
  el.innerHTML = state.overheadOnetime.map(item => \`
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f3f4f6">
      <span style="flex:1;font-size:14px;color:#111827">\${item.name}</span>
      <span style="font-size:14px;font-weight:600;color:#374151">\${fmt$d(item.amount)}</span>
      <button class="btn btn-danger btn-icon btn-sm" onclick="deleteOnetime(\${item.id})"><i class="fas fa-trash"></i></button>
    </div>
  \`).join('')
  const total = state.overheadOnetime.reduce((s, i) => s + i.amount, 0)
  document.getElementById('onetime-oh-total').textContent = fmt$d(total)
}

document.getElementById('add-ot-btn').addEventListener('click', async () => {
  const name = document.getElementById('new-ot-name').value.trim()
  const amount = parseFloat(document.getElementById('new-ot-amount').value) || 0
  const month = document.getElementById('onetime-month-picker').value || getMonthStr()
  if (!name) { showToast('Enter item name', 'error'); return }
  try {
    const item = await api('POST', '/overhead/onetime', { month, name, amount })
    state.overheadOnetime.push(item)
    renderOnetimeList()
    updateOverheadSummary()
    document.getElementById('new-ot-name').value = ''
    document.getElementById('new-ot-amount').value = ''
    showToast('Item added', 'success')
  } catch(e) { showToast('Error', 'error') }
})

async function deleteOnetime(id) {
  if (!confirm('Delete this item?')) return
  try {
    await api('DELETE', '/overhead/onetime/' + id)
    state.overheadOnetime = state.overheadOnetime.filter(i => i.id !== id)
    renderOnetimeList()
    updateOverheadSummary()
    showToast('Deleted', 'success')
  } catch(e) { showToast('Error', 'error') }
}

function updateOverheadSummary() {
  const fixed = state.overheadFixed.filter(i => i.active).reduce((s,i) => s+i.amount, 0)
  const onetime = state.overheadOnetime.reduce((s,i) => s+i.amount, 0)
  const total = fixed + onetime
  const weekly = total / 4.33
  document.getElementById('summ-fixed').textContent = fmt$d(fixed)
  document.getElementById('summ-onetime').textContent = fmt$d(onetime)
  document.getElementById('summ-total').textContent = fmt$d(total)
  document.getElementById('summ-weekly').textContent = fmt$d(weekly)
}

// ======================================================
// HISTORY
// ======================================================
async function loadHistory() {
  try {
    const weeks = await api('GET', '/weeks')
    state.historyRaw = weeks
    renderHistoryTable(weeks)
  } catch(e) { showToast('Failed to load history', 'error') }
}

function renderHistoryTable(rows) {
  const tbody = document.getElementById('history-tbody')
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><i class="fas fa-history"></i><p>No entries yet</p></div></td></tr>'
    return
  }
  tbody.innerHTML = rows.map(w => {
    const kpi = calcKPIs(w)
    const s = state.settings || {}
    const nrColor = kpiColor(kpi.nr_labor_ratio, s.nr_labor_target || 2.0)
    const gpColor = kpiColor(kpi.gp_pct, s.gp_pct_target || 40)
    return \`<tr>
      <td style="font-weight:600">\${fmtDate(w.week_start)}</td>
      <td>\${fmt$(w.gross_revenue)}</td>
      <td>\${fmt$(kpi.net_revenue)}</td>
      <td><span class="badge \${nrColor}">\${fmtX(kpi.nr_labor_ratio)}</span></td>
      <td><span class="badge \${gpColor}">\${fmtPct(kpi.gp_pct)}</span></td>
      <td>\${Number(w.direct_labor_hours).toFixed(1)}</td>
      <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#6b7280">\${w.notes || '—'}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-icon btn-sm" onclick="editEntry(\${w.id})" title="Edit">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-danger btn-icon btn-sm" onclick="deleteEntry(\${w.id})" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>\`
  }).join('')
}

document.getElementById('history-search').addEventListener('input', function() {
  const q = this.value.toLowerCase()
  const filtered = state.historyRaw.filter(w =>
    (w.week_start || '').includes(q) ||
    (w.notes || '').toLowerCase().includes(q)
  )
  renderHistoryTable(filtered)
})

document.getElementById('history-refresh-btn').addEventListener('click', loadHistory)

async function deleteEntry(id) {
  if (!confirm('Delete this entry? This cannot be undone.')) return
  try {
    await api('DELETE', '/weeks/' + id)
    state.historyRaw = state.historyRaw.filter(w => w.id !== id)
    renderHistoryTable(state.historyRaw)
    showToast('Entry deleted', 'success')
  } catch(e) { showToast('Error deleting entry', 'error') }
}

function editEntry(id) {
  const entry = state.historyRaw.find(w => w.id === id)
  if (!entry) return
  // Populate the weekly entry form and switch view
  document.getElementById('entry-id').value = entry.id
  document.getElementById('f-week-start').value = entry.week_start
  document.getElementById('f-notes').value = entry.notes || ''
  document.getElementById('f-gross-revenue').value = entry.gross_revenue
  document.getElementById('f-cogs').value = entry.cogs
  document.getElementById('f-dl-wages').value = entry.direct_labor_wages
  document.getElementById('f-dl-hours').value = entry.direct_labor_hours
  document.getElementById('f-il-wages').value = entry.indirect_labor_wages
  document.getElementById('f-il-hours').value = entry.indirect_labor_hours
  document.getElementById('f-add-benefits').value = entry.additional_benefits
  document.getElementById('f-labor-burden').value = entry.labor_burden
  document.getElementById('f-burden-display').textContent = fmt$d(entry.labor_burden)
  document.getElementById('entry-submit-btn').innerHTML = '<i class="fas fa-save"></i> Update Entry'
  updateLivePreview()
  navigateTo('entry')
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('open')
}

// ======================================================
// INIT
// ======================================================
async function init() {
  try {
    state.settings = await api('GET', '/settings')
    document.getElementById('sidebar-biz-name').textContent = state.settings?.business_name || 'NuWave Composites'
  } catch(e) {}
  loadDashboard()
}

init()
</script>
</body>
</html>`
}

export default app
