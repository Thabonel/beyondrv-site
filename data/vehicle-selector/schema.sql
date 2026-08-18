PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  manufacturer TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  published_date TEXT,
  accessed_date TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('manufacturer_pdf', 'manufacturer_webpage')),
  market TEXT NOT NULL DEFAULT 'AU',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS vehicle_variants (
  id TEXT PRIMARY KEY,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  model_year_start INTEGER NOT NULL,
  model_year_end INTEGER,
  grade TEXT NOT NULL,
  cab_type TEXT NOT NULL,
  body_type TEXT NOT NULL,
  drivetrain TEXT,
  engine TEXT,
  transmission TEXT,
  certification_category TEXT,
  licence_class_note TEXT,
  wheelbase_mm INTEGER,
  kerb_mass_kg INTEGER,
  kerb_mass_basis TEXT,
  gvm_kg INTEGER NOT NULL,
  gcm_kg INTEGER,
  front_gawr_kg INTEGER,
  rear_gawr_kg INTEGER,
  published_payload_kg INTEGER,
  payload_basis TEXT NOT NULL,
  braked_towing_kg INTEGER,
  towball_limit_kg INTEGER,
  usable_load_length_mm INTEGER,
  usable_load_width_mm INTEGER,
  cab_to_rear_axle_mm INTEGER,
  source_id TEXT NOT NULL REFERENCES sources(id),
  source_locator TEXT NOT NULL,
  verification_status TEXT NOT NULL CHECK (
    verification_status IN ('source_verified', 'source_verified_model_level', 'needs_secondary_review')
  ),
  customer_selectable INTEGER NOT NULL DEFAULT 0 CHECK (customer_selectable IN (0, 1)),
  notes TEXT,
  CHECK (model_year_end IS NULL OR model_year_end >= model_year_start),
  CHECK (gvm_kg > 0),
  CHECK (kerb_mass_kg IS NULL OR kerb_mass_kg > 0),
  CHECK (published_payload_kg IS NULL OR published_payload_kg >= 0)
);

CREATE INDEX IF NOT EXISTS vehicle_variant_lookup_idx
  ON vehicle_variants(make, model, model_year_start, cab_type, grade);

CREATE INDEX IF NOT EXISTS vehicle_variant_review_idx
  ON vehicle_variants(customer_selectable, verification_status);

CREATE TABLE IF NOT EXISTS vehicle_model_coverage (
  id TEXT PRIMARY KEY,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  platform_category TEXT NOT NULL,
  australian_market_status TEXT NOT NULL,
  selector_priority INTEGER NOT NULL CHECK (selector_priority BETWEEN 1 AND 3),
  fitment_mode TEXT NOT NULL CHECK (
    fitment_mode IN ('tray_cab_chassis', 'tub_or_tray_conversion', 'truck_body', 'specialist_review')
  ),
  research_status TEXT NOT NULL CHECK (
    research_status IN ('seeded', 'partially_seeded', 'source_identified', 'research_backlog', 'specialist_review', 'exclude_from_automatic_match')
  ),
  rationale TEXT
);

CREATE TABLE IF NOT EXISTS data_review_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  variant_id TEXT NOT NULL REFERENCES vehicle_variants(id),
  reviewed_at TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'changes_requested')),
  notes TEXT
);

CREATE VIEW IF NOT EXISTS vehicle_variant_quality AS
SELECT
  v.*,
  CASE
    WHEN v.kerb_mass_kg IS NOT NULL
      AND v.published_payload_kg IS NOT NULL
      AND v.gvm_kg - v.kerb_mass_kg = v.published_payload_kg
    THEN 1
    WHEN v.kerb_mass_kg IS NULL OR v.published_payload_kg IS NULL
    THEN NULL
    ELSE 0
  END AS payload_arithmetic_matches,
  s.url AS source_url,
  s.published_date AS source_published_date,
  s.accessed_date AS source_accessed_date
FROM vehicle_variants v
JOIN sources s ON s.id = v.source_id;

-- Fixed expedition bodies and heavy 4x4 chassis need a different data model
-- from removable slide-ons. Chassis-cab axle distribution and body/subframe
-- mounting constraints cannot be represented as tray dimensions.
CREATE TABLE IF NOT EXISTS heavy_overland_chassis (
  id TEXT PRIMARY KEY,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  model_year_start INTEGER,
  model_year_end INTEGER,
  variant TEXT NOT NULL,
  cab_type TEXT NOT NULL,
  axle_configuration TEXT NOT NULL,
  drivetrain TEXT NOT NULL,
  engine TEXT,
  transmission TEXT,
  wheelbase_mm INTEGER,
  gvm_kg INTEGER NOT NULL,
  gcm_kg INTEGER,
  front_axle_limit_kg INTEGER,
  rear_axle_limit_kg INTEGER,
  chassis_cab_front_mass_kg INTEGER,
  chassis_cab_rear_mass_kg INTEGER,
  chassis_cab_total_mass_kg INTEGER,
  published_body_payload_kg INTEGER,
  mass_basis TEXT NOT NULL,
  cab_to_rear_axle_mm INTEGER,
  max_body_length_mm INTEGER,
  max_body_width_mm INTEGER,
  braked_towing_kg INTEGER,
  licence_class_note TEXT,
  mounting_architecture_note TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES sources(id),
  source_locator TEXT NOT NULL,
  verification_status TEXT NOT NULL CHECK (
    verification_status IN ('source_verified', 'source_verified_model_level', 'needs_secondary_review')
  ),
  customer_selectable INTEGER NOT NULL DEFAULT 0 CHECK (customer_selectable IN (0, 1)),
  notes TEXT,
  CHECK (model_year_end IS NULL OR model_year_end >= model_year_start),
  CHECK (gvm_kg > 4500),
  CHECK (chassis_cab_total_mass_kg IS NULL OR chassis_cab_total_mass_kg > 0),
  CHECK (published_body_payload_kg IS NULL OR published_body_payload_kg >= 0)
);

CREATE INDEX IF NOT EXISTS heavy_overland_lookup_idx
  ON heavy_overland_chassis(make, model, model_year_start, cab_type, wheelbase_mm);

CREATE VIEW IF NOT EXISTS heavy_overland_chassis_quality AS
SELECT
  h.*,
  CASE
    WHEN h.chassis_cab_front_mass_kg IS NOT NULL
      AND h.chassis_cab_rear_mass_kg IS NOT NULL
      AND h.chassis_cab_total_mass_kg = h.chassis_cab_front_mass_kg + h.chassis_cab_rear_mass_kg
    THEN 1
    WHEN h.chassis_cab_front_mass_kg IS NULL OR h.chassis_cab_rear_mass_kg IS NULL
    THEN NULL
    ELSE 0
  END AS axle_mass_arithmetic_matches,
  CASE
    WHEN h.chassis_cab_total_mass_kg IS NOT NULL
      AND h.published_body_payload_kg IS NOT NULL
      AND h.gvm_kg - h.chassis_cab_total_mass_kg = h.published_body_payload_kg
    THEN 1
    WHEN h.chassis_cab_total_mass_kg IS NULL OR h.published_body_payload_kg IS NULL
    THEN NULL
    ELSE 0
  END AS payload_arithmetic_matches,
  s.url AS source_url,
  s.published_date AS source_published_date,
  s.accessed_date AS source_accessed_date
FROM heavy_overland_chassis h
JOIN sources s ON s.id = h.source_id;
