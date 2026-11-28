# Match changes

For tournament match, scoring, approval, sync or outbox changes, read MATCH-LIFECYCLE.md first and preserve its four rules across Group, Team, Knockout, embedded scoring and the standalone Scoreboard app. Keep all entry paths on the shared match transport and durable journal. Run the applicable lifecycle regression tests before packaging an update. Do not report a locally saved result as sent without a server receipt, and never bypass the server's approved-result lock.
