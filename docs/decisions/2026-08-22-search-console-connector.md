# Search Console connector decision

**Decision date:** 22 August 2026
**Outcome:** Withdraw the incomplete standalone connector

The audited standalone Search Console MCP/proxy proposal is not accepted into
the repository or deployment. Its proxy implementation, property boundary,
authentication tests, and operational runbook were incomplete, so setup claims
for that proposal must not be treated as shipped capability.

The existing first-party `netlify/functions/seo-data.ts` admin analytics path is
unchanged by this decision. Any future standalone connector requires a new
review covering a server-side Beyond RV property allowlist, read-only scopes,
bounded inputs and responses, credential rotation, failure tests, monitoring,
and revocation before source or deployment is accepted.
