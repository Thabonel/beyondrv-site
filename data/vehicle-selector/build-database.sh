#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
DB_PATH="$SCRIPT_DIR/australian-slide-on-vehicles.sqlite"

rm -f "$DB_PATH"
sqlite3 "$DB_PATH" < "$SCRIPT_DIR/schema.sql"
sqlite3 "$DB_PATH" < "$SCRIPT_DIR/seed.sql"

FK_ERRORS="$(sqlite3 "$DB_PATH" "PRAGMA foreign_key_check;")"
ARITHMETIC_ERRORS="$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM vehicle_variant_quality WHERE payload_arithmetic_matches = 0;")"
MASS_ERRORS="$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM vehicle_variants WHERE gcm_kg IS NOT NULL AND gvm_kg > gcm_kg;")"
UNSAFE_SEED_ROWS="$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM vehicle_variants WHERE customer_selectable <> 0;")"
HEAVY_ARITHMETIC_ERRORS="$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM heavy_overland_chassis_quality WHERE axle_mass_arithmetic_matches = 0 OR payload_arithmetic_matches = 0;")"
UNSAFE_HEAVY_ROWS="$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM heavy_overland_chassis WHERE customer_selectable <> 0;")"

if [[ -n "$FK_ERRORS" ]]; then
  echo "Foreign-key validation failed: $FK_ERRORS" >&2
  exit 1
fi

if [[ "$ARITHMETIC_ERRORS" != "0" || "$MASS_ERRORS" != "0" || "$UNSAFE_SEED_ROWS" != "0" || "$HEAVY_ARITHMETIC_ERRORS" != "0" || "$UNSAFE_HEAVY_ROWS" != "0" ]]; then
  echo "Data validation failed: payload=$ARITHMETIC_ERRORS mass=$MASS_ERRORS selectable=$UNSAFE_SEED_ROWS heavy_arithmetic=$HEAVY_ARITHMETIC_ERRORS heavy_selectable=$UNSAFE_HEAVY_ROWS" >&2
  exit 1
fi

sqlite3 -header -csv "$DB_PATH" "SELECT * FROM vehicle_variant_quality ORDER BY make, model, grade;" > "$SCRIPT_DIR/vehicle-variants.csv"
sqlite3 -header -csv "$DB_PATH" "SELECT * FROM heavy_overland_chassis_quality ORDER BY make, model, variant;" > "$SCRIPT_DIR/heavy-overland-chassis.csv"
sqlite3 -header -csv "$DB_PATH" "SELECT * FROM sources ORDER BY manufacturer, published_date;" > "$SCRIPT_DIR/sources.csv"
sqlite3 -header -csv "$DB_PATH" "SELECT * FROM vehicle_model_coverage ORDER BY selector_priority, make, model;" > "$SCRIPT_DIR/model-coverage.csv"

echo "Built $DB_PATH"
sqlite3 "$DB_PATH" "SELECT COUNT(*) || ' slide-on variants; ' || (SELECT COUNT(*) FROM heavy_overland_chassis) || ' heavy-overland chassis; ' || (SELECT COUNT(*) FROM sources) || ' sources; ' || (SELECT COUNT(*) FROM vehicle_model_coverage) || ' model coverage rows' FROM vehicle_variants;"
