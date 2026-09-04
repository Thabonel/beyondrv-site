# Meta retargeting: the Starlink Mini campaign

**Status:** Draft plan, not approved
**Date:** 30 August 2026
**Owner:** Thabo
**Scope:** Bring high-intent camper researchers back with a Meta retargeting offer

## What this is

Bring a genuinely interested visitor back with a Facebook or Instagram ad after
they leave the site, offering a Starlink Mini supplied and installed with an
eligible camper order.

A visitor cannot be sent a browser pop-up or an unsolicited private message once
they have left. Retargeting through the Meta Pixel is the mechanism that does
what is wanted here.

**Provenance.** The campaign strategy below came from Thabo. The platform and
regulatory claims it rests on are recorded as stated and have **not** been
verified against Meta, ACCC, or OAIC sources during this write-up. Confirm them
before spending money. They are marked *unverified* where they appear.

## What exists in the repo today

Four findings that change the shape of the work.

| Finding | Consequence |
|---|---|
| **No Meta Pixel is installed.** Nothing in `src/` or `netlify/` references `fbq` or `facebook.net` | This is a from-scratch install, not an event added to an existing pixel |
| **The content security policy blocks Meta entirely.** `netlify.toml` allows `script-src 'self' https://us.i.posthog.com https://*.posthog.com` and no Facebook domain in `connect-src` | The pixel is silently blocked until the policy changes. This is the same failure mode that blocked the Outfit font on the admin pages |
| **Consent is a single yes or no.** `CookieConsent.astro` writes `brv_cookie_consent` as `accepted` or `declined`, and `PostHogProvider.astro` gates on `=== 'accepted'` | Someone who accepted analytics would be enrolled in advertising with no separate choice |
| **PostHog already tracks behaviour.** `PostHogProvider.astro` is the established pattern for a consent-gated script | Follow it rather than inventing a second approach |

### The consent problem, stated plainly

The existing banner asks one question and stores one answer. If the pixel is
gated on that same flag, a visitor who accepted analytics cookies is also opted
into cross-platform advertising, without being asked.

The OAIC has said organisations must understand what tracking pixels collect,
configure them carefully, and be transparent about targeted advertising
(*unverified*). A single undifferentiated "accept cookies" is weak ground for
that, and it is the kind of thing that reads badly in hindsight.

**Recommendation: split the consent into two choices, analytics and advertising,
before the pixel ships.** That is real work and it is a prerequisite, not a
nicety. It also protects the campaign: a visitor who chose advertising is a
better audience than one who clicked accept to dismiss a banner.

## The audience

### Identifying a high-intent visitor

Do not fire on someone who left a tab open. Fire a custom event,
`HighIntentCamperVisitor`, when a visitor meets all of:

- at least 90 seconds of **active** browsing, not elapsed time
- viewed at least two camper pages
- scrolled at least 40 to 50 percent down a camper page
- viewed pricing, specifications, or the suitability checker
- has not already submitted an enquiry or paid a deposit

Meta's pixel supports custom events, so this audience can be separated from
casual traffic (*unverified*).

### The retargeting audience

A Meta Website Custom Audience of everyone who fired `HighIntentCamperVisitor` in
the last seven days, excluding:

- existing customers
- people who submitted an enquiry
- people who paid a deposit
- staff and administrators
- people who already claimed the offer

Meta allows retention periods and inclusion or exclusion rules based on website
behaviour (*unverified*).

**Note on the exclusions.** Four of those five are known to the site, not to
Meta. Enquiries and deposits live in Netlify Blobs; Meta only knows what the
pixel tells it. Each exclusion therefore needs its own event fired at the moment
it becomes true, or the exclusion silently does nothing. This is the most likely
way the campaign quietly retargets people who already bought.

## The ads

A visitor sees, on Facebook or Instagram:

> Still comparing slide-on campers?
> Order a selected ByondRV camper by 6 September 2026 and receive a Starlink Mini
> supplied and professionally installed at no additional cost.
> Talk to the ByondRV team to confirm availability and suitability for your vehicle.

Button options: Send Message, Claim Offer, Book a Consultation, Check My Vehicle.

A click-to-message variant opens Instagram, Messenger, or WhatsApp, but the
visitor must click the ad first. Meta does not allow privately messaging an
unidentified website visitor who has not initiated or consented to the
conversation (*unverified*).

### The strongest version is model-specific

Someone who looked at an Advent 2150 sees:

> Still considering the Advent 2150? Secure yours this week and receive a
> complimentary Starlink Mini installation package.

Someone who viewed another model sees that model. This reads as a continuation
of their research rather than an advertisement.

That requires the pixel event to carry the model viewed, which means the camper
pages need to pass a product identifier into the event.

## Why seven days, not three

A camper costs tens of thousands of dollars. Three days creates pressure rather
than confidence. Buyers need to discuss it with a partner, confirm vehicle
payload, arrange finance, compare models, visit the factory, and understand
delivery timing.

Structure it as: claim the Starlink offer within seven days by speaking with
ByondRV and placing an eligible order or agreed deposit. The clock starts when
the visitor becomes high-intent, not as a permanent countdown shown to everyone.

A second ad runs in the final 48 hours:

> Your complimentary Starlink Mini and installation offer ends soon. Speak with
> ByondRV before the offer closes.

## The urgency has to be real

The deadline must genuinely expire. Do not reset the countdown when a visitor
returns, and do not run the same "limited" offer indefinitely. The ACCC has
warned about misleading limited-time promotions and false urgency, including
countdown timers that reset and offers still available after supposedly ending
(*unverified*).

Campaign conditions to settle and publish before launch:

- eligible camper models
- exact campaign dates
- whether a signed order or a deposit is required
- whether the Starlink Mini hardware is included
- what installation covers
- any wiring, mounting, or data plan exclusions
- delivery and stock limitations

Advertising claims and stated savings must be accurate and supported
(*unverified*).

## The landing page

Visitors clicking the ad land on a page showing:

1. the camper they viewed
2. the Starlink offer
3. a genuine expiry date
4. a clear value breakdown
5. a vehicle suitability check
6. a direct button to contact ByondRV

Point 5 is worth noting: the vehicle suitability check is the weight calculator,
and its vehicle picker is currently hidden because no variant has passed review.
A campaign landing page that promises a suitability check should not ship before
that picker is back.

## Work required, in order

1. **Split the cookie consent** into analytics and advertising choices. Prerequisite.
2. **Allow Meta in the content security policy.** `script-src` needs
   `https://connect.facebook.net`; `connect-src` needs `https://www.facebook.com`.
   Verify against the pixel's actual requests rather than assuming.
3. **Install the pixel**, gated on advertising consent, following the
   `PostHogProvider.astro` pattern.
4. **Fire the intent event**, including the model viewed, on the conditions above.
5. **Fire the exclusion events** on enquiry submitted and deposit paid, without
   which the exclusions do nothing.
6. **Build the landing page**, after the vehicle picker is live.
7. **Update the privacy policy** at `src/pages/privacy-policy/index.astro` to
   disclose the pixel and targeted advertising, with a plain opt-out.
8. **Settle the campaign conditions** listed above, in writing, before spending.

## Open questions

- Does the Starlink offer apply to every camper or only selected models?
- Is a deposit sufficient to claim, or is a signed order required?
- What is the real hardware and installation cost, so the stated value is supportable?
- Who checks that the deadline actually expires, and switches the ads off?
- Does the seven-day clock run per visitor, or is 6 September a fixed campaign end?
  The ad copy above states a fixed date while the audience logic describes a
  rolling seven-day window. These are different offers and only one can be true.

## Out of scope

- Any change to how enquiries or deposits are recorded
- Email remarketing
- Google or YouTube retargeting
