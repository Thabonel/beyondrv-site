# Genuine Phase 0–1 Blockers

These items were not completed because doing so would require guessing, owner authority or external account credentials. Local preparation and production deployment have been completed where possible.

| ID | Blocker | Why it is genuinely blocked | Smallest action needed | Prepared local artefact |
|---|---|---|---|---|
| B-001 | Google Search Console baseline and submissions | No authenticated account or export is available in the repository. | Grant read access or export the requested reports; after deployment, request indexing for priority URLs. | Baseline requirements in `PHASE-0-BASELINE.md` |
| B-002 | Bing Webmaster baseline and sitemap inspection | No authenticated account or export is available. | Grant read access or export reports; submit/inspect the production sitemap. | Tracker rows P0-03/P1-09 |
| B-003 | Historical blog article recovery | The repository, current sitemap, public search results and the Internet Archive CDX inventory identify the former `/blog/` hub but no article URLs. Guessed redirects could destroy relevance. | Export historical URLs from Search Console, analytics, the former CMS or a backlink tool. | `legacy-url-map.csv` and verified `/blog/` hub redirect |
| B-008 | IndexNow live submission | A public key file must be deployed and live submission is an external side effect. | Choose a key, deploy `/<key>.txt`, set `INDEXNOW_KEY`, review URLs, then use explicit `--submit`. | `SCRIPTS/submit-indexnow.mjs` defaults to dry-run |
| B-009 | Google Business Profile and third-party citation consistency | Public search did not surface an authoritative editable profile, and authenticated listing access is unavailable. | Owner grants access or supplies the profile URL/screenshots; reconcile only after identity confirmation. | Canonical identity questionnaire and claim register |

## Resolved execution blockers

- **B-007 — Production redirect/sitemap/schema verification:** resolved on 29 July 2026. The approved preview was merged as `fd37b40c83aceb4b6d3ed67cfc909143d64e8e79`, Netlify production deploy `6a69a7d41e3ffa00084fbb06` reached ready, and the live authority gate was completed. Four retired-product redirect destinations found during the gate are corrected in the follow-up deployment.

## Resolved owner-input blockers

- **B-004 — Canonical identity:** public brand confirmed as Beyond RV; legal seller, ABN and contact record extracted from the approved contract-generator identity.
- **B-005 — Product origin and manufacturing wording:** owner confirmed on 29 July 2026 that caravan and camper shells are imported, then completed at the Beyond RV workshop in Mutdapilly, Queensland. Public copy must not imply that the shells are manufactured in Queensland.
- **B-006 — Compliance and warranty:** owner confirmed the scope of ADR, Queensland gas/240V certification and the five-year construction warranty on 29 July 2026.
