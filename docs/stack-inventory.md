# What the website depends on

Every external service beyondrv.com.au relies on, and what breaks without it.
Written after a hosting plan nobody knew was load-bearing came within thirteen
days of taking the site offline.

Compiled 19 August 2026.

> **Redacted for a public repository.** Account holders, login addresses,
> payment details and renewal amounts are deliberately omitted. The private
> working copy holds those. Environment variable names appear here because
> they are already in this repository's source; their values are not.

---

## The critical path — lose it and the site is down

No redundancy, no graceful degradation. The site is simply gone until restored.

### Squarespace — domain registrar and DNS

Holds the `beyondrv.com.au` registration, and since 19 August 2026 the DNS zone
as well.

Registrar of record is Tucows (Australia) t/a OpenSRS. Squarespace resells
through them because it is not auDA-accredited — both facts are true at once,
and the account to log into is Squarespace.

**If lost:** total outage. The domain stops resolving, email stops, nothing
reaches the site.

### Netlify — hosting and serverless

Project `beyondrv-au`. Runs the site, 105 serverless functions, TLS, and
Netlify Blobs storage. Builds from GitHub `main` on push.

**If lost:** total outage, plus checkout, the enquiry form and the admin tools.

A failed build never publishes — the previous good deploy keeps serving. This
is why a week of failing builds produced no visible symptom in August.

### GitHub — source of truth

`Thabonel/beyondrv-site`. The entire site, and the branch Netlify deploys.

**If lost:** the live site survives, but nothing can be changed or redeployed.

The admin panel commits content changes back here using `GITHUB_TOKEN`, so a
revoked token silently breaks admin publishing.

### Let's Encrypt — TLS

Automatic through Netlify, self-renewing, free. Listed only because it fails
loudly and publicly if renewal ever breaks.

---

## Revenue and enquiries — fails silently

These do not take the site down. They stop it earning, and they fail quietly,
which makes them more dangerous than the critical path. A broken enquiry
pipeline looks exactly like a slow week.

### Stripe — payments

Online checkout for parts and accessories. Keys are `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET`, set as Netlify environment variables.

**If lost:** customers cannot pay, and nothing on the site looks wrong.

### Resend — transactional email

Enquiry notifications, Stripe payment emails, and the daily lead summary. Sends
from an address on the domain, through Amazon SES, delivering to the business
inbox.

**If lost:** enquiries stop arriving. Customers still submit the form and still
see a success message — nobody hears about them.

**Depends on three DNS records** that are easy to lose in a migration because
they sit on the `send.` subdomain rather than the apex:

| Host | Type |
|---|---|
| `resend._domainkey` | TXT — DKIM |
| `send` | TXT — SPF for Amazon SES |
| `send` | MX — bounce handling |

Senders in code:

- `netlify/functions/contact-submit.ts`
- `netlify/functions/stripe-shared.ts`
- `netlify/functions/admin-daily-lead-summary.ts`

### Gmail — business inbox

Where every site notification is delivered. Independent of the domain, so
unaffected by DNS or hosting changes. Mail sent *to* the domain's own address
bounces; nothing receives there.

---

## Features and insight — degrades

Lose these and the site keeps selling.

### OpenAI

The public chatbot, admin assistant, contract drafting and voice capture.
Billed per use, so cost scales with traffic; rate limits are set through
`OPENAI_ADMIN_DAILY_LIMIT` and `OPENAI_ADMIN_HOURLY_LIMIT`.

### PostHog

Traffic, campaign attribution and conversion funnels. Losing it costs
visibility, not function — but historical data may not be recoverable.

### Google and Bing search console data

SEO reporting in the admin analytics page, via a Google service account plus
OAuth, and `BING_WEBMASTER_API_KEY`. Search rankings are unaffected; this only
reads the data. Service account keys can be rotated or expired by Google Cloud
policy.

---

## Retired

### SiteGround

Provided DNS and unused mailboxes. **Served no web traffic at any point** — the
website has been on Netlify throughout. Auto-renewal was switched off on
19 August 2026 and the plan lapses on 1 September.

The only site on the plan was a SiteGround placeholder hostname. The old
WordPress media already lives in this repository at `public/wp-content/uploads`
and is served by Netlify, so nothing of value is lost on expiry.

---

## What is actually watching

| Failure | Detected by | Status |
|---|---|---|
| Site down or erroring | UptimeRobot, 5-minute checks | Covered |
| Domain or DNS failure | UptimeRobot, indirectly | Covered |
| TLS certificate expiry | UptimeRobot, indirectly | Covered |
| Unquoted frontmatter date breaking the build | Schema coercion and regression tests | Covered |
| Build failing after a push | Manual check in Netlify | Covered |
| Build failing with no push (admin panel) | Nothing — accepted risk | Blind spot |
| Enquiry emails not arriving | Nothing | Blind spot |
| Stripe checkout broken | Nothing | Blind spot |
| Domain expiry | Auto-renew, notices to a monitored inbox | Covered |
| Other service renewals | Vendor emails only | Blind spot |

Netlify email notifications require a paid plan, and this site's account is on
the free tier, so deploys are reviewed by hand after each push instead. The
residual gap is automated commits from the admin panel, which produce no push
to prompt a check.

---

## Why this document exists

### The August 2026 near miss

1. On **18 August**, archiving a product through the admin panel wrote a
   timestamp in a format Astro's parser rejected. Every production build failed
   from that moment.
2. **Nobody was told.** No build alerts existed, and the site kept serving the
   14 August build quite happily, so there was no visible symptom.
3. On **19 August**, the broken builds were found by accident, while adding an
   unrelated job advertisement.
4. That discovery surfaced a second problem: the **SiteGround plan expiring on
   1 September** was providing DNS. Nobody knew the website depended on it.
   Letting it lapse would have taken beyondrv.com.au offline entirely, despite
   the site being hosted somewhere else.
5. Both were fixed the same day. Neither was found by monitoring.

### What changed as a result

1. **DNS moved to Squarespace**, with every record verified against public
   resolvers before and after the cutover. SiteGround can now expire harmlessly.
2. **The archive bug was fixed at the source**, not just patched in the data.
   The old test passed because it parsed output with the same YAML dialect that
   wrote it; the replacement parses the way Astro actually does, and failed
   before the fix.
3. **The whole category was then closed.** The content schema coerces a `Date`
   to an ISO string before validating, across every date field, so an unquoted
   timestamp written by any function can no longer fail a build. Proved by
   restoring the exact frontmatter that broke production on 18 August and
   watching the build complete.
4. **Uptime monitoring went live**, covering the site, DNS and certificate.
5. **Domain contacts were corrected**, so expiry and transfer notices reach the
   business rather than a departed contractor.

### The lesson worth keeping

The root cause was not a YAML bug or an expiring hosting plan. It was that
three things failed silently at once and nothing was watching any of them. Both
problems were found by accident, six hours apart, by someone doing unrelated
work.

---

## The YAML trap, in detail

Worth recording because it will look wrong to the next person who reads the
code and thinks the quoting is redundant.

The `yaml` package follows **YAML 1.2**, which has no implicit timestamp type,
so it serialises an ISO string unquoted. Astro reads frontmatter with
gray-matter, which uses js-yaml's **YAML 1.1** schema — and that dialect *does*
have implicit timestamps, so the same scalar parses back as a `Date`. A
`z.string()` field then fails, and the build aborts.

Two defences now exist, deliberately:

- `netlify/functions/product-archive-core.ts` quotes the timestamp on write.
- `src/content.config.ts` coerces a `Date` back to an ISO string on read, via
  `src/lib/contentDates.ts`.

Either alone would fix the known bug. Both together mean a mistake in one
cannot take the site down.

---

*Re-check when a service is added, removed, or repriced.*
