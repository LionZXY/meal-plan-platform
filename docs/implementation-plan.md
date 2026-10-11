# Meal plan platform implementation plan

**Goal:** Reusable, data-driven viewing for Nikita and Nastya, covered by tests and published automatically through GitHub Pages.
**Spec:** [design.md](design.md)
**Stack:** Browser ES modules, JSON, Node.js 24+, node:test, jsdom, GitHub Actions.

## Constraints and review focus

- Preserve existing portions, computed nutrition, instructions and illustrations in Nikita's migrated plan.
- Publish only sanitized platform/content files; test menus are fixtures, not real menus for Nastya.
- Resolve all paths relative to catalog/plan resources, including GitHub project subpaths.
- Test London midnight and DST, unknown persisted profiles, unavailable storage, failed loading, and stale asynchronous responses.
- Reject broken data before publication, and render arbitrary data as text.

## Tasks

- [ ] 1. Write fixtures for both people and tests for nutrition, date selection, catalog/plan validation and resource resolution. Run RED; implement `src/model.js`; run GREEN.
- [ ] 2. Migrate current public content into `content/catalog.json` and `content/plans/nikita-2026-10-10/`. Write migration verification and content validator. Require all meal totals and quantities to match the legacy data; verify all local images exist.
- [ ] 3. Write DOM integration tests for booting on today's date, switching/restoring profiles, icon disclosure, data-only menu changes, load failure/retry and request races. Run RED; implement `src/render.js`, `src/app.js` and `public/index.html`; run GREEN. Preserve existing visual styles and test in the real browser.
- [ ] 4. Implement build and preview scripts, data authoring documentation and `.agents/skills/add-meal-plan/SKILL.md`. Add a sample plan, JSON schemas and validate the skill. Add CI checks and official GitHub Pages deployment workflow; verify the packaged project subpath and exclusion of tests/source/private files from `dist/`.
- [ ] 5. Run the full suite and build. Conduct an independent review of the whole change, address significant findings with regression tests. Publish the existing Site and an explicitly sanitized GitHub repository, enable Pages and verify the successful Actions deployment.

## Completion evidence

Record final tests, content validation, browser checks and deployment URLs in README/turn output. Any remaining external permission failure must be reported separately from completed local implementation.
