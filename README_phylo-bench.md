# phylo-bench

A single-file browser tool that estimates functional distance between language models by sampling
one-token continuations of truncated text, counting alleles, and computing Nei's genetic distance.
Builds a dendrogram from the result, and refuses to build one when its own calibration fails.

Version 0.1.0 · one `.html` file · no build step · OpenRouter as the backend.

The file is `phylo-bench.html` — unversioned, so it has a stable path in git. `TOOL_VERSION` and
`METRIC_VERSION` live in the page (top bar) and in every export.

Sibling tools in this directory: `whoami-bench` (what models claim about themselves) and
`nihilartikel-bench` (agreement on fabricated entities). See **Which tool answers what** at the end.

---

## Prior art, and what it is worth reading for

The metric follows **PhyloLM** (Yax, Oudeyer, Palminteri, ICLR 2025), including its tokenizer-aware
two-mode design: Nei's genetic distance over token distributions when two models share a tokenizer,
and an approximation over the first four characters when they do not.

**LLM DNA** (Wu, Zhao, Wang, Guo, Wang, He — arXiv 2509.24496, 305 models) benchmarks directly
against PhyloLM and beats it on relation detection with a different pipeline: embed whole responses
with a sentence encoder, then random-project to a fixed dimension. Four of their results bear on how
you use *this* tool:

- Their criticism of the cross-tokenizer mode is correct and unresolved: it is dominated by
  early-token behaviour and does not reflect sentence-level distributions.
- Genome content matters less than intuition suggests. Their DNA extracted from 600 random-word
  prompts performed *slightly better* than curated benchmark text, and a Mantel test across two
  disjoint corpora gave Pearson r above 0.75. Curating a pristine genome is cheap insurance, not the
  decisive design choice.
- Dropping the chat template improved cross-family comparison by 1 to 3 percent, on the reading that
  a completion-style interface compares chat-tuned and base models fairly.
- Some APIs, the Claude series among them, may refuse to continue random strings. Plan for refusal as
  an outcome.

Their pipeline needs an embeddings API, which this tool does not have. See backlog item 1.

---

## What it measures

Functional similarity of next-token behaviour on truncated prefixes. Nothing more, and the tool is
built to keep saying so.

For each **gene** (a text prefix cut mid-word) and each model, collect N one-token continuations and
count **alleles**: the exact returned token for same-tokenizer pairs, otherwise the first K
characters. Allele frequency vectors give Nei's standard genetic identity pooled over genes,

    I = Σ p·q / sqrt( Σ p² · Σ q² )        D = −ln I

and D is the reported distance. Identical distributions give D = 0; disjoint ones give a large D.

---

## Quick start

1. Open `phylo-bench.html` in a browser. Works from `file://`; on a CORS error serve it with
   `python -m http.server`.
2. Paste an OpenRouter key in the left rail. **Spend-capped key only** — it is present in the page.
3. Paste a corpus and press **Build genome**. The hash appears in the top bar. Nothing runs until a
   genome is hashed.
4. Declare the cohort, including at least one `rep:2` entry (see below). Set the two anchor pairs.
5. Press **Run**, then read **Validity gates** before looking at anything else.

Call volume is models × genes × draws. The defaults, 7 entries × 32 genes × 16 draws, are about 3,600
one-token calls. The estimate is printed next to the Run button.

---

## Six design constraints, enforced rather than documented

### 1. Sampling is the estimator

N repeated one-token calls per gene, outcomes counted. Logprobs, where a provider returns them, are
an optional low-variance fast path selected **for the whole run**. A model that fails to return
logprobs is excluded, never silently resampled, because a matrix containing two estimator types is
not a matrix. The estimator is recorded in the export and printed in the top bar.

### 2. Two comparison modes, never mixed

Every pair carries the `mode` that produced it, decided by the declared tokenizer family:

- `token` — both models declare the same `tok:` family. Alleles are exact single-token completions.
- `char` — anything else. Alleles are the first K characters, K settable, default 4.

Matrices are built per mode. The tree uses `token` mode when it exists and `char` mode only
otherwise. The two scales are never averaged or compared.

### 3. Temperature ≥ 1, top_p = 1, top_k off

Preflight **refuses to run** below temperature 1, refuses top_p under 1, and refuses if top_k is
being sent, printing the reason for each. Temperature 0 collapses every gene to one allele at
frequency 1.0 and destroys the signal completely. Nucleus and top-k truncation distort the tail the
metric depends on.

> **Do not copy these settings to `nihilartikel-bench`.** That tool requires temperature 0 because its
> estimator is the single most likely fabrication, not a distribution. Opposite requirement, same
> author, and runs are not comparable across the two. Temperature belongs to the instrument.

Recorded on every run: temperature, top_p, top_k, wrapper text, both endpoints, requested model,
returned model string, provider, finish reason, date. Sampling seeds are provider-side and not
controllable through OpenRouter; the export says so rather than implying reproducibility it cannot
deliver.

### 4. The genome is a versioned, hashed artifact

Genes are passages truncated at a random character between 20 and 100, with cut points from a PRNG
seeded on the genome id, so a rebuild is byte-identical. The genome is SHA-256 hashed on build and the
hash is stamped into the top bar, the finding, and the export. **Distances computed against different
genome hashes are not comparable** and the tool will not merge them.

Two slots ship with distinct default corpora: `reasoning` (narrative prose) and `code` (source
fragments). Run both. Clustering shifts between them because of code training data, and that
divergence is itself a result rather than an inconsistency to be averaged away.

### 5. Chat wrapping is the dominant confound

Closed chat endpoints will not continue a truncated prefix; they comment on it. The continuation
wrapper is therefore part of the measurement: one editable textarea, applied **identically** to every
`chat` entry, stored verbatim in the export.

Entries declared `base` receive the raw prefix through `/completions` with no wrapper at all. Pairs
that cross the interface boundary are computed but marked `comparable: false`, shown amber in the
heatmap, and excluded from the tree. This asymmetry falls along the open/closed axis, which is exactly
the axis these tools get used to examine, so it is surfaced rather than absorbed.

### 6. Calibration anchors, or the numbers mean nothing

Three anchors, all required for a valid run:

| anchor | how | what it gives you |
|---|---|---|
| self | any cohort entry with `rep:2` — the same endpoint probed twice, independently | the noise floor: endpoint nondeterminism plus sampling variance |
| known-related | declared pair, e.g. a base model and its published fine-tune | the scale of a real relationship |
| known-unrelated | declared pair from different families | the scale of no relationship |

The run is marked **INVALID** unless self < related < unrelated. An instrument that cannot order its
own anchors does not get to draw a tree, and the tree card says so instead of drawing one.

Additionally: bootstrap confidence intervals over genes on every distance (default 200 resamples),
and a **G/N sweep** that subsamples the collected draws — no extra API calls — to show where distance
estimates stop moving. If the curve has not flattened at your setting, the intervals are the only
honest report.

---

## Cohort syntax

One entry per line:

    model_id | iface | tok:family | rep:2

- `iface` — `chat` (wrapper applied, `/chat/completions`) or `base` (raw prefix, `/completions`).
  Default `chat`.
- `tok:family` — free-text tokenizer family label. Entries sharing a label become eligible for
  `token` mode. Omit it and the entry is `char`-mode only.
- `rep:2` — probe this endpoint a second time under a distinct key. This is how the self-distance
  anchor gets its noise floor.

Lines beginning with `#` are ignored.

---

## Validity gates

Printed before any result, with hard gates blocking the finding and the tree:

| gate | hard? | fails when |
|---|---|---|
| `anchors_present` | yes | no `rep:2` entry, or an anchor pair not resolvable in the cohort |
| `anchor_ordering` | yes | self < related < unrelated does not hold |
| `allele_variety` | yes | some entry averages one allele per gene — temperature too low or genes too predictable |
| `single_mode` | no | both modes present; the tree is restricted to one |
| `single_iface` | no | cohort mixes wrapped and unwrapped; those pairs are excluded |
| `coverage` | no | draw success below 80 percent for some entry |

On a hard failure the finding says `RUN INVALID`, names the gates, and emits no similarity claim. A
dendrogram from a broken instrument looks exactly as convincing as a correct one, which is why it is
withheld rather than labelled.

---

## Output semantics, enforced in the pipeline

The finding text is generated by **deterministic JavaScript**, not by a model, so it is reproducible
and auditable. Every finding prints the genome hash, the estimator and sampling parameters, the metric
version, the noise floor, the ranked closest pairs with confidence intervals, and an explicit
six-item alternative-hypothesis list. Any pair whose interval reaches down to the noise floor is
marked as not separable from a repeat query of a single model.

Two guards sit on top:

- A **regex guard** scans the generated text for causal and accusatory phrasing (`distilled from`,
  `copied from`, `proves`, `stolen`, and similar). A hit is reported as a generator bug, not as
  permitted output.
- A **checker pass** (LLM, five-level verdict: confirmed / minor_corrections / major_issues /
  incorrect / uncertain) audits the phrasing only. It is instructed to fail any output that names a
  cause for the similarity, treats similarity as proof, omits the noise floor, or reports a point
  estimate whose interval crosses the threshold it is being compared against.

This is the documented-versus-speculation split applied in the pipeline instead of in the write-up.

---

## What a small distance means

Functional similarity, which is consistent with all of the following and separates none of them:

1. shared base weights or a shared checkpoint ancestor
2. overlapping pretraining corpora with no direct relationship
3. a shared teacher used by both, with no relationship between the two
4. similar post-training recipes, instruction data, or preference sets
5. independent convergence on the same high-probability continuation of ordinary text
6. the same serving stack, quantisation, or sampling implementation behind both endpoints

It is not evidence of a distillation attack. The tool will not phrase it as one.

---

## Exports

One JSON file: tool and metric versions, run timestamp, the interpretation caveat, all settings
including the verbatim wrapper, the hashed genome with every gene, the cohort with interface and
tokenizer declarations, all allele tables plus up to four raw completions per cell for audit, every
pairwise distance with mode, comparability, genes used and confidence interval, the coverage table,
the gate results, the sweep curves, the generated finding, the guard hits, and the checker verdict.

**Recompute metric** applies the current `METRIC_VERSION` to a loaded export with zero API calls.

---

## Known limitations

1. The `char` mode is dominated by early-token behaviour. This is PhyloLM's known weakness and it is
   not fixed here, only labelled.
2. Tokenizer families are user-declared. A wrong declaration silently produces a `token`-mode
   comparison between incompatible vocabularies.
3. Sampling seeds are not controllable through the router, so runs are reproducible in genome and
   settings but not in draws.
4. A router may move you between providers, quantisations, and injected system prompts mid-cohort.
   Provider and returned model string are recorded per call; nothing prevents the drift.
5. Nei distance is computed pooled over genes, not as a mean of per-gene identities. Pooling weights
   high-entropy genes more heavily. Both variants are defensible; only one is implemented.
6. Statistics treat genes as independent; passages drawn from one corpus only approximate that.
7. UPGMA assumes a roughly constant rate of change and will mislead where families evolve at
   different speeds. Neighbour-joining is the better choice and is in the backlog.
8. Chat models may refuse to continue a prefix, and refusals are recorded as failed draws, which
   shrinks the base rather than being surfaced as its own behaviour.

---

## Backlog

1. **RepTrace mode**: embed full responses with a sentence encoder, random-project to L = 128, and
   compute Euclidean distance. Wu et al. report large gains over the allele method, and their ablation
   found a 0.1B encoder matches an 8B one, so the cost is one embeddings API rather than compute.
2. Neighbour-joining with midpoint rooting alongside UPGMA, and report both.
3. Bootstrap the tree topology, not only the distances, and report branch support.
4. Cluster statistics by model rather than by pair, with Wilson intervals on cohort-level summaries.
5. Per-lab mean-of-means beside pooled figures.
6. Surface refusal as a first-class per-model rate rather than a failed draw.
7. Genome divergence report: run both slots and quantify how much the clustering moves, which the
   LLM DNA paper suggests should be small and which is worth checking rather than assuming.
8. Adaptive-attack note in the export: a public genome is trainable-against. Rotate corpora and treat
   any published genome as burned.

---

## Which tool answers what

| question | tool |
|---|---|
| What does this model claim to be, and does the claim survive pressure? | `whoami-bench` |
| Do two models invent the same nonexistent facts? | `nihilartikel-bench` |
| How functionally similar are two models' next-token distributions? | `phylo-bench` |

None of the three establishes a distillation attack. In ascending order of evidentiary weight for an
outside observer: self-reports (worthless — models confabulate both the claim and its source),
functional similarity (this tool), correlated fabrication (`nihilartikel-bench`), and planted canaries
or statistical watermarks, which only the teacher can run and which are the only tier that survives
contact with a lawyer.
