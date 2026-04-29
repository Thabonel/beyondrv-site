# ByondRV AI Admin — Design Document

**Date:** 2026-04-29
**Status:** Approved — build begins immediately
**Phase:** A (pre-launch, same branch as site)

---

## Overview

A chat-based admin panel at `/admin` where the owner types plain-English instructions to update any content on the site. Changes are queued as pending and committed in one batch when the owner clicks Deploy.

No auth for now (added before launch). No staging branch (direct to main).

---

## User Flow

1. Owner opens `/admin`
2. Types instructions: "Drop the Sunpatch price to $74k", "Mark the 3.5m cabover as sold", etc.
3. Claude reads relevant files, shows what will change, adds each to a **Pending Changes** list
4. Owner reviews the pending list, removes anything unwanted
5. Owner clicks **Deploy Changes**
6. All changes committed to `main` in one batch → Netlify rebuilds → live in ~30s

---

## UI Layout

Two-column layout:

- **Left — Chat:** Streaming conversation with Claude. File/image upload via drag-and-drop or file picker in input bar.
- **Right — Pending Changes:** Live list of queued changes, each removable. Deploy button (disabled when empty). Shows "✓ Live in ~30s" after successful deploy.

Built as a single Astro page with a React island for interactive state. Dark theme matching the site.

---

## Architecture

### Pages & Components

```
src/pages/admin.astro              ← shell page, loads island
src/components/AdminPanel.tsx      ← React island: chat + pending panel
```

### Netlify Functions

```
netlify/functions/admin-chat.ts    ← Claude conversation handler
netlify/functions/admin-deploy.ts  ← GitHub batch commit handler
```

### `/api/admin-chat`

- Receives: conversation history, new message, optional base64 image
- System prompt: site structure map, product slugs, file path conventions
- Claude tools:
  - `read_file(path)` — fetch file content from GitHub API
  - `list_files(dir)` — list files in a repo directory
  - `propose_change(path, content, description)` — queue a change (never commits)
  - `remove_change(path)` — dequeue a change
- Streams Claude response back to UI
- Returns new pending changes as structured JSON alongside text

### `/api/admin-deploy`

- Receives: array of `{ path, content }` objects
- For each file: fetches current SHA from GitHub API, commits updated content
- All commits under one message: `"AI admin update — <timestamp>"`
- Returns per-file success/error

---

## Environment Variables (Netlify dashboard)

```
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=ghp_...          # Personal Access Token, repo write scope
GITHUB_REPO=Thabonel/beyondrv-site
GITHUB_BRANCH=main
```

---

## Supported Operations (Phase A)

- Edit any text, headline, description, or feature list on any page
- Update product prices
- Toggle stock status (in-stock / sold / on-order / coming-soon)
- Toggle on-sale flag
- Upload and replace product images
- Update meta titles and descriptions
- Add/remove FAQ entries

---

## Claude System Prompt (summary)

- Site is Astro + Netlify, content lives in `src/content/products/*.md` (frontmatter + markdown body)
- Pages live in `src/pages/**/*.astro`
- Images live in `public/images/products/<slug>/`
- Never fabricate content — ask if unclear
- Always confirm what will change before proposing it
- Use `propose_change` to queue, never commit directly

---

## File Structure Reference

```
src/content/products/        ← product markdown files (price, status, specs)
src/pages/                   ← Astro page files
public/images/products/      ← product images
public/images/site/          ← site-wide images (logo, hero)
src/styles/global.css        ← global styles
```
