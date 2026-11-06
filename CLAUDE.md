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

## Todo list

`evebash_todo.txt` at the repo root lists new features and improvements we plan to build.

- Read it at the start of any task and say if the work touches one of its todos.
- Add new todos with the file's "Next todo number" (then increase it; pull staging first). Numbers are never reused.
- When starting on a todo, set Status to "In progress" and its Owner. When it ships, set Status to "Done" with "Done in: <commit> (date)", and add a device test in `test_yourself.txt` if it needs one.
- Bugs go in `evebash_issue.txt`, device checks in `test_yourself.txt`, new features here.

## Jira board

The files above are the main record. Jira (https://evebash.atlassian.net, project EB) mirrors the active issues and todos as a progress board. Device tests are in Jira only while they are FAIL, RETEST or BLOCKED (Task titled "Test #N: ...", labels `device-test`, platform and `fail`/`retest`/`blocked`; RETEST sits in Testing); when a test passes, move its ticket to Done. TODO and PASS tests stay in the file only.

- Every change to an issue or todo in the files also updates its Jira ticket in the same task, through the Atlassian connector (cloud id 3b189820-ae10-4501-9301-3fa7b15ef284). If the connector isn't signed in, say so and carry on with the files.
- Find a ticket by its file number: issues are titled "Issue #N: ...", todos "Todo #N: ...". Search `project = EB AND summary ~ "\"Issue N\""` (or `"\"Todo N\""`).
- New issue: a Task with labels `bug` and its platform (`app`, `website`, `both`, `backend-only`, `analytics-dashboard`). New todo: a Story with labels `todo`, its platform and phase (`phase-1`, `phase-2`, `phase-tbd`). Priority: Critical = Highest, the rest the same. Description: the entry's fields and text.
- Board columns: To Do, In Progress, Testing, Done. Status: In progress = In Progress (transition 2), or Testing (transition 31) once the fix is in and it only waits on a device check, a switch or a build; Open, Idea, Agreed = To Do; Blocked = To Do with label `blocked` and Flagged set; Fixed, Done, Dropped = Done (transition 41; add label `dropped` for Dropped).
- Tickets created through the connector land in the Backlog, not on the board. Tell the user to move them (Backlog > select > Move work item > Board), or do it in the browser if signed in.
- Owner goes in the description and as a label (`owner-sarthak`, `owner-shwetank`). A new Update or Note in an entry goes on the ticket as a comment.
- Never edit the files from Jira. If a ticket and its entry disagree, the file wins: tell the user.

## Code reuse

Search before you write. Duplicated helpers drift apart and cause web/app mismatches.

- Before adding a helper, hook, component or type, search for an existing one: `src/lib` (website), `apps/mobile/lib` (app), `apps/backend/src` (backend), `shared/` (used by both website and app), `modal_engine/` (Python).
- Use libraries already in the relevant `package.json` (or `modal_engine` requirements) before writing your own (dates, retries, validation, parsing). Ask before adding a new dependency.
- Don't copy a function to a second place. If the website and the app need the same plain logic (no React Native or Next.js imports), move it to `shared/` and import it from both.
- When you find a duplicate while working nearby, say so. Merge it only if it is in the files you are already changing; otherwise add it as an issue in `evebash_issue.txt`.
- One-off diagnostic scripts go in `scripts/` (reuse or extend an existing one), not the repo root, and get deleted when done.
