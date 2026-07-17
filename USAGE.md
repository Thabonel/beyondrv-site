# Branch Workflow

Use this repo with two long-lived branches:

- `main` is production only and auto-publishes the live site.
- `staging` is the review branch for checking changes before they reach `main`.

Simple workflow:

1. Make changes on a short-lived feature branch from `staging`.
2. Merge the feature branch into `staging`.
3. Open a pull request from `staging` to `main`.
4. Review the Netlify Deploy Preview for that PR.
5. Merge to `main` only after the preview looks right.

Recovery workflow:

1. If production breaks, revert the bad commit on `main`.
2. Merge or cherry-pick the same fix into `staging` so the branches stay aligned.

Rules:

- Do not push directly to `main` for routine work.
- Keep `staging` as the preview and recovery branch.
- Keep `main` as the only production branch.
