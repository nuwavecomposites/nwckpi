-- Add 4 new target columns to settings
ALTER TABLE settings ADD COLUMN np_target REAL NOT NULL DEFAULT 0;
ALTER TABLE settings ADD COLUMN np_pct_target REAL NOT NULL DEFAULT 0;
ALTER TABLE settings ADD COLUMN gp_target REAL NOT NULL DEFAULT 0;
ALTER TABLE settings ADD COLUMN nr_target REAL NOT NULL DEFAULT 0;
