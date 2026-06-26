# ByondRV Site Chatbot — PRD & Implementation Plan

**Date:** 2026-05-02
**Status:** Approved — ready to build
**Phase:** A (last major unbuilt Phase A feature)

---

## 1. Purpose

Add a floating chat widget to every page of the ByondRV site. Customers type questions in plain English and get instant, accurate answers about products, specs, pricing, compatibility, and the buying process. The chatbot converts curiosity into enquiries by handing qualified leads directly to the enquiry form with their conversation context pre-filled.

This is the last major unbuilt feature from Phase A. Everything else (site, admin, analytics) is live.

---

## 2. User Experience

### 2.1 Widget

- Floating button, **bottom-right corner**, every page (including product pages, category pages, home)
- Icon: a speech bubble or the ByondRV logo mark — orange fill, dark background
- On click: slides open a panel (~400px wide on desktop, full-screen on mobile)
- Closes on second click or via an X button
- Does not block the main CTA buttons on product pages
- Loads **asynchronously** — zero impact on page render or Lighthouse score

### 2.2 Greeting

- Default (non-product pages): *"Hi! I'm the ByondRV assistant. Ask me anything about our campers and caravans."*
- Product pages: *"Got questions about the [Product Name]? Ask away."* — product name injected via a `data-product` attribute on the widget's mount point
- The greeting appears immediately without hitting the API

### 2.3 Conversation

- User types a message and hits Enter or clicks Send
- Response streams back word-by-word (streaming API)
- Messages stack in a scrollable list (user bubbles right/orange, assistant bubbles left/dark)
- "Talk to a human →" button pinned at the top of the panel — always visible, never buried
- Session cap: 30 messages max. After 30, the assistant says: *"We've covered a lot — ready to speak with the team directly?"* and the send input is disabled

### 2.4 Hand-off to Enquiry Form

**Trigger — always user-initiated, never automatic.**

The assistant *suggests* the handoff in its response text when it detects purchase intent — e.g. *"Sounds like you're ready to chat with the team — hit 'Talk to a human' above and I'll send them a summary of our conversation."* The user still has to click. No automatic redirect, no form submission without user action.

The system prompt instructs Claude to say this whenever it detects phrases like "how do I order", "I want to buy", "what's the process", "I'm keen" — but the user always stays in control.

When the user clicks "Talk to a human":

1. The widget builds a one-sentence conversation summary (e.g. *"Customer asked about Advent 2450 for a 70-Series LandCruiser, particularly payload and solar setup. Wants a call to discuss."*)
2. Browser opens `/inquiry-form/` with `?message=<url-encoded-summary>` appended
3. The enquiry form's Message field is pre-filled with that summary
4. The chatbot panel remains open so the user can go back if needed

---

## 3. Knowledge Base

The chatbot receives a system prompt that includes:

### 3.1 Product Catalogue (generated at build time, bundled into the function)

A build script (`scripts/build-product-catalogue.mjs`) runs as part of the Netlify build command **before** `astro build`. It reads all product `.md` files from `src/content/products/**`, parses YAML frontmatter, and writes a compact JSON file to `netlify/functions/product-catalogue.json`. The `site-chat.ts` function imports this file directly — esbuild bundles it into the function at deploy time.

**Why not read from the GitHub API at request time?** That approach adds 200–500ms latency per request, risks GitHub rate limits, and increases function runtime cost. Deploy-time bundling is free and instant.

Each product entry in the catalogue:
- Name, slug, price, status (available / on-sale / coming-soon / sold)
- Key specs (length, TARE, sleeps, battery, solar)
- Short description
- Which vehicles it suits

Total catalogue size: ~3,000–5,000 tokens — well within Haiku's context window.

Build command in `netlify.toml` updated to:
```
command = "node scripts/build-product-catalogue.mjs && npm run build"
```

### 3.2 Brand & Operational Knowledge (static in system prompt)

- Company: ByondRV, Mutdapilly QLD 4307, phone 0430 863 819, email beyondcaravans@gmail.com
- Workshop: Mutdapilly, SE Queensland — all electrical, cabinetry, compliance done locally
- Warranty: full structural and fitout warranty (details on /warranty/)
- What we build: slide-ons, caravans, expedition builds (Unimog, Isuzu NPS)
- What we don't do: finance, trade-ins, delivery quotes — refer to team

### 3.3 Current Page Context

- A `data-page-title` and `data-page-slug` attribute on the widget mount point tell the assistant which page the user is on
- If on a product page, the full product content is highlighted in the prompt

### 3.4 What the Chatbot Does NOT Know / Do

- Live stock counts beyond what's in the product front matter
- Finance, trade-in, or delivery pricing — routes to enquiry form
- Off-topic questions — politely declines and steers back
- Never fabricates specs — says "I don't have that detail, the team can confirm" rather than guessing
- Never makes promises about delivery dates, pricing discounts, or finance approval

---

## 4. Technical Architecture

```
[Public page]
  └── <SiteChatWidget client:load /> (React island, mounted in BaseLayout.astro)
        └── data-product, data-page-title attributes from Astro frontmatter

[React island — SiteChatWidget.tsx]
  ├── Floating button toggle
  ├── Chat panel (messages, input, "Talk to a human" button)
  ├── Streams response from /.netlify/functions/site-chat
  └── Fires PostHog events (chat_opened, chat_message_sent, chat_handoff)

[Netlify Function — netlify/functions/site-chat.ts]
  ├── POST only
  ├── Receives: { messages, productSlug?, pageTitle? }
  ├── Builds system prompt with product catalogue + brand knowledge
  ├── Streams Claude Haiku response back using SSE (text/event-stream)
  ├── Enforces: max 30 messages check (returns 429 if exceeded)
  └── Returns: streamed text

[BaseLayout.astro]
  └── Mounts <SiteChatWidget> with page/product props
      — passes product/page data via props → data attributes
```

### 4.1 Streaming

The function returns `text/event-stream`. The React island reads the stream with `ReadableStream` / `TextDecoder` and appends tokens to the current assistant message as they arrive.

### 4.2 Model

**Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) — cheapest, fastest Claude model. Appropriate for product Q&A. Uses the existing `ANTHROPIC_API_KEY` already in Netlify env vars.

### 4.3 Cost Controls

- Session cap: 30 messages enforced server-side (client sends message count, function rejects if >30)
- Max tokens per response: 512 (plenty for product answers, prevents runaway spend)
- System prompt is compact (~5,000 tokens) — no retrieval needed at this traffic level
- Estimated cost: **$5–15/month** at typical RV site traffic

**Known limitation:** A determined user could reset their local message count and send another 30 messages. At this traffic level this is not worth defending against — a Netlify Blobs session store would fix it in Phase B if abuse becomes a problem.

### 4.4 Client-Side Timeout

If 15 seconds pass without receiving a token from the stream (API timeout or mid-stream error), `SiteChatWidget.tsx` aborts the fetch and appends a fallback message: *"Sorry, I hit a snag. Try again or hit 'Talk to a human' to reach the team directly."* This prevents the UI from hanging on a silent failure.

---

## 5. Files to Create / Modify

| Action | File |
|--------|------|
| Create | `scripts/build-product-catalogue.mjs` — build-time catalogue generator |
| Create | `netlify/functions/site-chat.ts` |
| Create | `src/components/SiteChatWidget.tsx` |
| Modify | `netlify.toml` — update build command to run catalogue script first |
| Modify | `src/layouts/BaseLayout.astro` — mount widget, pass page/product props |
| Modify | `src/pages/[...slug].astro` — pass product slug + title as props to BaseLayout |
| Modify | `src/pages/expedition/[slug].astro` — same |

### Product page prop passing (exact pattern)

```astro
<!-- src/pages/[...slug].astro -->
<BaseLayout
  title={entry.data.title}
  productTitle={entry.data.title}
  productSlug={entry.slug}
  ...
>
```

```astro
<!-- src/layouts/BaseLayout.astro -->
<SiteChatWidget
  client:load
  pageTitle={title}
  productSlug={productSlug}
  productName={productTitle}
/>
```

---

## 6. System Prompt Design

```
You are the ByondRV assistant — a friendly, knowledgeable chat helper on the ByondRV website.
ByondRV builds slide-on campers, caravans, and expedition vehicles out of Mutdapilly, Queensland.

CURRENT PAGE: {pageTitle} ({pageSlug})

PRODUCT CATALOGUE:
{productCatalogue}

CONTACT:
- Phone: 0430 863 819
- Email: beyondcaravans@gmail.com
- Address: 77 Coleyville Rd, Mutdapilly QLD 4307

RULES:
- Answer questions about ByondRV products, specs, compatibility, and the buying process
- Be warm, direct, and Australian in tone — no corporate speak
- If you don't know something specific (delivery dates, finance, exact stock count), say so and suggest calling or enquiring
- Never fabricate specs — say "the team can confirm that" if uncertain
- Keep responses under 3 short paragraphs — this is a chat, not an essay
- When the customer signals purchase intent ("how do I order", "I want one", "I'm keen", "what's the process to buy") respond naturally, then add: "Sounds like you're ready to chat with the team — hit 'Talk to a human' above and I'll send them a summary of our conversation." Do not automatically redirect. The user always clicks.
- Decline off-topic questions politely: "I'm set up to help with ByondRV campers — for anything else, I'd be out of my depth!"
- Never discuss competitor products
```

---

## 7. PostHog Analytics Events

Fired by `SiteChatWidget.tsx` (only when PostHog is loaded / consent given):

| Event | When | Properties |
|-------|------|------------|
| `chat_opened` | Widget opened | `page`, `product_slug` |
| `chat_message_sent` | User sends a message | `page`, `message_count` |
| `chat_handoff` | "Talk to a human" clicked | `page`, `product_slug`, `message_count` |
| `chat_session_capped` | 30-message limit reached | `page` |

These feed into the analytics dashboard chatbot metrics section.

---

## 8. CSS / Visual Design

Follows the existing design system (dark theme, orange accent, CSS custom properties):

- Widget button: 52px circle, `background: var(--orange)`, white icon, fixed bottom-right, `z-index: 9000`
- Chat panel: `background: var(--dark)`, `border: 1px solid var(--border)`, `border-radius: 12px` on desktop, full-screen on mobile
- User bubbles: `background: var(--orange)`
- Assistant bubbles: `background: var(--panel)`
- Input bar: same styling as admin panel input
- "Talk to a human" button: `color: var(--orange)`, top of panel, always visible
- Font: Outfit (already loaded on every page via BaseLayout)
- `prefers-reduced-motion`: disable slide-open animation if set

---

## 9. Accessibility

- Widget button: `aria-label="Open chat"` / `aria-label="Close chat"` (toggled on state change)
- `aria-expanded` on the button reflects panel state
- Chat panel: `role="dialog"`, `aria-label="ByondRV chat assistant"`
- Messages list: `role="log"`, `aria-live="polite"` — screen readers announce new messages
- Input: `aria-label="Your message"`
- Keyboard: Tab focuses widget button; Enter/Space opens it; Escape closes it

---

## 10. Mobile Behaviour

- Below 768px: panel opens full-screen (100vw × 100vh)
- Back/close button in top-right corner
- Input bar stays pinned to bottom of screen
- "Talk to a human" button collapses to a smaller version but remains visible

---

## 11. Owner Controls (via AI Admin)

The owner can ask the AI admin to:
- "Add this FAQ to the chatbot: Q — do you ship interstate? A — yes, freight is quoted at handover."
  → Appended to `src/content/chatbot-faqs.md`; system prompt includes these at function startup
- View chatbot metrics in analytics dashboard (conversation count, hand-off rate, top questions)

---

## 12. Environment Variables

No new env vars required. Uses the existing `ANTHROPIC_API_KEY` already set in Netlify.

---

## 13. Implementation Task Breakdown

### Task 0 — `scripts/build-product-catalogue.mjs` + update `netlify.toml`
- Node ESM script: reads all `.md` files from `src/content/products/**` recursively using `fs/promises`
- Parses YAML frontmatter (use the `gray-matter` npm package, already available)
- For each product: extracts title, slug, price, status, keySpecs, description, category
- Writes compact JSON to `netlify/functions/product-catalogue.json`
- Update `netlify.toml` build command: `node scripts/build-product-catalogue.mjs && npm run build`

### Task 1 — `netlify/functions/site-chat.ts`
- POST only, rejects other methods
- Validates `messages.length <= 30` — returns 429 with friendly message if exceeded
- Imports `product-catalogue.json` directly (bundled by esbuild at deploy time)
- Builds system prompt (brand block + catalogue from imported JSON)
- Calls `anthropic.messages.stream()` with `claude-haiku-4-5-20251001`, `max_tokens: 512`
- Pipes the stream back as `text/event-stream` SSE: each token as `data: <token>\n\n`, ends with `data: [DONE]\n\n`
- On API error: returns `data: [ERROR]\n\n` so the client shows a friendly fallback

### Task 2 — `src/components/SiteChatWidget.tsx`
- Toggle state: `isOpen`, `messages[]`, `loading`, `streamTimeout`
- Floating button (fixed, bottom-right)
- Chat panel: messages list + input bar + "Talk to a human" button + close X
- `sendMessage()`: POST to `/.netlify/functions/site-chat`, read `response.body` stream, decode tokens, append to current assistant message
- **15s timeout**: set a `setTimeout` when stream starts; clear it on each received token; if it fires, abort fetch and append fallback message
- `handleHandoff()`: builds `?message=` URL from last assistant message context, opens `/inquiry-form/...`
- PostHog events: `window.posthog?.capture(...)` guarded with optional chaining
- Props: `pageTitle?: string`, `productSlug?: string`, `productName?: string`

### Task 3 — Wire into `BaseLayout.astro`
- Add props: `productTitle?: string`, `productSlug?: string` to the Props interface
- Import `SiteChatWidget`
- Mount `<SiteChatWidget client:load pageTitle={title} productSlug={productSlug} productName={productTitle} />`

### Task 4 — Pass product props from product pages
- `src/pages/[...slug].astro`: pass `productTitle={entry.data.title}` and `productSlug={entry.slug}` to BaseLayout
- `src/pages/expedition/[slug].astro`: same

### Task 5 — CSS in `global.css`
Append chat widget CSS before `/* ─── RESPONSIVE ─── */`.

### Task 6 — Build, verify, commit, push
- `npm run build` passes
- Open browser, click widget, ask a product question — response streams correctly
- Click "Talk to a human" — enquiry form opens with pre-filled message
- Check PostHog for `chat_opened` event
- `git push origin main`

---

## 14. Verification Checklist

1. Widget button visible bottom-right on homepage, product pages, and category pages
2. Click opens panel; second click or X closes it
3. Product page greeting shows product name correctly
4. Typing a question and pressing Enter streams a response
5. Response is accurate for a product spec question (e.g. "What's the TARE on the Advent 2300?")
6. "Talk to a human" opens `/inquiry-form/` with message pre-filled
7. After 30 messages, send input is disabled and assistant explains why
8. Widget does NOT cause layout shift or slow page load (Lighthouse still ≥ 95)
9. PostHog shows `chat_opened` event after accepting cookies and opening widget
10. Mobile (< 768px): panel opens full-screen, close button works
11. Keyboard: Tab to button, Enter opens, Escape closes
12. `npm run build` passes with no TypeScript errors

---

## 15. Launch Checklist Gate

This feature completes the Phase A launch checklist once:
- [ ] Chatbot functional on public site
- [ ] Chatbot hands off to enquiry form correctly
- [ ] Daily budget cap respected (Anthropic account limit set)
- [ ] PostHog chatbot events flowing
