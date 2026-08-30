# Build the vehicle catalogue in CI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Netlify build regenerate `src/data/vehicle-selector/catalogue.json`, so committing a review decision actually changes what customers see.

**Architecture:** Add `SCRIPTS/build-vehicle-catalogue.mjs` to the Netlify build command, ahead of the product catalogue build and the Astro build. The script already exists and runs locally. The only open question is whether its one external dependency, the `sqlite3` CLI, exists in Netlify's build image.

**Tech Stack:** Netlify build image, Node 22 with `--experimental-strip-types`, the `sqlite3` command line tool.

**Spec:** `docs/superpowers/specs/2026-08-30-vehicle-review-screen-design.md`, section 6

## Why this exists

The vehicle review screen commits `data/vehicle-selector/reviews.json` and relies on the
next build turning that into a published catalogue. It does not today.

`netlify.toml` runs:

```
node SCRIPTS/build-product-catalogue.mjs && npm run build
```

That is the **product** catalogue. `SCRIPTS/build-vehicle-catalogue.mjs` is only
wired to `npm run catalogue:build`, which nothing in CI calls, and
`src/data/vehicle-selector/catalogue.json` is committed to the repo.

Without this change the GM would press Publish, see it succeed, and the picker
would stay hidden, because the committed catalogue never changes.

## The risk, stated plainly

`SCRIPTS/build-vehicle-catalogue.mjs` reads the database by shelling out:

```js
execFileSync('sqlite3', ['-json', dbPath, QUERY.trim()], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
```

There is no SQLite library in `package.json` — no `better-sqlite3`, nothing. If
the `sqlite3` binary is absent from Netlify's build image, **every deploy fails**,
not just this feature. That is a larger blast radius than the feature warrants,
which is why this is verified on a deploy preview before it reaches `main`.

## Global Constraints

- `NODE_VERSION` is 22, set in `netlify.toml`. `--experimental-strip-types` requires it.
- The build command runs from the repository root.
- Do not merge to `main` until a deploy preview has built green.
- If `sqlite3` is missing, do not attempt to install it in the build image. Fall back to Task 3.

---

### Task 1: Add the script to the build command

**Files:**
- Modify: `netlify.toml`

- [ ] **Step 1: Confirm the script runs clean locally**

Run: `npm run catalogue:build`
Expected: exits 0, and `src/data/vehicle-selector/catalogue.json` is unchanged in `git status` because the inputs have not changed.

- [ ] **Step 2: Change the build command**

In `netlify.toml`, replace the `[build]` command:

```toml
[build]
  command   = "npm run catalogue:build && node SCRIPTS/build-product-catalogue.mjs && npm run build"
  publish   = "dist"
```

The vehicle catalogue runs first, so a failure there stops the build before
anything expensive happens.

- [ ] **Step 3: Commit**

```bash
git add netlify.toml
git commit -m "build: generate the vehicle catalogue during the Netlify build"
```

---

### Task 2: Prove it on a deploy preview

**Files:** none

- [ ] **Step 1: Push the branch and open a pull request**

```bash
git push -u origin feat/vehicle-review-screen
gh pr create --title "Vehicle review: build the catalogue in CI" --body "Verifying the sqlite3 CLI exists in the Netlify build image."
```

- [ ] **Step 2: Watch the deploy preview build**

```bash
gh pr checks --watch
```

Expected: the Netlify deploy preview reaches `ready`.

- [ ] **Step 3: Read the build log for the catalogue step**

Confirm the log shows the vehicle catalogue script running, and confirm it did
not fall over on a missing binary. The failure signature to look for:

```
Error: spawnSync sqlite3 ENOENT
```

- [ ] **Step 4: Confirm the built catalogue is still empty**

`reviews.json` holds no entries yet, so the deploy preview must show the picker
still hidden and the notice still visible. A picker appearing here would mean
something is promoting variants that nobody reviewed.

Visit `<deploy-preview-url>/slide-on-camper-weight-calculator/` and confirm the
notice is present.

- [ ] **Step 5: Record the outcome**

If green, this plan is done and the review screen work can continue.
If `sqlite3` is missing, stop and go to Task 3.

---

### Task 3: Fallback, only if `sqlite3` is missing from the build image

Do not start this task unless Task 2 step 3 found `ENOENT`.

**Files:**
- Modify: `package.json`
- Modify: `SCRIPTS/build-vehicle-catalogue.mjs`
- Modify: `netlify.toml`

- [ ] **Step 1: Add a SQLite library**

```bash
npm install --save-dev node:sqlite-shim
```

Node 22 ships `node:sqlite` behind a flag; check `node -e "require('node:sqlite')"`
first, because if it is available the dependency is unnecessary and the script
can use the built-in instead.

- [ ] **Step 2: Replace the shell-out**

Replace the `execFileSync` call with the library equivalent, returning the same
array of row objects the rest of the script already expects. The query string
does not change.

- [ ] **Step 3: Verify the output is byte-identical**

```bash
git stash && npm run catalogue:build && cp src/data/vehicle-selector/catalogue.json /tmp/before.json
git stash pop && npm run catalogue:build
diff /tmp/before.json src/data/vehicle-selector/catalogue.json
```

Expected: no differences. A changed catalogue means the replacement is not
faithful, and the review work must not be built on it.

- [ ] **Step 4: Repeat Task 2**

## Out of scope

- Removing `catalogue.json` from version control. It stays committed so a
  failed build still serves the last known good catalogue.
- Migrating `build-product-catalogue.mjs`, which has no SQLite dependency.
