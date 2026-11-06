---
tags: [verifier]
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

Postmortem action items time. Here's the summary from the incident doc:

INC-2291 (SEV2). We rolled out the v2 device fetcher to all regions at once on Monday 14:00 UTC. v2 fetches device details one request per device instead of the v1 batch endpoint (100 devices per call). Tests all passed — unit tests mock the vendor client and only check the returned devices. In us-east traffic to the vendor went up ~40%, which was fine, but ap-southeast has a handful of very large accounts and vendor traffic there went up ~200%. We hit the vendor's rate limit, syncs started failing with 429s and evidence went stale. Our "sync failure rate > 20% for 30 min" monitor fired at 20:10 UTC, about 6 hours after rollout. Mitigated by rolling back to v1 in ap-southeast; fix was to keep using the batch endpoint in v2.

What verifiers should we add so this doesn't happen again? Write up the proposal.
