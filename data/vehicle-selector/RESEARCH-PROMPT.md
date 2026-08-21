# Research prompt: Australian vehicle mass and dimension data

Give this prompt to a research AI that has web access. It produces JSON that
imports into `seed.sql` for the Beyond RV vehicle selector.

The rules below exist because each one has already caused a real error in this
dataset. Keep them even if they seem pedantic.

---

## Prompt

You are compiling Australian-market vehicle specifications for a slide-on camper
suitability tool. A wrong payload figure in this tool can put an overloaded
vehicle on the road, so accuracy matters more than coverage. An incomplete record
is useful. A confident wrong record is harmful.

### Non-negotiable rules

1. **Every figure traces to a manufacturer document you actually opened.** Use
   the Australian manufacturer site, its brochures, or its specification PDFs.
   Never use a review site, a dealer listing, a forum, an aggregator such as
   loadmate or redbook, or your own recollection. If you cannot open the
   document, say so and leave the record empty.
2. **Never infer a number.** If a source publishes kerb mass but not payload,
   leave payload null. Do not calculate it silently, do not carry a figure across
   from a similar grade, and do not convert a nominal figure such as a 145-inch
   wheelbase into millimetres yourself. Report the manufacturer's own value.
3. **Report contradictions rather than resolving them.** If published kerb mass
   and payload do not sum to GVM, record both published values, flag the
   conflict, and explain it. Do not adjust either number to make them agree.
4. **Record the exact locator, not just the URL.** Name the table, section, and
   page so a person can re-check the figure in under a minute.
5. **State the document's model year and whether the range is newer.** A figure
   verified against a superseded brochure is still a superseded figure.

### Traps that have already produced errors here

- **Published payload is often a calculation, not a measurement.** Ford,
  Volkswagen, and Mazda all state that they derive payload by subtracting kerb
  mass from GVM. Record whether the manufacturer published payload independently
  or derived it, in `payload_is_derived_by_manufacturer`.
- **Cab-chassis kerb mass usually excludes the tray.** Mazda publishes both a
  bare-chassis and a tray-fitted mass; the tray adds 114 to 144 kg depending on
  cab. Kia states the exclusion but publishes no tray-fitted figure. Capture both
  states when published, and always say which state a figure represents.
- **One vehicle can hold several certified configurations.** The RAM 3500 offers
  an optional derating from 5,352 kg GVM to 4,495 kg, changing payload by 857 kg.
  Mitsubishi sells GLS and GSR pick-ups as 1.0 t and 0.9 t payload models sharing
  a kerb mass but differing in GVM. Toyota offers GVM upgrades. Give each
  certified configuration its own record; never average or pick one.
- **Manufacturers publish more than one kerb mass.** Ford publishes kerb weight
  with the heaviest factory options and a minimum kerb weight with the lightest.
  The gap reached 68 kg on a Ranger single cab. Capture both and label them.
- **The usable axle limit can be below the rated axle limit.** The Isuzu NPS
  rates its rear axle at 6,600 kg but the tyre and load limit is 6,000 kg. Record
  both when they differ, and say which binds.
- **Grade names do not always map cleanly to figures.** KGM publishes three
  certified mass configurations without reliably attributing them to grades. If
  the mapping is ambiguous, say so rather than assigning a grade by guesswork.
- **Tub and cab-chassis are different vehicles.** Never mix their figures.

### Fields per record

Required: `make`, `model`, `model_year`, `grade`, `cab_type`, `body_type`
(`cab_chassis` or `pickup_tub`), `drivetrain`, `gvm_kg`, `kerb_kg`,
`kerb_basis`, `payload_kg`, `payload_basis`, `primary_source_url`,
`source_locator`, `document_model_year`, `range_is_newer_than_document`,
`data_status`, `notes`.

Include when published: `gcm_kg`, `front_axle_limit_kg`, `rear_axle_limit_kg`,
`axle_limit_binding_factor`, `kerb_kg_minimum`, `payload_kg_at_minimum_kerb`,
`kerb_kg_with_standard_tray`, `payload_kg_with_standard_tray`,
`standard_tray_mass_kg`, `braked_tow_kg`, `towball_limit_kg`, `wheelbase_mm`,
`engine`, `transmission`, `tray_or_tub_length_mm`, `tray_or_tub_width_mm`,
`accessory_masses_kg` (an object, for example
`{"canopy": 130, "bull_bar": 68, "suspension_upgrade": 95}`).

Flags: `payload_is_derived_by_manufacturer` (true, false, or null if the source
does not say), `arithmetic_reconciles` (does `gvm_kg - kerb_kg == payload_kg`),
`conflict_description` (null unless something does not reconcile).

### Before you return the JSON

Check each record yourself:

- Does `gvm_kg - kerb_kg` equal `payload_kg`? If not, set `arithmetic_reconciles`
  to false and describe the conflict. Do not change the numbers.
- Does every populated field trace to the document named in `source_locator`?
- Have you left null everything the source does not state?
- Have you split every separately certified configuration into its own record?

Return a single JSON object: `{"as_of": "<date>", "scope": "<text>",
"configurations": [ ... ]}`. Then list, in plain text, every model you could not
source and the reason.

### Models needed now

Resolve these known gaps first:

1. **RAM 1500**, all current grades. The grade pages render client-side with no
   mass data in the HTML, so find a specification PDF or brochure instead.
2. **Ford Ranger 2026.50MY**, full mass table including 4x2. The data on hand is
   the 2022MY brochure, and the 4x2 section of that document has no mass page.
3. **GWM Cannon Alpha**, the two 3.0 turbo-diesel grades listed without a mass
   table.
4. **KGM Musso**, the grade-to-configuration mapping for the 880 kg and 1,010 kg
   payload configurations.
5. **Mitsubishi Triton**, the meaning of the published payload pair on single-cab
   cab-chassis, `1,304 / 1,314` kg and `1,330 / 1,335` kg.
6. **Mazda BT-50 Boss Pickup**, which publishes 2,067 kg kerb and 1,034 kg
   payload against a 3,100 kg GVM. Those do not reconcile by 1 kg.

Then these truck-body chassis, for the expedition path: Isuzu N Series, Fuso
Canter, Hino 300 Series, Mercedes-Benz Sprinter Cab Chassis, and Volkswagen
Crafter Cab Chassis. For these, also capture cab-to-rear-axle dimension, chassis
frame width, body-builder guide URL, and front and rear chassis-cab axle mass
distribution.
