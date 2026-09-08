# checked-chat

A single-file browser chat whose memory lives in the browser, one signed entry per turn, and whose answers pass a second model family before the user sees them. It is the one-page-app cut of the "Checked Chat with Client-Held Memory" plan, version 0.2 (2026-09-07), with OpenRouter as the backend for maker, checker and compressor.

Version 0.3.0 · one `.html` file · no build step · OpenRouter only.

---

## What it does

Every send runs this loop in the browser:

1. **Assemble.** Verify the HMAC on every stored entry, drop and log failures, compute decay, apply the caps, build the memory block and the last raw turns.
2. **Maker.** The maker model answers with the memory block framed as data in its system prompt.
3. **Check** (checked mode only). A model from another vendor receives the same inputs the maker had (prompt, the recent raw turns, memory, web sources) and audits the answer for three things and nothing else: contradiction with a pinned or importance-5 claim, fabricated attribution, instruction steering from memory. On a finding the maker patches the flagged spans and the checker looks again, at most two rounds by default. A second failure ships the answer as `checked_failed` with the findings visible and the flagged spans highlighted.
4. **Compress.** The cheapest model distills the turn into claims, each tagged `user` or `assistant`, with a `hypothetical` flag, an importance from 1 to 5, and ops (`supersede` a claim id, `pin` an entry id, `pin_this_entry`).
5. **Summary check** (checked mode only). The checker verifies that every claim traces to the raw exchange and carries no instruction. One retry of the compressor; a second failure signs the entry as `summary_flagged` and keeps it out of context until the user accepts it.
6. **Sign.** The entry is signed with HMAC-SHA256 over every envelope field and stored. Ops are applied to entries whose ids were actually in the context.

Every structured call (checker, summary check, compressor) validates the shape of the reply. Gemini-family models behind OpenRouter sometimes spend the whole completion on the reasoning channel and return `{ }` under `response_format` (observed with gemini-3.8-flash: 242 of 247 completion tokens as reasoning). Such a reply is logged with its raw text and the reasoning-token count, retried once with the schema written into the prompt, and the app remembers per model that the schema goes into the prompt from then on. The rail shows which models are in that mode and has a reset button. A provider that rejects `response_format` outright gets the same treatment. A failure after the answer was produced keeps the answer on screen and shows the memory-step error in the turn's meta row.

Plain mode skips steps 3 and 5 and stores the entry as `unchecked`. With "strict memory" on, plain mode drops `assistant` claims before signing, the same rule that applies to every `checked_failed` answer: a failed answer may add what the user said, never what the model concluded.

### Web search

The rail has a **web search** toggle for the maker. It adds OpenRouter's web plugin (`plugins: [{ id: "web", engine: "exa", max_results: N }]`) to the maker call; OpenRouter runs the search, feeds the results to the model and returns the sources as `url_citation` annotations. The engine defaults to Exa because Exa returns a text snippet per source. The vendor's native grounding (Google, OpenAI), selectable in the rail, returns redirect URLs and titles without text: cheaper, but the checker then cannot confirm any figure taken from those pages and no observation can be validated. The checker treats a figure attributed to a listed source without text as unverifiable, not fabricated; a finding needs a source absent from the inputs or a source text that says something else. OpenRouter bills per result, a few cents per call at the default of five. The checker never searches: its job is to compare the answer with the inputs, and a searching checker would start grading truth, which the plan rules out.

The app reads the annotations and passes them on as a WEB-DATA block to the checker, the compressor and the summary check, so a figure or URL that comes from a returned source is a supported attribution, not a fabricated one, and an instruction hidden in a web page is caught by check (c). The compressor may return observations, each pointing at a source number with text copied verbatim; the app keeps an observation only if the text is an exact span of that source's snippet or title, otherwise it is dropped and logged. Kept observations land in the entry as `{obs_id, text, tool: "web", call_id, args_hash, url, observed_at, fresh_until}`, inside the MAC, and appear in the memory block with their date. `fresh_until` stays null, because the plugin carries no freshness annotation.

One limit: the results reach the maker inside OpenRouter's own prompt, not inside the app's data-block framing. Injected instructions in a page are therefore caught at the checker, not at the maker; in plain mode nothing catches them.

### Deterministic parts

Everything that has an exact expected output runs in plain JavaScript and never touches a model: MAC signing and verification, the decay formula (`importance × 0.85^(current_turn − turn) ≥ 0.5`, pinned entries exempt), entry ordering and caps, the token budget, claim caps and truncation, span clamping, op validation against visible ids, the import rules, the stats. The rail has a **self-test** button that checks the decay lifetimes from the phase-1 test (an importance-3 entry is gone by turn 12, importance-5 by 15), the cap (500 synthetic entries, cap 100), MAC tamper detection for status, pin, claim text and cross-chat binding, and the claim caps. It logs 16 checks and needs no key.

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

## Config card and rail

The rail holds what changes per send: the chat list, the PLAIN/CHECKED switch, the web-search toggle and strict memory. Everything else sits in the **Config** card in the main area, reachable from the navigation: OpenRouter key and catalog, the three model pickers with reasoning effort, web-search engine and result count, the caps below, MAC keys, the structured-output modes and the self-test.

## Settings

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

## Chats and storage

Chats live in IndexedDB (database `checkedchat`, store `chats`, one record per chat with its transcript and signed entries). Settings, prompts, the schema modes and the MAC key stay in `localStorage`. The rail lists every chat with its turn and entry counts and last activity, newest first; click to switch, `+ new chat` in the rail or in the Chat card header, rename and delete for the active chat. Chats from 0.1 and 0.2 that sit under the old `localStorage` key are not loaded; the console names the key so you can delete it.

Two export paths with different purposes:

- **backup all** (rail) writes every chat as one JSON file. It asks whether to include the MAC keys. **restore** reads such a file, adds the chats whose id is not present, and, if the file carries a different key, offers to install it as the current key with the present key kept as previous. Without the keys, restored entries from another browser do not verify and are dropped from context; that is the intended failure. A single-chat export from the Memory card restores the same way.
- **import entries** (Memory card) is the trust ceremony from the plan: entries from anywhere, pins stripped, assistant claims dropped, re-signed as `imported`.

## Token stats

Every call reports OpenRouter's usage (`usage: { include: true }` is set on each request): prompt tokens, completion tokens, reasoning tokens where the provider separates them, cost in USD, and wall time. The app sums them per role (maker including patch rounds, checker including the summary check, compressor including retries) and stores the result on the turn. Three places show them: a line under each answer (`maker 323→922 · 9.7s`, and so on, plus the turn's cost), a pill in the top bar with the chat's totals, and a "tokens by role" chart at the top of the Stats card with calls, seconds per turn and cost per role. Cost is what OpenRouter reports per call; the web plugin's per-result fee is included in the maker's cost.

## Memory card

Each entry shows status, live state (`live`, `decayed`, `over cap`, `flagged`, `mac failed`), turn, importance, current score, turns left before decay, source, key id, and its claims with source tag, hypothetical marker and claim id. Per entry: pin, unpin, accept (for `summary_flagged`), delete. Per claim: supersede and restore. Supersession is a local overlay outside the MAC, as the plan's data model says; pin, unpin and accept change signed fields and re-sign the entry. Deleting is a local action; the client owns the store.

Filters: LIVE shows what the next send will contain, ALL shows everything, FLAGGED shows summary-flagged and MAC-failed entries.

Export writes the current chat (turns, entries, key id) as JSON.

---

## Prompts

Five prompts, all editable in the Prompts card, persisted per browser, each with a reset button and a placeholder check: maker system prompt (`{memory}`), checker (`{prompt}`, `{recent}`, `{memory}`, `{answer}`, `{web}`), patch (`{issues}`), compressor (`{prompt}`, `{answer}`, `{memory}`, `{web}`), summary check (`{prompt}`, `{answer}`, `{claims}`, `{web}`). When a release changes a default prompt, an unedited stored copy is replaced silently and the console says so; an edited copy is kept, with a console warning that the default moved, and the reset button takes the new one. A removed placeholder is appended at runtime so a prompt never silently loses its data.

The checker returns codes, character offsets and a reason through a strict JSON schema. The patch prompt hands the maker the codes, offsets and the flagged text of its own answer, never the text of a memory entry, which keeps to the plan's rule that the maker sees no quoted untrusted input in the patch step.

---

## Status vocabulary

`unchecked`, `checked_passed`, `checked_failed`, `summary_flagged`, `user_accepted`, `imported`. The scope statement sits next to the compose box: the check tests contradiction with memory, fabricated attribution and instruction steering, and establishes neither truth nor completeness. "Verified" does not appear.

---

## Not in this cut

- **Tools and MCP (phase 3).** A browser page has no MCP transport, so tool loops, continuation tokens and the side-effect protocol are absent. The one tool that exists is OpenRouter's web search for the maker, with its results validated into observations as described above.
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
