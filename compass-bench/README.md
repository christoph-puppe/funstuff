# compass-bench

A single-file browser tool that gives language models the well-known political compass tests in five
languages, scores the answers with each test's own published algorithm, and draws every model where the
test's website would draw it. It also measures what a single dot cannot show: how many statements the model
refused, how wide the interval around the dot is, and how far the dot moves when the same statements are
asked in German, Chinese, Japanese or Hindi.

Version 0.3.0 · one `.html` file plus its data file · no build step · OpenRouter as the backend.

This directory: `compass-bench.html` (the tool, runs on its own), `compass-bench-items.json` (the
statements in five languages, weights, translation verdicts and hashes; embedded in the HTML, byte-identical),
`compass-bench.test.mjs` (the test harness), `PLAN.md`, and `compass-bench.zip` with the tool, its data file
and this README for download. `TOOL_VERSION` and `BUILD` are in the top bar and in every export.

Sibling tools in this directory: `whoami-bench` (what models claim about themselves), `phylo-bench`
(functional distance over sampled continuations), `nihilartikel-bench` (agreement on fabricated entities).

---

## What it measures

| # | measure | meaning |
|---|---|---|
| 1 | **Position per test** | axis values in the test's native scale (8values and 6axes 0–100, SapplyValues and PCT −10…+10), with a bootstrap interval over items and, with trials ≥ 2, the range across trials |
| 2 | **Refusal rate** | share of `no_position` answers per test and axis; a model that refuses most of a test has a gap, not a position |
| 3 | **Forcing sensitivity** | how far the point moves between the soft rung (test scale plus an exit) and the hard rung (the website's format, no exit) |
| 4 | **Stability** | SD of each axis across repeated trials on a [−1, +1] scale; the share of items whose repeated answers differed |
| 5 | **Response style** | raw agreement before direction coding (acquiescence), and the shift in agreement when the answer scale is shown disagree-first instead of agree-first |
| 6 | **Convergence across instruments** | whether a model lands in the same quadrant of economic × authority on every test that passed the answer-rate gate |
| 7 | **Language shift** | distance between a model's point in English and in each other language, per test, against the model's own trial noise |
| 8 | **Error budget** | how much of the variance in this run is instrument and axis, model, rung, language, and what is left for trial noise and interactions |

Later milestones add the open rung, 9Axes, resume from an export and an item-inversion contamination check.
The plan is in `PLAN.md`.

**Not measured:** whether a position is "right", where it comes from, or whether it shows in writing
assistance (IssueBench). A dot here is the behaviour of one model on one test in one language under one
framing on one day. It is not a worldview.

---

## Quick start

1. Open `compass-bench.html` in a browser (or unpack `compass-bench.zip` anywhere and open it there). Chrome
   and Firefox work from `file://`. If the model catalog fails to load, serve the folder:
   `python -m http.server`, then `http://localhost:8000/compass-bench.html`.
2. Paste an OpenRouter key in the left rail. It stays in the tab's memory, is sent only to `openrouter.ai`,
   and is never written to storage, exports or the log. A reload clears it. **Use a spend-capped key.**
3. Tick one or more models in the live catalog (filter by name or vendor, or paste a slug). The estimate
   under **Run** updates with every tick: calls, tokens, dollars at catalog prices, minutes.
4. Tick the languages you want under **Languages** (English is on; the other four are opt-in) and press
   **run**. Markers appear per test once the run completes; **rescore** recomputes locally after you change a
   gate threshold, with no API calls.

Default run: 182 statements × 1 rung × 1 language × 1 trial = **182 calls per model**, about two minutes at
concurrency 4, cents for a cheap model and around 20 cents for a flagship. The hard rung doubles that, every
extra trial multiplies it; the estimate shows the product before you press run.

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

## The rungs: soft by default, hard as the comparison point

**Soft.** The statement is shown with the test's own answer options plus one exit, `no_position`. A model that
answers is scored exactly as a visitor of the website would be. A model that will not take a stance is counted
as a refusal instead of being forced into an invented position. That is the minimal consequence of Röttger et al.
(ACL 2024), who showed that forced-choice answers move with the strength of the forcing.

**Hard** (opt-in in the rail). Exactly the website's options, "you must choose one", no exit. This is the format
of the twelve earlier studies and of the websites themselves, so it is the comparison point to the literature.
Each rung has its own prompt pair (single item, page) in the Prompts card and its own prompt version in the cell
key. With both rungs on, the **Ladder** card draws each model's projection axes per rung: a flat line is a
position, a line that moves from soft to hard is forcing sensitivity. The `open` rung (free text with an
extractor) is a later milestone.

### Languages

Every test exists only in English. The German, Chinese, Japanese and Hindi sets are translations made once,
in the build session, by Maker-Checker sub-agents: one agent translated the 182 statements, the six option
labels and the four prompt templates; a second agent in a separate context back-translated each statement and
judged it on five levels (`faithful`, `minor_shift`, `major_shift`, `wrong`, `uncertain`); items judged
`major_shift` or worse went back to a Maker once, were re-judged, and kept the better of the two. Both agents
were Claude; the independence is a separate context, not a different vendor. The result is in
`compass-bench-items.json`: `text.<lang>` per item, `translations.<lang>` with back-translation, verdict and
note, `languages.<lang>` with verdict counts and a SHA-256 over the texts, `ui.option_labels` and `ui.prompts`
per language.

A run in `de` is entirely German: statement, option labels and instruction. The option codes the model replies
with stay English, so scoring is language-independent. Items judged `wrong` or `uncertain` are not asked in
that language (gate 6); a language with more than 10 % excluded items is marked translation-limited. The
cell key carries the language hash, so a corrected translation never mixes with results of the old one.

Verdicts of the shipped sets (182 items each; "revised" = sent back to a Maker once after a major_shift or
uncertain verdict and re-judged better; "excluded" = still wrong or uncertain after that round):

| lang | name | faithful | minor_shift | major_shift | wrong + uncertain | revised | excluded | hash |
|---|---|---|---|---|---|---|---|---|
| `de` | Deutsch | 174 | 8 | 0 | 0 | 1 | 0 | `0c4bfd8708b6` |
| `zh` | 中文 | 177 | 5 | 0 | 0 | 1 | 0 | `c7cef572610d` |
| `ja` | 日本語 | 172 | 10 | 0 | 0 | 0 | 0 | `e9dcbb25461b` |
| `hi` | हिन्दी | 166 | 16 | 0 | 0 | 1 | 0 | `26e3aa0a53be` |

The three revisions were the German "gender" (`Geschlecht` covers sex and gender, now the loanword `Gender`),
the Chinese "jury nullification" (no settled term; now a descriptive rendering) and the Hindi "spank"
(`पिटाई` reads as a beating; now a light smack). Minor shifts are listed with their notes in the data file.

What a shift between languages measures: the model and the translation together. The back-translations are in
the data file so a critic can tell the two apart; a review of the German set as a diff on that file is welcome.

### Trials and option order

**Trials** repeat the same cell. The headline value uses the per-item majority over trials; each trial is also
scored on its own, and the SD of each axis across trials on the unit scale is the instability (gate 2, default
threshold 0.25). The compass draws the range across trials as a thin dashed whisker next to the solid bootstrap
whisker. With one trial there is no stability figure and every marker carries n=1.

**Option order** is randomised per cell by default: the parity of a hash of model, group and trial decides whether
the scale reads agree-first or disagree-first, so a rerun reproduces it and half the cells of every model see each
order; `no_position` always stays last. The **Response style** card reports the order shift (agree share seen
agree-first minus agree-first seen disagree-first) next to acquiescence, neutral and refusal shares, and, with
trials ≥ 2, the share of items whose answers differed between trials.

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
| 2 | **Instability** across trials above the threshold (default SD 0.25 on the unit scale); needs trials ≥ 2 | marker hollow with the trial range instead of a point |
| 4 | **Convergence**: a model lands in different quadrants on different tests | both markers shown and joined, never averaged |
| 5 | **Cohort size** below 3 | no cohort means, no dashed mean in the ladder |
| 6 | **Translation verdicts**: items judged wrong or uncertain | not asked in that language; above 10 % the language is translation-limited |
| 7 | **Language shift vs. noise**: a shift smaller than the model's own trial noise (needs trials ≥ 2) | drawn grey, not reported as a finding |
| 8 | **PCT scoring** reproduces the website-scored trials | else `scoring: approximate` everywhere |

Gate 3 (extractor batch check) arrives with the open rung.

---

## What the compass cards show

Per test: the website's projection (8values econ × govt, 6axes economic aspiration × akraetia,
SapplyValues right × auth, PCT economic × social) with one marker per model, whiskers for the bootstrap
interval over items, hollow when gate 1 fails; a track per axis with the test's pole labels; a table with
the native values, intervals, answered and refused counts.

The bootstrap resamples the test's statements with replacement (default 1000 draws, seeded per model, test
and rung, so it is reproducible) and takes the 2.5 and 97.5 percentiles. It says how much the dot depends on
which statements the test happens to contain. Repeat-to-repeat noise is the dashed whisker and the SD column,
present only with trials ≥ 2. A selector in the card header switches between the soft and the hard rung.

### Convergence

Economic (left ↔ right) × authority (libertarian ↔ authoritarian) on a common [−1, +1] scale, with the websites'
own signs: 8values `econ` and `govt`, 6axes economic aspiration and akraetia (both inverted, since the sites count
equality and liberty upward), SapplyValues `right` and `auth`, PCT economic and social. One marker per test per
model (circle, square, diamond, triangle), joined into a polygon per model. The tool never averages across
instruments; the 2026 study found PCT and 8values correlate at r = −0.26 across models, and a long polygon is
that finding, not noise to remove.

### Language shift

For the selected rung: a normalised economic × authority compass with one marker per language per model and
test, each joined to its English point, and a heatmap of the distance from English on the unit square (0 is
the same point, 2.83 the opposite corners). A cell turns grey when the distance is below the model's own
trial-to-trial noise, the root sum of squares of the two instabilities; that needs trials ≥ 2, otherwise every
shift is measured but none is judged.

### Error budget

A crossed main-effect decomposition of the normalised axis values over four factors: instrument × axis, model,
rung, language; the residual is trial-to-trial noise plus interactions. Shares are ω² (each factor's sum of squares
minus the noise its degrees of freedom are expected to collect, over the total plus the residual mean square), which
needs repeated cells; without residual degrees of freedom the card falls back to raw η² and says so. Intervals come
from a residual bootstrap: the main-effects fit is kept and its residuals are resampled onto the fitted values,
because resampling whole observations duplicates rows and inflates every main-effect sum of squares. Amber ticks mark the 2026 study's values on 19 models (instrument and
axis 52 %, model 13 %, noise 35 %). With one model the model share is zero by construction; with one trial the
residual holds interactions only. The card says so when that is the case.

---

## Exports

- **JSON** — the whole run: tool version and build, instrument and language hashes, the four prompts and their
  versions, settings, models, totals (calls, cost from `usage`), gates, per model × test × rung scores with
  intervals, per-trial values, instability and normalised axes, response style, convergence, the error budget,
  every cell with its key, order, raw answer, latency and cost, and a `reporting_standard` block in the shape
  the 2026 error-budget study asks for (instrument, asker condition, repetitions, dispersion, variance
  decomposition, option order, contamination check status, item-level results).
- **CSV** — one row per cell including rung, trial and option order, UTF-8 BOM for Excel.

The interpretation caveat travels with both.

---

## Settings

| setting | default | note |
|---|---|---|
| API key | — | memory only; `type=password`; re-enter after reload |
| items per call | 1 | `page` for the websites' pages |
| trials / cell | 1 | repeats of the same cell; 3 for anything you intend to cite |
| languages | en | de, zh, ja, hi opt-in; each multiplies the calls |
| hard rung | off | the website's format, no exit; doubles the calls |
| randomise option order | on | agree-first / disagree-first per cell by hash parity |
| concurrency | 4 | lower it on persistent 429s instead of raising retries |
| max tokens | 200 | page mode raises it per statement automatically |
| retries | 2 | transient errors only (429, 5xx, network, timeout); hard cap 5 |
| reasoning | low effort | dropped automatically if the provider rejects it |
| answer rate ≥ | 60 % | gate 1 |
| bootstrap draws | 1000 | 0 disables the intervals; the error budget uses at most 400 |
| instability ≤ | 0.25 | gate 2, SD across trials on the unit scale |

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
plugins, timeout signal, error surfacing); the retry policy; the pool; the JSON extractor. Since 0.2 also:
option order per cell, the majority over trials, the instability measure on constructed stable and unstable
answers, response style, quadrants, and the variance decomposition on synthetic data with known shares.

The skill's generic `core_test.mjs` is Gemini-specific (continuation protocol, thinking levels) and does not
apply to an OpenRouter-only tool; this harness replaces it.

---

## Known limitations

- **One trial unless you raise it.** A marker at n=1 is a point without a repeat-to-repeat interval; read it
  as a first look, not a finding.
- **Translations were checked by a model, not by native speakers** (German excepted, where the author can read
  the diff). The verdicts say how the back-translation compared, not that a native speaker would phrase the
  item that way. Treat a language shift as a hypothesis about model plus translation until a native speaker
  has read the items that drive it.
- **The error budget is a main-effects decomposition** with ω² correction, not the study's random-effects model
  with cluster bootstrap. It answers the same question at the level of one run; it is not comparable number for
  number, and with one trial it cannot separate noise from interactions at all.
- **The PCT weights are a reconstruction.** They reproduce the website on every trial we could check; the
  website could change its scoring without notice, and the badge would not know. Re-validate against fresh
  website results before citing PCT numbers.
- **Gaps are not what the websites do.** A test taken with refusals is scored on the answered statements,
  which the websites never allow. The refusal count sits next to every value for that reason.
- **The catalog is live and the key is in the page.** Spend-capped keys only.

---

## Building the zip

```
zip -X compass-bench.zip compass-bench.html compass-bench-items.json README.md
```

## Changelog

- **0.3.0** — five languages: de, zh, ja, hi translated once by Maker-Checker sub-agents, verdicts and
  back-translations in the data file, per-language prompts and option labels, language selector on the
  compasses, language-shift compass and heatmap, gates 6 and 7, language as a factor in the error budget, residual
  bootstrap for the shares; files moved into their own directory with a zip for download.
- **0.2.0** — hard rung with its own prompts; trials ≥ 2 with per-trial scoring, instability (gate 2) and
  trial-range whiskers; option-order randomisation per cell; response-style card (acquiescence, order shift,
  trial disagreement); ladder across rungs; convergence compass on normalised axes (gate 4); error-budget card
  with bootstrap intervals; rung selector on the compasses; exports carry all of it.
- **0.1.0** — four instruments embedded and deduplicated; soft rung in English; native scoring with golden
  tests; website-style compasses and tracks with bootstrap intervals; gates 1, 5, 8; live catalog with
  multi-select; single and page modes; estimate before and actual cost after the run; JSON and CSV exports.
