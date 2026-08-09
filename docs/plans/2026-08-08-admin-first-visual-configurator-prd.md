# Product Requirements Document: Admin-First Visual Camper Configurator

- Date: 2026-08-08
- Owner: Beyond RV
- Status: Phase 2 operational workflow implemented in code — owner/factory catalogue approval and CAD assets pending; not deployed
- Primary implementation target: Existing Beyond RV Astro/React admin on Netlify
- Supersedes: `2026-04-17-3d-configurator-prd.md`

Related documents:

- `2026-07-23-contract-generator-gmail-esign-prd.md`
- `2026-04-17-buy-now-prd.md`
- `2026-05-22-ai-admin-self-service-prd.md`
- `2026-05-28-owner-website-review-change-prd.md`
- `../HANDOVER-PRODUCT-ADMIN-MODEL.md`
- `../UNIFIED-LIFECYCLE-DESIGN.md`
- `../CONTRACT-WORKFLOW-RUNBOOK.md`

## Implementation Progress — 2026-08-09

The internal sales-to-production workflow is implemented in the existing protected admin:

- a versioned owner-review catalogue containing the four slide-ons and four priced 4x4/expedition products, with three additional Unimog products recorded as inactive while their POA base prices are collected;
- a deterministic shared pricing, quantity and compatibility-rules engine;
- saved configurations, revisions, duplicates, audit history and immutable approval snapshots in Netlify Blobs;
- an owner-facing Configurator workspace linked to customers and leads;
- customer-safe summary preview, print and download output;
- an exact approved-snapshot adapter into the existing contract workflow;
- a deliberate contract safety gate while the catalogue remains marked `owner_review`; and
- the confirmed made-to-order workflow: deposit payment starts production in China, followed by shipment to the Mutdapilly factory for local finishing;
- charged off-catalogue alterations with a required visual brief and 3D-drawing approval gate before configuration approval;
- an operational catalogue editor with a separate deliberate internal-approval action;
- versioned private drawing uploads or HTTPS links, owner drawing review and superseded-version history;
- an implemented Three.js GLB viewer with Draco support, orbit/zoom, base/configured comparison, node bindings and hotspots;
- a GLB validation, optimization, compression and size-gating command;
- expiring private customer-review links stored by hash, customer approval/change requests and decision evidence;
- contract gating on customer approval and an immutable configuration snapshot;
- production release gated by verified contract, approved drawings and deposit evidence; and
- a production tracker following China manufacture, shipping and Mutdapilly finishing.

The implementation has not been deployed. Retail pricing and the made-to-order production flow are confirmed. Factory/owner validation is still required for technical option compatibility, internal costs, weights and final catalogue approval. The viewer is ready, but actual model assets and final node bindings still depend on receipt and audit of the source CAD files. See `../CONFIGURATOR-PHASE-2-OPERATIONS.md`.

---

## 1. Executive Summary

Beyond RV will build a visual camper configuration system inside the existing protected site admin for the owner to use first. It will let the owner select a base camper, choose layouts and options, enforce compatibility rules, calculate price and weight, inspect the camper visually, save a configuration against a customer, and turn an approved configuration into a customer summary, quote or contract draft.

The system must be designed as a reusable configuration platform, not as an admin-only form. The admin interface and a later customer-facing interface will use the same catalogue, deterministic rules engine, pricing calculations, weight calculations, saved-configuration format and visual bindings. The public interface will expose only approved customer-visible data and actions; private costs, margins, supplier references, internal notes and override controls will remain admin-only.

The first release is an internal sales and specification tool. It does not need cinematic 3D or manufacturing automation to be useful. Commercial correctness, saved records, rule enforcement and trustworthy output take priority. Existing CAD models will be converted into web-safe GLB assets after a CAD audit. The rules engine and configuration workflow must continue to work when a visual asset is missing or still being prepared.

The long-term flow is:

```text
Product catalogue + CAD-derived visual assets
                    ↓
Shared configuration catalogue and rules engine
                    ↓
       ┌────────────┴────────────┐
       ↓                         ↓
Owner/admin configurator   Customer configurator
       └────────────┬────────────┘
                    ↓
        Saved configuration snapshot
                    ↓
Customer summary → quote → contract → deposit/order
                    ↓
          Build specification → future BOM
```

---

## 2. Product Decision Summary

The following decisions govern this PRD:

1. Build the owner/admin interface first.
2. Use one shared configuration engine for admin and future public interfaces.
3. Keep business rules outside React UI components.
4. Keep catalogue definitions versioned in the repository and validate them at build time.
5. Store operational configuration records in Netlify Blobs, following the existing contract and owner-workflow patterns.
6. Store money as integer cents and calculate it deterministically.
7. Recalculate and validate all commercial totals server-side before quote, contract or payment actions.
8. Treat CAD as the engineering source and GLB as a derived web-viewing asset; never serve original CAD files publicly.
9. Separate commercial option identity from 3D node names through explicit visual bindings.
10. Let configurations produce contract inputs, but keep the immutable contract snapshot authoritative once a contract is created.
11. Do not let AI invent or autonomously approve prices, costs, weights, compatibility rules, delivery effects or compliance claims.
12. Ship a useful non-3D fallback before blocking the workflow on perfect visual assets.

---

## 3. Existing Foundations

This is an extension of the current platform, not a separate CPQ application.

### 3.1 Existing implementation to reuse

- Protected Astro/React admin and owner authentication.
- Admin Products, Customers, Leads, Orders and Contracts workspaces.
- Netlify Functions and Netlify Blob operational storage.
- Product catalogue and public/private product-data separation.
- Current optional-extras catalogue in `src/data/optional-extras.ts`.
- Current React optional-extras selector in `src/components/OptionalExtras.tsx`.
- Server-side validation of selected extras and recalculation of configured totals in `netlify/functions/checkout.ts`.
- Stripe deposit and full-payment checkout.
- Contract records containing products, specification sections, line items, pricing, exclusions and immutable document snapshots.
- Contract revisions, addenda and owner-entered reasons for commercial changes.
- Customer, lead, lifecycle, audit and timeline patterns.
- PostHog infrastructure.

### 3.2 Historical plan to retain selectively

The superseded 3D configurator PRD contains useful decisions that remain valid:

- browser rendering with Three.js;
- web delivery using GLB/glTF;
- named visual components that can be shown, hidden or swapped;
- live price and weight updates;
- mobile-aware orbit and zoom controls;
- server-side price recalculation before Stripe checkout;
- analytics for selections and conversion;
- a CAD/3D validation script.

The following historical assumptions are replaced:

- public customer launch before internal use;
- deposit checkout as the first completed workflow;
- no saved configurations;
- no PDF/customer-summary generation;
- no dependency or exclusion rules;
- no private cost, margin or override data;
- a single unversioned configuration file as the complete operational record;
- commissioning a new 3D model before auditing the existing CAD;
- using Stripe metadata as the primary home of the build specification.

### 3.3 Current gaps

The repository currently does not have:

- a dedicated configuration record store;
- a versioned camper-option catalogue;
- a shared configuration rules engine;
- option dependency, exclusion or automatic-selection logic;
- saved configuration revisions;
- cost, margin or per-deal override handling in the extras selector;
- a 3D configurator route or admin workspace;
- a web GLB asset and validated CAD-to-web pipeline;
- a direct configuration-to-contract conversion;
- a manufacturing/BOM output model.

---

## 4. Problem Statement

Camper configurations can involve layouts, appliances, electrical capacity, batteries, solar, cabinetry, finishes, water systems, heating and cooling, external accessories and vehicle-specific constraints. A list of checkboxes cannot safely represent all of the commercial and technical relationships between those choices.

Without a shared configuration system:

- option compatibility depends on memory and manual checking;
- totals can be copied incorrectly between an enquiry, quote and contract;
- weight effects are difficult to see while discussing a build;
- selections can be buried in email, phone notes or free text;
- the customer may visualise a different build from the one quoted;
- public and admin tools can drift into different option catalogues;
- the accepted contract may not match the latest working specification;
- future production staff cannot rely on a single authoritative build record.

The owner needs a fast internal tool that makes a correct configuration easier than an informal one, while preserving the ability to review and override exceptional deals deliberately.

---

## 5. Goals

### 5.1 Business goals

- Reduce the time required to prepare a configured camper proposal.
- Reduce pricing, selection and transcription errors.
- Make rules and compatibility knowledge reusable and maintainable.
- Improve owner confidence before exposing self-service configuration publicly.
- Preserve a configuration from first discussion through contract and order.
- Make upgrade value, configured total and indicative weight visible during the sale.
- Establish the data foundation for later production specifications and BOM generation.
- Reuse the current site, admin, contracts, checkout and customer records.

### 5.2 Owner goals

The owner must be able to:

- start a configuration without first creating a customer;
- optionally attach an existing customer or lead;
- select a base product and model version;
- work through configuration categories in a clear order;
- see choices reflected in the visual model where supported;
- see price, cost, margin and indicative weight update immediately;
- understand why an option is unavailable, required or automatically selected;
- save a draft and return later;
- duplicate an existing configuration;
- create a new revision without overwriting an approved or quoted version;
- record custom items and deliberate overrides with reasons;
- compare revisions;
- preview a customer-safe summary;
- generate a printable/downloadable customer configuration summary;
- create a contract draft from an approved configuration;
- eventually create a quote or request a deposit from the same snapshot.

### 5.3 Customer goals for the later public phase

A customer must eventually be able to:

- configure only products and options approved for public use;
- see compatible choices without exposure to internal business data;
- see clear retail pricing or approved price-on-application wording;
- see indicative weight and appropriate payload warnings;
- save or share a configuration using a secure link;
- send the configuration to Beyond RV;
- receive or download a customer-safe summary;
- pay an enabled deposit only after server validation.

### 5.4 Technical goals

- Implement a deterministic rules engine as reusable TypeScript, independent of UI.
- Use the same engine on the client for immediate feedback and on the server for authority.
- Version configuration catalogues and saved configuration snapshots.
- Keep public projections free of private fields.
- Keep original CAD and sensitive manufacturing data private.
- Make visual bindings replaceable without changing commercial option IDs.
- Validate catalogue data and GLB node references automatically.
- Preserve auditability across configuration, quote, contract and order transitions.

---

## 6. Non-Goals

The first admin release will not:

- expose the configurator publicly;
- generate manufacturing-ready CAD, STEP, DXF or CNC files;
- replace the factory's engineering CAD process;
- promise legal payload or vehicle suitability approval;
- automatically generate or approve a final BOM;
- autonomously set prices, costs, rules or delivery dates with AI;
- autonomously send quotes, contracts or customer messages;
- support every camper model before one pilot model is proven;
- require photorealistic rendering before the core workflow can launch;
- replace the existing Contracts workspace;
- silently update an accepted deal when catalogue prices or options change;
- allow arbitrary client-supplied prices to reach Stripe.

AR, customer accounts, production scheduling, supplier purchase orders, inventory reservation and engineering drawing generation are later opportunities, not MVP requirements.

---

## 7. Users, Roles and Data Visibility

### 7.1 Owner/admin

The owner can access:

- retail prices;
- internal costs;
- calculated margin and margin percentage;
- supplier or procurement references;
- internal notes;
- option availability controls;
- rule explanations;
- override controls;
- unpublished models and options;
- customer, lead, quote, contract and order links;
- catalogue validation errors.

### 7.2 Staff role for later use

If additional staff access is introduced, permissions must distinguish:

- configure and save;
- view internal cost/margin;
- override rules;
- override price;
- approve a configuration;
- publish catalogue changes;
- convert to contract or payment.

The current single-owner authentication is sufficient for the first release, but actions must record the acting identity in preparation for later roles.

### 7.3 Customer/public

The public projection must never contain:

- internal cost or margin;
- supplier details;
- internal SKU notes;
- internal-only options;
- unpublished products;
- owner notes;
- override reasons;
- private BOM details;
- CAD source locations;
- another customer's configuration or identity.

Public configuration links must use unguessable share tokens and return only the customer-safe snapshot.

---

## 8. Delivery Phases

Work is divided by capability gates rather than calendar estimates.

### Phase 0 — Product, rule and CAD audit

Purpose: establish trustworthy inputs before building the visual workflow.

Required outputs:

- select one pilot camper model;
- identify the CAD application and available file formats;
- confirm ownership and permitted web use of CAD-derived assets;
- list base variants, standard inclusions and optional extras;
- identify option prices, internal costs and indicative weight changes;
- identify required, excluded and conditional combinations;
- distinguish hard technical rules from owner-review warnings;
- map CAD assemblies/components to commercial option concepts;
- decide which changes must be visual in the pilot;
- import the current optional-extras list as unverified seed data, not automatically approved truth;
- identify missing product information and assign an owner decision.

Gate: the pilot catalogue validates with no unresolved hard-rule references, and the owner approves the initial option/rule matrix.

### Phase 1 — Admin configuration core

Purpose: deliver useful CPQ behaviour before depending on complete 3D assets.

In scope:

- new Configurator area in admin;
- pilot-model catalogue;
- shared deterministic rule engine;
- live price, internal cost, margin and weight calculations;
- hard errors, warnings and rule explanations;
- customer/lead attachment;
- save, reopen, duplicate and revise;
- custom line items and controlled overrides;
- customer-safe preview;
- printable/downloadable configuration summary;
- audit events;
- create a contract draft from an approved configuration snapshot;
- non-3D fallback using product images, diagrams or a neutral placeholder.

Gate: the owner can reproduce a known real sale configuration, obtain matching totals, and create a correct contract draft without copying selections manually.

### Phase 2 — CAD-derived visual experience

Purpose: connect the trusted commercial configuration to a useful interactive model.

In scope:

- CAD-to-GLB conversion workflow;
- Three.js viewer inside the admin configurator;
- exterior/interior views as supported by the pilot asset;
- show/hide, variant-swap and material-change bindings;
- camera presets and reset control;
- missing-binding indicators;
- GLB-node validation script;
- performance and mobile/tablet QA.

Gate: every visualised pilot option maps to a valid GLB node or material action, and the viewer remains usable on target owner devices.

### Phase 3 — Quote, order and production handoff

Purpose: make the saved snapshot useful across the rest of the business.

In scope:

- formal quote/customer proposal workflow if still required beyond the customer summary;
- configuration-to-contract linkage and revision comparison;
- deposit request against an approved immutable snapshot;
- configuration/order linkage after payment;
- structured build specification output;
- production checklist fields;
- BOM reference fields and export shape, without claiming automated engineering approval.

Gate: a configuration can be traced to the exact customer document, payment and working build specification without ambiguous free-text copying.

### Phase 4 — Customer-facing configurator

Purpose: expose the proven engine through a restricted public interface.

In scope:

- customer-safe catalogue projection;
- customer-facing copy and media;
- public configuration route;
- secure save/share flow;
- enquiry handoff;
- customer summary/email;
- approved deposit checkout;
- consent-aware analytics;
- accessibility, browser and load testing.

Gate: the owner has used the same catalogue and engine internally on real configurations, public visibility filters are verified, and server-side recalculation passes tampering tests.

---

## 9. Core Admin Workflows

### 9.1 Start a new configuration

1. Owner opens `Admin → Configurator`.
2. Owner selects `New configuration`.
3. Owner optionally selects an existing customer or lead.
4. Owner selects the pilot product/base model.
5. System loads the latest published catalogue version and default selections.
6. Rules engine evaluates defaults and shows current price, cost, margin and weight.
7. System saves an initial draft record.

### 9.2 Configure the camper

1. Owner works through ordered categories such as Layout, Electrical, Solar, Appliances, Water, Interior, Exterior and Accessories.
2. Each selection is passed to the rules engine.
3. Hard-invalid choices are blocked and explained.
4. Required selections can be added automatically only when the rule explicitly allows it.
5. Conflicting selections are either removed with confirmation or presented for owner resolution, according to the rule definition.
6. Warnings remain visible until acknowledged or resolved.
7. The visual layer applies the resulting visual state where bindings exist.
8. Totals and change summary update immediately.
9. The draft autosaves after a short debounce and on explicit Save.

### 9.3 Add a custom item or override

1. Owner selects `Add custom item` or an authorised override action.
2. Owner enters a description and, where applicable, price, cost, weight and delivery effect.
3. Owner must enter a reason.
4. The item is clearly marked `Custom` or `Overridden` in admin and customer-safe summaries.
5. A hard technical incompatibility cannot be bypassed unless the rule is explicitly marked owner-overridable.
6. The audit trail records the previous state, revised state, reason and actor.

### 9.4 Review and approve

1. Owner opens Review.
2. System displays base model, standard inclusions, selected options, custom items, warnings, totals and visual coverage.
3. System reruns validation server-side.
4. Approval is blocked by hard errors or missing required fields.
5. Owner acknowledges remaining advisory warnings.
6. System creates an immutable approved configuration snapshot and digest.
7. Later edits create a new revision rather than mutating the approved snapshot.

### 9.5 Create customer summary or contract

1. Owner selects an approved configuration revision.
2. Owner previews the customer-safe representation.
3. Owner generates a printable/downloadable summary or chooses `Create contract draft`.
4. Contract creation copies the approved snapshot into:
   - buyer/customer link;
   - product identity and build identifier;
   - specification sections;
   - base and optional line items;
   - discounts/custom items with reasons;
   - exclusions;
   - configured total and payment schedule inputs;
   - configuration ID, revision and digest.
5. The Contracts workspace remains responsible for contract validation, approval, preparation, delivery and acceptance.
6. Later catalogue changes do not alter the created contract.

### 9.6 Revise a configuration

1. Owner duplicates the latest revision into a new draft revision.
2. System preserves the source catalogue version and previous approved snapshot.
3. Owner changes selections or optionally upgrades the draft to a newer catalogue version.
4. If upgrading, the system shows added, removed, repriced and invalidated options for explicit review.
5. Revision comparison shows selection, price, weight and warning differences.
6. A revision linked to a sent or accepted contract does not alter that contract; the established contract revision/addendum workflow applies.

### 9.7 Maintain the catalogue

1. Owner requests or enters a catalogue change.
2. Change is validated as a draft and produces a preview/diff.
3. AI may help structure descriptions or propose a rule from owner-provided facts, but cannot publish commercial or technical facts by itself.
4. Owner approves the option, rule, price, cost, weight and visibility.
5. Repository change is reviewed and deployed through the existing admin/GitHub workflow.
6. Build validation compiles a new immutable catalogue version.
7. Existing approved configurations continue to reference their original version.

---

## 10. Configuration Rules

### 10.1 Rule categories

The engine must support at least:

- `requires_all`: selecting an option requires every listed option;
- `requires_any`: selecting an option requires at least one listed option;
- `excludes`: options cannot coexist;
- `auto_select`: selecting an option automatically adds another option;
- `auto_remove`: selecting an option removes a replaceable conflicting option after confirmation;
- `available_when`: option is offered only when a condition is true;
- `quantity_min` and `quantity_max`;
- `value_range`: numeric values must stay within bounds;
- `warning_when`: allowed but requires owner/customer attention;
- `model_constraint`: option allowed only on specified base models or variants;
- `capacity_constraint`: derived capacity, roof-space, weight or electrical threshold;
- `visual_only`: changes presentation without changing the commercial build;
- `admin_approval_required`: selectable internally but cannot become quote-ready without approval.

### 10.2 Rule severity

Each rule has one of three severities:

- `hard`: blocks a quote-ready or approved configuration;
- `warning`: permits selection but must display and may require acknowledgement;
- `information`: explains a consequence without blocking.

### 10.3 Rule behaviour requirements

- Rules use stable IDs, never display labels, as references.
- Rules must not depend on React component state.
- Evaluation must be deterministic for the same catalogue version and selections.
- Circular dependencies must fail catalogue validation.
- Every automatic change must have a human-readable explanation.
- The engine returns both resolved selections and a rule trace.
- Hard-rule overrides are disabled by default and allowed only per rule.
- Public rule messages may differ from internal messages but must describe the same underlying decision.
- Client evaluation is for responsiveness; server evaluation is authoritative.

### 10.4 Example

```json
{
  "id": "rule_800ah_requires_inverter_3000w",
  "type": "requires_all",
  "when": { "selected": "battery_800ah" },
  "targets": ["inverter_3000w"],
  "severity": "hard",
  "autoResolve": true,
  "adminMessage": "The 800Ah system requires the approved 3000W inverter package.",
  "publicMessage": "The matching inverter package has been included for this battery system."
}
```

---

## 11. Data Architecture

### 11.1 Separation of concerns

The system has four distinct data layers:

1. **Catalogue definition** — approved products, options, rules, pricing inputs, weight inputs and visual bindings.
2. **Configuration working record** — an owner's mutable draft and its audit events.
3. **Configuration snapshot** — immutable evaluated state used for summaries, quotes, contracts and payments.
4. **Downstream record** — contract, payment/order or build record that retains its own immutable copy and link.

No layer should be treated as a shortcut for another.

### 11.2 Catalogue storage

Recommended authoring structure:

```text
src/data/configurator/
├── catalogue.json
├── models/
│   └── <model-slug>.json
└── visual-bindings/
    └── <model-slug>.json
```

Requirements:

- JSON data validated by a strict TypeScript schema;
- stable IDs that do not change when labels change;
- explicit schema version and catalogue version;
- repository history provides review and rollback;
- build produces an internal compiled manifest for Netlify Functions;
- build produces a separate customer-safe projection with private fields removed;
- the current `optional-extras.ts` becomes a compatibility adapter during migration, then stops being a second source of truth.

### 11.3 Operational storage

Use a dedicated Netlify Blob store:

```text
byondrv-configurations
```

Suggested keys:

```text
configurations/<configuration-id>.json
configuration-snapshots/<configuration-id>/<revision>.json
configuration-events/<configuration-id>/<event-id>.json
configuration-share-links/<token-hash>.json
```

Original CAD files do not belong in Netlify Blobs or the public repository.

### 11.4 Core catalogue types

```ts
interface ConfiguratorCatalogue {
  schemaVersion: string;
  catalogueVersion: string;
  publishedAt: string;
  currency: 'AUD';
  taxTreatment: 'gst_inclusive' | 'gst_exclusive';
  models: ConfigurableModel[];
  options: ConfigurationOption[];
  rules: ConfigurationRule[];
}

interface ConfigurableModel {
  id: string;
  productSlug: string;
  version: string;
  name: string;
  description: string;
  active: boolean;
  adminVisible: boolean;
  customerVisible: boolean;
  basePriceCents: number;
  baseCostCents?: number;
  baseWeightKg?: number;
  categoryOrder: string[];
  standardOptionIds: string[];
  defaultOptionIds: string[];
  visualAssetId?: string;
}

interface ConfigurationOption {
  id: string;
  sku?: string;
  categoryId: string;
  name: string;
  shortDescription: string;
  internalDescription?: string;
  active: boolean;
  adminVisible: boolean;
  customerVisible: boolean;
  modelIds: string[];
  selectionMode: 'single' | 'multiple' | 'quantity' | 'value';
  retailPriceDeltaCents: number;
  internalCostDeltaCents?: number;
  weightDeltaKg?: number;
  leadTimeImpactDays?: number;
  bomRefs?: string[];
  visualBindingId?: string;
  sortOrder: number;
}

interface ConfigurationRule {
  id: string;
  type: string;
  severity: 'hard' | 'warning' | 'information';
  when: Record<string, unknown>;
  targets: string[];
  autoResolve: boolean;
  ownerOverridable: boolean;
  adminMessage: string;
  publicMessage?: string;
}
```

### 11.5 Configuration working record

```ts
interface ConfigurationRecord {
  id: string;
  configurationNumber: string;
  revision: number;
  parentConfigurationId?: string;
  status:
    | 'draft'
    | 'ready_for_review'
    | 'approved'
    | 'quoted'
    | 'converted_to_contract'
    | 'ordered'
    | 'superseded'
    | 'archived';
  catalogueVersion: string;
  modelId: string;
  customerId?: string;
  leadId?: string;
  selectedOptions: ConfigurationSelection[];
  customItems: ConfigurationCustomItem[];
  overrides: ConfigurationOverride[];
  acknowledgedWarningIds: string[];
  ownerNotes: string;
  customerNotes: string;
  linkedContractIds: string[];
  linkedOrderIds: string[];
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}
```

### 11.6 Evaluated snapshot

An immutable snapshot must contain resolved facts, not only option IDs:

```ts
interface ConfigurationSnapshot {
  configurationId: string;
  configurationNumber: string;
  revision: number;
  catalogueVersion: string;
  model: ModelSnapshot;
  selections: SelectionSnapshot[];
  customItems: CustomItemSnapshot[];
  appliedRules: AppliedRuleSnapshot[];
  warnings: WarningSnapshot[];
  pricing: {
    basePriceCents: number;
    optionsTotalCents: number;
    customItemsTotalCents: number;
    discountsTotalCents: number;
    configuredTotalCents: number;
    internalCostCents?: number;
    marginCents?: number;
  };
  weight: {
    baseWeightKg?: number;
    optionsDeltaKg?: number;
    configuredWeightKg?: number;
    status: 'known' | 'partial' | 'unknown';
  };
  visualState: VisualStateSnapshot;
  approvedBy: string;
  approvedAt: string;
  digest: string;
}
```

The customer-safe version must be produced through an explicit projection function rather than by sending the internal object and hiding fields in CSS.

### 11.7 Money, tax and weight

- Store all money as integer cents.
- Confirm and record whether catalogue values are GST-inclusive before the pilot is published.
- Never parse formatted public price strings inside the rules engine.
- Keep base, option, custom and discount lines separate.
- Require reasons for discounts and manual price overrides.
- Store indicative weight separately from verified engineering weight.
- If any selected item's weight is unknown, label the total `partial` rather than presenting false precision.
- Payload warnings are advisory until vehicle-specific inputs and approved engineering rules exist.

### 11.8 Versioning rules

- Publishing catalogue changes creates a new catalogue version.
- Existing approved snapshots never recalculate automatically.
- Drafts retain their original version until the owner explicitly upgrades them.
- Contract creation copies resolved labels, descriptions and amounts; it does not depend on future catalogue lookups.
- Deleted options are retired, not removed from historical snapshot interpretation.
- Stable IDs cannot be reused for a different meaning.

---

## 12. Visual and CAD Architecture

### 12.1 Source hierarchy

```text
Engineering CAD source
        ↓ controlled export
Sanitised mesh/interchange file
        ↓ optimisation and material preparation
Web GLB asset + node manifest
        ↓ visual-binding validation
Three.js viewer
```

The original CAD remains the engineering master. The GLB is a derived presentation asset and must never be treated as engineering output.

### 12.2 CAD audit checklist

For the pilot model, record:

- CAD software and version;
- available native and interchange formats;
- model units and coordinate orientation;
- whether assemblies and components are logically separated;
- whether optional variants already exist as separate components/configurations;
- material and colour information;
- hidden proprietary or supplier components that must not be exported;
- geometry complexity and polygon count after conversion;
- interior visibility requirements;
- source-file ownership and backup location;
- person responsible for future CAD changes.

### 12.3 Web asset requirements

- GLB/glTF 2.0 output.
- Stable named nodes or stable exported IDs.
- Compressed geometry and web-sized textures.
- No original CAD metadata, supplier secrets or unnecessary internal geometry.
- Separate or lazy-loaded exterior/interior chunks if one file is too large.
- Consistent origin, scale and orientation across model revisions.
- Neutral lighting/material fallback for incomplete textures.
- Node manifest generated during export or validation.
- Asset version recorded independently from catalogue version.

### 12.4 Visual bindings

Commercial options must not embed raw GLB node names directly. Use a binding layer:

```ts
interface VisualBinding {
  id: string;
  visualAssetId: string;
  actions: Array<
    | { type: 'show'; nodeIds: string[] }
    | { type: 'hide'; nodeIds: string[] }
    | { type: 'material'; nodeIds: string[]; materialId: string }
    | { type: 'variant'; groupId: string; variantId: string }
    | { type: 'camera_hint'; presetId: string }
  >;
}
```

This allows a GLB asset to be replaced or renamed without changing pricing and rule IDs.

### 12.5 Viewer behaviour

- Three.js loaded only in the configurator interface.
- Orbit, zoom, reset and camera presets.
- Touch controls for tablet and mobile.
- Optional roof/wall visibility controls where the asset supports them.
- Selection changes applied without reloading the whole model.
- Selected component can be highlighted briefly when practical.
- Missing visual binding never changes the commercial result.
- Admin sees `Visual not available for this option` when a binding is absent.
- A static image/diagram fallback appears if WebGL or the model fails.

### 12.6 Initial performance budgets

- Rule evaluation visible within 100 ms for normal pilot configurations.
- Visual state change visible within 250 ms after the model is loaded.
- Initial compressed model payload target at or below 5 MB; larger interior/detail chunks load on demand.
- Viewer targets 60 fps on a current desktop and remains usable at 30 fps on supported mobile/tablet devices.
- No Three.js or GLB payload on ordinary marketing pages.
- Loading progress, retry and failure states are required.

The historical `<2 MB` single-model target is not a hard requirement until the real CAD conversion is measured. Visual quality and mobile performance must be balanced using actual assets.

---

## 13. Admin Interface Requirements

### 13.1 Navigation

Add a distinct `Configurator` tab to admin. Do not bury the full workflow inside Products or Contracts.

The configurator may link into those workspaces:

- Products manages published commercial product facts.
- Configurator manages selectable build combinations and saved configurations.
- Contracts manages legal/customer agreements and acceptance.
- Orders manages payment and fulfilment records.

### 13.2 Workspace layout

Desktop/tablet target:

```text
┌──────────────────────────────────────────────────────────────────┐
│ Configuration BRV-CFG-...  Customer  Status  Save  Review        │
├──────────────────────────────────┬───────────────────────────────┤
│                                  │ Category / options            │
│          Visual viewer           │ - Layout                      │
│      or image/diagram fallback   │ - Electrical                  │
│                                  │ - Solar                       │
│                                  │ - Appliances                  │
│                                  │ - Interior / Exterior         │
├──────────────────────────────────┤                               │
│ Rule messages / visual coverage  │                               │
├──────────────────────────────────┴───────────────────────────────┤
│ Retail total | Cost | Margin | Weight | Warnings | Actions       │
└──────────────────────────────────────────────────────────────────┘
```

### 13.3 Required controls

- New, Save, Duplicate, Create Revision and Archive.
- Customer/lead selector.
- Model selector.
- Category navigation with completion indicators.
- Search/filter options.
- Retail/cost/margin visibility controls.
- Rule explanation panel.
- Acknowledged warnings panel.
- Add custom item.
- Override action where authorised.
- Compare revisions.
- Customer-safe Preview.
- Download/Print Summary.
- Approve Configuration.
- Create Contract Draft.
- Later: Create Quote and Request Deposit.

### 13.4 Usability requirements

- Unsaved changes warning.
- Autosave status and last-saved time.
- Keyboard-accessible option controls.
- Clear loading, empty and error states.
- Plain business language rather than CPQ jargon.
- No colour-only rule or validation states.
- Confirmation before an automatic rule removes a deliberate selection unless the removed choice is an explicit default.
- The owner can finish a valid configuration without interacting with the 3D viewer.

---

## 14. Customer Summary, Quote and Contract Integration

### 14.1 Customer configuration summary

The first admin release must generate a customer-safe printable view containing:

- Beyond RV branding and contact details;
- configuration number and revision;
- customer name when attached;
- camper model and representative image;
- selected options grouped by category;
- custom items clearly identified;
- retail line items and configured total;
- indicative/partial weight wording;
- relevant customer warnings and assumptions;
- validity date if the owner sets one;
- statement that final pricing, specification, suitability and availability require confirmation;
- no internal costs, margins, supplier notes or rule traces.

The summary is not a binding contract unless it is deliberately incorporated into an approved agreement.

### 14.2 Contract conversion

The integration should extend the current Contracts workspace, not recreate it.

Requirements:

- configuration ID, number, revision and digest stored on the contract;
- resolved configuration snapshot copied into contract inputs;
- base model and build identifier mapped to the contract product;
- selected options mapped to specification groups and line items;
- custom and discount line items retain owner-entered reasons;
- customer-safe exclusions and warnings mapped deliberately;
- contract total independently validated;
- configuration and contract cross-linked;
- a later configuration change cannot mutate the contract;
- pre-acceptance changes use contract revision rules;
- post-acceptance changes use addenda.

### 14.3 Quote decision

The configuration summary may be sufficient for early owner use. Before building a separate quote domain, validate whether customers require a formally numbered quote distinct from the existing contract workflow.

If a formal quote is required, it must:

- reference an immutable configuration snapshot;
- have its own number, status, expiry and sent snapshot;
- preserve line-item totals;
- convert to a contract without re-keying;
- never replace the contract's legal approval and acceptance workflow.

---

## 15. Checkout and Order Integration

### 15.1 Admin-first behaviour

Deposit and full-payment buttons are not required to complete Phase 1. The owner may create a contract and use the existing acceptance/payment process first.

### 15.2 Later configuration checkout

When enabled, the client submits only an approved configuration reference:

```json
{
  "configurationId": "configuration_...",
  "revision": 3,
  "snapshotDigest": "sha256:...",
  "type": "deposit"
}
```

The server must:

1. authenticate/authorise admin requests or validate a secure public share context;
2. load the immutable approved snapshot;
3. verify the revision and digest;
4. confirm the model and options remain eligible for checkout where required;
5. independently verify the stored arithmetic;
6. calculate the current approved deposit rule;
7. create Stripe Checkout metadata containing compact references, not the only copy of the specification;
8. create/link an order record after successful webhook completion.

The server must not accept arbitrary prices, costs, discounts or unvalidated selection arrays from the browser.

### 15.3 Price-change policy

An approved configuration's price does not silently change. If a new price must apply:

- create a new revision or explicitly refresh the draft against a later catalogue;
- show the price difference;
- require owner approval;
- generate a new snapshot digest;
- follow contract revision/addendum rules if a customer document already exists.

---

## 16. Build Specification and Future BOM

### 16.1 Structured build specification

Phase 3 should create a build-oriented projection containing:

- configuration and contract references;
- model and model version;
- approved selections by production area;
- quantities and values;
- custom items;
- owner-approved changes;
- weight data and uncertainty status;
- procurement/BOM references where configured;
- visual/reference images where useful;
- outstanding engineering or owner warnings;
- revision and approval history.

### 16.2 Authority boundary

- The configuration is the sales specification source before contract creation.
- The accepted contract plus accepted addenda is the commercial agreement source.
- Engineering CAD and approved factory documentation remain the technical authority.
- A production build specification must reconcile those sources rather than assuming one automatically overrides the others.
- BOM generation cannot be called manufacturing-ready until factory staff validate component mappings and quantities on real builds.

### 16.3 Future BOM fields

Options may contain stable references such as:

- internal part ID;
- supplier SKU;
- quantity expression;
- installation work package;
- affected CAD assembly;
- procurement lead-time class;
- substitution group.

These fields remain admin-only and may be incomplete during the sales-tool phases.

---

## 17. Security, Privacy and Commercial Integrity

- All admin endpoints require the current admin authentication mechanism.
- Customer identity and saved records remain server-side.
- Public share tokens are random, revocable, expiring where appropriate and stored as hashes.
- Public responses use allowlisted projection fields.
- Client-side totals are never authoritative.
- Internal costs and margins must not be bundled into public JavaScript or public manifests.
- Original CAD files and private manufacturing metadata must not be publicly hosted.
- Catalogue publishing requires validation and owner approval.
- Price/rule overrides require actor, timestamp and reason.
- Approved and downstream snapshots are immutable.
- Audit records must avoid unnecessary personal or payment information.
- Stripe keys, Blob credentials and other secrets remain server-only.
- Rate limiting and abuse controls apply before public save/share or checkout launch.
- Configuration summaries must escape untrusted custom text.

---

## 18. AI Boundaries

AI may:

- help convert owner-provided option information into a draft catalogue entry;
- draft customer-friendly descriptions;
- identify possibly missing or contradictory selections;
- summarise configuration changes;
- suggest a category or visual mapping for owner review;
- help interpret existing source documents when the owner asks.

AI must not:

- invent or approve prices, costs, margins or discounts;
- invent weights, compatibility or engineering facts;
- publish a rule without owner review;
- bypass hard rules;
- approve a configuration, quote or contract;
- send customer-facing output autonomously;
- mark a build safe, compliant or vehicle-compatible without approved evidence;
- silently modify an approved snapshot.

Every AI-derived structured change must show its source or be clearly marked as an unverified draft.

---

## 19. Analytics and Audit Events

### 19.1 Internal product analytics

Useful events include:

- `configuration_created`;
- `configuration_saved`;
- `configuration_approved`;
- `configuration_revised`;
- `option_selected` and `option_removed`;
- `rule_blocked_selection`;
- `rule_auto_resolved`;
- `warning_acknowledged`;
- `custom_item_added`;
- `price_override_applied`;
- `configuration_summary_generated`;
- `configuration_converted_to_contract`;
- `configuration_deposit_started`;
- `configuration_payment_completed`.

### 19.2 Audit requirements

Commercially material actions must record:

- configuration ID and revision;
- actor;
- action;
- timestamp;
- previous and new values where relevant;
- reason for override or revision;
- catalogue version;
- downstream contract/order reference.

PostHog is useful for aggregate behaviour but is not the authoritative audit store.

### 19.3 Future public funnel

After public launch, measure:

- configuration starts and completions;
- category and option engagement;
- invalid-combination attempts;
- save/share/enquiry conversion;
- summary downloads;
- deposit conversion;
- average configured value over base value;
- device and viewer failure rates;
- model load and interaction performance.

Public analytics must respect the existing consent mechanism.

---

## 20. Validation and Testing

### 20.1 Catalogue tests

- Schema validation.
- Unique IDs.
- Valid model, option, category and rule references.
- No circular hard dependencies.
- No duplicate single-select defaults.
- Public options cannot depend on hidden options without an approved public resolution.
- Retired IDs are not reused.
- Money values are integer cents.
- Visibility projection contains no private fields.

### 20.2 Rules-engine tests

- Deterministic output.
- Requires/excludes behaviour.
- Automatic selection/removal behaviour.
- Quantity and numeric limits.
- Hard/warning/information severity.
- Override permissions.
- Unknown or retired option handling.
- Partial weight handling.
- Exact price, cost and margin arithmetic.
- Re-evaluation produces the same snapshot on client and server.

Use fixtures based on real owner-approved camper combinations, including known invalid combinations.

### 20.3 Storage and lifecycle tests

- Create, save, reopen and autosave.
- Duplicate and revise.
- Concurrent/stale update protection.
- Approve and create immutable snapshot.
- Catalogue upgrade diff.
- Archive without deleting history.
- Customer/lead links.
- Contract conversion and cross-linking.
- Audit events.

### 20.4 Visual tests

- GLB loads without errors.
- Every binding references an existing node/material/variant.
- Default state matches default configuration.
- Each visual option produces the expected state.
- Missing binding falls back safely.
- Asset retry and WebGL failure states.
- Desktop, tablet and mobile orbit/zoom.
- Performance budgets under representative network/device conditions.

### 20.5 Security tests

- Tampered price ignored/rejected.
- Tampered selections re-evaluated.
- Unapproved draft cannot be checked out.
- Digest/revision mismatch rejected.
- Public projection cannot expose internal cost/margin.
- Share token cannot access another private record.
- Custom text is safely escaped.
- Original CAD paths are never returned.

### 20.6 End-to-end pilot acceptance test

Use at least three owner-approved scenarios:

1. Standard/default build.
2. High-option build that triggers dependencies and warnings.
3. Invalid combination that must be blocked.

For each scenario:

- reproduce expected selections;
- compare retail total and cost against the owner's reference;
- compare indicative weight and unknown values;
- verify visual state where available;
- save, approve and regenerate the snapshot;
- generate the customer summary;
- create a contract draft;
- confirm no re-keying or arithmetic drift.

---

## 21. Recommended File and Module Structure

The exact structure may change during implementation, but responsibilities should remain separated:

```text
src/
├── components/
│   ├── admin/
│   │   └── ConfiguratorWorkspace.tsx
│   └── configurator/
│       ├── ConfiguratorShell.tsx
│       ├── ConfigurationOptions.tsx
│       ├── ConfigurationSummary.tsx
│       ├── ConfigurationRulesPanel.tsx
│       └── ConfiguratorViewer3D.tsx
├── data/
│   └── configurator/
│       ├── catalogue.json
│       ├── models/
│       └── visual-bindings/
└── lib/
    └── configurator/
        ├── types.ts
        ├── schema.ts
        ├── engine.ts
        ├── pricing.ts
        ├── projection.ts
        ├── snapshots.ts
        └── contract-adapter.ts

netlify/functions/
├── admin-configurations.ts
├── admin-configuration-catalogue.ts
├── admin-configuration-summary.ts
├── admin-configuration-contract.ts
├── configuration-public.ts            # Phase 4
└── checkout.ts                         # extended later by snapshot reference

public/models/configurator/
└── <model>/<asset-version>/...

SCRIPTS/
├── validate-configurator-catalogue.mjs
└── validate-configurator-model.mjs
```

Avoid placing the whole new workspace directly inside the already-large `AdminPanel.tsx`. The panel should route/render a dedicated component.

---

## 22. Implementation Sequence

### Track A — Catalogue and engine

1. Define stable IDs and schemas.
2. Audit/import current optional extras as seed data.
3. Create pilot model catalogue.
4. Add rule evaluator and calculation tests.
5. Add internal and customer-safe projections.
6. Add build validation and compiled function manifest.
7. Replace duplicate public extras data with a compatibility adapter.

### Track B — Operational configuration records

1. Add Blob store and server helpers.
2. Add configuration number and revision logic.
3. Add CRUD with stale-update protection.
4. Add audit events.
5. Add approval and immutable snapshot generation.
6. Add customer/lead links.

### Track C — Admin experience

1. Add Configurator tab and dedicated workspace.
2. Build model/category/option workflow.
3. Add live totals and rule explanations.
4. Add custom item and override controls.
5. Add save, duplicate, revision and comparison.
6. Add review and approval.
7. Add customer-safe print/download summary.

### Track D — Contract integration

1. Define configuration-to-contract adapter.
2. Copy snapshot fields into a contract draft.
3. Add cross-links and digest.
4. Test revisions and addenda boundaries.
5. Verify current contract rendering and arithmetic.

### Track E — CAD and visual layer

1. Complete CAD audit.
2. Produce pilot web export and node manifest.
3. Add Three.js viewer and fallback.
4. Add visual binding schema.
5. Add binding validation script.
6. Tune assets, camera, materials and performance.

### Track F — Public and payment later

1. Validate internal use and correct real configurations.
2. Build customer-safe route and share workflow.
3. Add consent-aware funnel analytics.
4. Extend checkout to approved snapshot references.
5. Link webhook-created order to configuration.
6. Complete public security, accessibility and performance gates.

---

## 23. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Product rules are incomplete or live only in the owner's memory | Incorrect configurations | Phase 0 option/rule workshop; real valid/invalid fixtures; warnings for unknowns |
| Existing CAD is too detailed or poorly separated for direct web use | Delayed visual layer | Treat GLB as a derived asset; ship non-3D core first; optimise and remap components |
| Commercial options and CAD nodes become tightly coupled | Expensive model updates | Explicit visual-binding layer with stable option IDs |
| Multiple option catalogues drift | Pricing and quote mismatch | Canonical versioned catalogue; migrate `optional-extras.ts` to an adapter |
| Client totals are manipulated | Incorrect deposit | Authoritative server evaluation and immutable snapshot checkout |
| Catalogue update changes an existing deal | Customer dispute | Immutable snapshots and explicit revision/catalogue-upgrade workflow |
| Internal costs leak publicly | Commercial harm | Separate public projection generated server/build-side; leakage tests |
| Weight looks more authoritative than the data supports | Safety/legal exposure | Known/partial/unknown state; approved warnings; no legal suitability promise |
| Owner is forced through excessive data entry | Tool is abandoned | Defaults, autosave, duplication, ordered categories and fast non-visual workflow |
| 3D work dominates the project | Commercial foundation remains unfinished | Phase gates put engine and saved records before visual polish |
| Contract and configurator become competing sources | Operational confusion | Explicit authority boundaries and snapshot adapter |
| Custom overrides bypass product knowledge | Undeliverable quote | Required reason, audit, review state and restricted hard-rule overrides |

---

## 24. Success Measures

For the admin pilot:

- Owner can configure the pilot model without developer help.
- Known reference builds calculate to the approved retail total.
- Invalid combinations are blocked or clearly warned as designed.
- Drafts can be saved, reopened, duplicated and revised reliably.
- Approved snapshots reproduce identically.
- Customer summaries contain no private fields.
- A contract draft can be created without retyping options or totals.
- At least three real-world configurations are completed before public planning proceeds.
- Owner reports reduced quote/specification preparation time.
- No pricing drift between configuration snapshot and contract line items.

For the later public phase:

- Public and admin engines return the same commercial result for the same permitted selections.
- Internal cost/margin leakage tests pass.
- Server-side tampering tests pass.
- Configurator completion, enquiry and deposit conversion can be measured.
- Mobile visual performance meets the agreed supported-device threshold.

---

## 25. Owner Decisions and Inputs Required

The following decisions block or materially affect implementation:

1. Which camper model is the pilot?
2. What CAD software and native/export formats are available?
3. Where are the authoritative CAD files stored, and who may access them?
4. Are assemblies/options already separated in CAD?
5. What are the approved base configuration and standard inclusions?
6. What is the complete pilot option list?
7. What are the current retail prices, internal costs and GST treatment?
8. Which option weights are known, estimated or unknown?
9. Which rules are hard incompatibilities, warnings or informational notes?
10. Which hard rules, if any, may the owner override?
11. Which options must be visually represented in the pilot?
12. Should the first customer document be called a configuration summary, proposal or quote?
13. Is a separately numbered formal quote required before the contract?
14. Which owner devices must the 3D viewer support?
15. When is a configuration considered approved for deposit/payment?
16. Who validates the future production/BOM mapping?

---

## 26. Definition of Done for the First Admin Release

The first release is done only when:

1. One pilot model has an owner-approved, versioned catalogue.
2. Catalogue and rules pass automated validation.
3. The admin has a dedicated Configurator workspace.
4. The owner can create, save, reopen, duplicate and revise configurations.
5. Price, cost, margin and weight states update deterministically.
6. Required, excluded and warning rules behave correctly.
7. Custom items and permitted overrides require reasons and are audited.
8. Hard-invalid configurations cannot be approved.
9. Approval creates an immutable snapshot and digest.
10. Customer-safe preview and printable/downloadable summary work.
11. Internal fields do not appear in customer output.
12. An approved configuration creates a correctly populated contract draft.
13. Existing Contracts behaviour, checkout and public optional extras are not regressed.
14. The workflow works without 3D when the visual asset is absent or fails.
15. Automated tests cover reference builds and invalid combinations.
16. The owner completes and approves at least three realistic pilot configurations.

The 3D visual layer can follow as Phase 2 without delaying acceptance of the commercially useful Phase 1 release.

---

## 27. Final Recommendation

Proceed with a custom configuration engine integrated into the existing Beyond RV admin rather than purchasing an enterprise CPQ platform at this stage.

Begin with the pilot catalogue, rules and saved configuration record. Reuse the current optional-extras pricing work, server-side checkout validation and contract workspace, but consolidate them behind one canonical catalogue and snapshot model. Audit the existing CAD in parallel and add the Three.js/GLB visual layer only after commercial option IDs and rules are stable.

This sequence delivers an immediately useful owner tool while creating a safe path to the later customer-facing visual configurator, deposit workflow and production specification system.

---

*Document version 1.0 — admin-first rewrite. This document supersedes the 2026-04-17 customer-first 3D configurator PRD while retaining its applicable Three.js, GLB and server-validation foundations.*
