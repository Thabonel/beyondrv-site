# Genuine Phase 0–1 Blockers

These items were not completed because doing so would require guessing, owner authority, external credentials or a production deployment. Local preparation has been completed where possible.

| ID | Blocker | Why it is genuinely blocked | Smallest action needed | Prepared local artefact |
|---|---|---|---|---|
| B-001 | Google Search Console baseline and submissions | No authenticated account or export is available in the repository. | Grant read access or export the requested reports; after deployment, request indexing for priority URLs. | Baseline requirements in `PHASE-0-BASELINE.md` |
| B-002 | Bing Webmaster baseline and sitemap inspection | No authenticated account or export is available. | Grant read access or export reports; submit/inspect the production sitemap. | Tracker rows P0-03/P1-09 |
| B-003 | Historical blog article recovery | The repository and current sitemap do not identify the old article URLs, traffic or backlinks. Guessed redirects could destroy relevance. | Export historical URLs from Search Console, analytics, the former CMS, backlinks or a web archive. | `legacy-url-map.csv` and `/blog/` hub redirect |
| B-005 | Product origin and manufacturing wording | The owner confirmed how completed units are certified but not whether shells are made locally, imported and completed locally, or vary by model. Source data contains mixed supply models. | Answer the single plain-language clarification in `OWNER-QUESTIONNAIRE-1.md`. | Claim register C-005/C-009 |
| B-007 | Production redirect/sitemap/schema verification | Local configuration cannot prove CDN behaviour or the deployed HTML. | Deploy the tested change, then run one-hop redirects and live crawl checks. | Local redirect config, build and audit command |
| B-008 | IndexNow live submission | A public key file must be deployed and live submission is an external side effect. | Choose a key, deploy `/<key>.txt`, set `INDEXNOW_KEY`, review URLs, then use explicit `--submit`. | `SCRIPTS/submit-indexnow.mjs` defaults to dry-run |
| B-009 | Google Business Profile and third-party citation consistency | These records are external and their current values were not available for authenticated editing. | Owner grants access or supplies screenshots/exports; reconcile only after identity confirmation. | Canonical identity questionnaire and claim register |

## Resolved owner-input blockers

- **B-004 — Canonical identity:** public brand confirmed as Beyond RV; legal seller, ABN and contact record extracted from the approved contract-generator identity.
- **B-006 — Compliance and warranty:** owner confirmed the scope of ADR, Queensland gas/240V certification and the five-year construction warranty on 29 July 2026.
