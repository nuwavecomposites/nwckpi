-- Add fixed overhead snapshot to weekly entries
-- Saves the fixed overhead total at time of entry so past KPIs are never affected by future overhead changes
ALTER TABLE weekly_entries ADD COLUMN fixed_overhead_snapshot REAL NOT NULL DEFAULT 0;
