-- Seed data for NuWave Composites KPI Dashboard
-- Sample weekly entries
INSERT OR IGNORE INTO weekly_entries (week_start, notes, gross_revenue, cogs, direct_labor_wages, direct_labor_hours, indirect_labor_wages, indirect_labor_hours, labor_burden, additional_benefits) VALUES
  ('2026-04-21', 'Strong close to April', 47500, 19000, 8800, 218, 2300, 40, 1345.35, 320),
  ('2026-04-14', 'New lamination job started', 52000, 20800, 9200, 230, 2400, 42, 1409.40, 350),
  ('2026-04-07', 'Slower — weather delays', 38000, 15200, 7800, 195, 2000, 38, 1190.70, 280),
  ('2026-03-31', 'Month-end push', 55000, 22000, 9800, 245, 2600, 44, 1497.30, 380),
  ('2026-03-24', 'Good production week', 49000, 19600, 9000, 225, 2350, 41, 1374.75, 330),
  ('2026-03-17', 'Training new hire', 41000, 16400, 8200, 205, 2150, 39, 1252.65, 295),
  ('2026-03-10', 'Large commercial order', 61000, 24400, 10500, 260, 2800, 46, 1603.35, 410),
  ('2026-03-03', 'Normal week', 44000, 17600, 8600, 215, 2250, 40, 1313.85, 315);

-- Seed fixed overhead items
INSERT OR IGNORE INTO overhead_fixed (name, amount, active) VALUES
  ('Rent / Facility', 4200, 1),
  ('Utilities', 650, 1),
  ('Insurance', 1100, 1),
  ('Equipment Lease', 800, 1),
  ('Phone / Internet', 180, 1);

-- Seed one-time overhead for current months
INSERT OR IGNORE INTO overhead_onetime (month, name, amount) VALUES
  ('2026-04', 'Forklift repair', 1200),
  ('2026-03', 'Safety audit fee', 450);
