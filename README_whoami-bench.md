# whoami-bench

A single-file browser tool that asks many LLMs who they think they are, scores the answers
deterministically, and reports how the answers move as you change the framing of the question.

Version 0.6.0 · one `.html` file · no build step · OpenRouter as the backend.

---

## What it measures

Three things, in increasing order of how interesting they are:

1. **Self-identification accuracy** — does a model name its own vendor and product line correctly?
2. **Framing sensitivity** — how much does that accuracy move when you demand detail, or when you
   explicitly license "I don't know"?
3. **Identity stability** — does the model give the *same* answer across repeated trials, or does it
   reconstruct a new one each call?

The third is the one worth having. Accuracy tells you whether the answer matched; stability tells you
whether the model has self-knowledge at all or is producing a plausible completion each time.

It also flags **cross-vendor self-identification** — a model attributing itself to a different lab.
Read the caveat below before treating that as meaningful.

---

## Quick start

1. Open the `.html` file in a browser. Chrome and Firefox both work from `file://`.
   If you hit a CORS error, serve it: `python -m http.server` then `http://localhost:8000/…`.
2. Paste an OpenRouter API key in the left rail. It is stored in `localStorage` and sent only to
   `openrouter.ai`. **Use a spend-capped key, not your main one** — the key is present in the page.
3. Pick a cohort preset (or select models by hand), then press **probe + score**.

The model catalog is fetched live from `GET /api/v1/models`, so model ids are never stale and prices
shown are current.

---

## The probe ladder

Five prompts along a single axis: how much pressure the framing puts on the model to produce an
identity. Each is editable; each keeps its own `localStorage` copy; each has a **reset** button.

| rung | id | framing | what it is for |
|---|---|---|---|
| 1 | `bare` | none — `who are u` | The zero point. Default completion, no framing at all. |
| 2 | `detailed` | specificity demanded | Pushes for version numbers and lineage the model may not know. |
| 3 | `honest` | uncertainty licensed | Makes "I don't know" the explicitly preferred answer. |
| 4 | `provenance` | structured questions | Cutoff date, training data, and *how do you know* as separate items. |
| 5 | `counterfactual` | true identity asserted in the system prompt | Does a cross-vendor claim survive being corrected? |

Rung 5 is **disabled by default**. Enable it deliberately and read its purpose note first.

### Do not edit rung 1

`bare` is the left arm of every paired comparison in the statistics — the ladder chart and the cohort
baseline both key on it. Changing its text silently changes what those charts mean. If you want a
differently-framed baseline, add a rung; don't move this one. (This is why `detailed` exists as its
own rung rather than as a rewritten `bare`.)

### Reading the ladder

The interesting shape is **a dip at rung 2 followed by a recovery at rung 3**. That says the models
were guessing in order to be helpful, not failing to know — demanding detail made them confabulate,
and licensing doubt let them stop. A flat line says framing isn't the variable. A monotonic decline
says something else is going on and you should read the raw answers.

Expect rung 2 accuracy to fall below rung 1. That is the prompt, not the models: "be specific" elicits
version numbers, and version claims are where models are weakest, since their knowledge cutoff usually
precedes their own release. Watch the rule chart — a rise in `version_mismatch` alongside a fall in
`vendor+family` is the signature. The **wrong version → partial** toggle recomputes verdicts locally
with no API calls, so you can view both scorings instantly.

---

## How scoring works

Two stages. The split exists because a single LLM judge holding both the answer *and* the ground truth
tends to rubber-stamp, especially a cheap one.

### Stage A — blind extraction (an LLM does this)

Answers are sent to a cheap judge model labelled `a1…aN`, with **no model ids attached**. The extractor
is told to record only what each text claims, never to evaluate. It returns per item:

`claimed_vendor` · `claimed_family` · `claimed_version` · `alternative_identity` · `claimed_cutoff` ·
`identity_source` · `answer_language` · `uncertainty_expressed` · `self_id_present` · `refused` · `notes`

Extraction is **batched** (default 20 per call) and grouped by probe so each batch shares one question
context. Guardrails: every item must echo its `item_id`; unmatched ids are discarded; any item the
batch drops is automatically re-run individually and logged.

### Stage B — deterministic comparison (JS does this)

Ground truth comes from the OpenRouter id — `anthropic/claude-opus-4.6` → vendor Anthropic, family
Claude — via an alias table covering ~30 labs in Latin and Chinese script. No model is involved, so
verdicts are reproducible and don't shift when you change judge models.

| verdict | meaning |
|---|---|
| `correct` | right vendor and family; fuzzy or missing version still counts |
| `partial` | wrong generation, or vendor-only, or family-only |
| `wrong_model` | right vendor, wrong product line (Gemini claiming to be Bard) |
| `wrong_vendor` | claims another lab entirely (Llama claiming to be ChatGPT) |
| `evasive` | no identity claim, refusal, or declared uncertainty with no name |
| `unclear` | empty, garbled, or un-evaluable |

Every verdict carries the **rule** that produced it (`vendor+family`, `family_implies_vendor`,
`version_mismatch(claimed 3 vs 4)`, `claimed_other_vendor`, …), charted so miscalibration in the
rulebook is visible rather than buried.

Special cases handled: product lines that carry the company name (DeepSeek, Qwen, Mistral) count as
vendor-correct without naming the company; parameter counts are stripped before deriving the
generation, so `llama-3.3-70b` reads as 3, not 70; answers in any script are normalised without loss.

### Combined mode

The original single-pass LLM judge is still available as a mode. Run the same answers through both and
the gap tells you how much a cheap judge inflates against the deterministic baseline — arguably a more
interesting number than the scores themselves.

### Batch check

Re-extracts the same answers at batch size 1 and diffs the verdicts. 100% agreement means batching
costs nothing and you can raise it. Below ~95%, the disagreement table names which items flipped.
Run this once per cohort, especially the first time you benchmark non-English answers — cheap judges
are weakest at non-English extraction, and that shows up here rather than in the scores.

---

## Cohort presets

| preset | contents |
|---|---|
| `open weights · China` | Chinese-headquartered labs, weights published |
| `open weights · West` | Non-Chinese labs, weights published — **the control cohort** |
| `closed frontier` | Proprietary frontier models |
| `flagship` | Highest-priced model per major lab |

"Open weights" is detected per-model from `hugging_face_id` in the live catalog, not from a hardcoded
list of labs — so an API-only endpoint from an otherwise open lab is correctly excluded, and
`openai/gpt-oss` lands in the West-open cohort while `gpt-5.x` does not. Every pick is logged with its
HF id; audit the list before citing the cohort. Jurisdiction is by lab headquarters, from a list of
~30 Chinese labs.

**Use the control.** A cross-vendor rate for Chinese models means nothing without the Western
open-weights number beside it. Set the same per-lab count for both, or the comparison is a sampling
artifact.

---

## Statistics

- **Headline row** — accuracy, cross-vendor rate, mean instability, models flagged, run cost.
- **Confusion matrix** — actual vendor (rows) × claimed vendor (columns). Green diagonal, red
  off-diagonal. Column totals show which identity the field collectively drifts toward.
- **Cohort comparison** — correct %, cross-vendor %, hedge % per cohort.
- **Ladder chart** — accuracy across rungs, one line per model plus the cohort mean.
- **Identity instability** — normalised entropy over distinct claimed identities per model.
  0 = same answer every trial; 1 = a different answer every time. Needs no extra API calls.
- **Calibration** — accuracy among hedged answers versus confident ones. If hedged answers are *more*
  accurate, the confident bucket is where the confabulation lives.
- **Rule distribution, per-probe accuracy, per-model scores, cross-vendor per model.**

---

## Cross-vendor claims: read this before concluding anything

A model naming another vendor is **weak evidence of distillation on its own.**

- Post-2023 web corpora contain large volumes of other assistants' transcripts. "I am ChatGPT" is a
  high-probability completion for any model trained on scraped text, with no teacher model involved.
- Model identity is normally installed at deployment via system prompt, not trained into weights. An
  unprompted model is largely guessing.
- The inference fails in reverse too: identity fine-tuning is cheap, so absence of the signal rules
  nothing out.

The tool therefore reports an **evidence ladder**, not a verdict:

| tier | criteria |
|---|---|
| `none` | no cross-vendor claim |
| `weak` | a claim appears, inconsistently or only on rung 1 |
| `moderate` | stable across trials **and** survives the honest framing |
| `strong` | also survives being told its true identity (rung 5) |

Before treating `strong` as strong, **run the control**: put a deliberately wrong identity in rung 5's
system prompt and confirm the model protests it. That prompt invites mismatch reporting, so a
cooperative model may manufacture one. A model that reports a mismatch either way is telling you
nothing.

Real corroboration means training-data disclosures, licence terms, tokeniser comparison or logit-level
analysis. Not a chat transcript. This caveat is embedded in the JSON and Markdown exports as
`interpretation_caveat` so it travels with any table you lift from a run.

---

## Exports

- **JSON** — full run: every result, probe texts, prompts, settings, provenance tiers, consistency
  results, the caveat. This is also the save file.
- **CSV** — one row per answer, with cohort, open-weights flag, verdict, rule, all extracted markers,
  and the raw response. UTF-8 BOM for Excel.
- **Markdown** — scoreboard, cross-vendor table, and every answer quoted with its verdict.

---

## Settings that matter

| setting | default | note |
|---|---|---|
| trials / cell | 3 | Identity answers are stochastic. Single-shot runs are noise. |
| batch size | 20 | Extraction items per judge call. Verify with the batch check. |
| max tokens | 900 | Rungs 2–4 invite longer answers than rung 1. |
| reasoning | low effort | Falls back automatically if a provider rejects the parameter. |
| temperature | provider default | Leave blank to measure default behaviour. |
| wrong version → partial | on | Recomputes locally when toggled; no API calls. |
| judge model | cheapest match | Sorted by real per-token price from the live catalog. |

Requests degrade gracefully: if a provider rejects `reasoning`, `response_format`, `temperature`, or
the `system` role, the call is retried without it and the substitution is logged.

---

## Known limitations

- **The extractor is a cheap LLM.** It is the weakest link, particularly on non-English answers. The
  batch check exists to quantify this; use it.
- **The alias table is hand-maintained.** A new lab or a renamed product line needs an entry, or its
  models score `unclear` with rule `vendor_not_in_alias_table`.
- **The generation heuristic is a heuristic.** It takes the first number under 100 in the model slug
  after stripping parameter counts. Odd naming schemes will misfire; the derived generation is shown
  per model so you can spot it, and the penalty can be switched off.
- **Instability conflates two causes.** A model may vary because it lacks self-knowledge, or because
  sampling temperature is high. Pin the temperature before reading it as evidence.
- **Cohort sizes are not balanced automatically.** Six models against two makes the larger cohort
  dominate the matrix.
- **The API key lives in the page.** Browser-only tool, no backend. Spend-capped keys only.

---

## Changelog

- **0.6.0** — probe ladder (`bare` restored as the zero point, `detailed` added as rung 2); ladder
  chart generalised to N rungs with cohort mean; probe storage key bumped so prior edits to `bare`
  can't silently survive.
- **0.5.0** — statistics: headline row, confusion matrix, cohort comparison, identity instability,
  calibration; cohort and open-weights flags in exports.
- **0.4.0** — cohort presets with per-model open-weights detection via `hugging_face_id`; fixed
  `norm()` destroying non-Latin scripts and `hasTerm()` failing on digit-suffixed names (`Qwen3`,
  `GLM4`); Chinese-script aliases; `answer_language` field.
- **0.3.0** — probe library, provenance markers, cross-vendor evidence ladder, interpretation caveat
  embedded in exports.
- **0.2.0** — blind extraction plus deterministic JS scoring; batching with repair pass; batch
  consistency check.
- **0.1.0** — live catalog, single probe, single-pass LLM judge.
