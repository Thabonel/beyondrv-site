# Contact Form Delivery Notes

Date: 2026-05-22

## Current delivery path

The enquiry form now submits to `/.netlify/functions/contact-submit` when JavaScript is available.

The function:

- validates required fields: name, email, phone, and message
- ignores honeypot spam submissions
- stores a backup copy in Netlify Blobs under `customer-enquiries`
- sends an email notification through Resend when `RESEND_API_KEY` is configured
- returns success only after the backup is stored

The original Netlify Forms markup remains in place as a no-JavaScript fallback.

## Required Netlify environment variables

Set these in Netlify under Project configuration > Environment variables:

```text
RESEND_API_KEY=...
CONTACT_TO_EMAIL=beyondcaravans@gmail.com
CONTACT_FROM_EMAIL=Beyond RV Website <enquiries@beyondrv.com.au>
```

`CONTACT_FROM_EMAIL` should use a domain verified in Resend. During initial testing, Resend's onboarding sender may work only for limited test recipients, so a verified Beyond RV sending domain is the production-ready setup.

## Admin backup inbox

The admin area now has an `Enquiries` tab. It reads the last 50 stored submissions from Netlify Blobs through `/.netlify/functions/admin-enquiries`.

This is not a replacement for email notifications. It is a backup so the owner can check recent submissions even if email delivery is misconfigured.

## Launch test

After the environment variables are set:

1. Deploy the site.
2. Submit a real test enquiry from `/inquiry-form/`.
3. Confirm the success page loads.
4. Confirm the email arrives at `CONTACT_TO_EMAIL`.
5. Confirm the submission appears in Admin > Enquiries.
6. Reply to the received email and confirm it replies to the customer email address.

