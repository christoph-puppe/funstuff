---
name: "cp-coding-core"
description: "Christoph's stack-agnostic coding rules. Load for ANY coding task in any language: writing, fixing, reviewing or refactoring code, scripts, CLIs, pipelines, browser tools, and anything that calls an LLM. Covers working discipline (assumptions, simplicity, surgical edits, verified goals), error handling at boundaries with surfaced reasons, deterministic-first design with the LLM only on the residual, the Maker-Checker pattern, model-call rules (parallel pool, caching, batch tier with 300 s fallback, retry cap 5), idempotent work and resumable long runs (checkpoints, intermediates kept on failure), verification after every edit, logging, build versions, and README/code agreement. Use it even when the request is only 'fix this', 'add a field', 'review this repo' or 'build me a tool'. Load it together with the stack skill (cp-coding-python-gemini for Python/GCP, one-page-app-gemini for single-file HTML tools): the stack skill adds stack detail, this one sets the principles."
---

# CP Coding Core

The rules that hold for every piece of code Christoph asks for, whatever the language. Stack skills (`cp-coding-python-gemini`, `one-page-app-gemini`) add concrete code and stack detail on top. They fill in what these rules leave open; where one contradicts a rule here, the core wins. Follow this unless Christoph redirects. A redirect means drop the old path at once.

**Proportion:** these rules bias toward care over speed. A three-line fix needs judgment, not a plan and a test suite.

## Working with Christoph

- Terse, high-trust delegation ("apply", "go on", "weiter"): hold context and act. Don't re-confirm each step.
- Recommend, don't enumerate: give the pick and a one-line why.
- A correction ("no, wrong approach") is a hard redirect. Abandon the path; don't defend sunk work.
- He reviews adversarially: threat model, least privilege, provenance. Look for the gap he would find before he does.
- Answer in the language he writes in: German for quick operational asks, English for spec-shaped ones.
- When the problem sits in the environment or the org, say so and stop instead of thrashing.

## Discipline

1. **Think before coding.** Read the existing code and context first. State assumptions explicitly. If the request has more than one reading, present them with your pick; don't choose silently. If something is unclear, stop, name it and ask. If a simpler approach exists, say so and push back. This governs what to build: once the path is agreed, act on it without re-confirming each step.
2. **Simplicity first.** Minimum code that solves the problem. Before writing new code, look for what already does the job, in this order: the codebase, the standard library, the platform, the installed dependencies. A new dependency needs a reason that a few lines of code can't meet. No speculative features, no abstraction for single-use code, no unrequested configurability, no resilience machinery (circuit breakers, plugin systems, DI containers) nobody asked for. Idempotency and checkpoints are asked for, permanently: see *Idempotent work, resumable runs*.
3. **Surgical changes.** Touch only what the task requires and match the existing style. Mention unrelated dead code; don't delete it. Remove only the orphans your change created. Every changed line traces to the request, which also rules out features carried over from other projects or earlier chats.
4. **Goal-driven execution.** Turn the task into a check that can fail ("fix the bug" → reproduce it in a test → make it pass). A bug report names a symptom: before editing, look at every caller of the function and fix the cause where they all pass through, not only on the path the report names. Multi-step work gets a short plan with one verify per step.

## Errors: handle at the boundary, surface the reason

Rule 2 forbids error handling for impossible scenarios. This section says where handling is required. The line between the two: **boundaries get handling, pure logic does not.**

- Boundaries are file and network I/O, subprocesses, external APIs, parsing input you didn't produce, and each item of a batch or render loop. Inside pure logic, let a bug raise with its traceback. A defensive `except` there hides it.
- Every broad catch logs or surfaces. A deliberate best-effort swallow (cleanup) carries a comment saying so.
- Two audiences, two outputs. The full traceback goes to the log. The user gets one line with action, code/status and the upstream message (`upload failed (403 PERMISSION_DENIED): …`). "Something went wrong" throws away the one fact the operator needs.
- Isolate per item: one bad record becomes an error entry and the run continues. Results have three states (ok, error, pending) and the renderer handles all three. Report the failure count at the end.
- Retry transient failures only (429, 5xx, timeouts, dropped connections), with exponential backoff and a cap; for model calls the cap is 5 retries. Permanent errors (400/401/403/404, validation) raise at once; retrying them burns quota and buries the cause.
- Auth and validation fail closed.

## Idempotent work, resumable runs

A run that dies at item 4,800 of 5,000 should cost the missing 200, not a second 5,000. Two properties deliver that: every unit of work is safe to run twice, and finished work is on disk before the next unit starts. Keep both in their simplest form: plain files in a run directory. No queue, no database, no workflow engine.

**Proportion:** idempotency applies to everything with a side effect. Checkpointing applies when a restart from zero would hurt: paid API calls, rate limits, or more than a few minutes of runtime. A ten-second script only has to be safe to rerun.

- **Safe to repeat.** A second run with the same input ends in the same state as the first: no duplicate records, no double-posted message, no second resource. Upsert by key instead of appending, create only if absent, write to deterministic paths, and pass an idempotency key (or check before create) on external calls that mutate.
- **Stable keys.** Identify each unit of work by a hash over its input and everything that shapes the output (prompt version, model, schema version, parameters), never by list position. A changed input or prompt then yields a new key, so a stale result is never reused and no invalidation logic is needed.
- **Persist per unit, at once.** A result is written when it completes, not at the end of the run: one file per item, or one JSONL line flushed per item. Store the raw model response before parsing it, so a parser bug costs a re-parse and not a second paid call.
- **Atomic writes.** Write to a temp file in the same directory, then rename. A crash leaves the old file or the new one, never half of one. A JSONL reader drops a truncated last line and redoes that item.
- **One run directory.** All intermediates live under one visible, git-ignored path in the project (`.work/<run-id>/`), with the run-id derived from the job and its input, not from the clock, so the same command finds its directory again. It holds a manifest (input hash, parameters, build version, start time), per-item results, per-stage outputs and the log. Not the OS temp directory, which a reboot empties and nobody finds. Log the path at start and repeat it in the failure message.
- **Resume is the default.** Starting the same command again continues the run: `ok` items are skipped, `error` and `pending` are redone. Log the split (`resume: 4,800 ok, 37 error, 163 pending`). Starting over is the explicit choice (`--fresh`), never the accident.
- **Stages read from disk.** Each stage of a pipeline persists its output and the next stage loads it from there. A crash in stage 3 keeps stages 1 and 2, and any stage can be rerun alone. For Maker-Checker this is the immutability rule again: Maker output on disk, verdict beside it.
- **Intermediates outlive the failure.** No cleanup on error or in a `finally`. Deletion is an explicit command, run after the final output is verified. The run directory is as sensitive as the input, and no key or token goes into the manifest.
- **No filesystem?** In a browser tool the checkpoint is the exported run JSON plus a resume input; `one-page-app-gemini` has the pattern.
- **Prove it.** Two checks that can fail: kill the run halfway and restart it (no `ok` item is processed again, the final output equals that of an uninterrupted run), and run it once more after success (zero work done, identical output).

**Your own work follows the same rule.** In a long session (many files generated, a migration, a batch through tools), write each finished piece to disk as it is done instead of holding it in context, and keep a short progress note (done, next, open) in the working directory so a fresh session can continue where the dead one stopped. Scripts and setup steps you run are written check-then-act, so running them again is harmless.

## Deterministic first, LLM on the residual

The model is the slowest, most expensive and least reproducible part of any program. Decompose the task before writing a prompt.

**Litmus test per sub-step:** could a unit test state one exact expected output? Yes → code. No → candidate for the model, after all deterministic pre-work is done.

- Always code: parsing structured formats, regex extraction of well-formed identifiers, joins and lookups against a known catalog, dedup/sort/group/count, all arithmetic and statistics, format conversion, schema and reference validation, IDs, timestamps, hashes, templating from structured fields.
- Model-worthy: semantic classification with no computable rule, understanding free text, anything that needs outside knowledge.
- Pipeline shape: deterministic pre-processing → model on the residual → deterministic validation and assembly.
- Resolve before dispatch: an item a rule or lookup can answer never reaches the model. Log the split (`142 resolved deterministically, 38 sent to model`). In compliance work, computed is a stronger evidence class than generated.
- A zero-LLM result is a valid result. If nothing needs judgment, ship no key field, no model picker and no prompt, and say so.
- Use structured output with a strict schema and validate it in code on return. IDs the model returns are checked against the IDs that were sent; the model never mints them.
- One source of truth for the contract. Enum values and field names live in the schema; the prompt is generated from it or tested against it. A prompt that names a value the schema rejects makes the model substitute silently, and everything downstream is corrupted.
- Prompts are named artefacts in one place (files or constants), visible and editable, not strings assembled at the call site.

## Model calls: parallel, cache, batch, retry cap

Every model call goes through one client function. Concurrency, retry cap, caching, batch handling and call logging live there, so a rule for "all AI calls" holds by construction and not by discipline at each call site.

- **Never pay twice for the same answer.** The response cache is the run directory: an item whose key already has an `ok` result is not sent. Identical items inside one run share a key and cost one call.
- **Cache the shared prefix** when many calls repeat the same large block (system instruction, catalog, corpus) and the provider offers context caching. Stable content first, the varying item last, the cache keyed by content hash. Skip it for a handful of calls or a prefix below the provider's minimum size, and log cached versus fresh input tokens so the saving shows.
- **Parallel by default.** Calls that don't depend on each other's output run concurrently through a bounded worker pool; sequential needs a reason, such as a call that consumes the previous answer. The standard-call rerun after a batch deadline is parallel too. Each result is written under its key as it completes and the final output is assembled in input order, so completion order never shows in the result. Per-item files need no lock; a shared JSONL gets a single writer. One failed call leaves the others running. Persistent 429s mean the pool is too large: lower the concurrency, don't raise the retries.
- **Batch when nobody is waiting.** Bulk offline work (pipelines, nightly jobs, re-scoring a corpus) goes to the provider's batch tier where one exists, since it costs about half. Interactive tools and anything a person watches use standard calls.
- **A batch gets 300 seconds**, measured from submission. When the deadline passes, cancel the job, keep every result it already delivered, and run the remaining items again as standard calls. Cancel, don't abandon: an abandoned job can finish later and be billed anyway. Log it (`batch deadline 300 s: 120 delivered, 80 rerun as standard calls`). A batch result that still arrives afterwards meets an existing key and changes nothing.
- **At most 5 retries per call**, the first attempt not counted. The budget covers every reason to ask again for the same item: transient errors, timeouts, and output that fails schema validation. After the fifth, the item becomes an `error` entry with the last reason and the run moves on; the next resume picks it up. A stack skill may default lower, never higher.
- Concurrency, retry cap (5) and batch deadline (300 s) are settings in the config table with these defaults, not literals at the call site.

## Maker-Checker

Use it when someone will act on model output: audits, compliance artefacts, architecture reviews, generated plans. Build it as a switchable stage. It doubles cost, so the default depends on the stakes.

- Deterministic checks come first: schema validation and reference resolution in code. The Checker gets only what code cannot judge.
- Two prompts, two schemas, two runners. The Checker has its own persona and success criteria and receives the original input plus the Maker's complete output. Re-asking the Maker "are you sure?" is not a check.
- The Checker checks and never repairs. Maker output is immutable; the verdict is stored beside it. A Checker that rewrites erases the audit trail.
- Verdicts are graded and include `uncertain`. A forced yes/no makes the Checker claim knowledge it lacks.
- If a failed check triggers a Maker retry, cap the loop at two rounds, then flag the item for a human. Output that fails the check is marked or dropped, never passed on as good.
- Know the limit and document it: Maker and Checker read the same prepared input, so the pair catches model errors, not pipeline errors. A bad join or a truncated list fools both. Input preparation therefore needs its own deterministic tests.
- The same pattern applies to the code itself: before a PR, a full review (performance, security, stale code) in a fresh session or sub-agent finds more than the session that wrote the code. Offer it to Christoph; don't launch it unasked.

## Verify, don't assume

- After every edit, run the cheapest check that can fail: syntax check, linter, the affected tests (`node --check`, `ruff check`, `pytest -k …`). Text-replacement edits drop braces and declarations more often than they appear to.
- Two strikes: when the second fix for the same symptom fails, stop patching. Remove what the attempts added, return to the smallest native form of the library's API, and read its docs or source for the installed version.
- Library and API knowledge from memory is a hypothesis. Check the installed version's signature; probe the live endpoint.
- Report plainly: what ran, what passed, what failed, what was not verified, and what was deliberately left out.

## Observability and versions

- Log every meaningful event with numbers: input parsed (counts), resume split (ok/error/pending), deterministic/model split, each external call with size and duration, retries, failures, final totals. Logs go to stderr or a console panel; machine output stays clean on stdout.
- One log-level switch for the whole program instead of hand-instrumented call sites.
- Every artefact carries a build version the user can see (`--version`, `/version`, UI footer). Bump it with every change handed over, so a bug report names the build.

## Docs and code agree

- The README describes what the code does today. A change ships with its doc update in the same commit.
- Before handover, check README claims against the code: features, config names, defaults, storage locations, model names. Drift here is a recurring review finding.
- Every setting appears in one config table and in the example config. Secrets come from the environment or are typed in for the session. They never sit in code, the repo, exported files or browser storage (`localStorage`, `sessionStorage`, IndexedDB); a browser tool holds its key in memory and asks again after a reload.

## Before handing over

- [ ] Every changed line traces to the request; no orphaned imports or variables
- [ ] Syntax check, linter and affected tests ran; result reported, failures included
- [ ] No broad catch that swallows; user-facing errors carry the reason
- [ ] A second run does no work twice and duplicates no side effect
- [ ] Long runs: killed halfway and restarted, the run resumes from its run directory; intermediates are still there after a failure
- [ ] Nothing computable is asked of a model; the deterministic/model split is logged
- [ ] Prompt and schema agree on enum values and field names
- [ ] Model calls go through one client: independent calls run in parallel, at most 5 retries, batch falls back to standard calls after 300 s, a repeated prefix is cached
- [ ] Maker output is never overwritten by the Checker; `uncertain` is a possible verdict
- [ ] Build version bumped and visible
- [ ] README and config table match the code
- [ ] No secret in code, repo, exported files or browser storage
