# Genuine Phase 0–1 Blockers

These items were not completed because doing so would require guessing, owner authority or external account credentials. Local preparation and production deployment have been completed where possible.

| ID | Blocker | Why it is genuinely blocked | Smallest action needed | Prepared local artefact |
|---|---|---|---|---|
| B-001 | Google Search Console baseline and submissions | No authenticated account or export is available in the repository. | Grant read access or export the requested reports; after deployment, request indexing for priority URLs. | Baseline requirements in `PHASE-0-BASELINE.md` |
| B-002 | Bing Webmaster baseline and sitemap inspection | No authenticated account or export is available. | Grant read access or export reports; submit/inspect the production sitemap. | Tracker rows P0-03/P1-09 |
| B-003 | Historical blog article recovery | The repository, current sitemap, public search results and the Internet Archive CDX inventory identify the former `/blog/` hub but no article URLs. Guessed redirects could destroy relevance. | Export historical URLs from Search Console, analytics, the former CMS or a backlink tool. | `legacy-url-map.csv` and verified `/blog/` hub redirect |
| B-009 | Google Business Profile and third-party citation consistency | Public search did not surface an authoritative editable profile, and authenticated listing access is unavailable. | Owner grants access or supplies the profile URL/screenshots; reconcile only after identity confirmation. | Canonical identity questionnaire and claim register |

## Resolved execution blockers

- **B-007 — Production redirect/sitemap/schema verification:** resolved on 29 July 2026. The approved authority preview was merged as `fd37b40c83aceb4b6d3ed67cfc909143d64e8e79`; the redirect and Lighthouse follow-up was merged as `6aba4eb0e4328a1a69dda0ce5894a70d4ac3e2c0`. Netlify production deploy `6a69ab548464d000082cc0a8` reached ready and the final live authority gate passed.
- **B-008 — IndexNow live submission:** resolved on 29 July 2026. The public key file was verified on production and IndexNow accepted all 33 canonical sitemap URLs with HTTP `202`.

## Resolved owner-input blockers

- **B-004 — Canonical identity:** public brand confirmed as Beyond RV; legal seller, ABN and contact record extracted from the approved contract-generator identity.
- **B-005 — Product origin and manufacturing wording:** owner confirmed on 29 July 2026 that caravan and camper shells are imported, then completed at the Beyond RV workshop in Mutdapilly, Queensland. Public copy must not imply that the shells are manufactured in Queensland.
- **B-006 — Compliance and warranty:** owner confirmed the scope of ADR, Queensland gas/240V certification and the five-year construction warranty on 29 July 2026.
