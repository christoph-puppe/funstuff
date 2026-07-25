# nihilartikel-bench

A single-file browser tool that asks many LLMs about technical entities which do not exist, records
what they invent, and reports which pairs of models invent the *same thing* more often than the
cohort baseline explains.

Version 0.1.0 · one `.html` file · no build step · OpenRouter as the backend.

The file is `nihilartikel-bench.html` — unversioned, so it has a stable path in git. `TOOL_VERSION`
and `RULEBOOK_VERSION` live in the page (top bar) and in every export.

Sibling tools in this directory: `whoami-bench` (what models claim about themselves) and
`phylo-bench` (functional distance over sampled continuations). See **Which tool answers what** at
the end.

---

## The name

A *Nihilartikel* is a fictitious entry planted in a dictionary or encyclopedia; cartographers call
their version a trap street. The entry has no purpose except to be copied. If it turns up in a
competitor's product, the competitor did not do their own surveying.

This tool builds trap streets for language models. It generates technical entities that do not
exist — a CLI flag, a CVE id, a library function, a paper title — and asks a loaded question that
presupposes each one is real. A model with no knowledge of the entity either says so or invents an
answer. The inventions are the measurement.

---

## What it measures

1. **Denial rate** — how often a model says the entity does not exist rather than inventing a value
   for it. This is a resistance-to-presupposition score and is interesting on its own.
2. **Pairwise agreement on inventions** — among items where two models both invented something, how
   often did they invent a *matching* value.
3. **Excess agreement over the cohort** — the same figure expressed as a z-score against the
   distribution of all eligible pairs in the run.

Only the third is evidence of anything. Two models agreeing on facts is expected; they read the same
internet. Two models agreeing on the same fabrications, more than their peers do, is a signal about
shared ancestry.

---

## Quick start

1. Open `nihilartikel-bench.html` in a browser. Works from `file://` in Chrome and Firefox.
   On a CORS error: `python -m http.server`, then `http://localhost:8000/…`.
2. Paste an OpenRouter key in the left rail. It is stored in `localStorage` and sent only to
   `openrouter.ai`. **Use a spend-capped key, not your main one** — the key is present in the page.
3. Edit the cohort. Put suspected teachers and suspected students in the *same* run; the statistic is
   relative to the cohort, so a cohort of one family measures nothing.
4. Press **Generate items**, read them, delete any that look like they might name something real.
5. Press **Run benchmark**. Read the **Agreement matrix** card, not the scoreboard.

Cost scale: 31 models × 30 items ≈ 930 probe calls plus one extraction call each, low single-digit
euros with a flash-class extractor.

---

## Pipeline

Three stages, deliberately separated so that a failure can be attributed to one of them.

### Stage 1 — probes (the cohort models)

One call per (model, item). **Temperature 0, one trial per item.** The mode of the distribution is
the fingerprint here; sampling spread is noise that would blur the very agreement being measured.

> **Do not copy the sampling settings from `phylo-bench`.** That tool requires temperature ≥ 1
> because its estimator *is* the allele distribution. This tool requires temperature 0 because its
> estimator is the single most likely fabrication. The two instruments have opposite requirements and
> runs are not comparable across them. Temperature belongs to the instrument, not to a shared
> settings panel.

### Stage 2 — blind extraction (a cheap LLM)

Each answer goes to an extractor model that classifies the stance and pulls the atomic value. The
extractor **never sees which model produced the text**, so it cannot rubber-stamp a family it
recognises. It does not know the right answer either; there is no right answer.

| stance | meaning |
|---|---|
| `answered` | a concrete value was supplied. The value is extracted verbatim, shortest form. |
| `denied` | the reply states the entity does not exist or cannot be confirmed. |
| `refused` | declined on policy or capability grounds, without denying existence. |
| `unclear` | none of the above fits. |

`hedged` is recorded separately: a reply that doubts the entity and then answers anyway is
`answered` with `hedged: true`, because it still produced a fabrication.

### Stage 3 — deterministic scoring (JavaScript)

Normalisation, allele matching, pairwise agreement, cohort mean and standard deviation, z-scores.
No model involved. `RULEBOOK_VERSION` is stamped separately from `TOOL_VERSION` and bumps on its own,
so a scoring fix does not pretend to be a new tool.

### Re-scoring without paying twice

**Load export…** then **Re-score** applies the current rulebook to a saved run with zero API calls.
This exists because the predecessor tool shipped with an alias table that silently misscored two
whole vendors, and finding that cost a full re-run. If a rulebook bug turns up here, fixing it costs
thirty seconds.

---

## Unscoreable is a verdict

Empty completions (including reasoning-only responses where the provider returned a trace and no
content), API errors, and extraction failures are recorded as `unscoreable` with a reason code, are
excluded from every rate, and are displayed as their own count.

They are never folded into `unclear`. In the predecessor tool, a missing alias-table entry and
genuine model confusion landed in the same bucket, which hid a vendor's cross-vendor claims for an
entire article draft. Reason codes currently emitted: `not_dispatched`, `api_error`, `empty_content`,
`empty_content_reasoning_only`, `extraction_failed`, `no_extraction`, `answered_without_value`.

---

## Item generation

Items are procedurally generated from a seeded PRNG, so a given seed reproduces a given item set
byte-for-byte. Six categories:

| category | shape | answer entropy |
|---|---|---|
| `cli_flag` | default value of a nonexistent flag on a real tool | high |
| `cve_product` | which product a nonexistent CVE id affects | medium |
| `api_param` | first parameter of a nonexistent library function | high |
| `paper_author` | first author of a nonexistent paper at a real venue | high |
| `config_default` | default of a nonexistent config key in real software | high |
| `http_header` | which company introduced a nonexistent header | medium |

**Entropy is the property that matters.** A question whose plausible answers number in the thousands
makes agreement meaningful; a question with four plausible answers produces agreement by chance. The
medium-entropy categories are included because they are realistic, not because they are strong. Every
item's distinct-value count across the cohort is in the export, so you can weigh categories yourself.

### Burn your items

Once an item set is published it enters the next crawl, and future models will have learned your fake
entities from your own benchmark. Generate a fresh seed per run and never reuse a set you have
shown anybody. This is the same logic as a canary token, applied to the tool's own contents.

### Read the items before running

Generated entities are *probabilistically* fictitious, not checked against any registry. A rare
collision with something real turns that item into a knowledge probe, which measures the opposite of
what is intended. The item list is editable before the run and lands verbatim in the export.

---

## Reading the output

**Scoreboard.** Stance distribution and per-model denial rate. Useful, not the point.

**Agreement matrix.** Rows and columns are models; each cell is the share of co-fabricated items on
which both invented a matching value. Violet intensity scales with agreement. Flagged pairs are red.
The header prints the cohort mean μ, standard deviation σ, the flag threshold, and the minimum
co-answered count.

**Flag list.** Pairs at or above μ + *z*σ, sorted by z. Default threshold z = 2, minimum 5
co-answered items. Both are user-settable; lowering either will produce flags, which is not the same
as producing findings.

**Answers.** Per-model, per-item, filterable by stance. Read these before believing any aggregate.
This is where a mis-parsed value or a collided item becomes obvious.

---

## Before concluding anything

An excess-agreement flag means **shared training lineage**, and lineage has several causes this tool
cannot separate:

- distillation from a shared teacher, in either direction, or both from a third model
- a genuine base-model relationship (a fine-tune of a published checkpoint)
- overlapping open SFT datasets, which are widely reused
- both having memorised the same public assistant transcripts, which state the same things
- a shared synthetic-data pipeline from a common vendor

**Absence of a flag is not an alibi.** Identity and knowledge behaviour are cheap to fine-tune, low
co-answered counts starve the statistic, and a model that denies everything cannot be fingerprinted
by this method at all. A clean sheet means the instrument found nothing, which is different from
there being nothing.

**Where this sits in the evidence hierarchy.** Weakest to strongest, for an outside observer:
benchmark-profile arguments ("high reasoning, low world knowledge") are circumstantial and are
confounded by legitimate synthetic-data training; inherited idiolect and refusal-boundary similarity
is suggestive; **correlated-error agreement, which is what this tool measures, is the strongest
method available with API access only**; planted canaries and statistical watermarks, verifiable by a
third party and planted before any dispute, are the only court-grade tier, and only the teacher can
run them. This tool is the ceiling of outsider methods, not the ceiling of methods.

---

## Exports

One JSON file containing: tool and rulebook versions, run timestamp, the interpretation caveat, all
settings, both prompt templates verbatim, the model list, the full item list, every raw response with
provider and returned-model string, every extraction, every scoring verdict with its reason code, and
the complete statistics block including all pairs and per-item distinct-value counts.

The export is the unit of citation. If you publish a number, publish the export.

---

## Known limitations

1. Items are probabilistically fictitious, not registry-verified.
2. Category entropy varies and low-entropy categories inflate baseline agreement.
3. One trial per item means no within-model stability estimate.
4. Value matching is normalised string equality with containment, which is crude for multi-word
   values and will over-match on short strings.
5. Statistics treat items as independent; templated items only approximate that.
6. The cohort mean is itself sensitive to cohort composition, so adding four models from one family
   moves everyone's z-score.
7. No confidence intervals on the agreement rates yet — see backlog.
8. Some providers refuse to answer prompts about entities that look like random strings; those land
   in `refused` and shrink the co-answered base.

---

## Backlog

1. Bootstrap confidence intervals per pair, and Wilson intervals on denial rates.
2. Cluster statistics by model rather than by item.
3. Per-lab mean-of-means beside the pooled cohort mean, so one vendor's six endpoints cannot set the
   baseline alone.
4. Registry pre-check for generated entities (CVE, PyPI, arXiv) to catch collisions before spending.
5. Semantic value matching for multi-word answers, with the crude matcher kept as a comparison.
6. Optional second trial per item to separate sampling noise from genuine agreement.
7. Category-weighted aggregate that discounts low-entropy items.
8. Positive control: sibling models from one lab should flag first. If they do not, item entropy is
   too low and the run should say so before reporting anything else.

---

## Which tool answers what

| question | tool |
|---|---|
| What does this model claim to be, and does the claim survive pressure? | `whoami-bench` |
| Do two models invent the same nonexistent facts? | `nihilartikel-bench` |
| How functionally similar are two models' next-token distributions? | `phylo-bench` |

They are complementary and their settings are not interchangeable. `whoami-bench` findings are the
reason this tool exists: self-reports turned out to be worthless as provenance evidence, because
models confabulate both the claim and its source. Correlated fabrication is the harder question and
this is the cheap instrument for it.
