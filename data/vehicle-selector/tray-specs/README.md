# Tray manufacturer specifications

A cab chassis leaves the factory without a tray, so the vehicle specification
cannot say how long the load floor is. Tray makers build to a small number of
standard sizes per cab configuration, which is what makes this worth holding as
data rather than asking every customer to measure.

## The one thing that will bite you

**Tray makers publish outside dimensions. The calculator asks the customer for
the usable floor.**

Norweld states it plainly: its figures are measured *"from the front of the
headboard to the back of the tray"*. The usable floor is shorter by the headboard
and the rear frame. MITS Alloy publishes a standardised L × W × H per cab
configuration rather than per vehicle, and says so.

That difference is not academic. The camper model finder matches tray length
within `BUILD_TOLERANCE_MM`, which is **50 mm**. A headboard is comfortably
40–80 mm. Loading an outside dimension into a usable-length field can move a
customer from an Advent 2150 to an Advent 2300.

So `dimension_basis` is required on every row, is checked against `outside` or
`usable`, and `dimension_basis_quote` must carry the manufacturer's own words.
A row whose basis is unknown is refused, not guessed at.

## Loading a crawl

```bash
node SCRIPTS/load-tray-specifications.mjs your-crawl.csv            # print the SQL
node SCRIPTS/load-tray-specifications.mjs your-crawl.csv --append   # append to seed.sql
bash data/vehicle-selector/build-database.sh                        # rebuild
```

The loader refuses the whole file if any row is bad, and says which row and why.
A partial load would leave the database in a state nobody chose.

It refuses: a missing or unknown `dimension_basis`; a `cab_type` outside
`single, extra, dual, crew, any`; a length or width that is not a whole number of
millimetres or is not a size a tray could be; a vehicle named by make but not
model, or the reverse; a non-HTTPS source; a duplicate row; the same `source_id`
described two different ways; and any column it does not know.

See `EXAMPLE-tray-specifications.csv` for the shape.

## Columns

Required: `manufacturer`, `tray_model`, `cab_type`, `length_mm`, `width_mm`,
`dimension_basis`, `dimension_basis_quote`, `source_id`, `source_manufacturer`,
`source_title`, `source_url`, `source_accessed_date`, `source_locator`.

Optional: `vehicle_make`, `vehicle_model`, `height_mm`, `fits_note`,
`verification_status`, `notes`.

Leave `vehicle_make` and `vehicle_model` empty for a size that fits a class of
vehicles rather than one model, which is how MITS Alloy publishes. Give both or
neither.

## Nothing loaded here is shown to a customer yet

Every row lands with `customer_selectable = 0`, and a test enforces that. These
figures are a starting point a customer confirms, in the same way reported tray
sizes already work: *"That is my tray"* or *"Mine is different"*. Deciding how
they are offered, and whether an outside dimension is converted to a usable one
or simply shown as an outside dimension, is a product decision that has not been
made.
