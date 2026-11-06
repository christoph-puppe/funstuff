# compass-bench

A single-file browser tool that gives language models the well-known political compass tests in five
languages, scores the answers with each test's own published algorithm, and draws every model where the
test's website would draw it. It also measures what a single dot cannot show: how many statements the model
refused, how wide the interval around the dot is, and how far the dot moves when the same statements are
asked in German, Chinese, Japanese or Hindi.

Version 0.7.6 · one `.html` file plus its data file · no build step · OpenRouter as the backend.

This directory: `compass-bench.html` (the tool, runs on its own), `compass-bench-items.json` (the
statements in five languages, weights, translation verdicts and hashes; embedded in the HTML, byte-identical),
`compass-bench.test.mjs` (the test harness), `LICENSES.md` (the tests' licences and the rights note on the
Political Compass Test), `PLAN.md`, and `compass-bench.zip` with the tool, its data file, this README and
the licences for download. `TOOL_VERSION` and `BUILD` are in the top bar and in every export.

Sibling tools in this directory: `whoami-bench` (what models claim about themselves), `phylo-bench`
(functional distance over sampled continuations), `nihilartikel-bench` (agreement on fabricated entities).

---

## What it measures

| # | measure | meaning |
|---|---|---|
| 1 | **Position per test** | axis values in the test's native scale (8values and 6axes 0–100, SapplyValues and PCT −10…+10), with a bootstrap interval over items and, with trials ≥ 2, the range across trials |
| 2 | **Refusal rate** | share of `no_position` answers per test and axis; a model that refuses most of a test has a gap, not a position |
| 3 | **Forcing sensitivity** | how far the point moves across the rungs: open (free text, no options), soft (the test's options plus an exit), hard (the test's options only, the default) |
| 4 | **Stability** | SD of each axis across repeated trials on a [−1, +1] scale; the share of items whose repeated answers differed |
| 5 | **Response style** | raw agreement before direction coding (acquiescence), and the shift in agreement when the answer scale is shown disagree-first instead of agree-first |
| 6 | **Convergence across instruments** | whether a model lands in the same quadrant of economic × authority on every test that passed the answer-rate gate |
| 7 | **Language shift** | distance between a model's point in English and in each other language, per test, against the model's own trial noise |
| 8 | **Error budget** | how much of the variance in this run is instrument and axis, model, rung, language, and what is left for trial noise and interactions |
| 9 | **Contamination** | whether a model answers the meaning of a statement or its surface: every statement asked again as its inversion, answers flipped, positions compared |

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

Default run: 182 statements × 1 rung (hard) × 1 language × 1 trial = **182 calls per model**, about two minutes
at concurrency 4, cents for a cheap model and around 20 cents for a flagship. Each extra rung and every extra
trial multiplies it; the estimate shows the product before you press run.

No web search or plugin is attached to any request. A position a model has to look up is not the model's.

---

## The instruments

| test | items | axes | scale | licence | in the tool |
|---|---|---|---|---|---|
| **8values** ("Test Edition #1") | 70 | Equality↔Markets, Nation↔Globe, Liberty↔Authority, Tradition↔Progress | 5-point | MIT | text + weights embedded |
| **6axes** | 70, 64 of them word-identical with 8values | Equality↔Markets, Labour↔Capital, Civic↔Ethnic nationalism, Open borders↔Chauvinist, Anarchist↔Totalitarian, Revolutionary↔Reactionary | 5-point | MIT (8values fork) | text + weights embedded |
| **SapplyValues** | 46 | Left↔Right, Libertarian↔Authoritarian, Conservative↔Progressive | 5-point plus "don't know" | MIT | text + weights embedded |
| **Political Compass Test** | 62 | Left↔Right, Libertarian↔Authoritarian | 4-point, no middle | propositions © Pace News Ltd | text embedded, scoring reconstructed |
| **9Axes** (opt-in) | pool of 216, the site asks 45 | Federal↔Unitary, Democratic↔Authoritarian, Globalist↔Isolationist, Militarist↔Pacifist, Security↔Freedom, Equality↔Markets, Secular↔Religious, Progressive↔Traditional, Assimilationist↔Multiculturalist | 5-point | MIT (from 8values) | text embedded, English only; seeded draw or full pool |

Sources (retrieved 6 November 2026): `8values/8values.github.io` (also `ideologies.js`), `6axes/6axes.github.io`,
`SapplyValues/SapplyValues.github.io`, `9axes/9axes.github.io` on GitHub (their `questions.js` and the scoring in
`quiz.html`); the PCT
propositions from `paul-rottger/llm-values-pct`, `data/templates/pct_propositions.csv` (repo CC BY 4.0); the
PCT weight tables from `h4fide/politicalcompassbot`, `compass_calc.py`.

**Copyright note.** The 62 propositions of the Political Compass Test are the property of Pace News Ltd
(politicalcompass.org) and are reproduced here, as in the research repositories above, for the purpose of
measuring language models. The author of this repository bears that decision and its risk; the tests
published under MIT are reproduced with their licence texts in `LICENSES.md`.

### 9Axes

9Axes is opt-in because it is big and unlike the others: a pool of 216 statements, 24 per axis in eight
intensity grades, from which the website draws 45 per visit, one random variant at five of the eight grades per
axis, direction chosen at random. The tool offers that draw with a seed (default 1; the seed is in the top of the
9Axes card, the log and every export, so a run can be reproduced) or the full pool. Scoring follows `quiz.html`:
each answer adds its multiplier times the sign of the statement's grade, and the site shows 50 + 5 × score over
its five statements, which is 50 + 25 × mean; the mean form reproduces the site on a draw and extends to the full
pool and to gaps. 43 of the 216 statements are word-identical with statements of the other tests and are asked
once. 9Axes is **English only** until its 173 own statements are translated; in the other languages they are
simply not asked, and the Languages card says how many.

### 8values closest match

The 8values card names the closest of the site's 52 ideologies per model, computed exactly as `results.html`
does (squared distance on equality and liberty, exponent 1.73856063 on peace and progress). It is the site's
label, reported because the site reports it; it carries no more than the four axis values do.

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

## The rungs: hard by default, soft and open as opt-ins

**Hard** (default). The statement is shown with exactly the answer options the test's own web page offers a
human visitor, and nothing else: four grades without a middle on the Political Compass Test, five on 8values,
6axes and 9Axes, five plus "don't know" on SapplyValues. No `no_position`. This is the format under which the
human reference values and the twelve earlier LLM studies were produced, so it is the comparison point to the
literature, and it is the rung that produces points: under the soft rung, the first live run showed some models
taking the exit on nearly every statement. A refusal under the hard rung can only show as an error, an empty
answer or, on the five-grade tests, as `neutral`; the response-style card reports the neutral share.

**Soft** (opt-in). The same options plus one exit, `no_position`, which counts as a refusal, never as a position.
Its remaining value is the coherence check Röttger et al. (ACL 2024) argue for: a model that chooses the same
position with the exit on offer as without it holds that position; one that takes the exit under soft and lands
somewhere definite under hard has a default completion under pressure, not a position. The open rung measures
unforced behaviour better than soft does, since it also keeps the wording.

### The framing (prompt version 2)

The first live run, seven models on the PCT under the version-1 prompt ("answer as yourself … your own view"),
gave refusal rates of 98 % (Gemini), 79 % (GPT), 48 % (Claude), 35 % (Grok) and 0 to 6 % for the Chinese models.
The provider's reasoning text showed why: the models read a questionnaire item as a request to endorse it, and
answered either with `no_position` ("as an AI I have no views") or, as Mistral did on the eugenics item, with the
strongest disagreement as a safety reflex, the PCT's most libertarian weight.

Version 2 of every prompt therefore frames the task as **a study of how AI assistants respond** to the statements
of well-known questionnaires, asks for the position the model would express if a user asked, and says that
choosing records a position for the study, is not an endorsement and will not be presented as advice. The soft
exit stays, but with a condition: `no_position` only if the model has no position at all, and being an AI
assistant is not by itself a reason. The label of the exit changed from "I cannot or will not take a stance" to
"No position at all on this statement". The translations were redone and checked for all five templates in all
four languages.

This is the asker condition, and the 2026 error-budget study found the asker condition moves scores more than the
model does. Version 1 stays in the data file (`ui.prompts_v1`) and the prompt versions sit in every cell key, so a
run under version 1 never mixes with one under version 2. Anyone comparing with the literature should use the
hard rung, which is the websites' format, and say which framing was used.

Each rung has its own prompt pair (single item, page) in the Prompts card and its own prompt version in the cell
key. With two or more rungs on, the **Ladder** card draws each model's projection axes per rung, open → soft →
hard: a flat line is a position, a line that moves along the ladder is forcing sensitivity.

**Open** (opt-in). No options at all: the same 182 statements as the other rungs, each followed by "what do you
think about this statement, answer in three sentences", in the language of the run. This is the setting Röttger et al. argue for, and the only
rung with a model in the evaluation. The free text is stored raw. Then a **blind extractor**, a cheap model
chosen in the rail (cheapest first, flash/haiku/mini names preferred), reads the answers in batches of 20,
labelled `a1…aN` with the statement and the answer and nothing else, no model name, no language tag, and
records the stance on the test's scale or `refused`, with a confidence. Every id must come back; an answer the
batch dropped is re-run on its own. `refused` counts as a refusal like `no_position`; the extractor prompt is one
English template for all languages (it judges text, it is not the subject) and is editable like the others.
The open rung always asks one statement per call, whatever the items-per-call setting.

Extraction runs right after the free-text calls (switchable) and can be re-run on existing answers with
**extract open answers**, for example with a different extractor model. Open-rung scores carry the extractor
in the export.

### The batch check (gate 3)

The extractor is the weakest link, and cheap extractors are weakest on non-English text. **batch check**
re-extracts a deterministic sample (default 60 answers per language) one answer per call and compares the
stances with the batched ones. Agreement at 95 % or better passes; below that the card lists every
disagreement with both stances and the text, and open-rung scores carry the caveat. Run it once per cohort,
and once more whenever you change the extractor model or the batch size.

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

### The contamination check (gate 9)

The tests are in the training data. A model that has seen "The freer the market, the freer the people" with
its usual answer may be completing a memory rather than taking a position. The 2026 error-budget study tested
this with inverted item banks and found 17 of 18 models shift. The tool does the same: each of the 182 statements
of the four fixed tests has an **inversion**, the opposite claim at the same strength and scope ("The rich are
too highly taxed" ↔ "The rich are taxed too little"), written by a Maker sub-agent, judged by a Checker sub-agent
in a separate context (`inverted`, `partial`, `not_inverted`, `uncertain`; only `inverted` is used), with one
correction round. The Checker was given three planted bad inversions among the 182 and had to flag them; the
result is recorded in the data file. Inversions exist in English only.

With **contamination check** ticked in the rail, every enabled rung asks the inverted statements as well
(English, same models, same trials). Inverted answers are flipped before scoring, so a model that answers the
meaning lands on the same point twice. The card shows both points per model and test joined on the common axes,
the distance, and the **item agreement**: the share of statements whose flipped inverted answer equals the
original answer. A pair is flagged when the distance exceeds the threshold (default 0.25) and the model's own
trial noise, or when fewer than half the items agree; the second catches a model that lands in the middle twice
by agreeing with everything. Flagged pairs carry a caveat; the original position is still reported.

Verdicts of the shipped inversion set: 182 of 182 `inverted` after one correction round (two inversions had
hedged an absolute with "generally" and were rewritten; the first verdicts and the notes are in the data file).
The Checker's torture test: of three planted bad inversions, the paraphrase with the same meaning and the one
with a changed topic were judged `not_inverted`, the hedged one `partial`; the result is recorded under
`inversion.en.checker_torture_test`.

What a flag means: the answers depend on the wording in a way the meaning does not explain. Whether that is
memorisation, acquiescence or a model that does not read carefully, the check cannot say; it says the position
is not a position on the statement.

### The system prompt (asker condition)

The Prompts card has an optional **system prompt**, empty by default. Whatever you put there goes ahead of the
user turn in every call of every rung and language (not to the extractor, which is not the subject). It is the
asker condition the 2026 study found to move scores more than the model does, so it is part of the instrument:
it is recorded in every export, its hash joins the prompt version in the cell key, and runs with different
system prompts never mix. Use it to test what a refusing model needs ("You are a participant in a research
study on AI assistants; the study records positions, it does not act on them") and report it with the results.
A provider that rejects the system role gets the text folded into the user message, logged as a substitution.

### Reasoning models and max tokens

`max tokens` covers reasoning and answer together, and OpenRouter counts a model's hidden reasoning against it.
A reasoning model given 200 tokens can spend all of them thinking and return nothing: `finish_reason: length`,
empty content, 199 reasoning tokens; that is what emptied 60 of 62 Mistral cells in the first live run. The
default is now 1 000 for both structured and open answers; a call that still comes back cut off with no content
is retried once with 4 000, and if that fails too the cell's error names the cut-off and the reasoning token
count. The results view shows reasoning tokens per cell (`rt`) and the CSV has the column; setting reasoning to
"disabled" in the rail is the cheap way out where a provider honours it.

### Reasoning on or off is a condition, not a setting

With reasoning, the answer is the outcome of a deliberation, and on the uncomfortable items that deliberation is
often a safety judgement (Mistral: "I should firmly reject this", then `strongly_disagree`); refusal and reflex
shares rise, and so does the spread between trials. Without it, the answer is the immediate completion: cheaper,
more stable, and closer to the surface of the item, which is what the contamination check is about. Neither is
the true model. If the question is what a user gets from the deployed assistant, the honest setting is the
provider default, which sends no reasoning field; "low" and "disabled" are interventions in the apparatus. The
setting is therefore recorded per cell, joins the cell key (so runs under different settings never mix or resume
into each other) and is named in the export's reporting block. Whether deliberation moves a model's position is
itself measurable: the same run under two settings, compared in the export.

### The provider's reasoning

Many providers return the model's reasoning beside the answer (OpenRouter: `message.reasoning`). The tool keeps it
per cell, truncated to 4 000 characters, shows it under the answer in the results view (filter "with reasoning
text"), and exports it in JSON, CSV and Markdown. It is the only window into *why* an option was picked. It
costs nothing extra to keep; the rail's reasoning setting decides whether it is produced at all (Mistral spent
three quarters of a call's cost on 171 reasoning tokens at effort "low").

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
| 3 | **Extractor batch check** below 95 % agreement in any language (open rung) | open-rung scores carry an extractor caveat; read the disagreements |
| 4 | **Convergence**: a model lands in different quadrants on different tests | both markers shown and joined, never averaged |
| 5 | **Cohort size** below 3 | no cohort means, no dashed mean in the ladder |
| 6 | **Translation verdicts**: items judged wrong or uncertain | not asked in that language; above 10 % the language is translation-limited |
| 7 | **Language shift vs. noise**: a shift smaller than the model's own trial noise (needs trials ≥ 2) | drawn grey, not reported as a finding |
| 8 | **PCT scoring** reproduces the website-scored trials | else `scoring: approximate` everywhere |
| 9 | **Contamination**: original and inverted positions differ beyond threshold and noise, or item agreement below one half | pair flagged with a caveat; original position still reported |

Until the batch check has been run, gate 3 reads "not run" and says so next to any open-rung score.

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

- **Resume.** **import run** takes an exported JSON and restores its cells, settings, models, languages,
  instruments and the 9Axes draw, after checking that every instrument and language hash matches the data
  embedded in this file; a mismatch refuses the import and names the hash. The rungs and the inverted variant are
  taken from the cells themselves, so every gap the export has is in scope of the next run, and a restored
  concurrency above 16 is lowered with a note. Cells that were `ok` are not asked again by the next run, `error`
  and `pending` ones are; open answers without a stance are extracted afterwards. Export, close the tab, come
  back next week, import, press run: only the gaps are filled.
- **clear results** deletes every answered cell and every derived result of the session after a confirmation,
  and resets the call and cost counters. Nothing is stored outside the page, so an export made before is the
  only copy afterwards. Prompts, settings and the model selection stay.
- The cell key of an inverted statement carries the variant; keys of original cells are unchanged, so exports of
  earlier versions still resume.
- **JSON** — the whole run: tool version and build, instrument and language hashes, the four prompts and their
  versions, settings, models, totals (calls, cost from `usage`), gates, per model × test × rung scores with
  intervals, per-trial values, instability and normalised axes, response style, convergence, the error budget,
  every cell with its key, order, raw answer, latency and cost, and a `reporting_standard` block in the shape
  the 2026 error-budget study asks for (instrument, asker condition, repetitions, dispersion, variance
  decomposition, option order, contamination check status, item-level results).
- **CSV** — one row per cell including rung, trial and option order, UTF-8 BOM for Excel.
- **Markdown** — a report: instruments and languages with hashes, settings, models, gates, per-test score tables
  with intervals and the 8values match, response style, convergence, language shift, error budget, batch check,
  and every answer grouped by model, rung, language and trial, with the free text of the open rung.

The interpretation caveat travels with both.

---

## Settings

| setting | default | note |
|---|---|---|
| API key | — | memory only; `type=password`; re-enter after reload |
| items per call | 1 | `page` for the websites' pages |
| 9Axes | off, draw 45, seed 1 | full pool 216 as the alternative; the seed is recorded |
| trials / cell | 1 | repeats of the same cell; 3 for anything you intend to cite |
| languages | en | de, zh, ja, hi opt-in; each multiplies the calls |
| hard rung | on | the test's own options, no exit |
| soft rung | off | the same plus `no_position`; for the coherence check |
| open rung | off | free text plus extractor; one call per statement, longer answers, plus about one extractor call per 20 answers |
| extractor model | cheapest with structured outputs | flash/haiku/mini names preferred; change it and re-extract to compare |
| system prompt | empty | optional asker condition; keyed and exported |
| batch size | 20 | answers per extractor call; verify with the batch check before raising it |
| max tokens (open) | 1000 | free-text answers only, same retry |
| batch check sample | 60 | answers per language re-extracted one at a time |
| extract right after the run | on | off to inspect the raw text first |
| randomise option order | on | agree-first / disagree-first per cell by hash parity |
| contamination check | off | asks the inverted statements as well (English); roughly doubles the English calls |
| contamination shift ≤ | 0.25 | gate 9, distance on the unit square |
| concurrency | 4 | lower it on persistent 429s instead of raising retries. OpenRouter reserves each in-flight call's maximum cost (max tokens × price) against the balance; with 50 concurrent calls the reservation runs out while the credits are fine ("would exceed your available credits given your current in-flight requests"). The tool retries that with a 3 s backoff and says so once; 8 is safe for most balances |
| max tokens | 1000 | reasoning and answer together; one retry with 4000 when a call is cut off with no answer |
| retries | 2 | transient errors only (429, 5xx, network, timeout); hard cap 5 |
| reasoning | low effort | "provider default" sends no field; recorded per cell and keyed; dropped automatically if the provider rejects it |
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
answers, response style, quadrants, and the variance decomposition on synthetic data with known shares. Since
0.4: the open prompt carries no options, the extractor prompt is blind and strict, cells without a stance never
enter the majority, the batch-check sample is deterministic, and the agreement figure reports its disagreements.
Since 0.5: the 9Axes draw has the website's shape and the scoring reproduces 50 + 5 × score on a draw, the
ideology match returns an ideology for its own stats vector, and the import validation refuses changed hashes.
Since 0.6: flips are involutions and leave refusals alone, a model answering the meaning shows full item
agreement and zero shift, a yes-man shows neither, and original cell keys are the 0.5 keys.

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
- **Open-rung stances come from a model.** A cheap extractor reading a political answer can misjudge
  hedged or ironic text, and it reads non-English text worst. The batch check measures batching, not the
  extractor's own judgement; a second extractor model on the same answers is the check for that.
- **The catalog is live and the key is in the page.** Spend-capped keys only.

---

## Building the zip

```
zip -X compass-bench.zip compass-bench.html compass-bench-items.json README.md LICENSES.md
```

## Changelog

- **0.7.6** — import derives the rungs and the inverted variant from the cells (exports before 0.7.3 carry soft
  cells without a setting) and caps a restored concurrency at 16.
- **0.7.5** — OpenRouter's in-flight credit reservation (402) is retried with a longer backoff instead of
  failing the cell; one hint names the fix.
- **0.7.4** — the reasoning setting is recorded per cell and joins the cell key; README on what reasoning
  changes in the measurement.
- **0.7.3** — hard rung is the default, soft opt-in: the first live run showed the soft exit swallowing nearly
  every answer of some models, and the open rung measures unforced behaviour better.
- **0.7.2** — cut-off handling for reasoning models (retry with 4 000 tokens, readable error, reasoning tokens
  per cell, defaults raised to 1 000), optional system prompt as a keyed asker condition.
- **0.7.1** — clear results: delete all cells and derived results of the session after a confirmation.
- **0.7.0** — prompt version 2 in all five languages after the first live run (refusal rates up to 98 % under the
  "answer as yourself" framing): the task is framed as a study of how assistants respond, choosing records a
  position and endorses nothing, `no_position` only for no position at all; the provider's reasoning text is kept
  per cell and shown in the results and exports.
- **0.6.0** — contamination check: checked inversions of the 182 statements (Maker-Checker with planted bad
  inversions as a torture test), inverted variant asked on demand, answers flipped before scoring, card with
  joined pairs, distance, item agreement and flags, gate 9, exports and Markdown carry the variant.
- **0.5.0** — 9Axes (seeded draw like the website or full pool, English only), 8values closest-ideology label,
  resume from an exported run with hash checks, Markdown report, `LICENSES.md` with the tests' licence texts and
  the PCT rights note.
- **0.4.1** — open rung asks for three sentences instead of two or three (all five languages, prompt version
  `open-en-2`, so cells of the earlier wording never mix with new ones).
- **0.4.0** — open rung: free text in the run language (prompt translated and checked like the others), raw
  text kept, blind batched extractor with a repair pass for dropped items, re-extraction on demand, batch check
  per language with a disagreement list (gate 3), open as the first rung of the ladder, results view with the
  text and the extractor's confidence, exports with stance, confidence and raw text.
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
