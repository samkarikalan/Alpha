# SCS V965-R1 — repaired frontend

This package contains the complete available frontend, including Badminton,
Pickleball, Scoreboard, Tournaments, and tournament-wide Assign matches.

## Upload to a new GitHub repository

1. Extract this ZIP.
2. Upload its contents to the repository root. `index.html`, `sw.js`, and the
   four app folders must sit directly at the root, rather than inside another folder.
3. Preserve the directory structure and upload all files together.

## Deploy for testing

Recommended: connect the GitHub repository to Cloudflare Pages (or another static
host that gives the site its own root domain).

- Framework: None / static HTML.
- Build command: none required.
- Publish/build output: repository root (`.`).
- Use HTTPS.

Open these paths after deployment:

- `/` — app chooser
- `/badminton/`
- `/pickleball/`
- `/scoreboard/`
- `/tournaments/`

The app uses root-relative URLs, including `/sw.js`. If using GitHub Pages, use
an account-root site (`USERNAME.github.io` repository) or a custom domain.
A project subpath such as `USERNAME.github.io/REPOSITORY/` requires further URL
changes and is not supported by this package as-is.

## Existing backend

The frontend currently connects to:
`https://scs-app.karikalan-indo.workers.dev`

No Worker upload or SQL migration is required for this frontend repair, assuming
the existing V962-compatible Worker and court-pool database setup remain deployed.
A new repository/site still shares the existing backend and saved data. Use a test
account and test club to exercise editing, assignments, and scoring.

For first testing, use email/password login. Google/LINE sign-in depends on the
existing Worker's OAuth return-domain configuration and may return to the current
production domain. Separate OAuth staging configuration is outside this package.

Worker source, SQL files, and private deployment configuration are intentionally
outside this public frontend repository.

## What was fixed

A delayed court-allocation response from a closed event could change the next
event's court numbers and cause its save to fail. The repair discards responses
from detached/replaced event controllers, preserves event context during async
operations, and reveals reused Group workspaces.

`supabase.js` and `scs-api.js` are unchanged from the supplied working backup.
Validation covered delayed T1/T2 switching, individual event saves, server-only
reopening, adding events, common assignment, and scoreboard saving, using isolated
fixtures. Your new hosted deployment still needs its own test.

## Editing the shared HTML shell

Edit the root `index.html`, then run `python3 build-sport-entries.py` and commit the
regenerated app entry pages/manifests with the other changes.
