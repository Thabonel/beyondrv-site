# Configurator Phase 2 Operations Runbook

Date: 2026-08-09
Status: Implemented in code, verified locally, not deployed

## What is now built

The Configurator workspace now covers the operational path from a priced configuration to production:

1. The owner edits model and option pricing in **Manage Catalogue**.
2. A customer configuration is saved against a customer and optional lead.
3. Every off-catalogue alteration has a positive customer charge, a visual brief and a versioned drawing register.
4. Drawings can be uploaded as PDF, PNG, JPEG, WebP or GLB, or linked using HTTPS. Only an owner-approved drawing version is exposed to the customer.
5. The owner creates a private 14-day customer-review link.
6. The customer reviews the price, selected options, approved drawings and available 3D model, then approves or requests changes with recorded identity and time evidence.
7. The owner approves the configuration, producing an immutable digest-protected snapshot.
8. An internally approved catalogue and approved snapshot can create a contract draft.
9. After the verified contract and deposit evidence exist, the configuration can be released to production.
10. Production status follows the real Beyond RV process: deposit received → ordered from factory → China production → awaiting shipping → in transit → arrived at Mutdapilly → local fitout → handover → delivered.

## Safety gates

- Saving catalogue changes always returns the catalogue to `owner_review`.
- Internal catalogue approval requires a separate confirmation action.
- Customer review links become stale when the underlying configuration changes.
- Original CAD is never published. Only derived GLB assets or explicitly approved drawing files are exposed through token-checked file delivery.
- A customer cannot access private costs, margins, owner notes or unapproved drawing versions.
- Customer approval is required before internal configuration approval.
- Configuration approval requires the deterministic rules engine to pass, including approved drawings for every custom alteration.
- Contract creation requires an internally approved catalogue, customer approval and a verified configuration snapshot.
- Production release requires a linked contract, customer approval, approved custom drawings and deposit reference/date evidence.

## Storage

Operational data uses the existing Netlify Blobs connection:

| Store | Purpose |
| --- | --- |
| `byondrv-configurator-catalogue` | Current owner-edited catalogue override |
| `byondrv-configurations` | Configurations, snapshots and hashed review-token indexes |
| `byondrv-configuration-files` | Private drawing and GLB bytes |
| `customer-orders` | Linked production orders and status history |

The raw review token is returned only when its link is created. The stored token index and configuration record contain only its SHA-256 hash and a short hint.

## CAD and GLB intake

Keep the received source CAD outside the public website. Produce a web-safe `.glb`, preserving useful component/node names for option bindings.

Run:

```bash
npm run configurator:prepare-glb -- path/to/source.glb path/to/output.optimized.glb
```

The command validates the binary glTF header, optimizes and Draco-compresses the model, and rejects output over 25 MB. After visual QA:

1. upload the approved GLB as a drawing version or put it at a controlled public asset URL;
2. enter that URL under **Manage Catalogue → 3D web asset**;
3. mark the visual asset `ready`;
4. add node bindings and hotspots to the catalogue data when the final node names are known;
5. test base/configured toggling, orbit, zoom and mobile rendering.

The viewer supports a poster fallback, orbit/zoom controls, base-versus-configured comparison, option-to-node visibility bindings and 3D hotspots. Until a GLB is marked ready, the normal product image remains visible.

## Remaining external inputs

The code is ready to accept these without another structural rebuild:

- source CAD or exportable GLB files from China;
- base prices for the Blue Unimog Overlander, Unimog Overlander and Empty DIY Unimog Camper Box;
- verified option compatibility rules;
- verified internal costs and weight deltas;
- owner acceptance testing and a deliberate deployment decision.

## Local verification

Run:

```bash
npm run check
npm test
npm run build
```

The build requires the usual Netlify environment at runtime for Blobs and admin authentication. No production deployment is part of this implementation.
