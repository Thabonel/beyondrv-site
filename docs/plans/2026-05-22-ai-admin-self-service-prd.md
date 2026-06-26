# PRD: Beyond RV AI Admin Self-Service

Date: 2026-05-22
Owner: Beyond RV
Status: Draft for implementation planning

## Executive summary

Beyond RV wants the site owner to manage product changes and chatbot business knowledge through the protected admin area using ChatGPT. The current code already supports a protected admin chat that can read repository files, propose file changes, run a safety judge, queue pending changes, and deploy approved changes through GitHub/Netlify. It is suitable for controlled edits to existing text and product data, but it is not yet a full product-management CMS. The official model now needs to cover the shop, campers, caravans, and expedition inventory with the same pricing, discount, availability, and lead-time vocabulary.

This PRD splits the work into three phases:

1. Phase 1: Safe assisted editing for existing content, chatbot knowledge, and owner instructions.
2. Phase 2: Guided product creation and structured admin workflows.
3. Phase 3: Full media management, visual preview, and higher-confidence publishing controls.

## Goals

- Let the owner update product prices, compare-at prices, discount labels, availability, lead times, container timing, status, featured flags, and general website copy from the admin page.
- Let the owner add business knowledge that improves the public chatbot's answers.
- Reduce developer involvement for routine content changes.
- Keep changes reviewable before deployment.
- Prevent accidental deletion, broken product data, unsupported statuses, secret exposure, and unsafe AI changes.

## Non-goals

- Replacing GitHub/Netlify as the deployment system in Phase 1.
- Letting AI publish without owner review.
- Building a full image DAM in Phase 1.
- Allowing public users to train the chatbot.
- Storing private customer data in chatbot knowledge.

## Current state

The site is an Astro static site deployed through Netlify. Product data lives in markdown files under `src/content/products`. The public chatbot uses OpenAI and receives a generated product catalogue from `netlify/functions/product-catalogue.json`.

The admin page currently has:

- Password-protected access through Netlify edge/function checks.
- An admin chat powered by OpenAI.
- GitHub file-reading tools.
- A proposed-change workflow.
- A safety judge that can allow, block, revise, or escalate changes.
- A pending changes panel.
- A deploy action that writes approved pending changes back to GitHub.

Current limitations:

- The admin page needs owner-facing help and task instructions.
- There is no dedicated business-knowledge file for the chatbot.
- Product creation is possible only if the AI follows the markdown pattern correctly.
- Full image upload, image ordering, and hero-image selection are not solved.
- There is no visual preview of a queued change before deployment.

## Users

- Site owner/admin: makes stock, product, wording, and chatbot knowledge updates.
- Developer/operator: handles higher-risk site structure, media, integration, and recovery tasks.
- Website customer: uses the public site and chatbot.

## Phase 1: Safe Assisted Editing

### Objective

Make the current AI admin useful and understandable for routine owner-led changes while keeping deployment controlled.

### Scope

- Add a Help button to the admin page.
- Add clear owner instructions for common tasks covering product price, compare-at price, discount copy, availability and ETA wording, product copy/specs, sold/removal, basic product entry, chatbot knowledge, pending changes, and deploy.
- Add an admin section for chatbot business knowledge.
- Store chatbot knowledge in a dedicated editable markdown file.
- Feed chatbot knowledge into the public chatbot prompt.
- Update the admin AI prompt so it understands product markdown location, chatbot knowledge file location, supported product status values, shared pricing and availability fields, current image-upload limitation, and sold product handling.

### Functional requirements

- The admin page must show a Help button that opens a readable instruction panel.
- The Help panel must explain the admin workflow without requiring technical knowledge.
- The admin page must include a chatbot knowledge textarea.
- Submitting chatbot knowledge must queue a file change instead of publishing directly.
- The public chatbot must receive the approved business knowledge after deployment.
- The admin AI must read existing files before proposing changes.
- The owner must be able to remove pending changes before deployment.
- Deploy must remain an explicit action.

### Acceptance criteria

- Owner can open admin help and follow steps to complete common tasks.
- Owner can add a business note and see it appear as a pending change.
- After deploy, the public chatbot can use the new business knowledge.
- Product catalogue generation still works.
- Site build passes.

### Risks

- AI may still produce incorrect markdown if asked for complex product creation.
- Image-related tasks can be described but not completed end-to-end.
- The owner may paste private information into chatbot knowledge unless warned clearly.

## Phase 2: Guided Product Management

### Objective

Move from freeform AI instructions to structured workflows for common product and site tasks.

### Scope

- Product manager screen inside admin.
- Product list with current title, price, compare-at price, sale label, category, availability, lead-time text, hero image, and featured state.
- Guided forms for add product, edit product, remove product, reorder gallery, change hero image, and update related products.
- AI-assisted copy rewriting from form fields.
- Field-level validation before queuing changes.
- Preview of generated markdown before deploy.
- Safer redirect creation when deleting product pages.

### Functional requirements

- Owner can create a product without knowing markdown syntax.
- Required fields must be validated before a product can be queued.
- Product slugs must be generated consistently and checked for duplicates.
- Product availability must be limited to the supported public values from the shared inventory model.
- Discount and ETA fields must be validated before they are queued.
- Related product links must reference existing products.
- Delete/sold workflows must create or confirm redirects.
- AI copy generation must be optional and reviewable.

### Acceptance criteria

- A non-technical owner can add a complete product using a form.
- A non-technical owner can update price, discount, availability, and lead-time fields without knowing the markdown schema.
- Invalid product data is blocked before it reaches GitHub.
- Existing product pages continue to build after edits.
- Redirects prevent deleted product URLs from becoming dead links.

### Risks

- Product schema drift could break builds if validation is incomplete.
- More admin UI increases maintenance surface.
- Preview accuracy depends on matching the live Astro build output.

## Phase 3: Media Management and Publishing Confidence

### Objective

Support complete product publishing, including image upload, image ordering, hero selection, previews, and safer live deployment.

### Scope

- Image upload from admin.
- Image storage strategy: GitHub repository assets, Cloudinary, or Netlify Blobs / S3-compatible storage.
- Automatic image resizing and optimization.
- Drag-and-drop gallery ordering.
- Hero-image selection.
- Alt text generation and editing.
- Visual preview builds before publishing.
- Rollback controls.
- Change history visible to owner.
- Optional owner approval flow for high-risk changes.

### Functional requirements

- Owner can upload product images from the browser.
- Owner can choose the hero image intentionally.
- Owner can reorder gallery photos visually.
- Images must be optimized for web delivery.
- The system must prevent missing image paths in product markdown.
- Owner can preview product page before publishing.
- Owner can rollback a recent deployment or ask a developer to restore a known commit.

### Acceptance criteria

- A full product with images can be added without developer involvement.
- Hero images and gallery order match the owner-selected order.
- Uploaded images render correctly on desktop and mobile.
- Failed image upload or failed deploy does not corrupt product content.

### Risks

- Repository-based image uploads can bloat Git history.
- Third-party media storage adds cost and credentials management.
- Preview builds add complexity and may need Netlify API integration.

## Recommended implementation path

Start with Phase 1 immediately because it improves the existing admin with low risk. Phase 2 should follow once the owner has used the admin for real changes and the most common workflows are clear. Phase 3 should be planned after choosing the media storage strategy, because image management is the largest missing piece for true self-service product publishing.

## Success metrics

- Owner can make routine text and price updates without developer help.
- Owner can add chatbot knowledge without developer help.
- Fewer emergency developer edits are needed for sold stock and small content changes.
- No failed Netlify builds from owner-driven Phase 1 changes.
- Product pages remain accurate against the live business inventory.
