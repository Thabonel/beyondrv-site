# GM Sales Workspace — Phase 0 Operations

Updated: 9 August 2026

## Purpose

Phase 0 creates the safety foundation for the GM sales workspace without changing the customer-facing agreement wording or making the new workspace the production default. It adds individual actor identity, role/capability checks, actor-attributed agreement history, stable record links, idempotency storage, shared activity events, and session revocation controls.

No production deployment is authorised by this document. Configure and verify these settings in a Netlify Deploy Preview first.

## Authentication configuration

Set a long, random `ADMIN_COOKIE_SECRET` in Netlify. Do not reuse an admin password as the long-term signing secret.

Configure the required individual accounts:

| Environment variable | Purpose |
|---|---|
| `ADMIN_GM_PASSWORD` | Temporary password for the GM actor |
| `ADMIN_GM_NAME` | GM display name used in audit events |
| `ADMIN_OWNER_PASSWORD` | Temporary password for the owner actor |
| `ADMIN_OWNER_NAME` | Owner display name used in audit events |
| `ADMIN_SITE_ADMIN_PASSWORD` | Temporary password for the technical site administrator |
| `ADMIN_SITE_ADMIN_NAME` | Site administrator display name |

Use distinct random passwords. The login user identifiers are `gm`, `owner`, and `site-admin`.

`ADMIN_PASSWORD` remains a temporary compatibility path. Existing shared-password and version-1 sessions continue for at most eight hours. Remove `ADMIN_PASSWORD` only after each individual account has been tested in the Deploy Preview and the rollback window has passed.

The planned approved-phone-number plus one-time SMS-code login is a future backlog item. It must reuse these actor IDs, capabilities, audit attribution, and revocation controls rather than create a parallel permission system.

## Agreement activation configuration

The customer-facing agreement wording is unchanged. New agreement records use:

- Terms version: `2026-08-09-v1-business-approved`
- Business approval version: `2026-08-09-v1`

Set `CONTRACT_TERMS_APPROVED_VERSION=2026-08-09-v1-business-approved` only in the Deploy Preview first. A mismatch deliberately prevents final preparation and sending. Follow [`CONTRACT-WORKFLOW-RUNBOOK.md`](./CONTRACT-WORKFLOW-RUNBOOK.md) for the full test cycle.

## Roles and capabilities

- **GM:** sales, agreements, configurations, deposit verification, build reading and build release.
- **Owner:** all commercial, site, integration, and audit capabilities.
- **Site administrator:** website and integration management plus read-only commercial visibility. The site administrator cannot approve/send agreements, verify deposits, or release builds.
- **Legacy administrator:** temporary full compatibility access while `ADMIN_PASSWORD` is retained.

Capability checks are server-side. Hiding a button is not treated as permission enforcement.

## Session operation and revocation

Sessions expire after eight hours. `/.netlify/functions/admin-session` returns the signed-in actor and capabilities for the admin interface. `/.netlify/functions/admin-logout` clears the browser session on POST.

To invalidate sessions, set one of these values to the current ISO timestamp or Unix epoch in milliseconds and redeploy:

- `ADMIN_SESSION_VALID_AFTER` — revoke every role's earlier sessions.
- `ADMIN_GM_SESSION_VALID_AFTER`
- `ADMIN_OWNER_SESSION_VALID_AFTER`
- `ADMIN_SITE_ADMIN_SESSION_VALID_AFTER`
- `ADMIN_LEGACY_SESSION_VALID_AFTER`

After a cutoff change, verify that an old session is rejected and a fresh login succeeds.

## New storage foundations

Phase 0 adds two append-only/supporting Netlify Blob stores:

- `sales-activity-events` — actor-attributed business activity with customer, opportunity, enquiry, agreement, configuration, and build links where available.
- `sales-command-idempotency` — hashed request keys and their completed results, preventing repeated commands from creating duplicate records.

Existing source stores remain authoritative. Phase 0 does not migrate, delete, or rewrite existing customer, enquiry, agreement, configuration, order, or build stores.

## Preview verification

Before any production promotion:

1. Sign in separately as GM, owner, and site administrator.
2. Confirm `admin-session` reports the expected actor and capabilities for each.
3. Confirm the site administrator can inspect commercial records but receives `403 Forbidden` for agreement approval or mutation.
4. Create a marked test agreement as GM and verify the GM actor ID is stored on creation and update events.
5. Approve, prepare, mark sent, and record acceptance using internal test data; verify each action has the correct actor.
6. Repeat an agreement-creation request with the same idempotency key and confirm only one agreement is created.
7. Confirm existing agreement revisions, addenda, configuration links, calculations, preview, and download continue to work.
8. Confirm old version-1 sessions still work during the compatibility window, then test a session cutoff.
9. Run the automated unit suite and production build.

## Rollback

If preview verification fails:

1. Do not promote the Deploy Preview.
2. Revert the Phase 0 code commit or redeploy the last known-good production commit.
3. Keep `ADMIN_PASSWORD` available during the rollback window so the existing login path remains usable.
4. Remove the individual account variables only if reverting to code that does not understand them.
5. Restore the previous `CONTRACT_TERMS_APPROVED_VERSION` only with the matching previous code/version; never force approval by setting a mismatched identifier.
6. Do not delete the two new Blob stores. They are additive and can remain dormant; retaining them preserves diagnostic history.

Before a production rollout, export or otherwise verify recoverability of the existing agreement, enquiry, configuration, order, and build Blob stores using the established Netlify account controls. Phase 0 itself performs no destructive migration.

## Security notes

- Login attempts are limited per source address; the limiter fails open only if Blob storage is unavailable, with a server warning.
- Unsafe cookie-authenticated mutations require same-origin browser headers.
- Idempotency keys are hashed before storage.
- Do not place passwords, session secrets, bank details, customer correspondence, or access tokens in activity notes.
- Passwords are transitional. SMS-code login requires a separate threat review covering code expiry, replay protection, rate limiting, delivery failure, SIM-swap/account recovery, privacy, provider cost, and an emergency recovery method.
