# Beyond RV — Current Landmark

**Last updated:** 10 August 2026  
**Repository:** `Thabonel/beyondrv-site`  
**Working branch:** `staging`  
**Production branch:** `main`  
**Current production commit:** `d6d8864` — Sunpatch 12C walkthrough video

This is the practical landmark for the current Beyond RV site. It records what is live, where the important parts live in the codebase, how the GM workflow works, and what remains to be validated by the GM.

## 1. Live environments

| Environment | Address | Purpose |
|---|---|---|
| Production | `https://beyondrv.com.au` | Live customer and staff site. |
| GM call logger | `https://beyondrv.com.au/admin/quick-note/` | The GM's direct phone page for post-call notes. Login required. |
| Admin | `https://beyondrv.com.au/admin/` | Owner/site-admin/legacy administration. |
| Analytics | `https://beyondrv.com.au/admin/analytics/` | Private traffic and marketing dashboard. |
| Staging review | `https://deploy-preview-14--beyondrv-au.netlify.app` | Current branch preview while PR 14 remains open. |

Netlify project: `beyondrv-au` (`97ce02f8-5e4c-4373-ba3c-6fc473ef2bdb`).

## 2. What is live now

### GM sales workspace

- The GM has a separate mobile-first sales workspace: **Today**, **Customers**, **Agreements**, and **Builds**.
- The owner and legacy administrator can enter the same view through **Sales workspace** in Admin Tools.
- The workspace has deliberate actions for calls, customer follow-up, agreements, builds, and Gmail connection.
- GM and owner roles are separate from the technical/site-management view. Access is enforced on the server by capability, not only hidden in the interface.

Main code:

- `src/components/GmSalesWorkspace.tsx`
- `src/components/AdminApp.tsx`
- `netlify/functions/admin-sales-workspace.ts`
- `netlify/functions/admin-auth.ts`

### Company Gmail connection

- The GM workspace includes **Connect company Gmail**.
- It starts the authenticated Google OAuth connection at `/.netlify/functions/google-oauth-start`.
- The button is available in the GM workspace; the connection still depends on the required Google/Netlify environment configuration being present.

### Phone call logger

The GM's prominent action is **Log customer call**. It opens `/admin/quick-note/` directly.

The safe flow is:

1. GM taps the phone Home Screen icon or **Log customer call**.
2. GM taps the microphone; permission is requested only after that deliberate tap.
3. The recording is uploaded for server-side transcription.
4. AI produces a proposed call summary and fields to review.
5. GM corrects typed fields as required, optionally adds a phone/email to link the customer, then chooses **Correct — Save Everything**.
6. The system saves a phone-call enquiry, an optional follow-up, exact contact-linked customer/lead data, activity and audit evidence.

The GM can use the typed fallback if a device cannot record. **Discard / re-record** removes the unconfirmed transcript and draft before starting again.

Important commercial boundaries:

- A call note does **not** automatically change price, agreement, deposit, production, or a build specification.
- Money, dates, appointments, unresolved items, and agreement discussion are prominently warned about for review.
- Audio is used for transcription only and is not stored.
- A stable call-record ID prevents an action retry from creating a duplicate note.

Android compatibility:

- Android Chrome reports recordings such as `audio/webm;codecs=opus`.
- The server now accepts this normal WebM variant rather than rejecting it.

Main code:

- `src/components/QuickVoiceCapture.tsx`
- `src/pages/admin/quick-note.astro`
- `netlify/functions/admin-voice-capture-extract.ts`
- `netlify/functions/admin-voice-capture-confirm.ts`
- `netlify/functions/admin-voice-capture-discard.ts`
- `netlify/functions/voice-capture-core.ts`

### Installable phone app

The call logger is an installable web app, not just a browser bookmark.

- Manifest: `public/manifest.json`
- Android icons: `public/icons/icon-192.png`, `public/icons/icon-512.png`, and `public/icons/icon-maskable-512.png`
- iPhone touch icon: `public/apple-touch-icon.png` (180×180 PNG, opaque)
- Browser icon: `public/favicon.ico` (32×32)

The application uses standalone display mode and starts at `/admin/quick-note/`.

#### GM instruction — Android

1. Open Chrome on the GM's phone.
2. Go to `https://beyondrv.com.au/admin/quick-note/`.
3. Sign in as the GM.
4. Open Chrome's three-dot menu.
5. Choose **Install app**, or **Add to Home screen** if that wording is shown instead.
6. Keep the name **Log Customer Call** and install it.

The Beyond RV icon will appear on the Home Screen. The first real recording needs microphone permission.

If an older shortcut was installed before the icon work, delete it first and install the new one from Chrome.

### Admin Analytics shortcut

- The **Analytics** shortcut is restored beside **Admin Tools** at the top left of the regular admin page.
- It opens `/admin/analytics/`.
- The GM sales workspace deliberately remains focused on sales work; Analytics is a technical/owner-admin shortcut.

Main code:

- `src/components/AdminPanel.tsx`
- `src/pages/admin/analytics.astro`
- `src/components/AnalyticsDashboard.tsx`

## 3. Product walkthrough videos

All checks below are against the live public product pages and count an actual embedded product video, not the generic YouTube channel link in the footer.

### Videos attached

- 7ft Electric Pop-Top Slide-On Camper
- Advent 2150 Hardtop Ute Slide-On Camper
- Advent 2300 Hardtop Ute Slide-On Camper
- Advent 2450 Hardtop Ute Slide-On Camper
- 3.5m Electric Pop-Top Cabover Family Camper
- 4.7m Hardtop Truck Camper
- Empty DIY Unimog Camper Box
- Mercedes Sprinter AWD LWB Cab Chassis Motorhome
- Sunpatch 12C Couples Off-Road Van
- Sunpatch 15-XC Couples Off-Road Van
- Sunpatch 21-XF Hardtop Family Off-Road Van

### No product video supplied

These remain without a video because no link has been supplied for them:

- 3.5m DIY Camper Box with Cabover and Underfloor Storage
- Twin Air Compressor Shield
- Blue Unimog Overlander Camper
- Unimog Overlander Camper
- Sunpatch 19-XC Hardtop Couples Off-Road Van

Recent additions:

- Advent 2150: YouTube ID `Dd_JKzK9jUo`
- Sunpatch 12C: YouTube ID `6MzaA9WCYU4`

Product data is stored in `src/content/products/`. Add a product video through the frontmatter shape below:

```yaml
youtubeVideo:
  id: YOUTUBE_VIDEO_ID
  title: Beyond RV Product Name Walkthrough
  description: Video walkthrough for the Beyond RV product.
  # startSeconds: 23  # only when the supplied video should start later
```

## 4. Authentication and roles

Roles are defined in `netlify/functions/admin-auth.ts`.

| Role | Intended use |
|---|---|
| `gm` | Routine sales work: customers, follow-ups, agreements and call notes. |
| `owner` | Can use sales work and technical/site administration. |
| `site_admin` | Site management and read-only access to commercial areas where permitted. |
| `legacy_admin` | Existing shared-admin migration account; has the compatibility access needed to test the GM view. |

Relevant environment variable names (never record their values in Git):

- `ADMIN_GM_PASSWORD`
- `ADMIN_OWNER_PASSWORD`
- `ADMIN_SITE_ADMIN_PASSWORD`
- `ADMIN_LEGACY_NAME`
- `ADMIN_COOKIE_SECRET`
- `ADMIN_SESSION_VALID_AFTER` and the role-specific session-valid-after settings

The phone call logger requires the signed-in actor to have `sales:write`.

## 5. Data and AI boundaries

### AI configuration

The call logger uses server-side OpenAI configuration only:

- `OPENAI_API_KEY`
- `OPENAI_VOICE_TRANSCRIPTION_MODEL` (defaults to `gpt-4o-mini-transcribe`)
- `OPENAI_VOICE_EXTRACTION_MODEL` (defaults through the configured admin model)

No API key is exposed to the phone browser.

### Data written after confirmation

- `customer-enquiries`: the manual phone-call enquiry/note
- `customer-lead-status`: an optional follow-up date and reason
- Owner customer/lead records: only when phone or email provides exact match evidence
- Sales activity and owner audit records

### Data not automatically changed

- prices or discounts
- agreement contents or agreement status
- deposits/payment status
- production, factory, drawing, CAD, shipping or build decisions

This is intentional. The current voice feature is a safe, confirmed call-capture slice, not an automated commercial-commitment system.

## 6. Agreements and sales outcomes

- A website enquiry can be converted to a prefilled agreement through the controlled agreement workflow.
- **New agreement** is intentionally for a blank phone/walk-in agreement.
- Free-text customer requests remain non-contractual until deliberately reviewed and confirmed.
- Sales outcomes are capability-gated and idempotent. Follow-up and visit actions require a date; a lost/not-proceeding action requires a reason.
- Activity, owner audit and queue updates are appended by the server.

Important files:

- `netlify/functions/admin-enquiry-agreement.ts`
- `netlify/functions/admin-sales-outcome.ts`
- `netlify/functions/sales-outcome-core.ts`
- `netlify/functions/sales-activity-core.ts`
- `src/components/ContractManager.tsx`

## 7. Remaining operational validation

The requested development work is complete. The primary remaining action is real GM feedback:

1. Install **Log Customer Call** on the GM's Android phone.
2. Record one short, non-sensitive test call note.
3. Confirm transcription, summary review, save result, customer linking and follow-up behaviour are clear and useful.
4. Report any language, missing field, device permission or workflow friction.

The following broader PRD capabilities are deliberately not claimed as complete by the current call logger:

- AI correction of an existing proposal by a second voice recording
- persistent offline upload queue
- fuzzy/ambiguous customer matching with one-tap match choices
- AI-created or AI-modified agreements, pricing, deposit, production or build actions

Do not add these without the corresponding human confirmation, validation, commercial rules and test coverage.

## 8. Verification baseline

For the phone-call and installation work, the following have passed:

- `npm test` — full unit suite passed (163 tests at the completed call-logger checkpoint)
- `npm run check` — no errors; pre-existing hints only
- `npm run build` — successful static build
- Playwright call-logger tests — passed in desktop Chromium, mobile Chrome and mobile Safari emulation
- Android WebM MIME-format unit test — passed
- PWA metadata/icon test — passed
- Live Netlify deployment checks confirmed the production embeds for the new Advent 2150 and Sunpatch 12C videos

The known non-blocking build warning is the existing large JavaScript chunk warning.

## 9. Deployment procedure

The current release process used for the recent live work is:

1. Make the smallest focused change.
2. Run relevant tests, then `npm run check` and `npm run build`.
3. Stage explicit paths only.
4. Commit with a focused message.
5. Push to `origin/staging`.
6. Promote to production only with user authorisation, using `git push origin staging:main`.
7. Wait for the Netlify production deploy state to be `ready` and verify the live page when relevant.

Recent production commits, newest first:

- `d6d8864` — Add Sunpatch 12C walkthrough video
- `ebc79b3` — Add Advent 2150 walkthrough video
- `de85f60` — Restore admin analytics shortcut
- `8f1b6ea` — Add installable call logger app icons
- `b29fd33` — Accept Android WebM call recordings
- `b086564` — Add GM phone call capture

## 10. Working-tree safety

These items are user-owned/generated and must not be reset, cleaned, overwritten or blanket-staged:

- `playwright-report/index.html`
- `docs/ByondRV-Configurator-PRD-and-Database-Design.md`
- `work/`

Always check `git status --short` and use focused `git add` paths. Do not use `git reset --hard`, `git checkout --`, `git clean`, or blanket staging in this repository.

## 11. Supporting documents

Read these when work expands beyond this landmark:

1. `docs/PROJECT_ROADMAP.md`
2. `docs/HANDOVER-GM-SALES-WORKSPACE-2026-08-09.md`
3. `docs/plans/2026-08-09-gm-sales-workspace-agreement-voice-capture-prd.md`
4. `docs/CONTRACT-WORKFLOW-RUNBOOK.md`
5. `docs/HANDOVER-FRESH-START-2026-08-10.md` — historical checkpoint, superseded for current status by this document

## 12. Fast restart prompt

> Work in `/Users/thabonel/Code/Byond_RV`. Read `docs/landmark.md` first. Preserve user-owned dirty files, make focused changes and commits, test appropriately, and do not promote staging to production without the user's explicit approval. The live GM call logger is at `/admin/quick-note/`; it saves human-confirmed call notes only and must not automatically make commercial or production decisions.
