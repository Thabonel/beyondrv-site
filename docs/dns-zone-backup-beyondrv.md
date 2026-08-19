# DNS zone backup — beyondrv.com.au

Captured 2026-08-19 by public DNS query, before the SiteGround plan expires on
2026-09-01. Recreate these records at the new DNS provider BEFORE changing
nameservers.

- Registrar: Tucows (Australia) Pty Ltd t/a OpenSRS
- Registrant: Passion Industries Pty Ltd (ABN 45145189297)
- Current nameservers: ns1.siteground.net, ns2.siteground.net

## 1. Website — recreate as-is

| Host | Type | Value |
|---|---|---|
| @ | A | 75.2.60.5 |
| www | CNAME | beyondrv-au.netlify.app. |

Confirm the apex value in the Netlify dashboard under Domain management rather
than copying the IP blindly — Netlify's apex address can differ by account.

## 2. Resend transactional email — MUST be carried across

These are the highest-risk records in this file. The site sends enquiry
notifications, Stripe payment emails and the daily lead summary from
`enquiries@beyondrv.com.au` through Resend. Miss any of these and that mail
silently stops arriving or starts landing in spam.

| Host | Type | Value |
|---|---|---|
| resend._domainkey | TXT | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDNn7byUJMJjwIuF2P0rGM47NrQa/ogpS5xl8MDhe3lV1HQWiqmhD0WkzjXA++f5Le08EE7cyKCnCqVA6ARUO4qM76f8o8yAYYZLGiX+owWyOn…` (truncated — copy the full value from Resend's dashboard, not from here) |
| send | TXT | v=spf1 include:amazonses.com ~all |
| send | MX 10 | feedback-smtp.ap-northeast-1.amazonses.com. |

The safest way to restore these is to re-verify the domain in the Resend
dashboard at the new DNS provider; Resend will reissue the exact records.

Senders in code:
- netlify/functions/contact-submit.ts:10
- netlify/functions/stripe-shared.ts:6
- netlify/functions/admin-daily-lead-summary.ts:19

All three deliver TO beyondcaravans@gmail.com, which is unaffected by this
migration.

## 3. DMARC — carry across

| Host | Type | Value |
|---|---|---|
| _dmarc | TXT | v=DMARC1; p=none; aspf=r; adkim=r; |

`p=none` only monitors. Once Resend's SPF and DKIM are verified at the new
provider, consider moving to `p=quarantine`.

## 4. SiteGround mailbox records — do NOT copy

These point at SiteGround infrastructure that dies with the plan. The business
reads mail at beyondcaravans@gmail.com, so no mailbox migration is needed.
Copying these across would route mail to servers that no longer answer.

| Host | Type | Value |
|---|---|---|
| @ | MX 10/20/30 | mx10 / mx20 / mx30 .antispam.mailspamprotection.com. |
| @ | TXT (SPF) | v=spf1 +a +mx include:beyondrv.com.au.spf.auto.dnssmarthost.net ~all |
| default._domainkey | CNAME | beyondrv.com.au.default.dkim.auto.dnssmarthost.net. |
| mail | A | 35.213.222.222 |
| ftp | A | 35.213.222.222 |
| autodiscover | A | 35.213.222.222 |
| autoconfig | A | 35.213.222.222 |

### The apex SPF record still needs replacing, not just dropping

The current apex SPF authorises SiteGround. After the migration nothing should
send as `@beyondrv.com.au` except Resend, so replace it with an SPF that
authorises Resend and nothing else, rather than deleting it outright. An absent
SPF record weakens deliverability for the transactional mail in section 2.

### One consequence to accept

Anyone emailing `enquiries@beyondrv.com.au` directly will bounce after the plan
lapses, because nothing will receive at the domain. That address appears in the
From header of every site email. If that matters, add free forwarding
(Cloudflare Email Routing) from enquiries@beyondrv.com.au to
beyondcaravans@gmail.com.

## Not captured

This was read from public DNS, so any record not queried by name is missing.
Export the authoritative zone file from SiteGround Site Tools before the plan
lapses and reconcile it against this list.
