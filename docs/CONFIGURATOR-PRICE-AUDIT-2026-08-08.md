# Beyond RV Website Price Audit

- Audit date: 2026-08-08
- Public source: `https://beyondrv.com.au`
- Result: No price mismatches found between the public website and repository product data.

## Slide-on campers

| Product | Live website | Repository | Result |
| --- | ---: | ---: | --- |
| 7ft Electric Pop-Top Slide-On Camper | $68,800 | $68,800 | Match |
| Advent 2150 Hardtop Ute Slide-On Camper | $72,000 | $72,000 | Match |
| Advent 2300 Hardtop Ute Slide-On Camper | $75,000 | $75,000 | Match |
| Advent 2450 Hardtop Ute Slide-On Camper | $77,800 | $77,800 | Match |

All four slide-ons are made to order. The confirmed workflow is: deposit paid, production starts in China, the camper is shipped to the Beyond RV factory in Mutdapilly, and local finishing, certification and handover preparation are completed there.

## Caravans

| Product | Live website | Repository | Result |
| --- | ---: | ---: | --- |
| Sunpatch 12C Couples Off-Road Van | $39,999 | $39,999 | Match |
| Sunpatch 15-XC Couples Off-Road Van | $63,000 | $63,000 | Match |
| Sunpatch 19-XC Hardtop Couples Off-Road Van | $68,000 | $68,000 | Match |
| Sunpatch 21-XF Hardtop Family Off-Road Van | $73,000 | $73,000 | Match |

## Expedition products

| Product | Live website | Repository | Result |
| --- | ---: | ---: | --- |
| 3.5m DIY Camper Box with Cabover and Underfloor Storage | From $38,999 | From $38,999 | Match |
| Custom 3.5m Electric Pop-Top Truck Camper | From $49,999 | From $49,999 | Match |
| 3.5m Electric Pop-Top Cabover Family Camper | From $140,000 | From $140,000 | Match |
| 4.7m Hardtop Truck Camper | From $98,000 | From $98,000 | Match |
| Blue Unimog Overlander Camper | POA | POA | Match |
| Unimog Overlander Camper | POA | POA | Match |
| Empty DIY Unimog Camper Box | POA | POA | Match |
| Mercedes Sprinter AWD LWB Cab Chassis Motorhome | $225,000 | $225,000 | Match |

The sold Custom 3.5m product's direct public URL currently returns 404, but its $49,999 starting price remains listed on the public Expedition range page and matches the repository record.

The Blue Unimog Overlander Camper, Unimog Overlander Camper and Empty DIY Unimog Camper Box are recorded as inactive configurator models. They will be activated after the owner supplies their base prices and confirms whether each price is exact or a starting price.

## Shop product

| Product | Live website | Repository | Result |
| --- | ---: | ---: | --- |
| Twin Air Compressor Shield | $188 | $188 | Match |

## Optional extras

| Optional extra | Live website | Repository/configurator | Result |
| --- | ---: | ---: | --- |
| Extra 200Ah battery | $1,500 | $1,500 | Match |
| Upgrade to 3000W Redarc inverter | $3,500 | $3,500 | Match |
| Additional 200W solar panel | $500 | $500 | Match |
| 2kW AuFocus diesel heater supply and install | $2,000 | $2,000 | Match |
| Upgrade to Truma Combi D6 diesel air and water heater | $3,500 | $3,500 | Match |
| Starlink Mini supply and install | $1,500 | $1,500 | Match |
| 40L greywater tank with 12V sump pump | $1,000 | $1,000 | Match |
| Custom gel-coat colour matching | $3,000 | $3,000 | Match |
| Anderson Plug supply and install to vehicle | $300 | $300 | Match |

The automated configurator tests now verify that each optional-extra price remains equal to the website catalogue source in `src/data/optional-extras.ts`.
