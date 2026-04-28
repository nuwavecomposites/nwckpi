-- NuWave Composites KPI Dashboard - Initial Schema

-- Settings table (single row)
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
);

-- Insert default settings row
INSERT OR IGNORE INTO settings (id) VALUES (1);

-- Weekly entries table
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
);

-- Overhead fixed items (recurring monthly)
CREATE TABLE IF NOT EXISTS overhead_fixed (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Overhead one-time items (per month)
CREATE TABLE IF NOT EXISTS overhead_onetime (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,  -- YYYY-MM format
  name TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weekly_entries_week_start ON weekly_entries(week_start DESC);
CREATE INDEX IF NOT EXISTS idx_overhead_onetime_month ON overhead_onetime(month);
