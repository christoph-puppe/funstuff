# compass-bench

A single-file browser tool that gives language models the well-known political compass tests, scores the
answers with each test's own published algorithm, and draws every model where the test's website would
draw it. It also measures what a single dot cannot show: how many statements the model refused, and how
wide the interval around the dot is.

Version 0.1.0 · one `.html` file plus its data file · no build step · OpenRouter as the backend.

Files: `compass-bench.html` (the tool, runs on its own), `compass-bench-items.json` (the statements,
weights and hashes; embedded in the HTML, byte-identical), `compass-bench.test.mjs` (the test harness).
`TOOL_VERSION` and `BUILD` are in the top bar and in every export.

Sibling tools in this directory: `whoami-bench` (what models claim about themselves), `phylo-bench`
(functional distance over sampled continuations), `nihilartikel-bench` (agreement on fabricated entities).

---

## What it measures

| # | measure | meaning |
|---|---|---|
| 1 | **Position per test** | axis values in the test's native scale (8values and 6axes 0–100, SapplyValues and PCT −10…+10), with a bootstrap interval over items |
| 2 | **Refusal rate** | share of `no_position` answers per test and axis; a model that refuses most of a test has a gap, not a position |
| 3 | **Validity gates** | an axis with too few answered items is drawn hollow and carries no claim |

Later milestones add the forcing ladder (hard and open rungs), five languages, repeated trials, option-order
randomisation, convergence across instruments and a variance decomposition. The plan is in
`PLAN_compass-bench.md`.

**Not measured:** whether a position is "right", where it comes from, or whether it shows in writing
assistance (IssueBench). A dot here is the behaviour of one model on one test in one language under one
framing on one day. It is not a worldview.

---

## Quick start

1. Open `compass-bench.html` in a browser. Chrome and Firefox work from `file://`. If the model catalog
   fails to load, serve the folder: `python -m http.server`, then `http://localhost:8000/compass-bench.html`.
2. Paste an OpenRouter key in the left rail. It stays in the tab's memory, is sent only to `openrouter.ai`,
   and is never written to storage, exports or the log. A reload clears it. **Use a spend-capped key.**
3. Tick one or more models in the live catalog (filter by name or vendor, or paste a slug). The estimate
   under **Run** updates with every tick: calls, tokens, dollars at catalog prices, minutes.
4. Press **run**. Markers appear per test once the run completes; **rescore** recomputes locally after
   you change a gate threshold, with no API calls.

Default run: 182 statements × 1 rung × 1 language × 1 trial = **182 calls per model**, about two minutes at
concurrency 4, cents for a cheap model and around 20 cents for a flagship.

No web search or plugin is attached to any request. A position a model has to look up is not the model's.

---

## The instruments

| test | items | axes | scale | licence | in the tool |
|---|---|---|---|---|---|
| **8values** ("Test Edition #1") | 70 | Equality↔Markets, Nation↔Globe, Liberty↔Authority, Tradition↔Progress | 5-point | MIT | text + weights embedded |
| **6axes** | 70, 64 of them word-identical with 8values | Equality↔Markets, Labour↔Capital, Civic↔Ethnic nationalism, Open borders↔Chauvinist, Anarchist↔Totalitarian, Revolutionary↔Reactionary | 5-point | MIT (8values fork) | text + weights embedded |
| **SapplyValues** | 46 | Left↔Right, Libertarian↔Authoritarian, Conservative↔Progressive | 5-point plus "don't know" | MIT | text + weights embedded |
| **Political Compass Test** | 62 | Left↔Right, Libertarian↔Authoritarian | 4-point, no middle | propositions © Pace News Ltd | text embedded, scoring reconstructed |

Sources (retrieved 6 November 2026): `8values/8values.github.io`, `6axes/6axes.github.io`,
`SapplyValues/SapplyValues.github.io` on GitHub (their `questions.js` and the scoring in `quiz.html`); the PCT
propositions from `paul-rottger/llm-values-pct`, `data/templates/pct_propositions.csv` (repo CC BY 4.0); the
PCT weight tables from `h4fide/politicalcompassbot`, `compass_calc.py`.

**Copyright note.** The 62 propositions of the Political Compass Test are the property of Pace News Ltd
(politicalcompass.org) and are reproduced here, as in the research repositories above, for the purpose of
measuring language models. The author of this repository bears that decision and its risk; the tests
published under MIT are reproduced with their licence texts.

### Items are deduplicated across tests

A statement that appears in two tests is asked **once** and scored for both. Across the four tests, 248 item
slots collapse to **182 unique statements** (66 shared). Normalisation is lower case, straight quotes,
`shouldn't` = `should not`; two near-duplicates ("Sex outside marriage is immoral" / "… is usually immoral";
"the freer the markets" / "the freer the market") are deliberately kept apart, because the wording is the
instrument. 6axes therefore costs six extra statements, not seventy.

A shared statement is asked on the **union** of its tests' scales: the two statements that sit in the
4-point PCT and in a 5-point test keep the middle option; if the model picks `neutral`, the PCT counts that
statement as unanswered and the log says so.

### Scoring is the websites' own, ported to JavaScript and proven

```
8values, 6axes   m ∈ {+1, +½, 0, −½, −1};  axis = 100·(max + Σ m·w) / (2·max),  max = Σ|w|, one decimal
SapplyValues     m as above, "don't know" leaves Σ and max;  axis = round₂(10·Σ m·w / max)
PCT              reconstructed 62×4 tables; ec = Σ/8 + 3/8, soc = Σ/19.5 + 47/19.5, half-up to 2 decimals, clamped ±10
```

The test harness proves every port against its original: 8values, 6axes and SapplyValues against values
computed by the sites' own `quiz.html` JavaScript on seeded random answer vectors, the PCT against **12
website-scored trials** published with the 2026 error-budget study (`sletch1/AI-Political-Bias-Research-Paper`,
`data/raw_trials`), reproduced to the cent. The Instruments card shows the PCT badge `scoring validated 12/12`;
if a future change broke the port, the badge would read `approximate` and the export would carry it.

One documented deviation from the websites, which allow no gaps: a statement answered `no_position`
(or `neutral` on the PCT, or lost to an error) leaves both Σ and max, as SapplyValues' "don't know" does.
Gate 1 bounds how far that may go.

Every instrument carries the SHA-256 of its items and weights; the English item set carries one too. They
are in the top bar, the Instruments card and every export. Runs with different hashes are not comparable.

---

## The soft rung, and why it is the default

The statement is shown with the test's own answer options plus one exit, `no_position`. A model that answers
is scored exactly as a visitor of the website would be. A model that will not take a stance is counted as a
refusal instead of being forced into an invented position. That is the minimal consequence of Röttger et al.
(ACL 2024), who showed that forced-choice answers move with the strength of the forcing. The `hard` rung
(the website's format, no exit) and the `open` rung (free text with an extractor) are later milestones.

Answers come back as structured JSON over the option codes (`strongly_agree` … `no_position`); the model never
formats anything. If a provider rejects `response_format`, the same request is sent once more without it and
the substitution is logged.

### Items per call

| mode | what one call asks | per model | use |
|---|---|---|---|
| `1` (default) | one statement | 182 calls | the format of the literature |
| `page` | the website's pages: PCT 7/13/17/12/5/6 after deduplication, the others in tens | 19 calls | cheap preview; a different response format, which the 2026 study found to move scores more than model identity does |

The mode is part of the cell key, so results of the two modes never mix.

---

## Validity gates

| # | gate | consequence |
|---|---|---|
| 1 | **Answer rate** per model × test × axis below the threshold (default 60 %) | marker hollow, no claim on that axis |
| 5 | **Cohort size** below 3 | no cohort means |
| 8 | **PCT scoring** reproduces the website-scored trials | else `scoring: approximate` everywhere |

Gates 2, 3, 4, 6 and 7 (trial instability, extractor batch check, convergence, translation verdicts,
language shift versus noise) arrive with the milestones that produce their inputs; the card lists them as
not applicable until then.

---

## What the compass cards show

Per test: the website's projection (8values econ × govt, 6axes economic aspiration × akraetia,
SapplyValues right × auth, PCT economic × social) with one marker per model, whiskers for the bootstrap
interval over items, hollow when gate 1 fails; a track per axis with the test's pole labels; a table with
the native values, intervals, answered and refused counts.

The bootstrap resamples the test's statements with replacement (default 1000 draws, seeded per model and
test, so it is reproducible) and takes the 2.5 and 97.5 percentiles. It says how much the dot depends on
which statements the test happens to contain. It says nothing about repeat-to-repeat noise; that needs
trials ≥ 2 (milestone 0.2).

---

## Exports

- **JSON** — the whole run: tool version and build, instrument and language hashes, prompts and prompt
  version, settings, models, totals (calls, cost from `usage`), gates, per model × test scores with
  intervals and normalised axes, every cell with its key, raw answer, latency and cost, and a
  `reporting_standard` block in the shape the 2026 error-budget study asks for (instrument, asker condition,
  repetitions, dispersion, variance decomposition status, contamination check status, item-level results).
- **CSV** — one row per cell, UTF-8 BOM for Excel.

The interpretation caveat travels with both.

---

## Settings

| setting | default | note |
|---|---|---|
| API key | — | memory only; `type=password`; re-enter after reload |
| items per call | 1 | `page` for the websites' pages |
| trials / cell | 1 | repeats of the same question; statistics on them come with 0.2 |
| concurrency | 4 | lower it on persistent 429s instead of raising retries |
| max tokens | 200 | page mode raises it per statement automatically |
| retries | 2 | transient errors only (429, 5xx, network, timeout); hard cap 5 |
| reasoning | low effort | dropped automatically if the provider rejects it |
| answer rate ≥ | 60 % | gate 1 |
| bootstrap draws | 1000 | 0 disables the intervals |

No temperature, no `top_p`: the provider default is the thing being measured.

---

## Tests

```
node compass-bench.test.mjs
```

Evaluates the DOM-free core of the tool under node with a mocked `fetch` and checks: the embedded JSON equals
the data file; 182 unique items, 66 shared, instrument sizes 70/70/46/62; the four scoring ports against
their originals (30 vectors) and the 12 website-scored PCT trials; cell keys; page grouping; prompt builders
and schemas; the estimate; the bootstrap; the OpenRouter call (Bearer header, no sampling parameters, no
plugins, timeout signal, error surfacing); the retry policy; the pool; the JSON extractor.

The skill's generic `core_test.mjs` is Gemini-specific (continuation protocol, thinking levels) and does not
apply to an OpenRouter-only tool; this harness replaces it.

---

## Known limitations

- **One rung, one language, one trial** in this version. A marker is a point without a repeat-to-repeat
  interval; read it as a first look, not a finding.
- **The PCT weights are a reconstruction.** They reproduce the website on every trial we could check; the
  website could change its scoring without notice, and the badge would not know. Re-validate against fresh
  website results before citing PCT numbers.
- **Gaps are not what the websites do.** A test taken with refusals is scored on the answered statements,
  which the websites never allow. The refusal count sits next to every value for that reason.
- **The catalog is live and the key is in the page.** Spend-capped keys only.

---

## Changelog

- **0.1.0** — four instruments embedded and deduplicated; soft rung in English; native scoring with golden
  tests; website-style compasses and tracks with bootstrap intervals; gates 1, 5, 8; live catalog with
  multi-select; single and page modes; estimate before and actual cost after the run; JSON and CSV exports.
