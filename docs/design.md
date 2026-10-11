# Meal plan platform

The existing viewer becomes a static application with independently editable JSON and image folders. It runs on both GitHub Pages project paths and the existing Sites URL. No account, server, or database is needed.

`content/catalog.json` defines the display locale, time zone and people. Each person has zero or more plan entries pointing to separate `plan.json` files. A plan contains its dates, products and nutrition per 100 units, meals and quantities, preparation instructions, storage notes, shopping groups and image paths relative to its own folder. Application files contain no person names, meal text, dates or nutrition values.

Initial production content: the complete existing 10–16 October plan for Nikita, with all 28 illustrations and the latest removal of olive oil. Nastya has an empty profile until real content is supplied. Tests use independent synthetic plans for both people.

The selected person is saved in localStorage. Invalid or unavailable storage must not prevent viewing. Initial day selection uses today's calendar date in the catalog's IANA time zone (Europe/London initially), including DST and midnight boundaries. If today is outside the available plan, choose the nearest available day and explain this. A second selector supports additional weeks; manual day selection remains available. A visible Today button returns to today's plan/day.

All nutrition is calculated from the same quantities displayed in the ingredient rows. Original English product names remain available through the info icons. Data validation rejects duplicate dates/IDs, unknown product references, invalid numbers/dates, and unsafe paths/URLs. Data load failures, missing plans and rapid switching between profiles have explicit states. Text from content is rendered as text, not executable markup.

The build validates content and copies it without modifying it, alongside versioned app files, into `dist/`. Unit tests exercise date and nutrition logic. DOM integration tests exercise the actual controller/rendering and localStorage, with fetch supplying the two synthetic plans. CI runs all tests and content validation before deploying `dist/` through official GitHub Pages actions on pushes to main; pull requests run checks only.

A repository-local Codex skill documents the content contract, adding a person/week, verification and publication. A discoverable local copy points to the same project. GitHub receives only the sanitized platform source and content, not raw Waitrose/Bitwarden records or the unrelated working directory.
