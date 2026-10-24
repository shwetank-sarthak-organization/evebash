# EveBash

## Issue list

`evebash_issue.txt` at the repo root is the list of active issues.

- Read it at the start of any task and say if the work touches one of its issues.
- When starting on an issue, set its Status to "In progress" and its Owner.
- When a fix lands, move the entry to RECENTLY FIXED with "Fixed in: <commit> (date)" in the same change; delete RECENTLY FIXED entries older than 7 days.
- Add newly found issues with the file's "Next issue number", then increase that number. Numbers are never reused.

## Device test list

`test_yourself.txt` at the repo root lists what testers must check by hand on a real phone or browser.

- When a change needs a manual check on a device, add a test with the file's "Next test number" (then increase it; pull staging first) (Status TODO, Priority, Platform, how to test). Numbers are never reused.
- When fixing a FAIL, fill in its "Fix ref" and set Status to RETEST.
- Testers fill in Status, Done by, Device / browser, Build / version, Date tested, Account used, Screenshot and Feedback.
- `evebash_issue.txt` is for bugs; `test_yourself.txt` is for tests. A FAIL that needs real work also gets an issue in `evebash_issue.txt`.

## Code reuse

Search before you write. Duplicated helpers drift apart and cause web/app mismatches.

- Before adding a helper, hook, component or type, search for an existing one: `src/lib` (website), `apps/mobile/lib` (app), `apps/backend/src` (backend), `shared/` (used by both website and app), `modal_engine/` (Python).
- Use libraries already in the relevant `package.json` (or `modal_engine` requirements) before writing your own (dates, retries, validation, parsing). Ask before adding a new dependency.
- Don't copy a function to a second place. If the website and the app need the same plain logic (no React Native or Next.js imports), move it to `shared/` and import it from both.
- When you find a duplicate while working nearby, say so. Merge it only if it is in the files you are already changing; otherwise add it as an issue in `evebash_issue.txt`.
- One-off diagnostic scripts go in `scripts/` (reuse or extend an existing one), not the repo root, and get deleted when done.
