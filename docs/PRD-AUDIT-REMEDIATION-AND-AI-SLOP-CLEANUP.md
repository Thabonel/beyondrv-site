# Product Requirements Document: Audit Remediation and AI-Slop Cleanup

**Status:** Implemented; public vehicle data remains gated pending human approvals

**Date:** 22 August 2026

**Owner:** Beyond RV product and engineering

**Target branch:** `main`

**Priority:** Release-blocking for vehicle-selector safety requirements

## 1. Executive summary

This PRD defines the work required to resolve the findings from the seven-day code-quality audit covering the vehicle selector, slide-on weight calculator, marketing-idea workflow, Google Search Console connector, automated tests, and repository artifacts.

The audit found useful, tested functionality, but also identified two safety-critical failure modes, a potential stored-record collision, an unsafe JSON embedding boundary, weak runtime validation, cross-browser test failures, incomplete connector source, and generated-artifact sprawl. Some corrective work has subsequently landed on `main`; this PRD keeps those items in scope until their regression, migration, and release criteria are satisfied.

The public vehicle selector must remain fail-closed until the publication approval workflow and weight-calculation safety gates are complete. A passing build alone is not sufficient evidence for release.

## 2. Problem statement

The current implementation mixes research status, publication approval, calculation behavior, and user-facing provenance in ways that can make unreviewed data public or allow incomplete mass information to look safe. At the same time, several boundaries appear type-safe in TypeScript while accepting insufficiently validated runtime data. Generated files and local tool artifacts are also easy to commit accidentally, reducing review quality and obscuring meaningful changes.

The remediation must produce a system where:

- only explicitly human-approved vehicle variants are published;
- missing or ambiguous safety data can never produce a green suitability result;
- stored admin records cannot overwrite unrelated records through derived-ID collisions;
- catalogue data cannot break out of its serialization context;
- runtime validation genuinely validates unknown data;
- supported browsers exercise the real fallback behavior;
- operational tools are reproducible from repository source; and
- generated artifacts do not pollute normal source-control reviews.

## 3. Goals

1. Close every P1 and P2 audit finding with automated regression coverage.
2. Make vehicle publication and calculation behavior conservative by default.
3. Separate data verification from customer-publication approval.
4. Replace superficial type assertions and repeated `any` usage with validated boundaries and shared types.
5. Establish a reliable desktop and mobile browser test gate.
6. Make every shipped operational tool buildable and deployable from this repository.
7. Prevent local reports, renders, dependencies, and working files from entering commits accidentally.
8. Leave concise documentation that explains the safety and maintenance decisions without duplicating implementation details.

## 4. Non-goals

- Researching additional vehicle makes or variants.
- Treating the calculator as engineering certification or legal fitment approval.
- Replacing the existing calculator design or admin dashboard wholesale.
- Building a general-purpose content-management platform for research data.
- Committing generated proposals, document renders, browser reports, or local dependency folders.

## 5. Audit baseline and current status

| ID | Finding | Severity | Status on `main` at PRD creation | Release treatment |
|---|---|---:|---|---|
| AUD-01 | Catalogue promotion ignores the documented `customer_selectable` approval state | P1 | Open | Blocks public selector release |
| AUD-02 | Missing tray mass could produce a green result | P1 | Corrective logic exists; full regression verification required | Blocks release until acceptance tests pass |
| AUD-03 | Title-derived marketing IDs could collide and overwrite records | P1 | Fingerprinted IDs exist; legacy-data migration and conflict behavior require verification | Blocks workflow release if legacy records exist |
| AUD-04 | Raw catalogue JSON is embedded with `set:html` | P2 | Open | Must close before accepting additional external research data |
| AUD-05 | Catalogue validation relies on type assertions and partial checks | P2 | Open | Required for maintainability gate |
| AUD-06 | Catalogue-failure test fails in WebKit/Safari | P2 | Open | Required for browser support gate |
| AUD-07 | Search Console MCP references a proxy not represented in repository source | P2 | Tool is not part of current `main`; unresolved in working material | Must be completed or withdrawn before commit/deployment |
| AUD-08 | Reports, renders, working folders, and dependencies can pollute commits | P3 | Open; Playwright artifacts are tracked | Required repository-hygiene cleanup |

## 6. Users and stakeholders

- **Customers:** need conservative, understandable suitability results.
- **Beyond RV sales and fitment staff:** need trustworthy source provenance and clear review states.
- **Data reviewers:** need an explicit approval workflow with attributable decisions.
- **Administrators:** need durable marketing records without silent overwrites.
- **Developers and maintainers:** need validated boundaries, focused modules, reliable tests, and clean diffs.
- **Business owner:** needs release evidence and a reversible rollout.

## 7. Functional requirements

### FR-1: Human-approved vehicle publication

1. Source verification and customer publication approval must be separate states.
2. `customer_selectable` or its explicitly designed successor must be the default-deny publication gate.
3. Catalogue generation must exclude every row that lacks explicit publication approval, regardless of `verification_status`.
4. A publication decision must record reviewer identity, timestamp, decision, and an optional bounded note.
5. Overrides must not bypass auditability. Every force-show action must include a reason, reviewer, and date, and must fail validation when those fields are absent.
6. A hide decision must always take precedence over a show decision.
7. Catalogue generation must fail when:
   - a published row lacks an approval record;
   - an approval references a missing variant;
   - an override is contradictory or incomplete;
   - a published row lacks required source provenance; or
   - mass arithmetic or required safety fields do not validate.
8. The generated catalogue must include a non-sensitive approval reference or publication timestamp for traceability.
9. Existing rows must remain unpublished until a human review is completed. Bulk approval based only on an AI research pass is prohibited.

### FR-2: Fail-closed tray and vehicle-weight calculation

1. When published kerb mass excludes the tray, the result must remain `Needs review` until either:
   - a valid tray mass is entered; or
   - the customer explicitly confirms that the current weight is an actual measured weight that already includes the fitted tray.
2. When tray inclusion is unknown, the customer must make the same explicit choice; silence must never be interpreted as zero tray mass.
3. Hidden or inapplicable tray inputs must never contribute to the calculation.
4. Changing make, model, variant, current weight, or tray-inclusion confirmation must recompute the tray requirement and clear stale incompatible state.
5. Negative, non-finite, malformed, or missing tray mass must not reduce estimated vehicle weight.
6. Provenance must immediately disclose when a customer-provided value replaces a published value.
7. A green result requires all safety-critical fields and confirmations to be present and internally consistent.
8. Unit tests must cover the pure weight-resolution rules; browser tests must cover the complete state transitions.

### FR-3: Collision-resistant and migration-safe marketing records

1. Canonical IDs must include a deterministic fingerprint of the complete normalized title, not only a truncated or lossy slug.
2. Equivalent whitespace-normalized titles must remain idempotent.
3. Punctuation-distinct titles and titles sharing a long prefix must remain distinct.
4. The server, not the browser, is authoritative for canonical new-record IDs.
5. Existing records using legacy IDs must remain readable and updatable.
6. A documented migration or alias strategy must prevent duplicate records when a legacy idea is saved again under the new algorithm.
7. A write must never overwrite a record whose stored canonical identity does not match the intended idea. Conflicts must return a clear `409`-style response rather than silently replacing data.
8. Tests must cover legacy IDs, collision cases, idempotent resaves, concurrent writes, and status-only updates.

### FR-4: Safe catalogue serialization

1. Catalogue transport must treat all database strings as untrusted data.
2. The chosen serialization must prevent closing-script sequences, HTML injection, and execution through URLs or text fields.
3. If JSON remains embedded in HTML, at minimum `<`, `>`, `&`, U+2028, and U+2029 must be safely encoded before insertion.
4. A preferable alternative may expose a static JSON asset with explicit schema validation and a graceful fetch failure path.
5. Source URLs must be restricted to approved `https:` manufacturer or authoritative domains during catalogue validation.
6. Security tests must include `</script>`, HTML tags, JavaScript-like URLs, Unicode separators, and malformed JSON.
7. The solution must remain compatible with the site Content Security Policy and must not require `unsafe-inline`.

### FR-5: Genuine runtime schema validation

1. Imported or parsed catalogue data must enter the validator as `unknown`.
2. Validation must verify the complete top-level, model, variant, source, numeric, enum, URL, date, and array structure before use.
3. Validation must reject missing arrays and fields with controlled errors rather than throwing incidental `map` or property-access exceptions.
4. Numeric strings, `NaN`, infinities, negative masses, impossible years, duplicate IDs, duplicate model entries, and unsupported schema versions must be rejected.
5. The validator must return a typed catalogue only after successful validation; double assertions such as `as unknown as VehicleCatalogue` are not acceptable at the boundary.
6. Client code must consume shared inferred or exported types rather than repeated `any` annotations.
7. Vehicle-picker behavior should be extracted from the page-level inline script into focused modules with testable pure functions.
8. Validation errors shown in logs must identify the failing path without exposing secrets or dumping the entire catalogue.

### FR-6: Reliable cross-browser fallback behavior

1. The supported matrix is Chromium, Firefox, WebKit, mobile Chromium, and mobile Safari.
2. The catalogue-missing and catalogue-malformed tests must pass in every supported project.
3. Fallback tests must prove that the calculator module executed and recalculates results, not merely that HTML inputs remain editable.
4. Response rewriting in tests must preserve headers and module-loading behavior consistently across engines.
5. The normal project test command must start a deterministic local server without relying on a stale detached process or a manually selected port.
6. Playwright reports and last-run metadata must be CI artifacts, not tracked source files.
7. Any intentionally unsupported browser must be documented with an approved product decision; tests must not silently skip it.

### FR-7: Reproducible Search Console connector

Before the connector is committed or deployed, choose one of two outcomes:

**Ship the connector**

1. Add the read-only proxy implementation to repository source.
2. Restrict the proxy to the Beyond RV Search Console property through a server-side allowlist; client-provided `siteUrl` must not broaden access.
3. Keep Google credentials server-side and connector tokens outside source control.
4. Validate action names, parameters, date ranges, row limits, URLs, and response sizes.
5. Add authentication failure, authorization boundary, timeout, rate-limit, malformed upstream response, and property-allowlist tests.
6. Document local setup, deployment, token rotation, revocation, monitoring, and incident response.
7. Ensure the smoke test can run against an explicitly selected non-production or approved production endpoint without revealing secrets.

**Withdraw the connector**

1. Remove incomplete connector source and setup claims.
2. Record the decision and required future design work in the project roadmap.

### FR-8: Repository and artifact hygiene

1. Ignore local working and generated paths, including appropriate forms of:
   - `work/`;
   - rendered document and image outputs;
   - `playwright-report/`;
   - transient `test-results/` files;
   - nested `node_modules/`; and
   - local editor or agent launch configuration where it is not intentionally shared.
2. Remove tracked generated reports from the index in a dedicated, reviewable commit without deleting needed local copies unexpectedly.
3. Keep only deliberate final deliverables in source control, stored in a documented location with a reason for versioning them.
4. Add a CI check that fails on common generated directories, accidental dependency trees, secrets, and oversized unexpected files.
5. Run whitespace and Markdown checks on documentation.
6. Documentation must identify the canonical source when SQL, SQLite, CSV, and generated JSON versions coexist.
7. Generated data builds must be reproducible and must include a documented verification command.

## 8. Non-functional requirements

### Safety

- Missing or ambiguous vehicle data must bias toward `Needs review`, never toward suitability.
- No automated or AI-generated research may become customer-selectable without attributable human approval.
- The public calculator must continue to state that it is an estimate and requires final Beyond RV confirmation.

### Security

- Treat catalogue strings, stored admin records, tool arguments, and upstream API responses as untrusted.
- Do not weaken the existing Content Security Policy.
- No credential, token, private key, or complete sensitive DNS value may enter source control, test output, or browser-visible responses.

### Maintainability

- Prefer small pure modules for calculation, normalization, validation, and state derivation.
- Avoid parallel client/server constant lists unless they are generated from or imported from a browser-safe shared module.
- Comments should explain non-obvious safety decisions, not narrate line-by-line implementation.
- New production logic requires tests that fail before the fix and pass afterward.

### Performance

- The selector must not materially regress page startup or interaction responsiveness.
- If the catalogue grows beyond the present payload, move it to a cacheable static asset or indexed server endpoint.
- Build output must document and address unexpected large JavaScript chunks.

### Accessibility

- Required tray decisions and validation errors must be programmatically associated with their controls.
- Error and status meaning must not depend on color alone.
- Keyboard and screen-reader flows must be included in browser acceptance testing.

## 9. Delivery plan

### Phase 0: Release containment

1. Confirm whether the selector is publicly deployed.
2. If AUD-01 is present in production, disable catalogue-assisted selection or publish an empty approved catalogue until review records exist.
3. Preserve manual calculator entry if it remains fail-closed and unaffected.
4. Record the production state and rollback point.

### Phase 1: Safety-critical remediation

1. Implement and test the human publication gate.
2. Verify the tray-weight corrections already present on `main` against every state transition.
3. Complete a human review of each variant intended for initial publication.
4. Regenerate the catalogue only from approved rows.
5. Conduct product-owner and fitment-specialist sign-off.

### Phase 2: Security and data integrity

1. Replace unsafe JSON embedding.
2. Implement full runtime schema validation.
3. Verify marketing-ID collision fixes and migrate or alias legacy records.
4. Add hostile-input and conflict tests.

### Phase 3: Browser reliability and maintainability

1. Extract vehicle-picker logic into typed modules.
2. Fix the WebKit fallback test and prove calculation execution.
3. Run the complete browser matrix in CI.
4. Address new build or type-check diagnostics introduced by the feature.

### Phase 4: Tooling and repository cleanup

1. Ship or withdraw the Search Console connector.
2. Update ignore rules and untrack generated artifacts.
3. Add repository-hygiene and secret-scanning checks.
4. Document canonical generated-data workflows.

## 10. Test and verification plan

### Unit tests

- Publication decisions, overrides, missing approvals, and conflicting states.
- Complete catalogue schema, invalid primitives, missing collections, URLs, dates, enums, and versions.
- Tray excluded, included, not applicable, unknown, measured-weight override, blank, zero, negative, and malformed cases.
- Marketing IDs for whitespace equivalence, punctuation differences, long-prefix collisions, legacy records, and concurrent writes.
- Serialization of closing-script and Unicode edge cases.
- Search Console property allowlisting and input bounds if the connector ships.

### Integration tests

- Rebuild database and catalogue from canonical sources in a clean environment.
- Prove that zero unapproved rows appear in the public catalogue.
- Prove that every published row has an attributable approval and valid source.
- Exercise admin record creation, resave, migration, conflict, and status changes.
- Exercise connector authentication and the Beyond RV property boundary.

### Browser tests

- All existing selector flows across all five configured projects.
- Missing and malformed catalogue while confirming a calculated result changes after input.
- Every tray-inclusion transition and stale-state reset.
- Keyboard navigation, required-field announcements, and visible non-color status text.
- Hostile catalogue text rendered as inert text.

### Required commands

The implementation handoff must record exact results for:

```sh
npm test
npm run check
npm run build
npm run test:e2e
git diff --check
```

It must also run the database and catalogue rebuild/validation commands documented by the vehicle-selector data workflow.

## 11. Acceptance criteria

The remediation is accepted only when all of the following are true:

1. No vehicle variant is public without an explicit attributable human approval.
2. The catalogue build fails closed for unapproved, malformed, or unsafe rows.
3. Missing tray information cannot produce a green result.
4. The tray workflow handles measured weights without double-counting.
5. Distinct marketing ideas cannot resolve to the same canonical ID, and legacy records remain accessible without duplication or overwrite.
6. Hostile catalogue values cannot escape the JSON/data context or execute markup.
7. Runtime validation accepts `unknown` and returns a typed catalogue only after complete validation.
8. Production picker code contains no unbounded catalogue `any` usage.
9. The full configured Playwright matrix passes, including the catalogue-failure case in WebKit and mobile Safari.
10. The Search Console connector is either fully represented, secured, tested, and documented in source or removed from the proposed change set.
11. Generated reports, renders, dependencies, and working directories do not appear in a normal `git status`.
12. Unit tests, checks, build, browser tests, data validation, whitespace checks, and repository-hygiene checks all pass.
13. A Beyond RV product owner and a qualified vehicle/fitment reviewer approve the release evidence.

## 12. Rollout and rollback

1. Release the approved catalogue behind a reversible configuration or publication switch.
2. Start with a small, manually verified variant set.
3. Monitor selector errors, missing-data paths, customer overrides, and support feedback.
4. Do not use green-result counts as proof of fitment correctness.
5. Roll back to manual entry or an empty catalogue if approval provenance, calculation behavior, or client parsing becomes uncertain.
6. Preserve the previous catalogue and approval snapshot for audit comparison.

## 13. Success measures

- 100% of public variants have attributable approval records.
- 0 green results with missing safety-critical values.
- 0 canonical-ID collisions in migration and regression fixtures.
- 100% pass rate across the configured browser matrix.
- 0 generated working directories or dependency trees in review diffs.
- 0 high-severity secret-scanning or injection findings.
- A new maintainer can rebuild and validate the catalogue using repository documentation alone.

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Human review delays reduce available selector coverage | Launch with a smaller approved set; retain manual calculator entry |
| Legacy marketing ideas appear duplicated after ID migration | Alias or migrate deterministically and test existing store snapshots |
| Strict validation rejects current generated data | Report exact paths, fix canonical source data, and never weaken validation to force a build |
| Browser interception tests differ from production delivery | Test both production-built static output and controlled failure fixtures |
| Repository cleanup removes useful local deliverables | Untrack deliberately, preserve local copies, and document canonical deliverable storage |
| Connector proxy broadens access to other properties | Enforce the property allowlist server-side and test denial behavior |

## 15. Definition of done

Work is done when every acceptance criterion has linked evidence, all P1 and P2 findings are closed, the release gate is approved by both product and fitment reviewers, the public rollout is reversible, and the repository is left with focused source changes and no unexplained generated artifacts.
