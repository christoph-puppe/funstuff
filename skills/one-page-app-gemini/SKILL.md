---
name: "one-page-app-gemini"
description: "Build a single self-contained HTML file that calls the Gemini API or OpenRouter directly from the browser. Use this skill whenever the user wants a \"one page app\", standalone .html tool, or browser-only utility that talks to Gemini or OpenRouter — typically to transform, classify, or extract structured data from user input. Always load together with cp-coding-core, which holds the principles (deterministic-first, Maker-Checker, model-call rules); this skill adds the browser stack. Covers current Gemini 3.x model ids, no-sampling-params API rules, structured outputs via responseJsonSchema, OpenRouter as multi-vendor backend, chunked parallel requests with worker pool, progress bars, log console, transient-only retries, cancellation, in-memory API keys, file:// CORS pitfalls, the dark editorial design system, editable prompts as a hard rule, SVG-only stats, and optional Maker-Checker validation for audit/compliance work. Every file needs a build version."
---

# One-page Gemini app

A minimal pattern for shipping a functional browser tool in **one `.html` file**: no build step, no framework, vanilla JS, Gemini (or any OpenRouter-served model) as the reasoning engine — but only where reasoning is actually needed (see "Deterministic first" below; a fully deterministic zero-LLM tool is a valid outcome). The user opens the file, pastes a key, pastes input, gets structured output back — with live progress, editable prompts, a console log, and aggregate stats.

Load it together with `cp-coding-core`. The core holds the principles (deterministic-first, Maker-Checker, model-call rules, error handling, logging, build versions); this skill is the browser implementation, and where the two disagree the core wins.

## When to use

- User asks for a "one page app", "single HTML file", or "standalone tool"
- The task is: take user input → ask an LLM to produce structured JSON → render/download it
- The dataset is large enough that one LLM call would be slow, expensive, or exceed the output window — chunking + parallelism wins
- The user wants to run it locally without a dev server (though see CORS note)

## Deterministic first — the prime directive

The rule itself is in `cp-coding-core`: the litmus test, what is always code, what is model-worthy, the pipeline shape, resolve-before-dispatch. It outranks every other pattern in this skill. What it means in a one-page tool:

- Everything computable is plain JS: parsers instead of "extract" prompts, `Map.get` joins against the catalog, `crypto.randomUUID()` for IDs, `validatePlanReferences()`-style checks, and every number on the stats card. The chunking section's "flatten in JS first" and the multi-stage rule "pre-grouping into stage-buckets happens in JS BEFORE any LLM dispatch" are instances of this directive, not separate ideas.
- Items a rule or lookup can answer are resolved in JS and never enqueued to the pool. The log console shows the split: `142 resolved deterministically, 38 sent to model`.
- **Zero-LLM tools are valid output of this skill.** If decomposition leaves no residual, build the tool with **no API key field, no model selector, no prompts card, no backend switch** — just the design system, input handling, deterministic engine, results, stats, and export. Tell the user explicitly: "no AI needed for this — the tool is fully deterministic, runs offline, and produces identical output every run." Do not add a token LLM step to justify the skill.
- **Determinism knobs stay honest:** since sampling params are gone (see API rules below), the only real determinism on the LLM side is a tight prompt + schema. Everything the user needs to be *bit-identical* between runs must therefore live on the JS side.

## Gemini 3.x — current model ids (verified 27 August 2026)

**Shut down — do not use:** `gemini-3-pro-preview` (March 9, 2026), `gemini-3.1-flash-lite-preview`, `gemini-2.0-flash`, `gemini-2.0-flash-lite`. All 404 now. The live text-model family:

| model id | status | thinking levels (default) | notes |
|---|---|---|---|
| `gemini-3.7-flash` | stable | `low`/`medium`/`high` (`medium`) — **no `minimal`** | **Default choice.** GA 13 Aug 2026. Best coding, agentic and multi-step execution in the Flash line. Intro price $0.75/$3.75 per 1M in/out through 31 Dec 2026, then $1.50/$7.50. Free tier. |
| `gemini-3.6-flash` | stable | `minimal`…`high` (`medium`) | Previous generation, still fine and identically priced ($0.75/$3.75 intro, $1.50/$7.50 from 2027). Pick it over 3.7 only if you specifically want `thinking_level: minimal`. |
| `gemini-3.5-flash` | stable | `minimal`…`high` (`medium`) | Older frontier-reasoning Flash, now the *expensive* one ($1.50/$9.00 per 1M). 3.7 Flash beats it on coding and agentic work for half the price — no reason to default here anymore. |
| `gemini-3.5-flash-lite` | stable | `minimal`…`high` (`minimal`) | Fastest, cheapest with schema support ($0.30/$2.50 per 1M). The bulk workhorse for this skill: high-volume extraction, classification, structured JSON parsing. Raise thinking to `medium`/`high` for multi-step reasoning. |
| `gemini-3.1-flash-lite` | stable | (dynamic) | Cheapest of all ($0.25/$1.50 per 1M; $0.50 audio in). Previous Flash-Lite generation, still live — use when cost dominates and the task is trivially mechanical. |
| `gemini-3.1-pro-preview` | preview | `high` | Deep-reasoning Pro tier. Paid only (no free tier), tighter rate limits, $2/$12 per 1M under 200k context and $4/$18 above it. |
| `gemini-3-flash-preview` | preview | | Older preview; prefer `gemini-3.7-flash`. |

Image models (stable): `gemini-3-pro-image` (Nano Banana Pro), `gemini-3.1-flash-image` (Nano Banana 2), `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite). Transcription (stable): `gemini-3.5-transcribe`, `gemini-3.5-transcribe-live`.

Context 1M in / 64k out across the 3.5/3.6/3.7 family. If the user says "Gemini 3 Pro" without a version, they mean `gemini-3.1-pro-preview`; "Gemini 3 Flash" without a version means `gemini-3.7-flash`.

**This table decays.** Google has shipped a new Flash generation roughly every quarter, and ids that 404 are the single most common way a generated tool dies on first run. Before you commit a model id into a build, fetch `https://ai.google.dev/gemini-api/docs/models` and check the id is still listed — it costs one call and saves the user a debugging session. If the live page shows a newer Flash than `gemini-3.7-flash`, prefer it, tell the user you did, and treat the table above as history.

### The `minimal` trap on 3.7 Flash

This skill's bulk-chunk pattern reaches for `thinkingLevel: "minimal"` by reflex, and on `gemini-3.7-flash` that is an invalid value. Two consequences worth wiring in:

- Never emit `minimal` for a 3.7-family model. Use `low` — it's the latency-optimised tier there and gets you most of the speed-up.
- If the tool has a thinking dropdown *and* a model dropdown, the two interact. Either disable/relabel the `minimal` option when a 3.7 model is selected, or clamp in the request builder (`level === "minimal" && /^gemini-3\.7/.test(model) ? "low" : level`). A silent clamp with a log line is friendlier than a 400 the user has to decode.

### API rule changes on Gemini 3.x

- **`temperature`, `top_p`, `top_k` are deprecated.** They are ignored on current models and will return HTTP 400 on future ones. **Never send sampling parameters at all** (this replaces the old "leave temperature at 1.0" rule). For determinism, tighten the prompt/system instruction instead.
- **`candidate_count` is unsupported** on Gemini 3.x.
- **Prefilled model turns return HTTP 400.** A request whose last non-empty turn has `role: "model"` is rejected. Use structured outputs or system instructions instead of prefill tricks.
- `thinking_budget` is gone; use the `thinking_level` string enum (`minimal`/`low`/`medium`/`high`).
- Google now recommends the new **Interactions API** (`/v1beta/interactions`) and labels `generateContent` legacy. For this skill's stateless one-shot browser calls, `generateContent` still works fine and stays the default — no server-side state needed. Switch only if a build actually needs server-side conversation state or managed agents.

## REST call shape

```js
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey,           // header, NOT ?key= in the URL
  },
  body: JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: SCHEMA,
      thinkingConfig: { thinkingLevel: "medium" },  // minimal | low | medium | high — 3.7 Flash starts at "low"
    },
  }),
});
const data = await res.json().catch(() => ({}));
if (!res.ok || data.error) throw apiError(res.status, data.error?.message || `HTTP ${res.status}`);
const text = (data.candidates?.[0]?.content?.parts || [])
  .map(p => p.text || "").join("\n");
```

### API keys — memory only

The key lives in the input field and one JS variable, nowhere else: no `localStorage`, no `sessionStorage`, no IndexedDB, not in the exported run JSON, not in a log line. A reload clears it and the user pastes it again. Give the field `type="password"` and `autocomplete="off"`. Prompts, the model choice, the cached model list and the rail width are not secrets and may persist.

### Structured outputs — use them

Never prompt-beg for JSON. Set `responseMimeType: "application/json"` and pass a `responseJsonSchema`. Gemini 3 will return valid JSON matching the schema — you only need `JSON.parse(text)`, no regex. Still defensively call a `stripFences()` helper in case the model wraps it anyway:

```js
const stripFences = s => s.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
```

Schema uses standard JSON Schema (`type`, `properties`, `required`, `items`). Keep required fields minimal — over-constraining hurts recall. For nested structured data that won't fit one schema cleanly (e.g. a full OSCAL component-definition), **don't** ask the model to produce the whole envelope. Have it produce only the innermost leaf objects with a tight schema, and assemble the wrapper locally in JS with `crypto.randomUUID()` for any UUID fields. This is faster, more reliable, and parallelisable.

### Grounding + structured outputs

`tools: [{ googleSearch: {} }]` (camelCase, current Gemini 3 form) can now be **officially combined** with `responseJsonSchema` on Gemini 3.x — Google documents structured outputs as compatible with Google Search grounding, URL context, and code execution. So the default path is: keep the schema on even when grounding is enabled.

However, empirical behaviour on earlier 3.x endpoints was flaky (free prose despite the schema), so keep the **tolerant extractor** as the parse path whenever grounding is on — belt and braces, costs nothing:

```js
function extractJson(text) {
  const trim = text.trim();
  try { return JSON.parse(trim); } catch {}
  const stripped = stripFences(trim);
  try { return JSON.parse(stripped); } catch {}
  const s = stripped.indexOf("{"), e = stripped.lastIndexOf("}");
  if (s >= 0 && e > s) {
    try { return JSON.parse(stripped.slice(s, e + 1)); } catch {}
  }
  throw new Error("could not extract JSON from response");
}
```

When grounding is off, `JSON.parse` after `stripFences` is enough. Same prompt either way; only the parse tolerance differs. If a grounded run still produces prose despite the schema, fall back to dropping `responseJsonSchema` and prompt-instructing JSON — the old workaround still works.

### Thinking level

`thinkingConfig.thinkingLevel` trades latency for reasoning depth: `minimal` / `low` / `medium` / `high` — but **`minimal` is not accepted by `gemini-3.7-flash`** (see "The `minimal` trap" above); its floor is `low`. Defaults: 3.1 Pro `high`, 3.7/3.6/3.5 Flash `medium`, 3.5 Flash-Lite `minimal`.

For bulk classification/matching jobs where you're sending many small chunks, the lowest level the model accepts is usually right — speed-up is dramatic (2–5×), quality cost is usually negligible. Raise to `medium`/`high` for multi-step reasoning or when Flash-Lite terminates tool use prematurely. Expose this as a user-facing setting so they can dial it during runs.

## OpenRouter as an alternative backend

Offer **OpenRouter** (`openrouter.ai`) as a second backend whenever the user wants model diversity: one key, one endpoint, models from OpenAI, Anthropic, Google, Meta, Mistral and others behind an OpenAI-compatible Chat Completions surface. This is the natural backend for cross-validation workflows — run the same batch through two vendors' models and compare — and for Maker-Checker with *different* vendors (e.g. Gemini as Maker, a Claude model via OpenRouter as Checker, which is a genuinely independent audit).

Works from the browser: CORS is permitted, the trust model is identical to the Gemini path (user pastes their own `sk-or-...` key, held in memory only, never hardcoded or stored).

### Request shape

```js
async function openrouterOnce(prompt) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${orKey}`,
      "HTTP-Referer": "https://localhost",   // optional attribution
      "X-Title": "my-one-page-tool",         // optional attribution
    },
    body: JSON.stringify({
      model: orModel,                        // vendor/slug, e.g. "anthropic/claude-…"
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "result", strict: true, schema: SCHEMA },
      },
      provider: { require_parameters: true }, // route only to providers that honour response_format
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw apiError(Number(data.error?.code) || res.status,
                   data.error?.message || JSON.stringify(data.error ?? `HTTP ${res.status}`));
  }
  return data.choices?.[0]?.message?.content ?? "";
}
```

Key differences from the Gemini path:

- **Auth is `Authorization: Bearer`**, not `x-goog-api-key`.
- **Structured outputs** use OpenAI's `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }` instead of `responseJsonSchema`. Support **varies per model and per provider** — always set `provider: { require_parameters: true }` so OpenRouter routes only to providers that actually honour the schema, and always parse through the tolerant `extractJson()` regardless: normalization across vendors is good but not perfect.
- **Response text** is `data.choices[0].message.content` — one flat string, no parts array.
- **Errors** arrive as `data.error` in a 200-or-4xx body; surface `error.message`. 429s get the same exponential-backoff retry as Gemini.
- **No `thinkingConfig`.** Reasoning control is per-vendor (`reasoning: { effort: "low" | "medium" | "high" }` where supported); hide or repurpose the thinking-level control when the OpenRouter backend is active.
- Keep the **no-sampling-params discipline** here too: don't send `temperature`/`top_p` by default — Gemini-3.x-routed models ignore or reject them, and defaults are sane everywhere else.

### Model picker — fetch, don't hardcode

OpenRouter's catalog changes weekly. **Never bake a static model list into the tool.** Populate the model `<select>` from the live catalog:

```js
const cat = await (await fetch("https://openrouter.ai/api/v1/models")).json();
// cat.data: [{ id: "vendor/slug", name, context_length, supported_parameters, pricing, … }]
const structured = cat.data.filter(m =>
  (m.supported_parameters || []).includes("structured_outputs"));
```

Filter to models whose `supported_parameters` include `structured_outputs` (or `response_format`) when the tool depends on schemas. Cache the list in `localStorage` with a timestamp, refresh after 24 h, and always keep a free-text model input beside the dropdown so the user can paste any slug. The `/models` call needs no auth — it can populate before a key is entered.

### Grounding analog

There is no `googleSearch` tool. The equivalent is the **web plugin**: `plugins: [{ id: "web" }]` in the request body, or the `:online` suffix on the model slug (`vendor/slug:online`). Wire the existing grounding toggle to this when the OpenRouter backend is active. The `response-healing` plugin (`{ id: "response-healing" }`) auto-repairs malformed JSON server-side — a useful companion to `extractJson()` for schema-shaky models.

### Backend abstraction

One switch at the bottom of the stack; everything above it stays backend-agnostic:

```js
async function llmOnce(prompt) {
  return state.backend === "openrouter" ? openrouterOnce(prompt) : geminiOnce(prompt);
}
```

`runPool`, the retry wrapper, prompts, schemas, progress, logging, stats — none of it changes. The rail gets a backend selector (`Gemini | OpenRouter`), and the config card swaps its fields accordingly (API key + model dropdown per backend; the model choice persists to `localStorage`, the key stays in memory). Log which backend + model served each call so mixed-backend Maker-Checker runs stay auditable.

## Editable prompts — hard rule

**Every prompt the tool sends to the model lives in a `<textarea>` in the UI, never in a string constant alone.** The constant exists only as the default seed and as the reset target. This applies to all prompts: a single-pass tool's one prompt, a Maker-Checker tool's two prompts, multi-stage pipelines' N prompts. All of them. Always.

Why this is non-negotiable:

- The user knows their domain better than the skill author. A security architect tuning the Maker prompt for CVE attribution will out-write any default in five minutes.
- Comparing prompt variants is the fastest way to improve output quality. If the user has to edit the file to compare, they won't.
- The user can audit what the model is actually being told — important for compliance work where the prompt is part of the evidence trail.
- When a default prompt regresses after a skill update, the user can revert to a known-good local edit.

### Mechanics

Each prompt:

1. **Lives in a `<textarea>`** with `resize: vertical`, glass styling, violet focus ring, monospace font (it's structured text, treat it as code).
2. **Has a `Reset` button** that restores the textarea from a `DEFAULT_*_PROMPT` JS constant.
3. **Persists to `localStorage`** on input, so reload preserves user edits.
4. **Validates its placeholder** (`{cve_id}`, `{pairs}`, `{items}`, etc.) on every input event — show an amber warning chip if the placeholder is missing.
5. **Defensively appends the placeholder at runtime** if the user removed it, so a missing placeholder never produces a useless prompt:

```js
function buildPrompt(item) {
  let tpl = $("maker-template").value;
  if (!tpl.trim()) tpl = DEFAULT_MAKER_PROMPT;
  if (!tpl.includes("{cve_id}")) tpl = tpl + "\n\nCVE: {cve_id}";
  return tpl.replace("{cve_id}", item.cve_id);
}
```

### Layout

A dedicated "Prompts" card holding all editable templates, stacked vertically. Each template gets:

- A label header (`MAKER PROMPT`, `CHECKER PROMPT`)
- The textarea (min-height 180–220px to show structure on first load)
- A right-aligned `Reset to default` button and (optionally) a "Saved" indicator
- The placeholder warning chip beneath, hidden until the placeholder is missing

Do not hide prompts behind a collapsible by default. The user explicitly chose to use a one-page tool because they want to see everything at once.

### Defaults still matter

The default prompts must be production-quality on their own — the user shouldn't NEED to edit them. The textarea is for cases where they want to tighten or experiment. Write defaults with the same care you'd write a hard-coded prompt: structured headers, clear classification rules, explicit anti-confusion sections, schema-aligned output spec.

## Chunking + parallelism — the core pattern

Big inputs (hundreds of items against a large catalog) should not be one call. Apply "Deterministic first" before chunking: filter, join, and resolve everything you can in JS so the pool only ever sees the residual that needs judgment. Then:

1. **Flatten** the nested input into a flat array of leaf records (keep only what the model needs: id, path, title).
2. **Chunk** the array into groups of N (default 15 — small enough that one chunk won't overflow output, big enough that per-call overhead amortises).
3. **Run a bounded pool** of parallel chunk calls (default 4 concurrent).
4. **Merge** results as they complete, tolerate individual chunk failures.

For the *generation* step (where output is a structured document assembled from many parts), the same pattern applies but the chunking key is different: **group by output identity, not input slice**. Example: when emitting OSCAL implemented-requirements, group matched recommendations by `control-id` and make one parallel call per group producing one implemented-requirement. Then assemble the final wrapper document locally.

Some tasks have a natural chunk size of **1** — research/grounding tasks where each item needs focused retrieval. CVE attribution research is one example: each CVE wants its own Google Search round, batching dilutes attribution quality. The pool still applies; just `tasks.length === items.length`.

### Worker pool in ~15 lines

```js
// runs `tasks` with at most `limit` in flight; each task is a () => Promise
// onProgress(done, total) fires after each resolution
async function runPool(tasks, limit, onProgress) {
  const results = new Array(tasks.length);
  let done = 0, next = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const i = next++;
      if (state.cancel) { results[i] = { cancelled: true }; done++; onProgress?.(done, tasks.length); continue; }
      try { results[i] = await tasks[i](); }
      catch (e) { results[i] = { error: e }; }
      done++;
      onProgress?.(done, tasks.length);
    }
  });
  await Promise.all(workers);
  return results;
}
```

### Live results, not deferred

Tasks should **mutate `state.results[idx]` directly** rather than returning data the caller post-processes. Then call `renderResults()` from `onProgress`. Cards fill in live as each chunk completes — this is the entire reason for using a pool over `Promise.all`. Deferred rendering (collect all, then render once) wastes the user's attention while a 20-CVE run grinds for 4 minutes.

```js
const tasks = items.map((item, idx) => async () => {
  try {
    const out = await llm(buildPrompt(item), `[${idx+1}/${items.length}] ${item.id}`);
    state.results[idx].analysis = extractJson(out.text);
  } catch (e) {
    state.results[idx].error = e.message;
  }
});
await runPool(tasks, concurrency, (d, t) => {
  showProgress("phase", d, t);
  renderResults();
});
// sweep any never-dispatched entries as cancelled
state.results.forEach(r => { if (!r.analysis && !r.error) r.error = "cancelled"; });
```

The renderer must handle three states per entry: `analysis` (completed), `error` (failed or cancelled), and neither (pending). A pending card with a "Pending" badge is correct UX — never let the renderer crash on null analysis.

### Retries with exponential backoff

The rule is in `cp-coding-core`: retry transient failures only, at most 5 times; permanent errors raise at once. Both call functions throw through `apiError()` so the wrapper can tell the two apart:

```js
const MAX_RETRIES = 5;   // ceiling from cp-coding-core; the UI setting can only go lower

function apiError(status, message) {
  const e = new Error(String(message).slice(0, 400));
  e.status = status;
  return e;
}

// Worth another attempt: rate limit, server error, network drop. Everything else raises at once.
function isTransient(e) {
  if (typeof e.status === "number") return e.status === 429 || e.status >= 500;
  return e instanceof TypeError;   // fetch() rejects with a TypeError when the network fails
}

async function llm(prompt, label = "call") {
  const retries = Math.min(MAX_RETRIES, Math.max(0, parseInt($("retries").value) || 0));
  let attempt = 0;
  while (true) {
    if (state.cancel) throw new Error("cancelled");
    try {
      const t0 = performance.now();
      const text = await llmOnce(prompt);
      l.debug(`${label} ← ${(text.length/1024).toFixed(1)}kb in ${Math.round(performance.now()-t0)}ms`);
      return text;
    } catch (e) {
      if (!isTransient(e)) throw e;   // 400/401/403/404: surface the reason, don't burn quota
      attempt++;
      if (attempt > retries) throw e;
      const wait = 500 * Math.pow(2, attempt - 1);  // 500, 1000, 2000…
      l.warn(`${label} failed (${e.message}) — retry ${attempt}/${retries} in ${wait}ms`);
      await sleep(wait);
    }
  }
}
```

Gemini and OpenRouter both return 429s when you push concurrency too high. With retries + backoff, a rate-limited chunk just waits and tries again instead of aborting the run. If the 429s persist, lower the concurrency instead of raising the retries.

## Progress bar

One thin track is enough for everything. Track phase name + done/total on the left, amber fill that snaps to green on completion:

```css
.progress-track { height: 1px; background: var(--border-1); overflow: hidden; }
.progress-fill { height: 100%; background: var(--accent); width: 0%; transition: width .2s ease; }
.progress-fill.done { background: var(--green); }
```

Hide with a ~800ms delay after completion so the user sees the "done" state flash green.

## Log console

A console-style card is the single most valuable debug/trust affordance you can add. Users watching parallel chunks finish out-of-order *feel* the concurrency working, and when something breaks they can see exactly which call failed.

Five levels, each with a distinct color: `info` (blue), `ok` (green), `warn` (amber), `err` (red), `debug` (dim). Timestamp with millisecond precision. Autoscroll toggle + clear button in the header. Line count in the header.

What to log is set by `cp-coding-core` (Observability): every meaningful event, with numbers. In this tool all of it lands in the console card, including the chunk split with its concurrency number and cancel requests.

## Cancellation

Hard cancellation mid-fetch is not worth the complexity. Soft cancel is: a `state.cancel` flag, checked (a) at the top of each pool worker loop iteration, and (b) inside the retry wrapper. In-flight calls complete, the pool stops dispatching, the user sees a "cancelled by user" error. Show a `■ cancel` button only while `state.running` is true.

```js
$("btn-cancel").addEventListener("click", () => {
  state.cancel = true;
  l.warn("cancel requested — finishing in-flight calls");
});
```

## CORS — the one thing that breaks

Opening the HTML via `file://` and calling `generativelanguage.googleapis.com` **works in Chrome** (Google's CORS headers are permissive) but some configurations block it. Always tell the user: *"If you see a CORS error, serve it with `python -m http.server` and visit `http://localhost:8000/...`."* Do not try to add CORS proxies or workarounds — just mention the fallback.

## Stats and visualizations

If the results have categorical structure (verdicts, severity levels, classification labels, tool names), add a stats card with charts. Stats earn their slot when the run is bulk — for a 3-item run a counts pill is enough; for a 50-item run, distribution patterns reveal calibration issues the user couldn't spot scanning cards.

### When to add stats

Add a stats card if **all** of these are true:

- Output has at least one enum field (verdict, classification, severity, category)
- Users will scan the results in aggregate ("how many came back as X")
- Patterns in the aggregate carry real signal — e.g. "90% inconclusive" tells you the prompt isn't pushing hard enough on search, "all high confidence" tells you the model is over-calibrated

If the output is essentially one free-text field per item, stats add visual noise without insight. Skip them.

### What to chart

- **Donut chart** for the primary categorical distribution (3–6 buckets, total in the center). One donut, never two side-by-side — donuts are heavy.
- **Horizontal bar chart** for frequency counts where bar height is the meaningful axis: tool names cited, error codes, validation verdicts. Sort descending. Cap at top 8 + "…and N more" if needed.
- **Small horizontal bars** for ordinal distributions: confidence levels (high/medium/low), severity (critical/high/medium/low).
- **Sparklines** for time-series within a single item (rare in this skill's scope).

3–4 charts is the ceiling. More than that turns the card into a dashboard and competes with the results for attention.

### No charting libraries

Pure SVG paths + CSS rects. The whole point of one-page-app-gemini is no dependencies. Chart.js's default palette also clashes hard with the violet aesthetic — you'd spend more time fighting its defaults than writing the SVG.

Donut chart in ~25 lines:

```js
function donutChart(slices, size = 160, innerRatio = 0.6) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) return `<svg width="${size}" height="${size}"></svg>`;
  const cx = size/2, cy = size/2, r = size/2 - 8, ri = r * innerRatio;
  let a = -Math.PI/2;
  const paths = slices.filter(s => s.value > 0).map(s => {
    const sweep = (s.value / total) * Math.PI * 2;
    const a1 = a, a2 = a + sweep; a = a2;
    const x1 = cx + r*Math.cos(a1), y1 = cy + r*Math.sin(a1);
    const x2 = cx + r*Math.cos(a2), y2 = cy + r*Math.sin(a2);
    const xi1 = cx + ri*Math.cos(a1), yi1 = cy + ri*Math.sin(a1);
    const xi2 = cx + ri*Math.cos(a2), yi2 = cy + ri*Math.sin(a2);
    const large = sweep > Math.PI ? 1 : 0;
    return `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${ri} ${ri} 0 ${large} 0 ${xi1} ${yi1} Z" fill="${s.color}" />`;
  }).join("");
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${paths}
    <text x="${cx}" y="${cy-2}" text-anchor="middle" dominant-baseline="central"
          fill="currentColor" font-family="JetBrains Mono" font-size="22" font-weight="600">${total}</text>
    <text x="${cx}" y="${cy+18}" text-anchor="middle" fill="currentColor" opacity="0.55"
          font-family="JetBrains Mono" font-size="9" letter-spacing="1.5">TOTAL</text></svg>`;
}
```

Horizontal bar in ~10 lines of HTML+CSS:

```js
function hBarRows(items) {
  const max = Math.max(1, ...items.map(i => i.value));
  return items.map(i => `
    <div class="hbar-row">
      <div class="hbar-label">${escapeHtml(i.label)}</div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${(i.value/max)*100}%; background:${i.color}"></div></div>
      <div class="hbar-value">${i.value}</div>
    </div>`).join("");
}
```

### Color mapping — reuse the result palette

Charts must use the same colors as the verdict pills they summarize. If `ai_discovered = "yes"` is violet in the result cards, it's violet in the donut. Mismatched palettes break the connection between "scan the chart" and "find the items".

Keep a single source of truth for verdict-to-color, ideally a JS map referenced by both renderers:

```js
const VERDICT_COLORS = {
  yes:          "oklch(0.7 0.18 300)",
  ai_assisted:  "oklch(0.8 0.15 80)",
  no:           "oklch(0.55 0.02 280)",
  inconclusive: "oklch(0.7 0.15 240)",
  error:        "oklch(0.65 0.20 25)",
};
```

### Layout

A `.stats-card` containing a CSS grid of chart sub-cards. Two columns on desktop, one column under ~700px. Each sub-card: glass surface, small mono header (`VERDICT DISTRIBUTION`), chart body, optional legend.

Hide the entire stats card when `state.results` is empty or has no completed analyses. Don't show empty charts as placeholders — render nothing.

### Anti-patterns

- **3D charts, exploded pies, animated transitions.** The design system is calm. Charts that draw attention to themselves compete with the data.
- **Charts of debugging metadata.** "Calls per minute" or "tokens consumed" belongs in the log console, not the stats card. Stats is about the data the model produced, not the runner's behavior.
- **Charts on tiny samples.** A donut with `n=3` looks worse than a counts line. Add a `n >= some_threshold` check, or hide the stats card until enough results exist.
- **Different palette from result cards.** Visual coherence costs nothing; a mismatched chart palette costs trust.

## File shape

A single `.html` file with three sections:

```html
<!doctype html>
<html>
<head>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=...">
  <style> /* design tokens + layout */ </style>
</head>
<body>
  <!-- semantic markup, no framework -->
  <script>
    // state object, $(id) helper, pool, llm wrapper, handlers, render functions, event wiring
  </script>
</body>
</html>
```

No React, no Tailwind CDN, no build. Plain CSS with `:root` custom properties. Use a tiny `$()` helper, keep state in one plain object, mutate the DOM directly. Typical finished size: 1000–1700 lines for a full tool with concurrency, progress, logging, editable prompts, stats charts, and a styled UI.

## Design system — Glassmorphic Deep

Every one-page Gemini app uses this aesthetic by default. Translucent panels floating over a deep violet-dark background with soft auroral light. Do not deviate — the effect collapses if any one element is missing.

### Background atmosphere

```css
body {
  background: oklch(0.13 0.02 280);
  color: oklch(0.95 0.005 280);
}
```

Always render two blurred aurora blobs and a noise overlay on the root element:

```html
<!-- blob 1: top-left violet -->
<div style="position:fixed;width:600px;height:600px;border-radius:50%;
  background:radial-gradient(circle,oklch(0.4 0.18 300/.5),transparent 70%);
  top:-200px;left:-100px;filter:blur(60px);pointer-events:none;z-index:0"></div>
<!-- blob 2: bottom-right blue -->
<div style="position:fixed;width:700px;height:700px;border-radius:50%;
  background:radial-gradient(circle,oklch(0.4 0.16 240/.4),transparent 70%);
  bottom:-300px;right:-200px;filter:blur(80px);pointer-events:none;z-index:0"></div>
<!-- noise -->
<div style="position:fixed;inset:0;opacity:0.03;pointer-events:none;z-index:0;
  background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><filter id=%22n%22><feTurbulence baseFrequency=%220.9%22/></filter><rect width=%22100%22 height=%22100%22 filter=%22url(%23n)%22/></svg>')"></div>
```

### Color tokens

```css
:root {
  --bg-deep:      oklch(0.13 0.02 280);
  --bg-elev-1:    oklch(0.95 0.005 280 / 0.04);   /* low surface */
  --bg-elev-2:    oklch(0.95 0.005 280 / 0.06);   /* raised surface */
  --bg-elev-3:    oklch(0.95 0.005 280 / 0.08);   /* hovered/active */
  --border-1:     oklch(0.95 0.005 280 / 0.06);
  --border-2:     oklch(0.95 0.005 280 / 0.10);
  --text-primary:   oklch(0.95 0.005 280);
  --text-secondary: oklch(0.75 0.02 280);
  --text-tertiary:  oklch(0.65 0.02 280);
  --text-quiet:     oklch(0.55 0.02 280);
  --accent:         oklch(0.7  0.18 300);          /* violet — primary action */
  --accent-soft:    oklch(0.7  0.18 300 / 0.15);  /* active row tint */
  --accent-glow:    oklch(0.7  0.18 300 / 0.4);   /* button shadow */
  --red:   oklch(0.65 0.2 25);
  --amber: oklch(0.80 0.15 80);
  --green: oklch(0.75 0.18 145);
  --blue:  oklch(0.70 0.15 240);
}
```

Accent is always violet. Never use it as body text — only on active labels, links, controls. Body copy must use `--text-primary` (≥10:1 contrast).

### Typography

- **Inter** (400/500/600/700) — UI, body, headings
- **JetBrains Mono** — timestamps, IDs, code, prompts (they're structured text), `SECTION LABELS LIKE THIS`, numerical metadata
- Never three families. Never a serif.

### Surfaces

Every card/panel is a glass surface:

```css
.glass {
  background: oklch(0.95 0.005 280 / 0.04);
  border: 1px solid oklch(0.95 0.005 280 / 0.08);
  backdrop-filter: blur(20px);
  border-radius: 12px;
}
```

No shadows, no gradients on cards. The accent button casts a violet glow:
`box-shadow: 0 6px 20px oklch(0.7 0.18 300 / 0.4)`

### Iconography

Use geometric Unicode glyphs — ◐ ◇ ◈ ◉ ▣ ◬ ⬡ ⌕ for nav/section icons. Action icons: ▶ ❚❚ ⤓ ↗ ✎ ⋯. No emoji. No icon libraries.

### Motion

Transitions `120–200ms ease`. Hover lifts surface one elevation level. No scale > 1.02. No bouncy springs. The vibe is calm, not flashy.

Text selection: `::selection { background: oklch(0.7 0.18 300 / 0.35); color: oklch(0.95 0.005 280) }`

## Layout shell — always the same

```
┌─────────────────────────────────────────────────┐
│  TOP BAR     brand · meta pills                 │  ~62px, glass
├──────────┬──────────────────────────────────────┤
│          │                                      │
│  LEFT    │       MAIN WORK AREA                 │
│  NAV     │       (only this scrolls)            │
│  +       │                                      │
│  CONFIG  │       cards stack vertically:        │
│          │       Input → Prompts → Stats →      │
│  ~240px  │       Results                        │
├──────────┴──────────────────────────────────────┤
│  LOG CONSOLE                                    │  ~220px, glass
└─────────────────────────────────────────────────┘
```

**Rules:**
- Top bar: 60–68px, glass, `backdrop-filter: blur(20px)`, 1px hairline border-bottom.
- Left rail: 220–260px fixed. Houses navigation + config (API key, model, concurrency, thinking, retries, grounding toggle, Maker-Checker toggle).
- Main area: the only thing that scrolls vertically. 24–32px outer padding. Cards stack: Input → Prompts → Run/Progress → Stats → Results.
- Bottom log console: 200–240px, glass, full width.

### Resizable behavior

- **Every `<textarea>` has `resize: vertical`** with min-height 80–220px depending on role (prompts get 200px, free input gets 140px).
- **Every content `<div>`** with dynamic length has `overflow-y: auto` and `min-height: 0`.
- **Draggable splitter** between left rail and main area, rail width persisted to `localStorage`.
- Custom scrollbar: 6px, transparent track, glass thumb, accent on hover.

## Settings to expose to the user

For any tool doing chunked parallel LLM work, put these in the rail so they're tunable without editing code:

| setting | default | notes |
|---|---|---|
| backend | gemini | `Gemini \| OpenRouter` selector. Swaps the key + model fields. The model choice persists to `localStorage` per backend; keys stay in memory. |
| model | per backend | Gemini: dropdown of live 3.x ids (default `gemini-3.7-flash`). OpenRouter: dropdown fetched live from `/api/v1/models` + free-text slug input. |
| concurrency | 3–4 | Max parallel in-flight calls. Lower for grounding-heavy tasks (3); higher for ungrounded bulk (8). |
| chunk size | 1–15 | 1 for grounding-per-item tasks, 15 for catalog matching. Match the task's natural unit. |
| thinking level | model default | Lowest the model accepts for bulk classification (`low` on 3.7 Flash, `minimal` elsewhere), `high` for hard reasoning. Clamp `minimal`→`low` when a 3.7 model is selected. Gemini only; hide or map to `reasoning.effort` on OpenRouter. |
| max retries | 2 | Per-call retry count with exponential backoff, transient errors only. Input capped at 5. |
| grounding | varies | On by default for fact-finding tasks (CVE research, current-state lookup), off for pure transformation tasks. Gemini: `googleSearch` tool; OpenRouter: `web` plugin / `:online` suffix. |
| maker-checker | off | Always present as a toggle even when off by default. |

## Maker-Checker validation (always present as an option)

For tools where output quality matters more than throughput — compliance audits, security architecture reviews, BSI-grade analyses, attribution research, anything where a domain expert will read the output and act on it — add a second pass that audits the first pass. Same model, different role.

**Maker-Checker should ALWAYS be available as a toggle in the tool, even when off by default.** Users who need audit-grade output shouldn't have to edit the file to enable it. Default off (so cost-sensitive users aren't surprised by 2× usage), but visible.

### Shape

Two independent passes that share infrastructure:

1. **Maker** — Pass 1. Builds the structured output from input. Standard chunked pool call.
2. **Checker** — Pass 2 (only after Pass 1 completes). Takes each (input, Maker output) pair and audits it, producing a validation object *alongside* — never replacing — the Maker output.

Both passes use the same `runPool` / `llm()` / retry infrastructure. They differ in schema, prompt, and what they receive as input.

### Dual schemas

```js
const VALIDATE_SCHEMA = {
  type: "object",
  properties: {
    validations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item_id: { type: "string" },
          verdict: {
            type: "string",
            enum: ["confirmed", "minor_corrections", "major_issues", "incorrect", "uncertain"]
          },
          issues: { type: "array", items: { type: "string" } },
          corrections: { type: "string" },
          confidence_check: {
            type: "string",
            enum: ["appropriate", "too_high", "too_low"]
          },
          reviewer_notes: { type: "string" }
        },
        required: ["item_id", "verdict", "issues", "corrections", "confidence_check", "reviewer_notes"]
      }
    }
  },
  required: ["validations"]
};
```

Five-level verdict, not boolean. `uncertain` is critical — without it the Checker pretends to know things it doesn't, which defeats the entire purpose. `confidence_check` separates "is this analysis right" from "did the Maker calibrate confidence appropriately" — two different audit questions.

### Independent runners, shared infrastructure

The Checker reuses `runPool`, `llm()`, `chunk()`, and the cancel flag. It has its own progress bar phase ("validating"), its own log lines. Both pull concurrency, chunk size, thinking level, and grounding toggles from the same global settings.

Each pair handed to the Checker carries the original input and the Maker's full structured output (the reason is in `cp-coding-core`):

```js
function formatPairs(pairs) {
  return pairs.map((p, i) => `=== PAIR ${i + 1}: ${p.input.id} ===

INPUT (what the Maker was asked about):
${formatInput(p.input)}

MAKER'S ANALYSIS (to audit):
${formatAnalysis(p.analysis)}`).join("\n\n");
}
```

### Storage shape: never overwrite

Each result entry holds both:

```js
{
  item: {…},              // original input
  analysis: {…},          // Maker output, never modified by Checker
  validation: {…} | null, // Checker output, added in pass 2
  error: null,
  validationError: null,
}
```

The Maker output is immutable from the Checker's perspective. Re-running the Checker clears existing `validation` fields first, then refills them. Never partial updates.

### UI: validation block per result card

Each result card grows a validation section beneath the Maker's output after the Checker runs. Use a left-border accent that maps verdict to color:

```css
.validation-block {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--border-1);
  background: oklch(0.95 0.005 280 / 0.03);
  border-left-width: 3px;
}
.validation-block.ok      { border-left-color: oklch(0.75 0.18 145 / 0.8); }
.validation-block.warn    { border-left-color: oklch(0.8  0.15 80  / 0.8); }
.validation-block.danger  { border-left-color: oklch(0.65 0.2  25  / 0.8); }
.validation-block.neutral { border-left-color: var(--text-quiet); }
```

The card's badge row also gets a verdict pill. Add a filter option "Validation issues" to the results toolbar — surfaces just the items with `verdict ∈ {minor_corrections, major_issues, incorrect}`.

### Stats integration

When the Checker runs, the stats card grows a fourth chart: validation verdict distribution. Same horizontal-bar pattern as the AI-tool frequency chart, colored by verdict:

```js
const VALIDATION_COLORS = {
  confirmed:         "oklch(0.75 0.18 145)",  // green
  minor_corrections: "oklch(0.80 0.15 80)",   // amber
  major_issues:      "oklch(0.65 0.20 50)",   // orange-red
  incorrect:         "oklch(0.65 0.20 25)",   // red
  uncertain:         "oklch(0.55 0.02 280)",  // quiet
};
```

This is the highest-signal stat in the entire tool — "how much of my batch did the Checker disagree with" tells the user in one glance whether to re-run with a better Maker prompt.

### Export integration

Every export format includes validation alongside the Maker output:

- **JSON**: nest `validation` as a sibling field of `analysis`. Keep `error` and `validationError` separate.
- **CSV**: append `validation_*` columns at the end. Keep Maker columns stable so existing downstream tooling doesn't break.
- **Markdown**: append a per-item "Validation" subsection with verdict, issues, reviewer notes, and corrections.

### Compounding with grounding

When the Maker uses Google Search grounding, run the Checker with the same tools enabled. The Checker is doing fact-checking work — depriving it of search while equipping the Maker is backwards.

### Anti-patterns

The general ones are in `cp-coding-core`: the "are you sure?" rerun, a Checker that overwrites Maker output, a forced binary verdict, one prompt with a role toggle. Specific to this tool:

- **Letting the user validate before analyzing.** The Checker step must be skipped if there are no completed Maker analyses to audit.

## Multi-stage data pipelines

For tools where a single Maker→Checker pass isn't enough — compliance assessments with a final synthesis stage, planning tools that aggregate per-item analyses into a global plan, audit workflows with handoffs between roles — design as **discrete stages with structured handoffs**. Each stage has its own prompt, schema, runner, and persistence. Real example: an Azure DR analyzer running Maker (per-cluster analysis) → Checker (audit) → Planner (synthesize a phased recovery runbook).

Six patterns are mandatory once you cross from one Maker pass into a real multi-stage tool.

### Pre-grouping in JS before LLM dispatch

Bucket inputs by some categorical attribute in code (criticality, kind, owner) and run one chunked LLM stage per bucket. Two payoffs: smaller per-call context (cheaper, more focused), and the LLM gets a homogeneous task ("plan the high-priority phase" instead of "plan everything"). The JS-side grouping costs nothing and dramatically improves output quality vs. asking the model to do the grouping itself.

### Chunked synthesis with cross-chunk references

Late-stage synthesis often produces output items that reference output items from earlier stages by ID — e.g. a recovery plan's groups reference cluster IDs from the Maker stage, and downstream phases reference upstream phase group IDs via `depends_on`. When you chunk a synthesis stage, handle two ID-stability problems:

1. **Cross-stage references must be byte-stable.** If stage 1 produces `cluster.id = "rg/foo"`, stage 2 must reference that EXACT string. Schema should require it (`included_clusters: array of strings`); prompt should say "use EXACTLY the IDs provided — no invented ones". Add a post-assembly validator in JS that checks every reference resolves; surface orphans as warnings, not crashes.

2. **Within-stage references survive chunked execution.** When a stage gets chunked across N parallel LLM calls, each chunk produces locally-consistent IDs (`g.1`, `g.2` in chunk 1 AND in chunk 2 — collision). After parallel completion, walk all chunks: assign each item a globally-unique new ID with a monotonic counter, build a `localRemap` per chunk, rewrite `depends_on` arrays within the same chunk using the new IDs. Cross-chunk references **don't exist** (chunks are parallel-independent) so the remap is per-chunk-local. Cross-stage references (e.g. phase 2 → `g1.5` from phase 1) are stable because phase 1 ran first and was already remapped before phase 2 started.

```js
let counter = 1;
for (const chunkResult of chunkResults) {
  const localRemap = new Map();
  for (const g of chunkResult.groups) {
    const newId = `g${phaseNum}.${counter++}`;
    localRemap.set(g.group_id, newId);
    g.group_id = newId;
  }
  for (const g of chunkResult.groups) {
    g.depends_on = (g.depends_on || []).map(d => localRemap.get(d) || d);
    mergedGroups.push(g);
  }
}
```

### Quality cliff vs token cliff

Chunking is two things: a token-budget tool AND a reasoning-quality tool. The token-cliff (where the model 400s because input exceeds context) is loud and obvious. The quality-cliff is silent: at 190 items in one call, gemini-3.1-pro happily returns a "valid" response in which 190 items get lumped into 5 mega-buckets. No error, no warning — just a useless output. The fix is the same (chunk it) but the *threshold is lower* than the token math suggests. Empirical rule: keep per-call item count under ~25 for any task that requires the model to **group, sort, or relate items to each other**. Pure per-item classification can go higher (50–100 fine).

When you chunk, also bound the prompt size of the "prior context" that each later chunk receives — if stage-2-chunk-N gets a 5 KB summary of every prior chunk, you've just re-created the cliff. Truncate / bucket prior context above ~40 entries: list the first 40 individually, group the rest by category with sample IDs.

### Resume from exported run JSON

Multi-stage tools fail in late stages — the planner times out, the network drops, the model misbehaves — but the work of earlier stages is real and shouldn't be redone. Make this concrete:

1. **JSON export at each stage completion** captures enough state that the next stage can run. Shape mirrors `state.results[]` so the loader can rebuild state directly. The export never contains an API key.
2. **A Resume input mode** (separate tab alongside CSV/XLSX/whatever) takes the exported JSON, rebuilds `state.results`, and skips the stages that already have data.
3. **What rebuilds, what doesn't**: rebuild `state.results[]` (LLM-derived data); do NOT rebuild `state.raw` / `state.graph` (the original inputs). The loader marks raw as unavailable; downstream stages that only need LLM outputs work fine; stages that would need to re-read raw data must show disabled with a tooltip ("load CSVs again to redo Maker").
4. **UI cues**: status pill shows `RESUMED · N ANALYZED · M VALIDATED`, source label includes the resume timestamp, inventory + clusters cards stay hidden (raw absent), results + plan cards become available.

This is also the right shape for "save your work" — the JSON IS the save file. A power user can iterate on the planner prompt across many runs by exporting, editing the prompt, dropping the same JSON back in, re-running just the planner.

### Multi-file input with role detection by column fingerprint

When the user supplies multiple files that play different roles in the pipeline (e.g. 9 different CSV exports from a portal where the filename is sequence-based, not semantic), detect each file's role from its **column signature**, not its filename:

1. Define a `ROLE_DEFS` table mapping role-id → required column signature (the 3–5 columns that uniquely identify this role).
2. Score each uploaded file against each role's signature; pick the highest-scoring role above a threshold (e.g. 70% of signature columns present).
3. Show the user a list: file name · detected role · row count · column count. The role is a `<select>` so the user can override.
4. Color-code: green border on auto-detected with high confidence, amber on low/unknown or user-overridden.
5. A "Process files" button enabled only when the mandatory roles are assigned (e.g. the "master" table).
6. Files marked `(ignore)` are excluded — useful when the user dragged in metadata files they don't want in the pipeline.

Role detection ordering matters: if two roles share columns, list the more specific one first in the score-comparison loop. Pre-scan the columns from the first N rows (not just row 0) since portal exports sometimes have nulls in the first row.

### Synthetic field reconstruction

When the canonical pipeline input expects a "joined view" table that doesn't exist in the user's raw exports — e.g. the code wants `Q2_VMs` with VM + ASR + Backup + NICs + disks all merged, but the user only has the underlying separate tables — synthesize it in JS at parse time:

1. Build maps keyed by foreign-key (lowercased VM id).
2. Filter the master table to the relevant type.
3. For each row, look up the corresponding side-tables and merge into one synthetic record.
4. Down-pipeline code reads `Q2_VMs` without knowing it was synthesized.

Log loudly: `Q2_VMs synthetisiert: 246 VMs aus Master + ASR(N) + Backup(M) + NICs + Disks`. If a critical join table is missing, warn but proceed: `Weder ASR- noch Backup-Export zugewiesen — Recovery-Methoden-Erkennung wird stark eingeschränkt sein`. Don't refuse to run; tell the user what'll be degraded.

### Anti-over-engineering in synthesis prompts

LLMs default to producing "complete-looking" structured outputs even for trivial inputs. A planner that's supposed to output groups + steps will, given 1 cluster, produce 5 groups with 4 steps each — because the schema "feels like it expects more." This is over-engineering by the model.

Fix it in the prompt with an explicit small-input → small-output rule:

> **Bei wenigen Inputs (1–3) erzeuge auch nur wenige Output-Items (1–2)** — mehr ist NICHT besser. Eine kleine Phase bleibt klein.

The capitalization and emphasis matter. The rule has to be unambiguous because the default behaviour the model learned is "fill the schema generously." You're explicitly overriding that.

## Backend summary

- **Gemini** (`generativelanguage.googleapis.com`) — primary path for standalone HTML. Native `responseJsonSchema`, Google Search grounding, thinking levels.
- **OpenRouter** (`openrouter.ai/api/v1`) — multi-vendor option; see its section above. Best for cross-validation and mixed-vendor Maker-Checker.
- **Claude in-artifact** — if the tool might run inside a Claude artifact environment, add a toggle for `claude-sonnet-4-6` via `https://api.anthropic.com/v1/messages` (no key needed there). Outside an artifact (plain `file://` or local server), this path fails CORS — note: OpenRouter also serves Anthropic models with a key if the user wants Claude in a standalone file.

## Checklist before handing the file over

Principles:

- [ ] The `cp-coding-core` handover checklist passes: nothing computable asked of a model, the deterministic/LLM split logged, no swallowed errors, build version visible and bumped, no secret stored
- [ ] If no residual needs an LLM: tool built with zero LLM plumbing (no key, no model selector, no prompts card) and the user told it's fully deterministic/offline

Core infrastructure:

- [ ] Model id checked against `ai.google.dev/gemini-api/docs/models` this session, not just against the table in this skill; default `gemini-3.7-flash`, none of the shut-down ids (`gemini-3-pro-preview`, `gemini-3.1-flash-lite-preview`, `gemini-2.0-flash*`)
- [ ] No `thinkingLevel: "minimal"` reaches a `gemini-3.7-*` model — clamped to `low` in the request builder, or the option is disabled when a 3.7 model is selected
- [ ] `x-goog-api-key` header (Gemini) / `Authorization: Bearer` (OpenRouter) used; keys never hardcoded and never written to `localStorage`, `sessionStorage`, exports or logs
- [ ] **No sampling parameters sent at all** — no `temperature`, `top_p`, `top_k`, `candidate_count` (deprecated; future models 400)
- [ ] No prefilled model turns — request never ends on a `role: "model"` turn (HTTP 400 on current models)
- [ ] `extractJson()` tolerant parser used whenever grounding/web plugin is on (schema+grounding may combine, but stay defensive)
- [ ] Large inputs run through `runPool`, not in one call
- [ ] Tasks mutate `state.results[idx]` directly; `renderResults()` called from `onProgress` for live updates
- [ ] Renderer handles three states per entry: analysis, error, pending — never crashes on null
- [ ] Post-pool sweep marks un-dispatched entries as cancelled
- [ ] Progress bar wired to the pool's `onProgress` callback for every phase
- [ ] Log console captures: parse, chunk split, each call start, each call end with size + ms, retries, failures, assembly, final totals
- [ ] `llm()` wrapper retries transient errors only (429, 5xx, network) with exponential backoff, at most 5 times, raises permanent errors at once, and honours `state.cancel`
- [ ] A `■ cancel` button appears while `state.running` and sets `state.cancel = true`
- [ ] Error path shows the raw API error message, truncated to ~400 chars

Editable prompts (mandatory):

- [ ] Every prompt the model sees lives in a user-editable `<textarea>` with monospace font
- [ ] Each prompt has a Reset button that restores a `DEFAULT_*_PROMPT` constant
- [ ] Each prompt persists to `localStorage` on input
- [ ] Each prompt validates its placeholder (`{cve_id}`, `{pairs}`, etc.) and warns if missing
- [ ] Build functions append a missing placeholder defensively at runtime
- [ ] Default prompts are written to production quality, not as fill-me-in stubs

Stats and visualizations (when output has enum/categorical fields):

- [ ] A stats card appears between Run and Results when results exist
- [ ] Charts use SVG/CSS only — no Chart.js or other libraries
- [ ] Charts use the same color map as the result-card verdict pills
- [ ] 3–4 charts maximum (donut for primary distribution + 2–3 horizontal bars)
- [ ] Stats card hidden when no completed analyses
- [ ] Tool-name frequency chart capped at top 8 with "…and N more" if needed

Design system:

- [ ] Page bg = `oklch(0.13 0.02 280)`, two aurora blobs rendered, noise overlay present
- [ ] Top bar: glass, `backdrop-filter: blur(20px)`, 1px hairline border-bottom
- [ ] Left rail: always present, 220–260px, grouped nav with mono nano labels
- [ ] Active nav item uses `--accent-soft` bg + violet icon
- [ ] All cards: `background: oklch(0.95 0.005 280 / 0.04)`, `backdrop-filter: blur(20px)`, `border-radius: 12px`, 1px hairline border
- [ ] Primary CTA: solid violet with `box-shadow: 0 6px 20px oklch(0.7 0.18 300 / 0.4)` glow
- [ ] Inter for UI + body, JetBrains Mono for labels / timestamps / IDs / prompt textareas
- [ ] Every `<textarea>` has `resize: vertical`, glass styling, violet focus ring, styled resize grip
- [ ] Every content `<div>` with dynamic content has `overflow-y: auto` and `min-height: 0`
- [ ] Draggable splitter between left rail and main area; rail width persisted to `localStorage`
- [ ] Custom scrollbar: 6px, transparent track, glass thumb, accent on hover
- [ ] `::selection` uses violet tint, not OS blue
- [ ] No emoji. No icon libraries. No serif. No spinners (use 1px accent hairline progress bar).

User-facing settings:

- [ ] Backend selector (`Gemini | OpenRouter`) in the rail; key + model fields swap with it; model choice persisted per backend, keys in memory only
- [ ] Concurrency / chunk size / thinking level / retries exposed as user inputs
- [ ] Grounding toggle exposed (default depends on task); wired per backend (`googleSearch` vs. `web` plugin)
- [ ] Maker-Checker toggle always present in the rail/settings, even when default off
- [ ] User told about the CORS-on-`file://` caveat and the `python -m http.server` fix
- [ ] User told `gemini-3.1-pro-preview` is paid-only; offer `gemini-3.7-flash` (free tier, $0.75/$3.75 intro) or `gemini-3.5-flash-lite` ($0.30/$2.50) as cheap alternatives, and that the Flash intro pricing doubles on 1 Jan 2027 (check `ai.google.dev/gemini-api/docs/pricing` for current numbers)

If the OpenRouter backend is enabled:

- [ ] Model dropdown populated live from `GET /api/v1/models` (no auth needed), cached in `localStorage` ≤24 h, free-text slug input beside it
- [ ] Dropdown filtered/annotated by `supported_parameters` containing `structured_outputs` when the tool relies on schemas
- [ ] `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }` + `provider: { require_parameters: true }` set together
- [ ] Errors read from `data.error.message`; text from `data.choices[0].message.content`
- [ ] Log lines record which backend + model served each call (auditable mixed-backend runs)
- [ ] Optional `HTTP-Referer` / `X-Title` attribution headers set

If the tool uses the Maker-Checker pattern:

- [ ] Toggle defaults to off but is always visible
- [ ] Checker prompt is a second editable textarea (in addition to the Maker prompt)
- [ ] Validate button / second-pass dispatch is **disabled or skipped** until `state.results` contains at least one successful Maker analysis
- [ ] Checker prompt payload includes BOTH the original input AND the Maker's full structured output for each pair
- [ ] Re-running the Checker clears existing validations first
- [ ] Verdict schema is five-level (`confirmed`, `minor_corrections`, `major_issues`, `incorrect`, `uncertain`) — never boolean
- [ ] Validation block in each result card uses a left-border accent mapped to verdict color
- [ ] Verdict pill added to the card badge row for at-a-glance scanning
- [ ] "Validation issues" filter option in the results toolbar
- [ ] Stats card grows a validation-verdict-distribution chart when Checker has run
- [ ] All exports (JSON, CSV, Markdown) include validation fields and indicate whether validation ran
- [ ] Grounding tools (Google Search / URL context) are equally available to the Checker — not Maker-only

If the tool is a multi-stage pipeline (more than Maker+Checker):

- [ ] Each stage has its own editable prompt textarea, its own schema, its own runner
- [ ] Pre-grouping into stage-buckets happens in JS BEFORE any LLM dispatch
- [ ] Late-stage chunked calls produce locally-scoped IDs; a JS post-processor remaps to globally-unique IDs and patches within-chunk `depends_on` references
- [ ] A `validatePlanReferences()` step checks every cross-stage reference resolves; orphans logged as warnings, not crashes
- [ ] Per-call item count for synthesis stages capped at ~20–25 (quality cliff, not token cliff)
- [ ] Prior-context summary passed to later stages is truncated/bucketed above ~40 entries
- [ ] Default prompts include explicit "few-input → few-output" anti-over-engineering rules
- [ ] Resume tab in the input picker takes a previously-exported run JSON and rebuilds `state.results` without re-running Maker
- [ ] Status pill on resume reads `RESUMED · N ANALYZED · M VALIDATED`
- [ ] After resume, raw-data-dependent stages (Maker re-run) are disabled with an explanatory tooltip
- [ ] Multi-file input mode uses column-fingerprint role detection with override dropdowns
- [ ] Synthetic field reconstruction (when raw data lacks a joined view the pipeline expects) happens at parse time and logs what it built and from what
