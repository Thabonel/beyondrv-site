# Batch 2: What the Chatbot Knows About Products

The chatbot can answer product questions using two sources:
1. **Product catalogue** (`product-catalogue.json`) — specs, pricing, images from each product's page
2. **Business knowledge** (`chatbot-knowledge.md`) — cross-cutting info like warranty, custom builds, fitment

**Important:** The bot only knows what's published on the site. If a spec isn't on the product page, the bot will say it doesn't have that information and suggest contacting the team. To teach the bot something new, add it to the site first.

---

## Construction & Engineering — What the Bot Knows

| Question | What the bot can answer |
|---|---|
| How is composite construction built? | 29mm fibreglass sandwich panels with built-in PVC frame (truck campers & caravans). 17mm infused one-piece floor (truck campers) or 25mm honeycomb composite flooring (caravans). 55mm fibreglass alloy insulated roof (truck campers). Welded aluminium base/subframe. All shells 100% timber-free. |
| What materials are used? | Fibreglass outer skin, PVC internal framing, aluminium subframe and ceiling frame, honeycomb composite (caravan floors), laminated/Laminex benchtops. No wood, plywood, or timber in structure. |
| What are insulation benefits? | 29mm insulated sandwich panel walls. 55mm insulated roof on truck campers. Double glazed windows (caravans). Pop-top canvas has extra insulated paddings. R-values not stated on site. |
| What are weight advantages? | Composite + aluminium is lighter than traditional timber/aluminium stick frame. Caravan tare weights: 1900-2450kg across 12-21ft range. |
| How does it compare to aluminium-framed caravans? | Beyond RV uses composite sandwich panels with PVC frame — not aluminium stick frame. No thermal bridging, no corrosion risk. |
| How does it compare to timber-framed caravans? | 100% timber-free across all models. Timber frames carry rot risk, higher weight, thermal bridging — composite avoids all three. |
| What waterproofing is used? | Triple rubber seal on access hatches. Flush mounted windows and doors. Fibreglass outer skin is inherently waterproof. |
| What chassis philosophy? | Caravans: 6" hot dipped galvanised chassis and drawbar. Slide-ons: fully welded aluminium base with turnbuckle mounting. Truck campers: slide-on or permanent mount with 4 fixing plates. |
| What suspension? | Caravans: independent coil suspension with dual shock absorbers. D035 off-road hitch. 10" electric brakes with Brake Safe. Slide-on/truck campers: no own suspension, use host vehicle. Expedition vehicles: vehicle-dependent. |
| What off-road testing is done? | Not stated on site. Bot will say testing details aren't published and recommend contacting the team. |
| What warranty applies? | 5yr manufacturer warranty on most models. Covers manufacture/assembly defects. Non-transferable. Third-party appliances under supplier warranty. Excludes misuse, overloading, owner modifications, consumables, failure to maintain. Australian Consumer Law rights still apply. |
| What maintenance is required? | Not detailed on site. Bot will say maintenance requirements are covered in handover documentation and recommend contacting the team. |

---

## Product Models — What the Bot Knows

For each model below, the bot knows whatever is published on the product page. Gaps mean the bot will say it doesn't have that info.

### Slide-On Campers

#### Advent 2150 Hardtop
- **Price:** $72,000 | **Status:** on-sale
- **Dimensions:** 2150mm x 2000mm base | **Sleeps:** 2 (queen)
- **Water:** 100L fresh | **Battery:** 200Ah lithium | **Solar:** 360W | **Inverter:** 2000W
- **Appliances:** Truma Aventa AC, Truma HWS, Dometic 110L fridge, induction cooktop, cassette toilet, electric awning, TV
- **Construction:** Full composite fibreglass/PVC, aluminium base, timber-free
- **Not on site:** Tare, ATM, payload, grey water capacity, off-road rating

#### Advent 2300 Hardtop
- **Price:** $75,000 | **Status:** available
- **Dimensions:** 2300mm x 2000mm base | **Sleeps:** 2 (queen)
- **Water:** 100L fresh | **Battery:** 200Ah | **Solar:** 360W | **Inverter:** 2000W combo
- **Appliances:** Same as Advent 2150
- **Construction:** Same as Advent 2150
- **Not on site:** Tare, ATM, payload, grey water capacity, off-road rating

#### Advent 2450 Hardtop
- **Price:** $77,800 | **Status:** available (build to order)
- **Dimensions:** 4410mm x 2050mm x 2000mm | **Sleeps:** 2 (queen)
- **Water:** 100L fresh | **Battery:** 200Ah (Redarc BMS30) | **Solar:** 360W | **Inverter:** 2000W
- **Appliances:** Same as Advent 2150
- **Construction:** Same as Advent 2150
- **Not on site:** Tare, ATM, payload, grey water capacity, off-road rating

#### 7ft Electric Pop-Top
- **Price:** $68,800 | **Status:** available
- **Dimensions:** 2120mm x 2020mm x 1470mm | **Sleeps:** 2 (queen)
- **Water:** 120L fresh | **Battery:** 200Ah lithium | **Solar:** 380W (Enerdrive) | **Inverter:** 2000W
- **Appliances:** Dometic 110L fridge, Truma Aventa AC, Truma HWS, Thetford toilet, gas cooktop, Bluetooth radio
- **Construction:** Full composite fibreglass, aluminium base, pop-top with insulated canvas, timber-free
- **Not on site:** Tare, ATM, payload, grey water capacity, off-road rating

### Caravans

#### Sunpatch 12C
- **Price:** $39,999 | **Status:** on-sale
- **Dimensions:** 5550mm x 2050mm x 2750mm | **Sleeps:** 2-3
- **Tare:** 2000kg | **ATM:** 2420kg | **Ball:** 160kg | **Payload:** ~420kg
- **Water:** 190L fresh / 95L grey | **Battery:** 100Ah lithium | **Inverter:** 2000W
- **Appliances:** Dometic AC, Truma HWS, Thetford toilet, electric awning, 4-burner stove, TV, Bluetooth
- **Build:** Fibreglass insulated, aluminium frame, 6" galvanised chassis, independent coil suspension, D035 hitch
- **Not on site:** Solar spec, fridge brand, brake spec, off-road rating

#### Sunpatch 15-XC
- **Price:** $63,000 | **Status:** on-sale
- **Dimensions:** 6110mm x 2200mm x 2840mm | **Sleeps:** 2 (queen innerspring)
- **Tare:** 1900kg | **ATM:** 2500kg | **Ball:** 180kg | **Payload:** ~600kg
- **Water:** 240L fresh / 120L grey | **Battery:** 200Ah lithium | **Solar:** 300W | **Inverter:** 2000W
- **Appliances:** 175L fridge, microwave, 3kg washer, induction cooktop, Truma HWS, TV, speakers
- **Build:** 29mm composite sandwich/PVC, aluminium base/ceiling, 6" galvanised chassis, independent coil suspension, D035 hitch, 10" electric brakes, 16" all terrains
- **Not on site:** Off-road rating

#### Sunpatch 19-XC
- **Price:** $68,000 | **Status:** on-sale
- **Dimensions:** 7750mm x 2200mm x 2650mm | **Sleeps:** 2 (queen innerspring)
- **Tare:** 2300kg | **ATM:** 3100kg | **Ball:** 260kg | **Payload:** ~800kg
- **Water:** 240L fresh / 120L grey | **Battery:** 200Ah lithium | **Solar:** 300W | **Inverter:** 2000W
- **Appliances:** 175L fridge, microwave, 3kg washer, induction cooktop, Belief diesel heater, electric foldout steps, TV
- **Build:** 29mm composite/PVC, 25mm honeycomb floor, aluminium ceiling, 6" galvanised chassis (dual axle), independent coil suspension, D035 hitch, 10" electric brakes, 16" all terrains
- **Not on site:** Off-road rating

#### Sunpatch 21-XF
- **Price:** $73,000 | **Status:** on-sale
- **Dimensions:** 8300mm x 2200mm x 2650mm | **Sleeps:** 5 (queen + bunks)
- **Tare:** 2450kg | **ATM:** 3290kg | **Ball:** 270kg | **Payload:** ~840kg
- **Water:** 240L fresh / 120L grey
- **Appliances:** 175L fridge, microwave, 3kg washer, induction cooktop, Belief diesel heater, electric foldout steps, TV
- **Build:** Same as 19-XC (dual axle)
- **Not on site:** Battery capacity, solar spec, inverter spec, off-road rating

### Expedition Vehicles

#### 3.5m Electric Pop-Top Truck Camper
- **Price:** From $49,999 | **Status:** on-sale
- **Dimensions:** 3550mm x 2200mm floor | **Sleeps:** 2 (queen innerspring)
- **Battery:** 200Ah (Redarc BMS30) | **Solar:** 400W | **Inverter:** 2000W Redarc
- **Appliances:** 12V ducted AC, diesel air/water combo, Dometic 110L fridge, microwave, gas cooktop, TV, CarPlay
- **Build:** 100% wood-free, 17mm infused floor, 29mm fibreglass/PVC walls, 55mm insulated roof, electric pop-top
- **Not on site:** Tare, ATM, fresh/grey water capacities, off-road rating

#### 3.5m DIY Camper Box
- **Price:** From $38,999 | **Status:** on-sale
- **Build:** Waterproofed composite shell, electric legs, sold as-is
- **Not on site:** Dimensions, weight, warranty (none stated, sold as-is)

#### Mercedes Sprinter Motorhome
- **Price:** $225,000 negotiable | **Status:** on-sale
- **Platform:** 2022 Sprinter VS30 519 LWB CC AWD, 5500kg, 93L fuel
- **Dimensions:** 4700mm floor | **Sleeps:** 2 (queen innerspring)
- **Water:** 200L fresh | **Battery:** 200Ah | **Solar:** 380W
- **Appliances:** Diesel air/water combo, Sanjo 175L fridge, microwave, 2.5kg washer, induction cooktop, TV, CarPlay
- **Build:** Same construction as 3.5m truck (wood-free, composite, insulated roof)
- **Not on site:** Tare, payload, inverter spec, off-road rating

#### 3.5m Cabover Family Camper
- **Price:** From $140,000 | **Status:** available
- **Platform:** Dual cab Isuzu NPS, slide-on or permanent mount
- **Dimensions:** 3600mm x 2200mm x 2300mm | **Sleeps:** 4 (queen + drop-down queen)
- **Tare:** ~1200kg | **Water:** 100L grey (fresh to frame tanks) | **Battery:** 400Ah | **Solar:** 760W | **Inverter:** 2000W
- **Appliances:** Truma Aventa AC, Truma Combi D6 diesel, 175L fridge, microwave, induction cooktop, TV, CarPlay
- **Build:** Full composite, aluminium base, fibreglass/PVC, electric scissor lift pop-top
- **Not on site:** Fresh water capacity, ATM, off-road rating

#### 4.7m Hardtop Truck Camper
- **Price:** From $98,000 | **Status:** available
- **Platform:** Single cab truck or Unimog (2.2m or 2.4m width)
- **Dimensions:** 4700mm floor | **Sleeps:** 2 (queen innerspring)
- **Water:** 200L fresh | **Battery:** 200Ah | **Solar:** 380W | **Inverter:** 2000W
- **Appliances:** Diesel air/water combo, Sanjo 175L fridge, microwave, 2.5kg washer, induction cooktop, TV, CarPlay
- **Build:** Same wood-free composite construction
- **Not on site:** Tare, ATM, payload, off-road rating

#### Unimog Overlander / Blue Unimog / DIY Unimog Box
- **Price:** POA | **Status:** available
- **Build:** Full composite expedition body, custom to order
- **Unique:** Portal axle drive (Unimog platform), flatpack DIY option available
- **Not on site:** Most specs (custom builds — details depend on order)

---

## Optional Extras (Standard Price List)

| Option | Price |
|---|---|
| Extra 200Ah battery | $1,500 |
| Upgrade to 3000W Redarc inverter | $3,500 |
| Additional 200W solar panel | $500 |
| 2kW AuFocus diesel heater supply/install | $2,000 |
| Upgrade to Truma Combi D6 diesel air/water | $3,500 |
| Starlink Mini supply/install | $1,500 |
| 40L greywater tank with 12V sump pump | $1,000 |
| Custom gel-coat colour matching | $3,000 |
| Anderson Plug supply/install to vehicle | $300 |

---

## Rule for the Chatbot

If a customer asks about a product detail that is not published on the site, the chatbot must:
1. Say it doesn't have that specific information
2. Suggest contacting the team directly (phone or Talk to a human)
3. Never guess, estimate, or invent specs

To teach the bot new product details, Alex should add the information to the relevant product page in `src/content/products/`. The chatbot pulls from the product catalogue automatically.
