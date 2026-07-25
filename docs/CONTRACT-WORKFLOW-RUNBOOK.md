# Beyond RV Contract Workflow Runbook

Updated: 23 July 2026

## Production activation

The code is deliberately fail-closed. Do not enable customer sending while the Terms version contains `legal-review-draft`.

1. Have the new Terms and Conditions reviewed and approve the final wording.
2. Change `CONTRACT_TERMS_VERSION` in `netlify/functions/contract-core.ts` to a final unique version, for example `2026-07-30-v1-approved`.
3. Update the approved Terms document so it displays the same version.
4. Deploy the site.
5. In Netlify, open **Site configuration → Environment variables**.
6. Add `CONTRACT_TERMS_APPROVED_VERSION` with the exact same final version.
7. Trigger a fresh deploy so Functions receive the variable.
8. Run the test cycle below before using a customer email.

Do not configure the current value `2026-07-23-v0.1-legal-review-draft`. The application intentionally shows an orange legal-approval warning and hides the Gmail action until the exact approved version is configured.

## First test cycle

Use an internal email address and a clearly marked test agreement.

1. Open **Admin → Contracts → New Contract**.
2. Enter the buyer, product, pricing, specifications, and delivery notes.
3. Select **Validate & Preview** and check every page.
4. Save, move to review, and approve.
5. Select **Prepare Final Contract**. This locks that version and stores its SHA-256 digest.
6. View the final copy and download it.
7. Select **Open Gmail Draft**.
8. Attach both:
   - the downloaded final sale agreement; and
   - the approved Terms document bearing the exact Terms version shown on the agreement.
9. Check the recipient, subject, contract number, version, amount, and both attachments, then send from Gmail.
10. Return to admin and select **Mark as Sent**.
11. Reply with a signed test copy or explicit acceptance email.
12. Record the acceptance method, person, email, time, and Gmail/file evidence reference.
13. Confirm the contract shows **accepted** and that its change/addendum area is available.

## Live original contract

The permitted acceptance methods are:

- **Signed copy/photo:** retain the returned scan/photo and record its Gmail link or controlled file location.
- **Explicit email:** retain the Gmail message link containing clear acceptance of the identified contract/version.
- **Deposit payment:** use only after the complete agreement and Terms were sent. Record the amount and bank/payment reference. Investigate any amount mismatch before recording acceptance.

The customer-facing clause is:

> By signing this Agreement, or where permitted by this Agreement by paying the Deposit after receiving the complete Agreement, you confirm that you have read and agree to all terms and conditions forming part of it.

Payment does not replace a signature where law requires one. Do not infer acceptance from an unexplained, partial, third-party, or mismatched payment.

## Revisions

- Before acceptance, create a new revision; never overwrite a prepared or sent version.
- Record the reason for the revision.
- Recheck all prices, specifications, payment amounts, recipient details, and the Terms version.
- Prepare and send only the replacement version.

## Addenda after acceptance

1. Open the accepted contract.
2. Create an addendum from the phone call, email, in-person discussion, or owner note.
3. State each exact change, price delta, payment impact, and delivery impact.
4. Confirm every change, validate, preview, review, and approve it.
5. Prepare the immutable addendum, download it, open Gmail, attach it, and send it.
6. Mark it sent.
7. Record a returned signed copy/photo or explicit acceptance email.

Deposit payment alone is not an addendum-acceptance method.

## Evidence standards

Every acceptance record needs:

- accepting customer's legal name;
- customer email;
- acceptance date and time;
- acceptance method;
- Gmail message link, controlled signed-copy location, receipt, or other durable reference;
- bank/payment reference and amount for deposit acceptance; and
- a short note where the buyer email differs or authority needs explanation.

Do not paste full bank details, card information, access tokens, or unnecessary customer email content into notes.

## If something is wrong

- **Before Prepare Final:** edit and revalidate the draft.
- **After Prepare Final or Send, before acceptance:** create a replacement revision.
- **After acceptance:** create a numbered addendum.
- **Wrong recipient:** do not mark sent; correct the buyer record by creating the appropriate replacement. If already sent, notify the owner immediately and follow the privacy/data-breach process.
- **Terms warning remains:** compare the agreement's Terms version with Netlify `CONTRACT_TERMS_APPROVED_VERSION`, then redeploy.
- **Gmail disconnected:** reconnect Gmail for intake. Gmail compose itself uses the owner's normal signed-in Gmail browser session.

## No autonomous sending

The website AI may classify emails and draft proposed contract changes. It cannot approve prices, approve documents, send customer email, or record acceptance. Those remain explicit owner actions.
