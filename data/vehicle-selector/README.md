# Australian slide-on and heavy-overland vehicle research database

This directory contains a conservative, source-backed seed database for the proposed Beyond RV customer vehicle selector.

## Files

- `schema.sql` — normalized SQLite schema, provenance and review workflow.
- `seed.sql` — researched Australian vehicle variants and coverage backlog.
- `australian-slide-on-vehicles.sqlite` — generated working database.
- `vehicle-variants.csv` — generated flat export for review and spreadsheet use.
- `heavy-overland-chassis.csv` — generated expedition-chassis export with axle distribution and body-mounting fields.
- `sources.csv` — generated source register.
- `model-coverage.csv` — generated Australian platform scope and research backlog.
- `build-database.sh` — deterministic rebuild and export script.

## Safety and interpretation

The database is a research seed, not a legal fitment certificate. Every row is deliberately `customer_selectable = 0`. A row should become customer-selectable only after:

1. A second person checks the exact model year, grade, cab, body, engine, transmission and drivetrain against the source.
2. The source is still current and the vehicle has not changed model year.
3. Payload arithmetic is reconciled and any tray/body/accessory exclusions are explicit.
4. Beyond RV records verified camper dry mass, option mass, loaded scenarios, base geometry and centre of gravity.
5. The calculation engine checks GVM, individual axle loads, tyre ratings, load position, tray/body rating and physical clearances.

`published_payload_kg` is never the customer's remaining camper capacity. Occupants, tray or tub, accessories, fuel differences, towball download, cargo and existing modifications consume payload. For cab-chassis vehicles, manufacturer kerb mass frequently excludes the tray.

Heavy expedition vehicles are stored separately in `heavy_overland_chassis`. Their body payload is not an approval to install a camper body. A usable design also requires the exact order code, body-builder guide, frame/subframe architecture, cab-tilt and component clearances, as-built centre of gravity, individual axle reactions, intended off-road duty and engineering/compliance approval. Legacy, imported and ex-service trucks are manual-review only.

## Rebuild

```sh
./data/vehicle-selector/build-database.sh
```

Useful checks:

```sh
sqlite3 -header -column data/vehicle-selector/australian-slide-on-vehicles.sqlite \
  "SELECT make, model, grade, cab_type, gvm_kg, kerb_mass_kg, published_payload_kg FROM vehicle_variant_quality;"

sqlite3 -header -column data/vehicle-selector/australian-slide-on-vehicles.sqlite \
  "SELECT id, payload_arithmetic_matches FROM vehicle_variant_quality WHERE payload_arithmetic_matches <> 1;"

sqlite3 -header -column data/vehicle-selector/australian-slide-on-vehicles.sqlite \
  "SELECT make, model, variant, wheelbase_mm, gvm_kg, chassis_cab_total_mass_kg, published_body_payload_kg FROM heavy_overland_chassis_quality;"
```

## Coverage boundary

The seed covers commercially relevant Australian cab-chassis utes, selected large pickups and representative current expedition platforms from Mercedes-Benz, IVECO, Isuzu, Fuso and MAN. `model-coverage.csv` is the explicit scope register for remaining platforms and order-specific AWD trucks. “All vehicles available in Australia” cannot be a one-time scrape: model years, body options, local conversions and certification categories change. The production service therefore needs effective dating, automated freshness alerts and a human publication workflow.
