# Match lifecycle contract

This contract applies to Group, Team and Knockout tournament matches, whether scoring runs inside Tournament or in Scoreboard, on the same device or another device.

1. **Save locally first, then write to the server.** Commit each assignment/score/result/approval intent to the durable account-and-club-scoped outbox before sending it. Keep unsent work through refresh, connection loss and retries. A local receipt is never a server receipt.
2. **Scoreboard loads tournament matches from the server.** Every entry path resolves the exact event/match and players against the scoped match API. An unsynced local assignment cannot start scoring. The active score can be recorded locally while offline; the final result is durably saved and submitted again on Finish/Save & Close. Ordinary standalone friendly scoring remains local and has no tournament approval step.
3. **Approval requires a server-confirmed finished result.** The authoritative status sequence is `assigned → playing → submitted → approved`. `submitted` requires a finished score and winner confirmed by the server. The app records the returned revision/status/winner receipt before calling the result sent. Tournament reads this shared match status instead of treating a stale session snapshot or local score as approval-ready. Approval is its own durable match action, scoped to one fixture; unrelated setup/court saves must not block it. Only the organizer can approve.
4. **Approved results are immutable to scoring devices.** The UI excludes approved matches from scoring lists and locks an active scoring view when it learns of approval. The server rejects score writes after approval, including stale tabs, offline replays and retries from another device. Failed local attempts are retained for review and never silently replace an approved result.

## Required implementation boundaries

- One identity: server match UUID plus tournament UUID and fixture key. Verify exact player pairs. Display match numbering may differ from the fixture key; never use display labels to locate a score.
- One shared transport: `SCSLiveMatches` resolves server matches and normalizes statuses for every scoring entry path. The Worker and database enforce authorization, assignment, revision checks, result validation and the immutable approval boundary.
- One durable journal: `SCSTournamentLocal` persists writes before transfer and confirms a specific record independently of unrelated queued work. Private device history remains on that device.
- Setup/roster/draw/court settings may still use snapshots, but they cannot determine or overwrite a normalized match's submitted/approved state.
- Changed-match polling is allowed. It must coalesce concurrent reads and never replace a newer cached revision with an older response.
- Do not fix missing approvals by guessing a winner, editing production result rows directly, clearing app data, dropping pending jobs, or bypassing passwords/organizer checks.

## Required regression coverage

Before releasing changes to this flow, verify the cases in `match-sync/tests`:

- Local save and Save & Close complete while the server is stalled; History remains pending.
- A server receipt confirms the final score/winner before History says sent.
- Same-device Group/Team/Knockout entry ignores stale local score data and resolves a server assignment.
- A second scoring device sees server assignment/submission; an offline local-only fixture cannot start.
- A stale pending setup snapshot cannot hide a submitted result or block a match-only approval; pending setup remains intact.
- Approval releases the court, removes the match from scoring lists, and rejects later score writes with valid credentials.
- Court collisions, incorrect players, stale revisions, protected passwords and conflicting finished results are rejected.
- Existing approved results remain unchanged. Tests use isolated fixtures, not live tournament mutations.

Deployment requirements are recorded with each update. This file is a source contract, not a claim that prepared Worker/app files were deployed automatically.

## Independent tournament match publication (supersedes snapshot prerequisites)

Tournament may keep setup locally or sync it separately. Assigned matches are durably queued and published directly to `tournament_live_matches`; no server tournament/session record is required. Publication, password setup, scores and approvals use an independent match queue. A stalled snapshot queue cannot block that queue. Local event courts and cached court sessions are sufficient to create assignments; server match writes enforce occupied courts. Credentials remain private and do not require a tournament record.

Scoreboard tournament discovery, history approval checks and submission use match records only. Its background club download must not fetch tournament snapshots. Ordinary rounds continue to read/write their existing session/round records and are not converted to match-only records.

Required release tests: independent-publication.cjs, native-publication.cjs and rounds-unchanged.cjs, plus schema/Worker security tests. The independent tests must start with ZERO server tournament/session records and a deliberately stalled snapshot upload.
