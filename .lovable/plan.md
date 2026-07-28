## Why "Analyse & propose fields" fails

It is not your credit balance — the workspace has 164.80 credits remaining. A workspace **AI Gateway spend limit is set to 4.00 credits per month with the "block usage" action**, and this project's monthly AI Gateway usage has already passed it. Every model call is therefore rejected before it reaches the model: gateway log `019fa955-3dfc-782f-86b2-d58b72ab4aa0` (2026-07-28T15:26:03Z) returned HTTP 403 `credit_hard_block_workspace` after 52 ms.

## Plan

1. Raise the workspace AI Gateway credit limit from 4.00 to **50.00 credits per month**, keeping the alert and block behaviour in place as a safety ceiling.
2. Re-run "Analyse & propose fields" against a sample document and confirm the gateway returns a successful call (checked against the AI Gateway request log, not just the UI).
3. If the request now succeeds but is slow — an earlier successful analysis took 98 seconds — report that back so we can decide whether to trim the prompt or lower reasoning cost in a follow-up.

## Technical notes

- The error surfacing added to `src/lib/template-infer.functions.ts` stays; it correctly maps 402/403/credit errors to a readable message and will remain useful if the cap is hit again.
- No schema, route, or UI changes are needed — the extraction path itself is intact and was working earlier today (log `019fa83d-df77-78df-8ab1-93c46430b5cb`, 200 OK, 13,359 in / 12,176 out tokens, 1.73 credits).
- The same block also affects the document extraction flow on the upload page, so raising the cap unblocks both.
