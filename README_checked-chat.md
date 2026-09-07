# checked-chat

A single-file browser chat whose memory lives in the browser, one signed entry per turn, and whose answers pass a second model family before the user sees them. It is the one-page-app cut of the "Checked Chat with Client-Held Memory" plan, version 0.2 (2026-09-07), with OpenRouter as the backend for maker, checker and compressor.

Version 0.1.2 · one `.html` file · no build step · OpenRouter only.

---

## What it does

Every send runs this loop in the browser:

1. **Assemble.** Verify the HMAC on every stored entry, drop and log failures, compute decay, apply the caps, build the memory block and the last raw turns.
2. **Maker.** The maker model answers with the memory block framed as data in its system prompt.
3. **Check** (checked mode only). A model from another vendor audits the answer for three things and nothing else: contradiction with a pinned or importance-5 claim, fabricated attribution, instruction steering from memory. On a finding the maker patches the flagged spans and the checker looks again, at most two rounds by default. A second failure ships the answer as `checked_failed` with the findings visible and the flagged spans highlighted.
4. **Compress.** The cheapest model distills the turn into claims, each tagged `user` or `assistant`, with a `hypothetical` flag, an importance from 1 to 5, and ops (`supersede` a claim id, `pin` an entry id, `pin_this_entry`).
5. **Summary check** (checked mode only). The checker verifies that every claim traces to the raw exchange and carries no instruction. One retry of the compressor; a second failure signs the entry as `summary_flagged` and keeps it out of context until the user accepts it.
6. **Sign.** The entry is signed with HMAC-SHA256 over every envelope field and stored. Ops are applied to entries whose ids were actually in the context.

Every structured call (checker, summary check, compressor) validates the shape of the reply. Gemini-family models behind OpenRouter sometimes spend the whole completion on the reasoning channel and return `{ }` under `response_format` (observed with gemini-3.8-flash: 242 of 247 completion tokens as reasoning). Such a reply is logged with its raw text and the reasoning-token count, retried once with the schema written into the prompt, and the app remembers per model that the schema goes into the prompt from then on. The rail shows which models are in that mode and has a reset button. A provider that rejects `response_format` outright gets the same treatment. A failure after the answer was produced keeps the answer on screen and shows the memory-step error in the turn's meta row.

Plain mode skips steps 3 and 5 and stores the entry as `unchecked`. With "strict memory" on, plain mode drops `assistant` claims before signing, the same rule that applies to every `checked_failed` answer: a failed answer may add what the user said, never what the model concluded.

### Deterministic parts

Everything that has an exact expected output runs in plain JavaScript and never touches a model: MAC signing and verification, the decay formula (`importance × 0.85^(current_turn − turn) ≥ 0.5`, pinned entries exempt), entry ordering and caps, the token budget, claim caps and truncation, span clamping, op validation against visible ids, the import rules, the stats. The rail has a **self-test** button that checks the decay lifetimes from the phase-1 test (an importance-3 entry is gone by turn 12, importance-5 by 15), the cap (500 synthetic entries, cap 100), MAC tamper detection for status, pin, claim text and cross-chat binding, and the claim caps. It logs 15 checks and needs no key.

### What the MAC means here

The plan puts the signing key on a server that keeps no other state. In a one-page app there is no server, so the browser plays that role: a WebCrypto HMAC key is generated once, stored in `localStorage`, and every entry is bound to user, chat, key id and status. That still catches an edited or planted entry in the local store, an export edited by hand, and entries carried from another chat; the self-test demonstrates each case. It does not protect against someone who has the browser profile, because that person also has the key. The plan's rotation procedure is implemented: **rotate key** keeps the previous key for a grace period, and **re-sign old** moves verifying entries to the current key.

### Import is a trust ceremony

Importing an export from another chat or browser lists the entries and waits for confirmation. On import, pins are stripped, `assistant` claims are dropped, the turn is set to the current turn so decay starts fresh, and every entry is re-signed with `status: imported` and `source: imported`. The receiving side never claims to have verified the origin.

---

## Quick start

1. Open `checked-chat.html` in a browser. It works from `file://` in Chrome and Firefox; if OpenRouter calls fail with a CORS error, run `python -m http.server` in the folder and open `http://localhost:8000/checked-chat.html`.
2. Paste an OpenRouter key (`sk-or-…`). It is stored in `localStorage` of that browser and sent only to `openrouter.ai`.
3. The model catalog loads from `GET /api/v1/models` without a key and is cached for a day. Dropdowns for checker and compressor list only models whose catalog entry supports `structured_outputs`; the text field beside each dropdown takes any slug. On first load the app picks defaults from the live catalog by pattern (a Gemini Flash as maker, a Claude model as checker, a Flash-Lite as compressor) and logs what it chose. Nothing is baked in, so check the console and change what you disagree with.
4. Pick **CHECKED** or **PLAIN**, write a message, send. The frames under the compose box show the loop; content arrives in one piece, as the plan's D1 requires for checked mode.

An amber chip appears when checker and maker share a vendor. The plan's D2 wants them apart: a checker from the maker's family shares its blind spots.

---

## Rail settings

| setting | default | meaning |
|---|---|---|
| live entries | 300 | cap on entries sent per turn, pinned first, then by score |
| claims / entry | 8 | compressor output is cut to this many |
| words / claim | 30 | claim text truncated at this many words |
| raw turns | 3 | last N verbatim exchanges sent alongside memory |
| checker rounds | 2 | check, patch, check; the last round decides the status |
| decay factor / live threshold | 0.85 / 0.5 | the decay formula |
| token budget | 30000 | estimated tokens of memory per send (chars ÷ 4) |
| retries | 2 | per call, exponential backoff, honours cancel |
| effort per role | off | sends `reasoning: { effort }`; a model that rejects it is retried without |

All values persist in the browser. The plan calls them starting values chosen without data; the phase-1 measurement is yours to run.

---

## Memory card

Each entry shows status, live state (`live`, `decayed`, `over cap`, `flagged`, `mac failed`), turn, importance, current score, turns left before decay, source, key id, and its claims with source tag, hypothetical marker and claim id. Per entry: pin, unpin, accept (for `summary_flagged`), delete. Per claim: supersede and restore. Supersession is a local overlay outside the MAC, as the plan's data model says; pin, unpin and accept change signed fields and re-sign the entry. Deleting is a local action; the client owns the store.

Filters: LIVE shows what the next send will contain, ALL shows everything, FLAGGED shows summary-flagged and MAC-failed entries.

Export writes the chat (turns, entries, key id) as JSON. That file is also the save file.

---

## Prompts

Five prompts, all editable in the Prompts card, persisted per browser, each with a reset button and a placeholder check: maker system prompt (`{memory}`), checker (`{prompt}`, `{memory}`, `{answer}`), patch (`{issues}`), compressor (`{prompt}`, `{answer}`, `{memory}`), summary check (`{prompt}`, `{answer}`, `{claims}`). A removed placeholder is appended at runtime so a prompt never silently loses its data.

The checker returns codes, character offsets and a reason through a strict JSON schema. The patch prompt hands the maker the codes, offsets and the flagged text of its own answer, never the text of a memory entry, which keeps to the plan's rule that the maker sees no quoted untrusted input in the patch step.

---

## Status vocabulary

`unchecked`, `checked_passed`, `checked_failed`, `summary_flagged`, `user_accepted`, `imported`. The scope statement sits next to the compose box: the check tests contradiction with memory, fabricated attribution and instruction steering, and establishes neither truth nor completeness. "Verified" does not appear.

---

## Not in this cut

- **Tools and MCP (phase 3).** A browser page has no MCP transport, so tool loops, observations, continuation tokens and the side-effect protocol are absent. The `observations` field exists in the envelope and is always empty.
- **Streaming.** Plain mode returns the answer in one piece too. The frames show progress; content does not stream.
- **Retrieval (phase 4).** Every live entry is sent in full, exactly as the plan wants until a measurement proves otherwise.
- **IAP, server-side keys, audit log, EU-residency posture.** No server. The console is the audit line: request id, turn, status, applied ops, dropped entries.
- **Local encryption of the store.** Deferred in the plan; deferred here. Anyone with the browser profile can read the memory and the key.

---

## Privacy statement

Persistent memory is stored in this browser's `localStorage`. The selected memory is transmitted to OpenRouter and from there to the maker's, checker's and compressor's providers on every send. The page keeps no server-side profile, because it has no server. Provider retention and training settings are OpenRouter's and the providers', not this page's.

---

## Files

- `checked-chat.html` – the app
- `README_checked-chat.md` – this file
