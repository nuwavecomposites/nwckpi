import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import weeks from './routes/weeks'
import overhead from './routes/overhead'
import settings from './routes/settings'

type Bindings = { DB: D1Database }

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())

// API routes
app.route('/api/weeks', weeks)
app.route('/api/overhead', overhead)
app.route('/api/settings', settings)

// DB init — ensures tables exist on first request
app.use('/api/*', async (c, next) => {
  await next()
})

// Static files
app.use('/static/*', serveStatic({ root: './' }))

// Serve the SPA for all non-API routes
app.get('*', async (c) => {
  return c.html(getHTML())
})

function getHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NuWave Composites KPI Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --accent: #4f6ef7;
      --accent-light: #eef0fe;
      --accent-dark: #3a55d4;
      --green: #22c55e;
      --green-bg: #f0fdf4;
      --yellow: #eab308;
      --yellow-bg: #fefce8;
      --red: #ef4444;
      --red-bg: #fef2f2;
      --gray-50: #f9fafb;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-300: #d1d5db;
      --gray-400: #9ca3af;
      --gray-500: #6b7280;
      --gray-600: #4b5563;
      --gray-700: #374151;
      --gray-800: #1f2937;
      --gray-900: #111827;
      --sidebar-w: 240px;
      --sidebar-w-collapsed: 64px;
    }
    body { font-family: 'Inter', sans-serif; background: var(--gray-50); color: var(--gray-800); min-height: 100vh; }

    /* ── LAYOUT ── */
    .app-shell { display: flex; min-height: 100vh; }
    .sidebar {
      width: var(--sidebar-w); background: var(--gray-900); color: #fff;
      display: flex; flex-direction: column; position: fixed; top: 0; left: 0;
      height: 100vh; z-index: 100; transition: width .25s ease;
    }
    .sidebar-brand {
      padding: 20px 16px 16px; border-bottom: 1px solid rgba(255,255,255,.08);
    }
    .sidebar-brand .brand-name {
      font-size: 13px; font-weight: 700; color: var(--accent); letter-spacing: .04em;
      text-transform: uppercase; line-height: 1.3;
    }
    .sidebar-brand .brand-sub { font-size: 11px; color: var(--gray-400); margin-top: 2px; }
    .sidebar-nav { flex: 1; padding: 12px 0; overflow-y: auto; }
    .nav-item {
      display: flex; align-items: center; gap: 12px; padding: 11px 16px;
      cursor: pointer; border-radius: 0; transition: background .15s;
      font-size: 14px; font-weight: 500; color: var(--gray-300);
      border-left: 3px solid transparent; text-decoration: none;
    }
    .nav-item:hover { background: rgba(255,255,255,.06); color: #fff; }
    .nav-item.active { background: rgba(79,110,247,.15); color: var(--accent); border-left-color: var(--accent); }
    .nav-item i { width: 18px; text-align: center; font-size: 15px; }
    .main-content { margin-left: var(--sidebar-w); flex: 1; min-height: 100vh; display: flex; flex-direction: column; }
    .topbar {
      background: #fff; border-bottom: 1px solid var(--gray-200);
      padding: 0 24px; height: 60px; display: flex; align-items: center;
      justify-content: space-between; position: sticky; top: 0; z-index: 50;
    }
    .topbar-title { font-size: 18px; font-weight: 700; color: var(--gray-900); }
    .topbar-sub { font-size: 12px; color: var(--gray-400); margin-top: 1px; }
    .page-body { padding: 24px; flex: 1; }

    /* ── CARDS ── */
    .card {
      background: #fff; border-radius: 12px; border: 1px solid var(--gray-200);
      box-shadow: 0 1px 4px rgba(0,0,0,.04);
    }
    .card-header {
      padding: 16px 20px 12px; border-bottom: 1px solid var(--gray-100);
      display: flex; align-items: center; justify-content: space-between;
    }
    .card-title { font-size: 14px; font-weight: 600; color: var(--gray-700); }
    .card-body { padding: 20px; }

    /* ── KPI CARDS ── */
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-card {
      background: #fff; border-radius: 12px; border: 1px solid var(--gray-200);
      padding: 16px 20px; box-shadow: 0 1px 4px rgba(0,0,0,.04);
    }
    .kpi-card.green { border-left: 4px solid var(--green); }
    .kpi-card.yellow { border-left: 4px solid var(--yellow); }
    .kpi-card.red { border-left: 4px solid var(--red); }
    .kpi-card.neutral { border-left: 4px solid var(--accent); }
    .kpi-label { font-size: 11px; font-weight: 600; color: var(--gray-400); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 6px; }
    .kpi-value { font-size: 26px; font-weight: 700; color: var(--gray-900); line-height: 1; }
    .kpi-sub { font-size: 12px; color: var(--gray-400); margin-top: 4px; }
    .kpi-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 99px; margin-top: 6px; }
    .kpi-badge.green { background: var(--green-bg); color: #16a34a; }
    .kpi-badge.yellow { background: var(--yellow-bg); color: #a16207; }
    .kpi-badge.red { background: var(--red-bg); color: #dc2626; }

    /* ── WEEK PILLS ── */
    .week-pills { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
    .week-pill {
      padding: 6px 14px; border-radius: 99px; font-size: 12px; font-weight: 600;
      cursor: pointer; border: 1.5px solid var(--gray-200); background: #fff;
      color: var(--gray-600); transition: all .15s;
    }
    .week-pill:hover { border-color: var(--accent); color: var(--accent); }
    .week-pill.active { background: var(--accent); border-color: var(--accent); color: #fff; }

    /* ── CHARTS ── */
    .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px; }
    .chart-wrap { position: relative; height: 220px; }

    /* ── CHART TABS ── */
    .chart-tabs-bar {
      display: flex; align-items: center; gap: 0; flex-wrap: nowrap;
      overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none;
    }
    .chart-tabs-bar::-webkit-scrollbar { display: none; }
    .chart-tabs-group {
      display: flex; align-items: center; gap: 0;
      background: var(--gray-100); border-radius: 8px; padding: 3px;
      margin-right: 8px; flex-shrink: 0;
    }
    .chart-tabs-group-label {
      font-size: 10px; font-weight: 700; color: var(--gray-400);
      text-transform: uppercase; letter-spacing: .06em;
      padding: 0 6px 0 4px; flex-shrink: 0;
    }
    .chart-tab {
      padding: 5px 11px; border-radius: 6px; font-size: 12px; font-weight: 600;
      cursor: pointer; border: none; background: transparent;
      color: var(--gray-500); transition: all .15s; white-space: nowrap;
      font-family: inherit;
    }
    .chart-tab:hover { background: rgba(255,255,255,.7); color: var(--gray-700); }
    .chart-tab.active { background: #fff; color: var(--accent); box-shadow: 0 1px 3px rgba(0,0,0,.1); }

    /* ── YTD SUMMARY STRIP ── */
    .ytd-strip {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(140px,1fr));
      gap: 10px; margin-bottom: 16px;
    }
    .ytd-card {
      background: var(--gray-50); border: 1px solid var(--gray-200);
      border-radius: 10px; padding: 10px 14px;
    }
    .ytd-card .ytd-label { font-size: 10px; font-weight: 700; color: var(--gray-400); text-transform: uppercase; letter-spacing: .05em; }
    .ytd-card .ytd-val { font-size: 15px; font-weight: 700; color: var(--gray-900); margin-top: 3px; }
    .ytd-card .ytd-sub { font-size: 10px; color: var(--gray-400); margin-top: 1px; }

    /* ── CHART CARDS GRID ── */
    .charts-8-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    @media (max-width: 1100px) { .charts-8-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 640px)  { .charts-8-grid { grid-template-columns: 1fr; } }
    .chart-card {
      background: var(--gray-50); border: 1px solid var(--gray-200);
      border-radius: 10px; overflow: hidden;
    }
    .chart-card-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px 8px; border-bottom: 1px solid var(--gray-100);
    }
    .chart-card-title {
      font-size: 11px; font-weight: 700; color: var(--gray-600);
      display: flex; align-items: center; gap: 5px;
    }
    .chart-card-stat {
      font-size: 11px; font-weight: 700; color: var(--gray-700);
    }
    .chart-card-body {
      padding: 8px 12px 10px; position: relative; height: 220px;
    }

    /* ── FORMS ── */
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group.full { grid-column: 1 / -1; }
    label { font-size: 12px; font-weight: 600; color: var(--gray-600); }
    input[type=text], input[type=number], input[type=date], textarea, select {
      width: 100%; padding: 9px 12px; border: 1.5px solid var(--gray-200);
      border-radius: 8px; font-size: 14px; font-family: inherit;
      color: var(--gray-800); background: #fff; transition: border-color .15s;
      outline: none;
    }
    input:focus, textarea:focus, select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(79,110,247,.1); }
    textarea { resize: vertical; min-height: 80px; }
    .input-prefix { position: relative; }
    .input-prefix span { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--gray-400); font-size: 14px; pointer-events: none; }
    .input-prefix input { padding-left: 24px; }
    .input-suffix { position: relative; }
    .input-suffix span { position: absolute; right: 11px; top: 50%; transform: translateY(-50%); color: var(--gray-400); font-size: 14px; pointer-events: none; }
    .input-suffix input { padding-right: 28px; }

    /* ── BUTTONS ── */
    .btn { display: inline-flex; align-items: center; gap: 8px; padding: 9px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: all .15s; font-family: inherit; }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-primary:hover { background: var(--accent-dark); }
    .btn-secondary { background: var(--gray-100); color: var(--gray-700); }
    .btn-secondary:hover { background: var(--gray-200); }
    .btn-danger { background: var(--red-bg); color: var(--red); border: 1px solid #fecaca; }
    .btn-danger:hover { background: #fee2e2; }
    .btn-sm { padding: 5px 12px; font-size: 12px; }
    .btn-icon { padding: 7px; border-radius: 8px; background: var(--gray-100); color: var(--gray-500); border: none; cursor: pointer; transition: all .15s; font-size: 13px; }
    .btn-icon:hover { background: var(--gray-200); color: var(--gray-700); }
    .btn-icon.danger:hover { background: var(--red-bg); color: var(--red); }

    /* ── LIVE KPI PREVIEW ── */
    .kpi-preview {
      background: var(--accent-light); border: 1.5px solid rgba(79,110,247,.2);
      border-radius: 12px; padding: 16px 20px; margin-top: 20px;
    }
    .kpi-preview h4 { font-size: 12px; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 12px; }
    .kpi-preview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
    .kpi-prev-item .label { font-size: 10px; font-weight: 600; color: var(--gray-400); text-transform: uppercase; letter-spacing: .05em; }
    .kpi-prev-item .val { font-size: 16px; font-weight: 700; color: var(--gray-900); margin-top: 2px; }
    .kpi-prev-item .val.green { color: var(--green); }
    .kpi-prev-item .val.yellow { color: var(--yellow); }
    .kpi-prev-item .val.red { color: var(--red); }

    /* ── TABLE ── */
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: var(--gray-50); padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 700; color: var(--gray-500); text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid var(--gray-200); white-space: nowrap; }
    td { padding: 11px 14px; border-bottom: 1px solid var(--gray-100); color: var(--gray-700); vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--gray-50); }
    .td-actions { display: flex; gap: 6px; align-items: center; }

    /* ── SEARCH ── */
    .search-wrap { position: relative; }
    .search-wrap i { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--gray-400); font-size: 13px; }
    .search-wrap input { padding-left: 34px; }

    /* ── SECTION HEADING ── */
    .section-title { font-size: 15px; font-weight: 700; color: var(--gray-900); margin-bottom: 4px; }
    .section-sub { font-size: 12px; color: var(--gray-400); margin-bottom: 20px; }

    /* ── DIVIDER ── */
    .divider { border: none; border-top: 1px solid var(--gray-100); margin: 20px 0; }

    /* ── BADGE ── */
    .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
    .badge-green { background: var(--green-bg); color: #16a34a; }
    .badge-yellow { background: var(--yellow-bg); color: #a16207; }
    .badge-red { background: var(--red-bg); color: #dc2626; }
    .badge-blue { background: var(--accent-light); color: var(--accent); }

    /* ── MODAL ── */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .modal { background: #fff; border-radius: 16px; width: 100%; max-width: 620px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.2); }
    .modal-header { padding: 20px 24px 16px; border-bottom: 1px solid var(--gray-100); display: flex; align-items: center; justify-content: space-between; }
    .modal-title { font-size: 16px; font-weight: 700; }
    .modal-body { padding: 24px; }
    .modal-footer { padding: 16px 24px; border-top: 1px solid var(--gray-100); display: flex; justify-content: flex-end; gap: 10px; }
    .hidden { display: none !important; }

    /* ── TOAST ── */
    .toast-container { position: fixed; bottom: 24px; right: 24px; z-index: 300; display: flex; flex-direction: column; gap: 8px; }
    .toast { background: var(--gray-900); color: #fff; padding: 12px 18px; border-radius: 10px; font-size: 13px; font-weight: 500; box-shadow: 0 4px 20px rgba(0,0,0,.2); display: flex; align-items: center; gap: 10px; animation: slideUp .25s ease; }
    .toast.success { border-left: 4px solid var(--green); }
    .toast.error { border-left: 4px solid var(--red); }
    @keyframes slideUp { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: translateY(0); } }

    /* ── EMPTY STATE ── */
    .empty-state { text-align: center; padding: 48px 20px; color: var(--gray-400); }
    .empty-state i { font-size: 40px; margin-bottom: 12px; display: block; }
    .empty-state p { font-size: 14px; }

    /* ── SETTINGS ── */
    .settings-section { margin-bottom: 32px; }
    .settings-section-title { font-size: 13px; font-weight: 700; color: var(--gray-700); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--gray-100); }
    .settings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }

    /* ── OVERHEAD TOGGLE ── */
    .toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .toggle-track { width: 36px; height: 20px; background: var(--gray-300); border-radius: 99px; position: relative; transition: background .15s; flex-shrink: 0; }
    .toggle-thumb { width: 14px; height: 14px; background: #fff; border-radius: 50%; position: absolute; top: 3px; left: 3px; transition: transform .15s; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
    .toggle.on .toggle-track { background: var(--accent); }
    .toggle.on .toggle-thumb { transform: translateX(16px); }
    .toggle-label { font-size: 13px; color: var(--gray-600); }

    /* ── RESPONSIVE ── */
    @media (max-width: 768px) {
      .sidebar { width: 64px; }
      .sidebar-brand .brand-name, .sidebar-brand .brand-sub, .nav-item span { display: none; }
      .main-content { margin-left: 64px; }
      .form-grid { grid-template-columns: 1fr; }
      .charts-grid { grid-template-columns: 1fr; }
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .page-body { padding: 16px; }
      .kpi-preview-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 480px) {
      .kpi-grid { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
<div class="app-shell">
  <!-- SIDEBAR -->
  <nav class="sidebar" id="sidebar">
    <div class="sidebar-brand">
      <div class="brand-name">NuWave Composites</div>
      <div class="brand-sub">KPI Dashboard</div>
    </div>
    <div class="sidebar-nav">
      <a class="nav-item active" data-view="dashboard">
        <i class="fas fa-chart-line"></i><span>Dashboard</span>
      </a>
      <a class="nav-item" data-view="entry">
        <i class="fas fa-plus-circle"></i><span>Weekly Entry</span>
      </a>
      <a class="nav-item" data-view="overhead">
        <i class="fas fa-building"></i><span>Overhead</span>
      </a>
      <a class="nav-item" data-view="history">
        <i class="fas fa-history"></i><span>History</span>
      </a>
      <a class="nav-item" data-view="settings">
        <i class="fas fa-cog"></i><span>Settings</span>
      </a>
    </div>
  </nav>

  <!-- MAIN -->
  <div class="main-content">
    <div class="topbar">
      <div>
        <div class="topbar-title" id="topbar-title">Dashboard</div>
        <div class="topbar-sub" id="topbar-sub">Overview of your KPIs</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span id="business-name-display" style="font-size:13px;font-weight:600;color:var(--gray-400);"></span>
      </div>
    </div>
    <div class="page-body" id="page-body">
      <!-- Views rendered by JS -->
    </div>
  </div>
</div>

<!-- MODAL CONTAINER -->
<div id="modal-container"></div>
<!-- TOAST CONTAINER -->
<div class="toast-container" id="toast-container"></div>

<script>
// =====================================================================
// APP STATE
// =====================================================================
const state = {
  view: 'dashboard',
  settings: null,
  weeks: [],
  selectedWeekId: null,
  overheadFixed: [],
  overheadOnetime: [],
  currentMonth: new Date().toISOString().slice(0,7)
}

// =====================================================================
// UTILITIES
// =====================================================================
const fmt = (n, decimals=0) => {
  if (n == null || isNaN(n)) return '$0'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
const fmtPct = (n, decimals=1) => {
  if (n == null || isNaN(n)) return '0%'
  return Number(n).toFixed(decimals) + '%'
}
const fmtX = (n) => Number(n).toFixed(2) + 'x'
const fmtHrs = (n) => Number(n).toFixed(1) + ' hrs'

function showToast(msg, type='success') {
  const tc = document.getElementById('toast-container')
  const t = document.createElement('div')
  t.className = 'toast ' + type
  t.innerHTML = '<i class="fas fa-' + (type==='success'?'check-circle':'exclamation-circle') + '"></i> ' + msg
  tc.appendChild(t)
  setTimeout(() => t.remove(), 3200)
}

async function api(path, opts={}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

function getWeekMonth(weekStart) {
  return weekStart ? weekStart.slice(0,7) : state.currentMonth
}

// =====================================================================
// KPI CALCULATIONS
// =====================================================================
//  NR          = Gross Revenue – Materials – Subcontractors
//  DL Cost     = DL Wages + (DL share of burden) + Benefits  ← fully burdened
//  GP $        = NR – DL Cost
//  GP %        = GP $ / NR
//  NR/DL Ratio = NR / DL Cost                               ← primary KPI
//  IL Cost     = IL Wages + (IL share of burden)
//  OH (weekly) = IL Cost + Fixed Overhead
//  NP          = NR – DL Cost – OH
function calcKPIs(entry, fixedOHTotal) {
  const gr       = +entry.gross_revenue        || 0
  const mats     = +entry.materials            || 0
  const subs     = +entry.subcontractors       || 0
  const legacyCogs = +entry.cogs               || 0  // backwards compat
  const dlw      = +entry.direct_labor_wages   || 0
  const ilw      = +entry.indirect_labor_wages || 0
  const burden   = +entry.labor_burden         || 0
  const benefits = +entry.additional_benefits  || 0
  const dlh      = +entry.direct_labor_hours   || 0

  // NR = Revenue – Materials – Subcontractors (no labor in deduction)
  const totalDirect = (mats + subs) > 0 ? (mats + subs) : legacyCogs
  const nr = gr - totalDirect

  // Burden split proportionally by wage share
  const totalWages = dlw + ilw
  const dlBurden = totalWages > 0 ? burden * (dlw / totalWages) : burden
  const ilBurden = totalWages > 0 ? burden * (ilw / totalWages) : 0

  // Direct Labor Cost (fully burdened) = DL wages + DL burden share + benefits
  const dlCost = dlw + dlBurden + benefits

  // Gross Profit = NR – Direct Labor Cost only (indirect excluded)
  const gp    = nr - dlCost
  const gpPct = nr > 0 ? (gp / nr) * 100 : 0

  // Primary KPI: NR ÷ DL Cost
  const nrLaborRatio = dlCost > 0 ? nr / dlCost : 0

  // Indirect labor cost (for overhead)
  const ilCost = ilw + ilBurden

  // Weekly Overhead = Indirect Labor Cost + Fixed Overhead
  const fixedOH = fixedOHTotal || 0
  const oh = ilCost + fixedOH

  // Net Profit = NR – DL Cost – Overhead
  const np    = nr - dlCost - oh
  const npPct = nr > 0 ? (np / nr) * 100 : 0

  // NR per Direct Hour (direct hours only)
  const nrPerHour = dlh > 0 ? nr / dlh : 0

  // Total labor (informational)
  const totalLabor = dlCost + ilCost

  return { gr, mats, subs, nr, dlw, ilw, dlBurden, ilBurden, ilCost,
           burden, benefits, dlh, dlCost, gp, gpPct, nrLaborRatio,
           fixedOH, oh, np, npPct, nrPerHour, totalLabor }
}

function calcBurden(wages, s) {
  if (!s) return 0
  const pct = (+s.payroll_tax_pct + +s.workers_comp_pct + +s.fl_reemployment_pct + +s.other_burden_pct) / 100
  return wages * pct
}

function kpiColor(val, target, higherIsBetter=true) {
  if (!target) return 'neutral'
  const ratio = val / target
  if (higherIsBetter) {
    if (ratio >= 1) return 'green'
    if (ratio >= 0.85) return 'yellow'
    return 'red'
  } else {
    if (ratio <= 1) return 'green'
    if (ratio <= 1.15) return 'yellow'
    return 'red'
  }
}

// =====================================================================
// NAVIGATION
// =====================================================================
const topbarMeta = {
  dashboard: ['Dashboard', 'Weekly KPI overview'],
  entry: ['Weekly Entry', 'Log a new week of data'],
  overhead: ['Overhead', 'Manage fixed and one-time costs'],
  history: ['History', 'Browse and edit past entries'],
  settings: ['Settings', 'Configure rates and targets']
}

function navigate(view) {
  state.view = view
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view)
  })
  const [title, sub] = topbarMeta[view] || ['', '']
  document.getElementById('topbar-title').textContent = title
  document.getElementById('topbar-sub').textContent = sub
  renderView()
}

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => navigate(el.dataset.view))
})

// =====================================================================
// RENDER ROUTER
// =====================================================================
async function renderView() {
  const pb = document.getElementById('page-body')
  pb.innerHTML = '<div style="text-align:center;padding:60px;color:var(--gray-400);"><i class="fas fa-spinner fa-spin" style="font-size:28px;"></i></div>'
  try {
    if (state.view === 'dashboard') await renderDashboard()
    else if (state.view === 'entry') await renderEntry()
    else if (state.view === 'overhead') await renderOverhead()
    else if (state.view === 'history') await renderHistory()
    else if (state.view === 'settings') await renderSettings()
  } catch(e) {
    pb.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>' + e.message + '</p></div>'
  }
}

// =====================================================================
// DASHBOARD VIEW
// =====================================================================
async function renderDashboard() {
  const [weeks, settings] = await Promise.all([
    api('/weeks'),
    api('/settings')
  ])
  state.weeks = weeks
  state.settings = settings
  document.getElementById('business-name-display').textContent = settings.business_name

  if (!weeks.length) {
    document.getElementById('page-body').innerHTML = \`
      <div class="empty-state">
        <i class="fas fa-chart-line"></i>
        <p>No weekly entries yet. <a href="#" onclick="navigate('entry');return false;" style="color:var(--accent);">Add your first week →</a></p>
      </div>\`
    return
  }

  if (!state.selectedWeekId || !weeks.find(w=>w.id===state.selectedWeekId)) {
    state.selectedWeekId = weeks[0].id
  }

  const selected = weeks.find(w=>w.id===state.selectedWeekId)
  const month = getWeekMonth(selected.week_start)
  const ohSummary = await api('/overhead/summary/' + month)
  const weeklyOH = ohSummary.fixed_total / 4.33

  const kpi = calcKPIs(selected, weeklyOH)
  const s = settings
  const nrlColor  = kpiColor(kpi.nrLaborRatio, s.nr_labor_target, true)
  const gpColor   = kpiColor(kpi.gpPct, s.gp_pct_target, true)
  const gpDollarColor = kpi.gp >= 0 ? 'green' : 'red'
  const npColor   = kpi.np >= 0 ? 'green' : 'red'

  const pillsHTML = weeks.slice(0, 10).map(w => \`
    <div class="week-pill\${w.id===state.selectedWeekId?' active':''}" data-wid="\${w.id}">
      \${formatWeekLabel(w.week_start)}
    </div>\`).join('')

  document.getElementById('page-body').innerHTML = \`
    <div class="week-pills" id="week-pills">\${pillsHTML}</div>

    <div class="kpi-grid">

      <!-- 1. Net Revenue -->
      <div class="kpi-card neutral">
        <div class="kpi-label">1 · Net Revenue</div>
        <div class="kpi-value">\${fmt(kpi.nr)}</div>
        <div class="kpi-sub">Revenue \${fmt(kpi.gr)} − Materials \${fmt(kpi.mats)}</div>
      </div>

      <!-- 2. NR / Direct Labor (fully burdened) -->
      <div class="kpi-card \${nrlColor}">
        <div class="kpi-label">2 · NR / Direct Labor ⭐</div>
        <div class="kpi-value">\${fmtX(kpi.nrLaborRatio)}</div>
        <div class="kpi-sub">DL Cost \${fmt(kpi.dlCost)} · Target \${fmtX(s.nr_labor_target)}</div>
        <div class="kpi-badge \${nrlColor}"><i class="fas fa-\${nrlColor==='green'?'check':'exclamation'}-circle"></i> \${nrlColor==='green'?'On Target':nrlColor==='yellow'?'Near Target':'Below Target'}</div>
      </div>

      <!-- 3a. Gross Profit $ -->
      <div class="kpi-card \${gpDollarColor}">
        <div class="kpi-label">3 · Gross Profit $</div>
        <div class="kpi-value">\${fmt(kpi.gp)}</div>
        <div class="kpi-sub">NR \${fmt(kpi.nr)} − DL Cost \${fmt(kpi.dlCost)}</div>
        <div class="kpi-badge \${gpDollarColor}"><i class="fas fa-arrow-\${gpDollarColor==='green'?'up':'down'}"></i> Scale indicator</div>
      </div>

      <!-- 3b. Gross Profit % -->
      <div class="kpi-card \${gpColor}">
        <div class="kpi-label">3 · Gross Profit %</div>
        <div class="kpi-value">\${fmtPct(kpi.gpPct)}</div>
        <div class="kpi-sub">Target \${fmtPct(s.gp_pct_target)} · Pricing discipline</div>
        <div class="kpi-badge \${gpColor}"><i class="fas fa-\${gpColor==='green'?'check':'exclamation'}-circle"></i> \${gpColor==='green'?'On Target':gpColor==='yellow'?'Near Target':'Below Target'}</div>
      </div>

      <!-- 4. Weekly Overhead -->
      <div class="kpi-card neutral">
        <div class="kpi-label">4 · Weekly Overhead</div>
        <div class="kpi-value">\${fmt(kpi.oh)}</div>
        <div class="kpi-sub">Fixed \${fmt(weeklyOH)} + IL \${fmt(kpi.ilCost)}</div>
      </div>

      <!-- 5. Net Profit -->
      <div class="kpi-card \${npColor}">
        <div class="kpi-label">5 · Net Profit</div>
        <div class="kpi-value">\${fmt(kpi.np)}</div>
        <div class="kpi-sub">NR − DL − Overhead · \${fmtPct(kpi.npPct)} NP%</div>
        <div class="kpi-badge \${npColor}"><i class="fas fa-arrow-\${npColor==='green'?'up':'down'}"></i> \${fmtPct(kpi.npPct)}</div>
      </div>

      <!-- 6. NR / Direct Labor Hour -->
      <div class="kpi-card neutral">
        <div class="kpi-label">6 · NR / Direct Labor Hour</div>
        <div class="kpi-value">\${fmt(kpi.nrPerHour)}</div>
        <div class="kpi-sub">\${fmtHrs(kpi.dlh)} direct hours only</div>
      </div>

      <!-- Supporting: Direct Labor Cost breakdown -->
      <div class="kpi-card neutral">
        <div class="kpi-label">Direct Labor Cost</div>
        <div class="kpi-value">\${fmt(kpi.dlCost)}</div>
        <div class="kpi-sub">Wages \${fmt(kpi.dlw)} + Burden \${fmt(kpi.dlBurden)} + Benefits \${fmt(kpi.benefits)}</div>
      </div>

    </div>

    <!-- ── CHARTS PANEL ── -->
    <div class="card" style="margin-top:0;" id="charts-panel">
      <div class="card-header" style="flex-wrap:wrap;gap:10px;padding-bottom:14px;">
        <div class="card-title"><i class="fas fa-chart-line" style="color:var(--accent);margin-right:6px;"></i>Performance Charts</div>
        <div id="chart-range-tabs" class="chart-tabs-bar"></div>
      </div>
      <div class="card-body" style="padding:14px 20px 20px;">
        <div id="ytd-summary-strip"></div>
        <div id="charts-container" class="charts-8-grid"></div>
      </div>
    </div>
  \`

  // ── Week pill click ──────────────────────────────────────────────────
  document.getElementById('week-pills').addEventListener('click', async e => {
    const pill = e.target.closest('.week-pill')
    if (!pill) return
    state.selectedWeekId = +pill.dataset.wid
    await renderDashboard()
  })

  // ════════════════════════════════════════════════════════════════════
  // CHART ENGINE
  // ════════════════════════════════════════════════════════════════════
  if (!state.chartRange) state.chartRange = 'recent'

  // All weeks sorted oldest→newest
  const allWeeks = [...weeks].reverse()

  // ── Quarter helpers ──────────────────────────────────────────────────
  function getQuarterRange(year, q) {
    const starts = ['01-01','04-01','07-01','10-01']
    const ends   = ['03-31','06-30','09-30','12-31']
    return { s: \`\${year}-\${starts[q-1]}\`, e: \`\${year}-\${ends[q-1]}\` }
  }
  function quarterOfDate(dateStr) {
    const m = +dateStr.slice(5,7)
    return Math.ceil(m/3)
  }

  // ── Detect all available years ───────────────────────────────────────
  const availYears = [...new Set(allWeeks.map(w => w.week_start.slice(0,4)))].sort()
  const currentYear = new Date().getFullYear().toString()
  const displayYear = availYears.includes(currentYear) ? currentYear
                    : (availYears[availYears.length-1] || currentYear)

  // ── Build tab definitions ────────────────────────────────────────────
  // Group 1: Quick range
  const quickGroup = [
    { id:'recent', label:'Last 8 Wks' }
  ]
  // Group 2: Current-year filters (YTD + quarters + full year)
  const yearGroups = availYears.slice().reverse().map(yr => {
    const tabs = []
    if (yr === currentYear) tabs.push({ id:\`ytd_\${yr}\`, label:\`YTD\` })
    tabs.push(
      { id:\`q1_\${yr}\`, label:'Q1' },
      { id:\`q2_\${yr}\`, label:'Q2' },
      { id:\`q3_\${yr}\`, label:'Q3' },
      { id:\`q4_\${yr}\`, label:'Q4' },
      { id:\`year_\${yr}\`, label:\`Full \${yr}\` }
    )
    return { year: yr, tabs }
  })

  // ── Render tab bar ───────────────────────────────────────────────────
  function renderTabBar() {
    const bar = document.getElementById('chart-range-tabs')
    if (!bar) return
    let html = '<div class="chart-tabs-group">'
    quickGroup.forEach(t => {
      html += \`<button class="chart-tab\${state.chartRange===t.id?' active':''}" data-range="\${t.id}">\${t.label}</button>\`
    })
    html += '</div>'
    yearGroups.forEach(g => {
      html += \`<div class="chart-tabs-group"><span class="chart-tabs-group-label">\${g.year}</span>\`
      g.tabs.forEach(t => {
        html += \`<button class="chart-tab\${state.chartRange===t.id?' active':''}" data-range="\${t.id}">\${t.label}</button>\`
      })
      html += '</div>'
    })
    bar.innerHTML = html
    bar.addEventListener('click', e => {
      const btn = e.target.closest('.chart-tab')
      if (!btn) return
      state.chartRange = btn.dataset.range
      buildCharts()
    })
  }
  renderTabBar()

  // ── Filter weeks by range ────────────────────────────────────────────
  function filterWeeks(rangeId) {
    if (rangeId === 'recent') return allWeeks.slice(-8)
    const parts = rangeId.split('_')
    const type = parts[0]
    const yr   = parts[1]
    if (type === 'ytd') {
      const jan1  = \`\${yr}-01-01\`
      const today = new Date().toISOString().slice(0,10)
      return allWeeks.filter(w => w.week_start >= jan1 && w.week_start <= today)
    }
    if (type === 'year') {
      return allWeeks.filter(w => w.week_start.startsWith(yr))
    }
    if (['q1','q2','q3','q4'].includes(type)) {
      const { s, e } = getQuarterRange(yr, +type[1])
      return allWeeks.filter(w => w.week_start >= s && w.week_start <= e)
    }
    return allWeeks.slice(-8)
  }

  // ── Range label for summary heading ─────────────────────────────────
  function rangeLabel(rangeId) {
    if (rangeId === 'recent') return 'Last 8 Weeks'
    const parts = rangeId.split('_')
    const type = parts[0], yr = parts[1]
    if (type === 'ytd')  return \`Year-to-Date \${yr}\`
    if (type === 'year') return \`Full Year \${yr}\`
    if (['q1','q2','q3','q4'].includes(type)) return \`Q\${type[1]} \${yr}\`
    return rangeId
  }

  // ── 3-week moving average ────────────────────────────────────────────
  function movingAvg(data, n=3) {
    return data.map((_, i) => {
      const slice = data.slice(Math.max(0, i-n+1), i+1)
      return +(slice.reduce((a,b)=>a+b,0)/slice.length).toFixed(2)
    })
  }

  // ── Hex → rgba helper ────────────────────────────────────────────────
  function hexAlpha(hex, a) {
    const r = parseInt(hex.slice(1,3),16)
    const g = parseInt(hex.slice(3,5),16)
    const b = parseInt(hex.slice(5,7),16)
    return \`rgba(\${r},\${g},\${b},\${a})\`
  }

  // ── Chart options factory ────────────────────────────────────────────
  function chartOpts(yFmt='dollar') {
    const isDollar = yFmt==='dollar', isPct=yFmt==='pct'
    const isRatio  = yFmt==='ratio',  isHr =yFmt==='hr'
    const tickCb = isDollar ? v=>'$'+Math.round(v).toLocaleString()
                 : isPct    ? v=>v.toFixed(1)+'%'
                 : isRatio  ? v=>v.toFixed(2)+'x'
                 : isHr     ? v=>'$'+v.toFixed(0)+'/hr'
                 : v=>v
    return {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode:'index', intersect:false },
      plugins: {
        legend: { display: true, labels:{ font:{size:10}, boxWidth:10, padding:8 } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.y
              if (isDollar) return \` \${ctx.dataset.label}: \$\${Math.round(v).toLocaleString()}\`
              if (isPct)    return \` \${ctx.dataset.label}: \${v.toFixed(1)}%\`
              if (isRatio)  return \` \${ctx.dataset.label}: \${v.toFixed(2)}x\`
              if (isHr)     return \` \${ctx.dataset.label}: \$\${v.toFixed(0)}/hr\`
              return \` \${ctx.dataset.label}: \${v}\`
            }
          }
        }
      },
      scales: {
        y: { ticks:{ callback:tickCb, font:{size:10}, maxTicksLimit:5 }, grid:{color:'#f3f4f6'} },
        x: { ticks:{ font:{size:9}, maxRotation:45, autoSkip:true, maxTicksLimit:10 }, grid:{display:false} }
      }
    }
  }

  // ── Format summary value ─────────────────────────────────────────────
  function fmtStat(v, fmt) {
    if (fmt==='dollar') return '\$'+Math.round(v).toLocaleString()
    if (fmt==='pct')    return v.toFixed(1)+'%'
    if (fmt==='ratio')  return v.toFixed(2)+'x'
    if (fmt==='hr')     return '\$'+v.toFixed(0)+'/hr'
    return v
  }

  // ── Metric definitions ───────────────────────────────────────────────
  const metrics = [
    { id:'np',     label:'Net Profit $',       color:'#06b6d4', fmt:'dollar', extract: k=>k.np,
      target: ()=>+s.np_target,     targetLabel:'NP$ Target',
      icon:'fa-coins', formula:'NR − DL − Overhead' },
    { id:'npPct',  label:'Net Profit %',       color:'#0891b2', fmt:'pct',    extract: k=>k.npPct,
      target: ()=>+s.np_pct_target, targetLabel:'NP% Target',
      icon:'fa-percentage', formula:'NP ÷ NR' },
    { id:'ratio',  label:'NR / Direct Labor',  color:'#8b5cf6', fmt:'ratio',  extract: k=>k.nrLaborRatio,
      target: ()=>+s.nr_labor_target, targetLabel:'Target',
      icon:'fa-balance-scale', formula:'Primary efficiency KPI' },
    { id:'nr',     label:'Net Revenue',        color:'#4f6ef7', fmt:'dollar', extract: k=>k.nr,
      target: ()=>+s.nr_target,     targetLabel:'NR Target',
      icon:'fa-dollar-sign', formula:'Revenue − Materials' },
    { id:'gp',     label:'Gross Profit $',     color:'#22c55e', fmt:'dollar', extract: k=>k.gp,
      target: ()=>+s.gp_target,     targetLabel:'GP$ Target',
      icon:'fa-chart-bar', formula:'NR − Direct Labor Cost' },
    { id:'gpPct',  label:'GP %',               color:'#10b981', fmt:'pct',    extract: k=>k.gpPct,
      target: ()=>+s.gp_pct_target, targetLabel:'Target %',
      icon:'fa-percent', formula:'GP ÷ NR' },
    { id:'oh',     label:'Overhead Spend',     color:'#f59e0b', fmt:'dollar', extract: k=>k.oh,
      icon:'fa-building', formula:'Fixed OH + Indirect Labor' },
    { id:'nrhr',   label:'NR / Direct Hour',   color:'#ec4899', fmt:'hr',     extract: k=>k.nrPerHour,
      icon:'fa-clock', formula:'Revenue per billable hour' },
    { id:'dlcost', label:'Direct Labor Cost',  color:'#f97316', fmt:'dollar', extract: k=>k.dlCost,
      icon:'fa-users', formula:'Wages + Burden + Benefits' },
  ]

  // ── Track active Chart.js instances ─────────────────────────────────
  let activeCharts = []

  // ── Build YTD/range summary strip ───────────────────────────────────
  function buildSummaryStrip(rangeWeeks) {
    const strip = document.getElementById('ytd-summary-strip')
    if (!strip) return
    if (rangeWeeks.length === 0) { strip.innerHTML = ''; return }

    // Aggregate totals for the range
    let totNR=0, totGP=0, totNP=0, totDLCost=0, totOH=0, totDLH=0, ratioVals=[], gpPctVals=[], npPctVals=[]
    rangeWeeks.forEach(w => {
      const k = calcKPIs(w, 0)
      totNR     += k.nr
      totGP     += k.gp
      totNP     += k.np
      totDLCost += k.dlCost
      totOH     += k.oh
      totDLH    += k.dlh
      if (k.nrLaborRatio > 0) ratioVals.push(k.nrLaborRatio)
      if (k.gpPct > 0)        gpPctVals.push(k.gpPct)
      if (k.npPct > 0)        npPctVals.push(k.npPct)
    })
    const avgRatio = ratioVals.length ? ratioVals.reduce((a,b)=>a+b,0)/ratioVals.length : 0
    const avgGpPct = gpPctVals.length ? gpPctVals.reduce((a,b)=>a+b,0)/gpPctVals.length : 0
    const avgNpPct = npPctVals.length ? npPctVals.reduce((a,b)=>a+b,0)/npPctVals.length : 0
    const nrPerHr  = totDLH > 0 ? totNR / totDLH : 0
    const n = rangeWeeks.length

    const cards = [
      { label:'Net Profit $',      val:'\$'+Math.round(totNP).toLocaleString(),     sub:\`avg \$\${Math.round(totNP/n).toLocaleString()} · \${avgNpPct.toFixed(1)}% NP%\` },
      { label:'Net Profit %',      val:avgNpPct.toFixed(1)+'%',                    sub:\`avg over \${n} wks\` },
      { label:'NR / Direct Labor', val:avgRatio.toFixed(2)+'x',                    sub:\`Target \${(+s.nr_labor_target).toFixed(2)}x\` },
      { label:'Net Revenue',       val:'\$'+Math.round(totNR).toLocaleString(),     sub:\`\${n} wks · avg \$\${Math.round(totNR/n).toLocaleString()}\` },
      { label:'Gross Profit $',    val:'\$'+Math.round(totGP).toLocaleString(),     sub:\`avg \$\${Math.round(totGP/n).toLocaleString()} · \${avgGpPct.toFixed(1)}% GP%\` },
      { label:'GP %',              val:avgGpPct.toFixed(1)+'%',                    sub:\`Target \${(+s.gp_pct_target).toFixed(1)}%\` },
      { label:'Overhead Spend',    val:'\$'+Math.round(totOH).toLocaleString(),     sub:\`avg \$\${Math.round(totOH/n).toLocaleString()}/wk\` },
      { label:'NR / Direct Hour',  val:'\$'+nrPerHr.toFixed(0)+'/hr',              sub:\`\${Math.round(totDLH)} total DL hrs\` },
      { label:'Direct Labor Cost', val:'\$'+Math.round(totDLCost).toLocaleString(), sub:\`avg \$\${Math.round(totDLCost/n).toLocaleString()}/wk\` },
    ]
    strip.innerHTML = \`
      <div style="font-size:11px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">
        <i class="fas fa-layer-group" style="margin-right:5px;"></i>\${rangeLabel(state.chartRange)} Summary
      </div>
      <div class="ytd-strip">\${cards.map(c=>\`
        <div class="ytd-card">
          <div class="ytd-label">\${c.label}</div>
          <div class="ytd-val">\${c.val}</div>
          <div class="ytd-sub">\${c.sub}</div>
        </div>\`).join('')}
      </div>
    \`
  }

  // ── Main buildCharts function ────────────────────────────────────────
  function buildCharts() {
    // Sync tab highlights
    document.querySelectorAll('.chart-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.range === state.chartRange))

    const rangeWeeks = filterWeeks(state.chartRange)
    const labels = rangeWeeks.map(w => formatWeekLabel(w.week_start))
    const ptR = rangeWeeks.length > 20 ? 2 : (rangeWeeks.length > 10 ? 3 : 4)

    // Destroy old charts
    activeCharts.forEach(c => c.destroy())
    activeCharts = []

    // Build summary strip
    buildSummaryStrip(rangeWeeks)

    // Build chart cards
    const container = document.getElementById('charts-container')
    if (!container) return

    if (rangeWeeks.length === 0) {
      container.innerHTML = \`<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--gray-400);font-size:13px;"><i class="fas fa-inbox" style="font-size:28px;display:block;margin-bottom:8px;"></i>No data for this range</div>\`
      return
    }

    container.innerHTML = metrics.map(m =>
      \`<div class="chart-card">
        <div class="chart-card-header">
          <div class="chart-card-title">
            <i class="fas \${m.icon}" style="color:\${m.color};"></i>\${m.label}<span style="font-weight:400;color:var(--gray-400);font-size:10px;margin-left:5px;">(\${m.formula})</span>
          </div>
          <div class="chart-card-stat" id="chart-stat-\${m.id}"></div>
        </div>
        <div class="chart-card-body">
          <canvas id="chart-\${m.id}"></canvas>
        </div>
      </div>\`
    ).join('')

    metrics.forEach(m => {
      // Compute per-week values — use actual OH for the OH metric
      const values = rangeWeeks.map(w => {
        const k = calcKPIs(w, 0)
        const raw = m.extract(k)
        return isNaN(raw) ? 0 : +raw.toFixed(2)
      })

      // Summary stat shown in card header (latest value)
      const latest = values[values.length - 1] ?? 0
      const statEl = document.getElementById('chart-stat-'+m.id)
      if (statEl) statEl.textContent = fmtStat(latest, m.fmt)

      const ma = movingAvg(values, 3)

      const datasets = [
        {
          label: m.label,
          data: values,
          borderColor: m.color,
          backgroundColor: hexAlpha(m.color, 0.08),
          fill: true,
          tension: 0.35,
          pointBackgroundColor: m.color,
          pointRadius: ptR,
          pointHoverRadius: ptR + 2,
          borderWidth: 2
        },
        {
          label: '3-Wk Avg',
          data: ma,
          borderColor: '#94a3b8',
          borderDash: [4,3],
          pointRadius: 0,
          fill: false,
          tension: 0.35,
          borderWidth: 1.5
        }
      ]

      // Target line
      if (m.target) {
        const tv = m.target()
        if (tv) {
          datasets.push({
            label: m.targetLabel || 'Target',
            data: rangeWeeks.map(() => tv),
            borderColor: '#22c55e',
            borderDash: [5,4],
            pointRadius: 0,
            fill: false,
            borderWidth: 1.5
          })
        }
      }

      const c = new Chart(document.getElementById('chart-'+m.id), {
        type: 'line',
        data: { labels, datasets },
        options: chartOpts(m.fmt)
      })
      activeCharts.push(c)
    })
  }

  buildCharts()
}

function formatWeekLabel(weekStart) {
  if (!weekStart) return '—'
  const d = new Date(weekStart + 'T00:00:00')
  return (d.getMonth()+1) + '/' + d.getDate() + '/' + String(d.getFullYear()).slice(2)
}

// =====================================================================
// WEEKLY ENTRY VIEW
// =====================================================================
let entryEditId = null

async function renderEntry(editEntry=null) {
  if (!state.settings) state.settings = await api('/settings')
  const s = state.settings
  const e = editEntry || {}
  entryEditId = editEntry ? editEntry.id : null

  // Default week start = next Monday from today
  const todayWeekStart = getMonday(new Date())

  document.getElementById('page-body').innerHTML = \`
    <div class="card" style="max-width:780px;">
      <div class="card-header">
        <div class="card-title"><i class="fas fa-\${entryEditId?'edit':'plus'}-circle" style="color:var(--accent);margin-right:6px;"></i>\${entryEditId?'Edit Entry':'New Weekly Entry'}</div>
        \${entryEditId ? '<button class="btn btn-secondary btn-sm" onclick="renderEntry()"><i class="fas fa-times"></i> Cancel Edit</button>' : ''}
      </div>
      <div class="card-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Week Start Date</label>
            <input type="date" id="f-week-start" value="\${e.week_start || todayWeekStart}" />
          </div>
          <div class="form-group full">
            <label>Notes (optional)</label>
            <textarea id="f-notes" placeholder="Any notes for this week...">\${e.notes||''}</textarea>
          </div>
        </div>

        <hr class="divider" />
        <div class="section-title">Revenue & Direct Costs</div>
        <div class="section-sub">Net Revenue = Gross Revenue – Materials</div>
        <div class="form-grid" style="margin-top:12px;">
          <div class="form-group">
            <label>Gross Revenue</label>
            <div class="input-prefix"><span>$</span><input type="number" id="f-gross-rev" step="0.01" min="0" value="\${e.gross_revenue||''}" placeholder="0.00" oninput="updatePreview()" /></div>
          </div>
          <div class="form-group">
            <label>Materials</label>
            <div class="input-prefix"><span>$</span><input type="number" id="f-mats" step="0.01" min="0" value="\${e.materials||''}" placeholder="0.00" oninput="updatePreview()" /></div>
          </div>
        </div>

        <hr class="divider" />
        <div class="section-title">Direct Labor</div>
        <div class="form-grid" style="margin-top:12px;">
          <div class="form-group">
            <label>Direct Labor Wages</label>
            <div class="input-prefix"><span>$</span><input type="number" id="f-dl-wages" step="0.01" min="0" value="\${e.direct_labor_wages||''}" placeholder="0.00" oninput="updatePreview()" /></div>
          </div>
          <div class="form-group">
            <label>Direct Labor Hours</label>
            <div class="input-suffix"><span>hrs</span><input type="number" id="f-dl-hours" step="0.1" min="0" value="\${e.direct_labor_hours||''}" placeholder="0.0" oninput="updatePreview()" /></div>
          </div>
        </div>

        <hr class="divider" />
        <div class="section-title">Indirect Labor</div>
        <div class="form-grid" style="margin-top:12px;">
          <div class="form-group">
            <label>Indirect Labor Wages</label>
            <div class="input-prefix"><span>$</span><input type="number" id="f-il-wages" step="0.01" min="0" value="\${e.indirect_labor_wages||''}" placeholder="0.00" oninput="updatePreview()" /></div>
          </div>
          <div class="form-group">
            <label>Indirect Labor Hours</label>
            <div class="input-suffix"><span>hrs</span><input type="number" id="f-il-hours" step="0.1" min="0" value="\${e.indirect_labor_hours||''}" placeholder="0.0" oninput="updatePreview()" /></div>
          </div>
        </div>

        <hr class="divider" />
        <div class="section-title" style="margin-bottom:4px;">Labor Burden & Benefits</div>
        <div class="section-sub">Burden is auto-calculated from Settings rates applied to total wages.</div>
        <div class="form-grid">
          <div class="form-group">
            <label>Labor Burden (auto-calculated)</label>
            <div class="input-prefix"><span>$</span><input type="number" id="f-burden" step="0.01" placeholder="Auto" readonly style="background:var(--gray-50);color:var(--gray-500);" value="\${e.labor_burden||''}" /></div>
            <span style="font-size:11px;color:var(--gray-400);margin-top:2px;" id="burden-breakdown"></span>
          </div>
          <div class="form-group">
            <label>Additional Benefits (manual)</label>
            <div class="input-prefix"><span>$</span><input type="number" id="f-benefits" step="0.01" min="0" value="\${e.additional_benefits||''}" placeholder="0.00" oninput="updatePreview()" /></div>
          </div>
        </div>

        <!-- LIVE KPI PREVIEW -->
        <div class="kpi-preview" id="kpi-preview-box">
          <h4><i class="fas fa-bolt"></i> Live KPI Preview</h4>
          <div class="kpi-preview-grid" id="kpi-preview-grid">
            <div class="kpi-prev-item"><div class="label">Net Revenue</div><div class="val" id="prev-nr">—</div></div>
            <div class="kpi-prev-item"><div class="label">NR / Direct Labor</div><div class="val" id="prev-ratio">—</div></div>
            <div class="kpi-prev-item"><div class="label">Gross Profit $</div><div class="val" id="prev-gp">—</div></div>
            <div class="kpi-prev-item"><div class="label">GP %</div><div class="val" id="prev-gp-pct">—</div></div>
            <div class="kpi-prev-item"><div class="label">DL Cost (burdened)</div><div class="val" id="prev-labor">—</div></div>
            <div class="kpi-prev-item"><div class="label">NR / Direct Hr</div><div class="val" id="prev-nrhr">—</div></div>
          </div>
        </div>

        <div style="display:flex;gap:12px;margin-top:24px;">
          <button class="btn btn-primary" id="save-entry-btn" onclick="saveEntry()">
            <i class="fas fa-save"></i> \${entryEditId ? 'Update Entry' : 'Save Entry'}
          </button>
          <button class="btn btn-secondary" onclick="navigate('dashboard')">Cancel</button>
        </div>
      </div>
    </div>
  \`
  updatePreview()

  // Auto-fetch current fixed overhead snapshot if creating a new entry
  // (editing reuses the snapshot already saved on the entry)
  if (!entryEditId) {
    const weekStart = document.getElementById('f-week-start')?.value
    const month = weekStart ? weekStart.slice(0,7) : new Date().toISOString().slice(0,7)
    api('/overhead/summary/' + month).then(ohSummary => {
      const snap = (ohSummary.fixed_total || 0) / 4.33
      const el = document.getElementById('f-fixed-oh')
      if (el) { el.value = snap.toFixed(2); updatePreview() }
    }).catch(() => {})
  }

  // Re-fetch snapshot when week date changes (new entries only)
  document.getElementById('f-week-start')?.addEventListener('change', function() {
    if (entryEditId) return
    const month = this.value ? this.value.slice(0,7) : new Date().toISOString().slice(0,7)
    api('/overhead/summary/' + month).then(ohSummary => {
      const snap = (ohSummary.fixed_total || 0) / 4.33
      const el = document.getElementById('f-fixed-oh')
      if (el) { el.value = snap.toFixed(2); updatePreview() }
    }).catch(() => {})
  })
}

function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  return date.toISOString().slice(0,10)
}

function updatePreview() {
  const s = state.settings || {}
  const dlw = +document.getElementById('f-dl-wages')?.value || 0
  const ilw = +document.getElementById('f-il-wages')?.value || 0
  const totalWages = dlw + ilw
  const burden = calcBurden(totalWages, s)

  const burdenEl = document.getElementById('f-burden')
  if (burdenEl) burdenEl.value = burden.toFixed(2)

  const pctTotal = (+s.payroll_tax_pct||0) + (+s.workers_comp_pct||0) + (+s.fl_reemployment_pct||0) + (+s.other_burden_pct||0)
  const breakdownEl = document.getElementById('burden-breakdown')
  if (breakdownEl) breakdownEl.textContent = pctTotal.toFixed(2) + '% × $' + totalWages.toFixed(2) + ' total wages'

  const entry = {
    gross_revenue:        +document.getElementById('f-gross-rev')?.value || 0,
    materials:            +document.getElementById('f-mats')?.value      || 0,
    subcontractors:          0,
    direct_labor_wages:   dlw,
    direct_labor_hours:   +document.getElementById('f-dl-hours')?.value  || 0,
    indirect_labor_wages: ilw,
    indirect_labor_hours: +document.getElementById('f-il-hours')?.value  || 0,
    labor_burden:         burden,
    additional_benefits:  +document.getElementById('f-benefits')?.value  || 0
  }

  const kpi = calcKPIs(entry, 0)
  const target   = s.nr_labor_target || 2.0
  const gpTarget = s.gp_pct_target   || 40

  const ratioColor = kpiColor(kpi.nrLaborRatio, target,   true)
  const gpPctColor = kpiColor(kpi.gpPct,        gpTarget, true)

  const set = (id, val, cls='') => {
    const el = document.getElementById(id)
    if (el) { el.textContent = val; el.className = 'val ' + cls }
  }
  set('prev-nr',     fmt(kpi.nr))
  set('prev-ratio',  fmtX(kpi.nrLaborRatio), ratioColor)
  set('prev-gp',     fmt(kpi.gp))
  set('prev-gp-pct', fmtPct(kpi.gpPct), gpPctColor)
  set('prev-labor',  fmt(kpi.dlCost))
  set('prev-nrhr',   kpi.dlh > 0 ? fmt(kpi.nrPerHour) : '—')
}

async function saveEntry() {
  const burden = +document.getElementById('f-burden')?.value || 0
  const body = {
    week_start:           document.getElementById('f-week-start').value,
    notes:                document.getElementById('f-notes').value,
    gross_revenue:        +document.getElementById('f-gross-rev').value || 0,
    materials:            +document.getElementById('f-mats').value      || 0,
    subcontractors:          0,
    direct_labor_wages:   +document.getElementById('f-dl-wages').value  || 0,
    direct_labor_hours:   +document.getElementById('f-dl-hours').value  || 0,
    indirect_labor_wages: +document.getElementById('f-il-wages').value  || 0,
    indirect_labor_hours: +document.getElementById('f-il-hours').value  || 0,
    labor_burden:         burden,
    additional_benefits:  +document.getElementById('f-benefits').value  || 0
  }

  if (!body.week_start) { showToast('Please select a week start date.', 'error'); return }

  const btn = document.getElementById('save-entry-btn')
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'

  try {
    if (entryEditId) {
      await api('/weeks/' + entryEditId, { method: 'PUT', body: JSON.stringify(body) })
      showToast('Entry updated!')
    } else {
      const created = await api('/weeks', { method: 'POST', body: JSON.stringify(body) })
      state.selectedWeekId = created.id
      showToast('Entry saved!')
    }
    navigate('dashboard')
  } catch(err) {
    showToast('Error: ' + err.message, 'error')
    btn.disabled = false
    btn.innerHTML = '<i class="fas fa-save"></i> Save Entry'
  }
}

// =====================================================================
// OVERHEAD VIEW
// =====================================================================
async function renderOverhead() {
  const [fixed, s] = await Promise.all([api('/overhead/fixed'), api('/settings')])
  state.overheadFixed = fixed
  state.settings = s
  const onetime = await api('/overhead/onetime?month=' + state.currentMonth)
  state.overheadOnetime = onetime

  const fixedTotal = fixed.filter(f=>f.active).reduce((a,b)=>a+(+b.amount),0)
  const onetimeTotal = onetime.reduce((a,b)=>a+(+b.amount),0)

  const fixedRows = fixed.length ? fixed.map(item => \`
    <tr>
      <td>
        <div style="font-weight:600;">\${item.name}</div>
        \${item.notes ? \`<div style="font-size:11px;color:var(--gray-400);margin-top:2px;">\${item.notes}</div>\` : ''}
      </td>
      <td>\${fmt(item.amount)}</td>
      <td>
        <div class="toggle \${item.active?'on':''}" onclick="toggleFixed(\${item.id},\${item.active?0:1},this)">
          <div class="toggle-track"><div class="toggle-thumb"></div></div>
          <span class="toggle-label">\${item.active?'Active':'Off'}</span>
        </div>
      </td>
      <td>
        <div class="td-actions">
          <button class="btn-icon" onclick="editFixed(\${item.id})"><i class="fas fa-pen"></i></button>
          <button class="btn-icon danger" onclick="deleteFixed(\${item.id})"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>\`).join('') : '<tr><td colspan="4"><div class="empty-state" style="padding:20px;"><i class="fas fa-plus-circle" style="font-size:20px;"></i><p>No fixed items yet</p></div></td></tr>'

  const onetimeRows = onetime.length ? onetime.map(item => \`
    <tr>
      <td>\${item.name}</td>
      <td>\${fmt(item.amount)}</td>
      <td>
        <div class="td-actions">
          <button class="btn-icon" onclick="editOnetime(\${item.id})"><i class="fas fa-pen"></i></button>
          <button class="btn-icon danger" onclick="deleteOnetime(\${item.id})"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>\`).join('') : '<tr><td colspan="3"><div class="empty-state" style="padding:20px;"><i class="fas fa-plus-circle" style="font-size:20px;"></i><p>No one-time items this month</p></div></td></tr>'

  document.getElementById('page-body').innerHTML = \`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <!-- FIXED -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title"><i class="fas fa-repeat" style="color:var(--accent);margin-right:6px;"></i>Fixed Monthly Overhead</div>
            <div style="font-size:11px;color:var(--gray-400);margin-top:2px;">Apply every month automatically</div>
          </div>
          <div>
            <div style="text-align:right;font-size:18px;font-weight:700;color:var(--gray-900);">\${fmt(fixedTotal)}/mo</div>
            <div style="text-align:right;font-size:11px;color:var(--gray-400);">\${fmt(fixedTotal/4.33)}/wk avg</div>
          </div>
        </div>
        <div class="card-body" style="padding:0;">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Item</th><th>Amount</th><th>Status</th><th></th></tr></thead>
              <tbody id="fixed-tbody">\${fixedRows}</tbody>
            </table>
          </div>
          <div style="padding:16px;">
            <button class="btn btn-primary btn-sm" onclick="openFixedModal()"><i class="fas fa-plus"></i> Add Fixed Item</button>
          </div>
        </div>
      </div>

      <!-- ONE-TIME -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title"><i class="fas fa-calendar-day" style="color:var(--accent);margin-right:6px;"></i>One-Time Items</div>
            <div style="font-size:11px;color:var(--gray-400);margin-top:2px;">Non-recurring expenses this month</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <input type="month" id="onetime-month" value="\${state.currentMonth}" onchange="changeOnetimeMonth(this.value)" style="font-size:12px;padding:5px 10px;border:1.5px solid var(--gray-200);border-radius:8px;font-family:inherit;" />
          </div>
        </div>
        <div class="card-body" style="padding:0;">
          <div style="background:var(--accent-light);padding:10px 16px;border-bottom:1px solid rgba(79,110,247,.1);display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:12px;font-weight:600;color:var(--gray-600);">Month Total</span>
            <span style="font-size:16px;font-weight:700;color:var(--gray-900);">\${fmt(onetimeTotal)}</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Item</th><th>Amount</th><th></th></tr></thead>
              <tbody id="onetime-tbody">\${onetimeRows}</tbody>
            </table>
          </div>
          <div style="padding:16px;">
            <button class="btn btn-primary btn-sm" onclick="openOnetimeModal()"><i class="fas fa-plus"></i> Add One-Time Item</button>
          </div>
        </div>
      </div>
    </div>

    <!-- SUMMARY CARD -->
    <div class="card" style="margin-top:20px;">
      <div class="card-header"><div class="card-title">Monthly Overhead Summary — \${state.currentMonth}</div></div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px;text-align:center;">
          <div><div style="font-size:11px;font-weight:600;color:var(--gray-400);text-transform:uppercase;">Fixed</div><div style="font-size:22px;font-weight:700;color:var(--gray-900);margin-top:4px;">\${fmt(fixedTotal)}</div></div>
          <div><div style="font-size:11px;font-weight:600;color:var(--gray-400);text-transform:uppercase;">One-Time</div><div style="font-size:22px;font-weight:700;color:var(--gray-900);margin-top:4px;">\${fmt(onetimeTotal)}</div></div>
          <div><div style="font-size:11px;font-weight:600;color:var(--gray-400);text-transform:uppercase;">Grand Total</div><div style="font-size:22px;font-weight:700;color:var(--accent);margin-top:4px;">\${fmt(fixedTotal+onetimeTotal)}</div></div>
          <div><div style="font-size:11px;font-weight:600;color:var(--gray-400);text-transform:uppercase;">Weekly Avg</div><div style="font-size:22px;font-weight:700;color:var(--gray-900);margin-top:4px;">\${fmt((fixedTotal+onetimeTotal)/4.33)}</div></div>
        </div>
      </div>
    </div>
  \`
}

async function changeOnetimeMonth(m) {
  state.currentMonth = m
  await renderOverhead()
}

async function toggleFixed(id, newActive, el) {
  const item = state.overheadFixed.find(f=>f.id===id)
  if (!item) return
  try {
    await api('/overhead/fixed/' + id, { method:'PUT', body: JSON.stringify({...item, active: newActive}) })
    await renderOverhead()
  } catch(e) { showToast('Error: ' + e.message, 'error') }
}

function openFixedModal(item=null) {
  const mc = document.getElementById('modal-container')
  mc.innerHTML = \`
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">\${item?'Edit Fixed Item':'Add Fixed Item'}</div>
          <button class="btn-icon" onclick="closeModal()"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div class="form-group" style="margin-bottom:16px;">
            <label>Item Name</label>
            <input type="text" id="m-fixed-name" value="\${item?.name||''}" placeholder="e.g. Rent, Insurance..." />
          </div>
          <div class="form-group" style="margin-bottom:16px;">
            <label>Monthly Amount</label>
            <div class="input-prefix"><span>$</span><input type="number" id="m-fixed-amount" step="0.01" min="0" value="\${item?.amount||''}" placeholder="0.00" /></div>
          </div>
          <div class="form-group">
            <label>Notes <span style="font-weight:400;color:var(--gray-400);">(optional)</span></label>
            <input type="text" id="m-fixed-notes" value="\${item?.notes||''}" placeholder="e.g. TECO - Power, General liability..." />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="saveFixed(\${item?.id||'null'})"><i class="fas fa-save"></i> Save</button>
        </div>
      </div>
    </div>\`
}

async function editFixed(id) {
  const item = state.overheadFixed.find(f=>f.id===id)
  openFixedModal(item)
}

async function saveFixed(id) {
  const name = document.getElementById('m-fixed-name').value.trim()
  const amount = +document.getElementById('m-fixed-amount').value || 0
  const notes = document.getElementById('m-fixed-notes').value.trim()
  if (!name) { showToast('Please enter a name.', 'error'); return }
  try {
    if (id && id !== 'null') {
      const item = state.overheadFixed.find(f=>f.id===id)
      await api('/overhead/fixed/' + id, { method:'PUT', body: JSON.stringify({...item, name, amount, notes}) })
    } else {
      await api('/overhead/fixed', { method:'POST', body: JSON.stringify({name, amount, notes}) })
    }
    closeModal()
    showToast('Saved!')
    await renderOverhead()
  } catch(e) { showToast('Error: ' + e.message, 'error') }
}

async function deleteFixed(id) {
  if (!confirm('Delete this fixed item?')) return
  try {
    await api('/overhead/fixed/' + id, { method:'DELETE' })
    showToast('Deleted.')
    await renderOverhead()
  } catch(e) { showToast('Error: ' + e.message, 'error') }
}

function openOnetimeModal(item=null) {
  const mc = document.getElementById('modal-container')
  mc.innerHTML = \`
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">\${item?'Edit One-Time Item':'Add One-Time Item'}</div>
          <button class="btn-icon" onclick="closeModal()"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div class="form-group" style="margin-bottom:16px;">
            <label>Month</label>
            <input type="month" id="m-ot-month" value="\${item?.month||state.currentMonth}" />
          </div>
          <div class="form-group" style="margin-bottom:16px;">
            <label>Item Name</label>
            <input type="text" id="m-ot-name" value="\${item?.name||''}" placeholder="e.g. Equipment repair..." />
          </div>
          <div class="form-group">
            <label>Amount</label>
            <div class="input-prefix"><span>$</span><input type="number" id="m-ot-amount" step="0.01" min="0" value="\${item?.amount||''}" placeholder="0.00" /></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="saveOnetime(\${item?.id||'null'})"><i class="fas fa-save"></i> Save</button>
        </div>
      </div>
    </div>\`
}

async function editOnetime(id) {
  const item = state.overheadOnetime.find(f=>f.id===id)
  openOnetimeModal(item)
}

async function saveOnetime(id) {
  const month = document.getElementById('m-ot-month').value
  const name = document.getElementById('m-ot-name').value.trim()
  const amount = +document.getElementById('m-ot-amount').value || 0
  if (!name) { showToast('Please enter a name.', 'error'); return }
  if (!month) { showToast('Please select a month.', 'error'); return }
  try {
    if (id && id !== 'null') {
      await api('/overhead/onetime/' + id, { method:'PUT', body: JSON.stringify({month, name, amount}) })
    } else {
      await api('/overhead/onetime', { method:'POST', body: JSON.stringify({month, name, amount}) })
    }
    closeModal()
    showToast('Saved!')
    await renderOverhead()
  } catch(e) { showToast('Error: ' + e.message, 'error') }
}

async function deleteOnetime(id) {
  if (!confirm('Delete this item?')) return
  try {
    await api('/overhead/onetime/' + id, { method:'DELETE' })
    showToast('Deleted.')
    await renderOverhead()
  } catch(e) { showToast('Error: ' + e.message, 'error') }
}

// =====================================================================
// HISTORY VIEW
// =====================================================================
let historySearch = ''

async function renderHistory() {
  const [weeks, settings] = await Promise.all([api('/weeks'), api('/settings')])
  state.weeks = weeks
  state.settings = settings

  const filtered = weeks.filter(w =>
    !historySearch ||
    w.week_start?.includes(historySearch) ||
    (w.notes||'').toLowerCase().includes(historySearch.toLowerCase())
  )

  const rows = filtered.length ? filtered.map(w => {
    const kpi = calcKPIs(w, 0)
    const ratioColor = kpiColor(kpi.nrLaborRatio, settings.nr_labor_target, true)
    const gpColor = kpiColor(kpi.gpPct, settings.gp_pct_target, true)
    const npColor = kpi.np >= 0 ? 'green' : 'red'
    return \`<tr>
      <td style="font-weight:600;">\${w.week_start}</td>
      <td>\${fmt(w.gross_revenue)}</td>
      <td>\${fmt(kpi.nr)}</td>
      <td><span class="badge badge-\${gpColor}">\${fmt(kpi.gp)} <span style="font-weight:400;opacity:.7;">\${fmtPct(kpi.gpPct)}</span></span></td>
      <td><span class="badge badge-\${ratioColor}">\${fmtX(kpi.nrLaborRatio)}</span></td>
      <td><span class="badge badge-\${npColor}">\${fmt(kpi.np)}</span></td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="\${w.notes||''}">\${w.notes||'—'}</td>
      <td>
        <div class="td-actions">
          <button class="btn-icon" title="Edit" onclick="editWeek(\${w.id})"><i class="fas fa-pen"></i></button>
          <button class="btn-icon danger" title="Delete" onclick="deleteWeek(\${w.id})"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>\`
  }).join('') : \`<tr><td colspan="8"><div class="empty-state" style="padding:28px;"><i class="fas fa-search" style="font-size:24px;"></i><p>\${historySearch?'No results found.':'No entries yet.'}</p></div></td></tr>\`

  document.getElementById('page-body').innerHTML = \`
    <div class="card">
      <div class="card-header">
        <div class="card-title"><i class="fas fa-history" style="color:var(--accent);margin-right:6px;"></i>All Weekly Entries (\${weeks.length})</div>
        <div class="search-wrap" style="width:240px;">
          <i class="fas fa-search"></i>
          <input type="text" placeholder="Search by date or notes..." value="\${historySearch}" oninput="historySearch=this.value;renderHistory()" />
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Week Start</th><th>Gross Rev</th><th>Net Rev</th><th>Gross Profit / GP%</th><th>NR/DL</th><th>Net Profit</th><th>Notes</th><th></th>
            </tr>
          </thead>
          <tbody>\${rows}</tbody>
        </table>
      </div>
    </div>
  \`
}

async function editWeek(id) {
  const entry = await api('/weeks/' + id)
  navigate('entry')
  renderEntry(entry)
}

async function deleteWeek(id) {
  if (!confirm('Delete this weekly entry? This cannot be undone.')) return
  try {
    await api('/weeks/' + id, { method: 'DELETE' })
    showToast('Entry deleted.')
    if (state.selectedWeekId === id) state.selectedWeekId = null
    await renderHistory()
  } catch(e) { showToast('Error: ' + e.message, 'error') }
}

// =====================================================================
// SETTINGS VIEW
// =====================================================================
async function renderSettings() {
  const s = await api('/settings')
  state.settings = s

  document.getElementById('page-body').innerHTML = \`
    <div class="card" style="max-width:680px;">
      <div class="card-header">
        <div class="card-title"><i class="fas fa-cog" style="color:var(--accent);margin-right:6px;"></i>Application Settings</div>
      </div>
      <div class="card-body">

        <div class="settings-section">
          <div class="settings-section-title">Business</div>
          <div class="settings-grid">
            <div class="form-group full">
              <label>Business Name</label>
              <input type="text" id="s-biz-name" value="\${s.business_name||''}" placeholder="Your Business Name" />
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Labor Burden Rates</div>
          <div class="section-sub" style="margin-bottom:14px;">These rates are applied to total wages to auto-calculate labor burden in Weekly Entry.</div>
          <div class="settings-grid">
            <div class="form-group">
              <label>Payroll Tax %</label>
              <div class="input-suffix"><span>%</span><input type="number" id="s-pt" step="0.01" min="0" max="100" value="\${s.payroll_tax_pct}" /></div>
              <span style="font-size:11px;color:var(--gray-400);">Default: 7.65%</span>
            </div>
            <div class="form-group">
              <label>Workers' Comp %</label>
              <div class="input-suffix"><span>%</span><input type="number" id="s-wc" step="0.01" min="0" max="100" value="\${s.workers_comp_pct}" /></div>
              <span style="font-size:11px;color:var(--gray-400);">Default: 4.00%</span>
            </div>
            <div class="form-group">
              <label>FL Reemployment Tax %</label>
              <div class="input-suffix"><span>%</span><input type="number" id="s-fl" step="0.01" min="0" max="100" value="\${s.fl_reemployment_pct}" /></div>
              <span style="font-size:11px;color:var(--gray-400);">Default: 0.50%</span>
            </div>
            <div class="form-group">
              <label>Other Burden %</label>
              <div class="input-suffix"><span>%</span><input type="number" id="s-ob" step="0.01" min="0" max="100" value="\${s.other_burden_pct}" /></div>
              <span style="font-size:11px;color:var(--gray-400);">Default: 0.00%</span>
            </div>
          </div>
          <div style="margin-top:12px;padding:12px 16px;background:var(--accent-light);border-radius:8px;font-size:13px;color:var(--gray-700);">
            <strong>Total Burden Rate:</strong> <span id="total-burden-rate"></span>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">KPI Targets</div>
          <div class="section-sub" style="margin-bottom:14px;">Used for color-coding KPI cards and target lines on charts. Set to 0 to disable a target line.</div>

          <div style="font-size:11px;font-weight:700;color:var(--gray-500);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Ratio &amp; Percentage Targets</div>
          <div class="settings-grid" style="margin-bottom:20px;">
            <div class="form-group">
              <label>NR / Labor Cost Target</label>
              <div class="input-suffix"><span>x</span><input type="number" id="s-nrl" step="0.1" min="0" value="\${s.nr_labor_target}" /></div>
              <span style="font-size:11px;color:var(--gray-400);">Default: 2.0x</span>
            </div>
            <div class="form-group">
              <label>Gross Profit % Target</label>
              <div class="input-suffix"><span>%</span><input type="number" id="s-gp" step="0.1" min="0" max="100" value="\${s.gp_pct_target}" /></div>
              <span style="font-size:11px;color:var(--gray-400);">Default: 40%</span>
            </div>
            <div class="form-group">
              <label>Net Profit % Target</label>
              <div class="input-suffix"><span>%</span><input type="number" id="s-nppct" step="0.1" min="0" max="100" value="\${s.np_pct_target||0}" /></div>
              <span style="font-size:11px;color:var(--gray-400);">e.g. 15%</span>
            </div>
          </div>

          <div style="font-size:11px;font-weight:700;color:var(--gray-500);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Weekly Dollar Targets</div>
          <div class="settings-grid">
            <div class="form-group">
              <label>Net Revenue Target (weekly)</label>
              <div class="input-prefix"><span>\$</span><input type="number" id="s-nr" step="100" min="0" value="\${s.nr_target||0}" /></div>
              <span style="font-size:11px;color:var(--gray-400);">e.g. 75000</span>
            </div>
            <div class="form-group">
              <label>Gross Profit $ Target (weekly)</label>
              <div class="input-prefix"><span>\$</span><input type="number" id="s-gpdollar" step="100" min="0" value="\${s.gp_target||0}" /></div>
              <span style="font-size:11px;color:var(--gray-400);">e.g. 30000</span>
            </div>
            <div class="form-group">
              <label>Net Profit $ Target (weekly)</label>
              <div class="input-prefix"><span>\$</span><input type="number" id="s-np" step="100" min="0" value="\${s.np_target||0}" /></div>
              <span style="font-size:11px;color:var(--gray-400);">e.g. 10000</span>
            </div>
          </div>
        </div>

        <button class="btn btn-primary" onclick="saveSettings()">
          <i class="fas fa-save"></i> Save Settings
        </button>
      </div>
    </div>
  \`

  // Live total burden rate
  const updateRate = () => {
    const t = (+document.getElementById('s-pt').value||0) +
              (+document.getElementById('s-wc').value||0) +
              (+document.getElementById('s-fl').value||0) +
              (+document.getElementById('s-ob').value||0)
    const el = document.getElementById('total-burden-rate')
    if (el) el.textContent = t.toFixed(2) + '%'
  }
  updateRate()
  ;['s-pt','s-wc','s-fl','s-ob'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateRate)
  })
}

async function saveSettings() {
  const body = {
    business_name: document.getElementById('s-biz-name').value,
    payroll_tax_pct: +document.getElementById('s-pt').value || 0,
    workers_comp_pct: +document.getElementById('s-wc').value || 0,
    fl_reemployment_pct: +document.getElementById('s-fl').value || 0,
    other_burden_pct: +document.getElementById('s-ob').value || 0,
    nr_labor_target: +document.getElementById('s-nrl').value || 2.0,
    gp_pct_target: +document.getElementById('s-gp').value || 40.0,
    np_target:     +document.getElementById('s-np').value     || 0,
    np_pct_target: +document.getElementById('s-nppct').value  || 0,
    gp_target:     +document.getElementById('s-gpdollar').value || 0,
    nr_target:     +document.getElementById('s-nr').value     || 0
  }
  try {
    state.settings = await api('/settings', { method:'PUT', body: JSON.stringify(body) })
    document.getElementById('business-name-display').textContent = state.settings.business_name
    showToast('Settings saved!')
  } catch(e) { showToast('Error: ' + e.message, 'error') }
}

// =====================================================================
// MODAL HELPERS
// =====================================================================
function closeModal() {
  document.getElementById('modal-container').innerHTML = ''
}

// =====================================================================
// INIT
// =====================================================================
async function init() {
  try {
    state.settings = await api('/settings')
    document.getElementById('business-name-display').textContent = state.settings?.business_name || 'NuWave Composites'
  } catch(e) {}
  navigate('dashboard')
}

init()
</script>
</body>
</html>`
}

export default app
