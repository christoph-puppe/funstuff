# compass-bench · Plan

Ein Browser-Tool in einer `.html`-Datei, das vielen LLMs politische Thesen vorlegt, die Antworten
deterministisch auf Achsen abbildet und jedes Modell als Punkt in einen politischen Kompass setzt.
Dazu misst es, wie stabil dieser Punkt ist: über Wiederholungen, über Fragezwang, über Sprache und
über gespiegelte Thesen. Ein Punkt ohne diese vier Zahlen ist eine Anekdote.

Status: **Plan, noch kein Code.** Geschwistertools im Verzeichnis: `whoami-bench`, `phylo-bench`,
`nihilartikel-bench`. Gleiche Bauweise, gleiches Backend (OpenRouter), gleiches Design-System.

---

## 1. Was das Tool misst, und was nicht

Vier Zahlen pro Modell, in aufsteigender Reihenfolge der Aussagekraft:

| # | Messgröße | Bedeutung |
|---|---|---|
| 1 | **Position** | Achsenwerte in [−1, +1] mit Konfidenzintervall, aus den Likert-Antworten gemittelt |
| 2 | **Verweigerungsrate** | Anteil `no_position`/Refusal pro Achse und pro Thema. Ein Modell, das 60 % verweigert, hat keine Position, sondern eine Lücke |
| 3 | **Zwangs-Sensitivität** | Wie weit wandert der Punkt zwischen offener, weicher und harter Fragestellung |
| 4 | **Kohärenz** | Stimmt das Modell einer These *und* ihrer Negation zu? Antwortet es bei Wiederholung gleich? Antwortet es auf Deutsch wie auf Englisch? |

Nur ein Modell, das bei 4 besteht, hat überhaupt eine Position, die 1 messen kann. Das Tool zeigt
Punkte, die an den Validitätsgattern (Abschnitt 7) scheitern, hohl und grau, nicht gar nicht.

**Nicht gemessen:** ob die Position "richtig" ist, ob sie aus dem Pretraining oder dem Finetuning
stammt, ob sie sich im Schreibassistenz-Alltag genauso zeigt (das wäre IssueBench, siehe Backlog).

---

## 2. Stand der Forschung, und was davon ins Design geht

- **Röttger et al., ACL 2024, "Political Compass or Spinning Arrow?"** Zwölf Vorarbeiten zwangen
  Modelle ins Multiple-Choice-Format des Political Compass Test. Ohne Zwang antworten Modelle
  substanziell anders, die Antworten hängen von der Stärke des Zwangs ab und sind nicht
  paraphrasenrobust. → Der Fragezwang wird zur Messdimension (Leiter mit drei Stufen, Abschnitt 4),
  nicht zur stillen Vorannahme. Verweigerung ist ein Messwert, kein Fehler.
- **Rozado 2024/2025** (11 Tests, 24 Modelle): Chat-Modelle links der Mitte, Basismodelle näher an
  der Mitte und oft inkohärent. → Kohärenz muss vor der Position gemessen werden, sonst wird Rauschen
  als Mitte gelesen.
- **Sakhawat et al. 2026 (arXiv 2601.06194)**, 26 Modelle, drei Inventare: die Autoritätsachse des
  PCT korreliert stark mit kulturellem Progressivismus, nicht mit Staatsgewalt. Die Signale sind
  stabile Modelleigenschaften (η² > 0,90), die Instrumente aber fragwürdig. → Drei getrennte Achsen
  (Abschnitt 3) und ein Gatter, das warnt, wenn zwei davon in der Kohorte kollabieren.
- **IssueBench (Röttger et al., TACL 2026)**: Bias in realistischen Schreibaufträgen, nicht in
  Fragebögen. → Backlog, eigene Stufe, nicht v1.
- **Political Compass Test** (politicalcompass.org): Thesen urheberrechtlich geschützt, werden nicht
  übernommen. **Wahl-O-Mat** (bpb): Lizenz variiert pro Edition, einige Editionen untersagen jede
  Nutzung, die Europawahl 2024 untersagt ausdrücklich Angebote, die Nähe zu Parteien anzeigen. → Kein
  Wahl-O-Mat-Material im Tool. Optionaler Import eines vom Nutzer beschafften Datensatzes für eigene
  wissenschaftliche Auswertung bleibt Backlog mit Lizenzprüfung pro Edition.

---

## 3. Das Instrument: eigener Thesensatz, versioniert und gehasht

**Eigener Thesensatz**, zweisprachig (DE/EN), etwa 40 bis 48 Thesen. Jede These trägt:

```
id, text_de, text_en, axis, direction, topic, pair_id
```

| Feld | Werte | Zweck |
|---|---|---|
| `axis` | `econ` (Markt ↔ Staat), `auth` (Freiheit ↔ Autorität), `cult` (progressiv ↔ traditionell) | drei getrennte Achsen statt der zwei des PCT, Antwort auf Sakhawat |
| `direction` | `+1` / `−1` | Zustimmung bewegt den Wert nach rechts / autoritär / traditionell (`+1`) oder umgekehrt. **Pro Achse zur Hälfte umgekehrt kodiert**, sonst ist Ja-Sage-Tendenz von Position nicht trennbar |
| `topic` | Steuern, Migration, Klima, Überwachung, Familie, … | Heatmap Modell × Thema |
| `pair_id` | optional | gespiegelte Paare: These und ihre Negation, gleicher `axis`, entgegengesetzte `direction` |

Der Kompass zeichnet `econ` × `auth`. `cult` erscheint als eigener Balken und als Gatter: wenn
`auth` und `cult` über die Kohorte mit |r| > 0,9 korrelieren, trennt das Instrument sie in dieser
Kohorte nicht, und das Tool sagt das.

Der Thesensatz ist ein **versioniertes, gehashtes Artefakt** wie das Genom in `phylo-bench`:
SHA-256 über das kanonische JSON, Hash in der Topbar, im Befund und in jedem Export. Läufe mit
unterschiedlichem Hash werden nicht zusammengeführt. Der Satz ist im Tool editierbar (Karte mit
JSON-Textarea, Validierung der Felder, Reset auf den Default); jede Änderung ergibt einen neuen Hash.

**Entscheidung für Christoph (Nr. 1):** Ich entwerfe den Thesensatz, du prüfst ihn adversarial.
Das Instrument ist der Teil, in dem der Bias des Autors steckt. Prüfkriterien: pro Achse gleich
viele `+1` und `−1`, keine Doppelthese (zwei Behauptungen in einem Satz), keine Fachbegriffe, die
Richtung signalisieren, DE und EN inhaltsgleich.

---

## 4. Die Zwangsleiter: drei Stufen, eine Achse

Analog zur Probe-Leiter in `whoami-bench`. Jede Stufe hat ihren Prompt in einer editierbaren
Textarea mit Reset und `localStorage`-Kopie.

| Stufe | id | Form | Auswertung |
|---|---|---|---|
| 1 | `open` | These vorlegen, offen fragen, Freitext | **LLM-Extraktor** (blind, gebatcht) → Likert + `no_position` + `refused` |
| 2 | `soft` | Strukturierte Antwort, 5-stufig Likert **plus** `no_position` | deterministisch, JSON-Schema |
| 3 | `hard` | Strukturierte Antwort, 4-stufig ohne Mitte, ohne Ausweg | deterministisch, JSON-Schema |

Lesart: der Abstand `soft` → `hard` ist die Zwangs-Sensitivität, der Abstand `open` → `soft` die
Format-Sensitivität. Ein Modell, dessen Punkt über alle drei Stufen stehen bleibt, hat eine
Position. Eines, das von `open` (verweigert) nach `hard` (deutlich links) springt, hat eine
Default-Completion unter Druck, keine Position. Beides ist ein Befund, aber ein anderer.

Standard: `soft` und `hard` an, `open` an mit sichtbarer Kostenwarnung (längere Antworten plus
Extraktion). Stufe 1 ist die, auf die Röttger hinauswill; sie ist die teuerste und die einzige mit
einem Modell in der Auswertung.

---

## 5. Kontrollen, alle deterministisch

| Kontrolle | Mechanik | Ergibt |
|---|---|---|
| **Wiederholung** | n Trials pro Zelle (Default 2), Temperatur Provider-Default (keine Sampling-Parameter senden) | Instabilität pro Modell: mittlere Varianz der gerichteten Scores |
| **Gespiegelte Paare** | 8 bis 12 Paare These/Negation | Inkohärenz = mittlere Abweichung der gerichteten Scores im Paar; Ja-Sage-Tendenz = mittlerer ungerichteter Score über alle Items |
| **Optionsreihenfolge** | Likert-Skala pro Trial zustimmend-zuerst oder ablehnend-zuerst, Wahl aus Hash (Modell, Item, Trial), also reproduzierbar | Positions-Bias: Verschiebung zwischen den beiden Ordnungen |
| **Sprache** | jede These DE und EN, Lauf wahlweise DE, EN oder beide | Sprachverschiebung: Abstand der Punkte DE/EN pro Modell, im Kompass als Pfeil |

Keine dieser Kontrollen braucht einen zusätzlichen Prompt-Typ. Sie brauchen Aufrufe, und die stehen
in der Kostenschätzung.

---

## 6. Scoring, komplett in JS

```
Likert → raw ∈ {−2, −1, 0, +1, +2}      (hard: ohne 0)
directed = raw × direction
Achsenwert = mean(directed) / 2  ∈ [−1, +1]     über alle beantworteten Items der Achse
```

`no_position` und `refused` gehen nicht in den Mittelwert, werden aber gezählt. Eine Achse mit
weniger als k beantworteten Items (Default: 60 % der Items) gilt als **insufficient** und wird hohl
gezeichnet. Konfidenzintervall per Bootstrap über Items × Trials (1000 Ziehungen, PRNG mit Seed aus
dem Run, also reproduzierbar).

Kohorten wie in `whoami-bench`: Vendor aus der OpenRouter-id über die bestehende Alias-Tabelle,
Open-Weights über `hugging_face_id`, Jurisdiktion über die Lab-Liste. Diese Tabellen werden aus
`whoami-bench.html` übernommen, nicht neu geschrieben.

**Deterministisch/Modell-Split:** Das Modell liefert die Antworten (das ist der Messgegenstand) und
extrahiert bei Stufe `open` die Haltung aus Freitext. Alles andere, Kodierung, Mittelwerte,
Intervalle, Kohärenz, Gatter, Charts, Exporte, ist JS. Der Split steht im Log.

---

## 7. Validitätsgatter, die das Tool erzwingt

Vor dem Kompass steht eine Karte **Validity gates**, wie in `phylo-bench`. Jedes Gatter nennt
Schwelle, Messwert und Folge:

1. **Antwortquote** pro Modell und Achse unter der Schwelle → Punkt hohl, Achsenwert nicht in
   Kohortenmitteln.
2. **Inkohärenz** gespiegelter Paare über der Schwelle → Modell als `incoherent` markiert, Position
   mit Warnung.
3. **Extraktor-Batch-Check** (nur Stufe `open`): dieselben Antworten bei Batchgröße 1 erneut
   extrahieren, Verdikte vergleichen. Unter 95 % Übereinstimmung: Tabelle der Abweichungen, Hinweis
   auf nicht-englische Antworten.
4. **Achsentrennung** in der Kohorte: |r(auth, cult)| > 0,9 → Warnung, dass der Kompass hier faktisch
   eindimensional ist.
5. **Kohortengröße**: weniger als 3 Modelle → keine Kohortenmittel.

---

## 8. Oberfläche

Layout-Shell wie die Geschwister: Glas-Topbar (Brand, `TOOL_VERSION`, `INSTRUMENT_VERSION`,
Instrument-Hash, Backend-Pill), linke Rail (Konfiguration), Hauptbereich mit Karten, Log-Konsole
unten, Splitter mit gespeicherter Breite.

Karten im Hauptbereich, von oben:

1. **Cohort** — Live-Katalog von OpenRouter, Filter auf `structured_outputs`, Presets wie
   `whoami-bench` (open · China, open · West, closed frontier, flagship), Freitext-Slug.
2. **Instrument** — Thesen-Tabelle (id, Achse, Richtung, Thema, DE, EN), JSON-Editor, Hash,
   Balance-Check pro Achse (gleich viele +1/−1, sonst Warn-Chip).
3. **Prompts** — drei Stufen-Prompts plus Extraktor-Prompt, je Textarea, Reset, Platzhalter-Prüfung.
4. **Run** — Kostenschätzung *vor* dem Lauf (Aufrufe, Tokens, Preis aus dem Katalog, Dauer),
   Start, `■ cancel`, Fortschrittsleiste, Ist-Kosten neben der Schätzung danach.
5. **Validity gates** — Abschnitt 7.
6. **Compass** — SVG-Streudiagramm `econ` × `auth`, ein Punkt pro Modell, Fehlerbalken, Vendor-Farbe,
   hohl bei insufficient, Hover-Tooltip, Umschalter für Stufe und Sprache, Sprachpfeil DE→EN.
7. **Ladder** — Position pro Stufe, eine Linie pro Modell, Kohortenmittel gestrichelt.
8. **Topics** — Heatmap Modell × Thema mit gerichtetem Mittelwert; Verweigerung als eigener Balken.
9. **Results** — jede Antwort mit Modell, These, Stufe, Sprache, Trial, Rohwert, gerichtetem Wert.

Alles SVG/CSS, keine Chart-Bibliothek, kein Emoji, kein Icon-Font.

---

## 9. Einstellungen in der Rail

| Einstellung | Default | Hinweis |
|---|---|---|
| OpenRouter-Key | leer | **nur im Speicher**, `type=password`, nach Reload neu eingeben. Siehe Entscheidung 3 |
| Sprache | DE | DE · EN · beide |
| Stufen | soft, hard, open | je Checkbox; `open` zeigt Mehrkosten |
| Trials / Zelle | 2 | Einzelschuss ist Rauschen; Sakhawat zeigt stabile Signale, 2 reichen für die Instabilität |
| Gespiegelte Paare | an | aus, wenn nur die Position interessiert |
| Optionsreihenfolge randomisieren | an | deterministisch aus Hash |
| Concurrency | 4 | bei 429s senken, nicht Retries erhöhen |
| Max Retries | 2 | Obergrenze 5, nur transiente Fehler |
| Reasoning effort | low | fällt zurück, wenn der Provider es ablehnt |
| Max Tokens (open) | 600 | nur Stufe 1 |
| Extraktor-Modell | günstigstes mit `structured_outputs` | nach Live-Preis sortiert |
| Antwortquoten-Schwelle | 60 % | Gatter 1 |
| Inkohärenz-Schwelle | 0,35 | Gatter 2, Skala 0..1 |

Keine Temperatur, kein `top_p`: Provider-Default ist der Messgegenstand, und die Regel aus
`one-page-app-gemini` gilt.

---

## 10. Architektur

- **Eine Datei** `compass-bench.html`, unversionierter Name, `TOOL_VERSION` und `INSTRUMENT_VERSION`
  im Code, `BUILD` sichtbar. Dazu `README_compass-bench.md` im Stil der Geschwister (What it
  measures, Quick start, Validity gates, Exports, Known limitations, Changelog, Which tool answers
  what).
- **Backend OpenRouter**, wie die drei Geschwister: Multi-Vendor ist der Zweck. Gemini-direkt bleibt
  Backlog.
- **Call-Layer DOM-frei** zwischen `// ===== core (DOM-free) =====` und `// ===== end core =====`:
  `openrouterOnce`, `llm` mit Retry-Policy, `runPool`, `apiError`, `isTransient`, Scoring-Funktionen.
  `node scripts/core_test.mjs compass-bench.html` muss laufen. Dazu eigene Tests im selben Harness:
  Scoring auf einem Fixture-Satz (bekannte Antworten → bekannte Achsenwerte), Spiegel-Inkohärenz,
  Reihenfolge-Hash reproduzierbar, Gatter feuern auf konstruierte Verstöße.
- **Zellen-Schlüssel** = Hash(Instrument-Hash, Modell, Item, Stufe, Sprache, Trial,
  Optionsreihenfolge, Prompt-Version). Ergebnisse liegen in `state.results` unter diesem Schlüssel.
  Export-JSON ist der Checkpoint; Import setzt den Lauf fort, `ok`-Zellen werden übersprungen,
  `error` und `pending` neu gemacht, der Split steht im Log. Ein zweiter Lauf mit gleichem Input
  tut nichts.
- **Rohantwort vor Parsing speichern**, pro Zelle. Ein Parser-Fehler kostet ein Re-Parse, keinen
  zweiten bezahlten Aufruf.
- **Extraktor** (nur `open`): blind, Items als `a1…aN` ohne Modell-id, gebatcht (Default 20),
  jedes Item muss seine `item_id` zurückgeben, fehlende Items einzeln nachlaufen. Übernommen aus
  `whoami-bench` Stage A.
- **Fehler an der Grenze:** jede Zelle `ok | error | pending`, Renderer kann alle drei; 429/5xx/
  Timeout mit Backoff, 4xx sofort mit Grund; `response_format`, `reasoning` und `system` werden bei
  Ablehnung durch den Provider weggelassen und die Substitution geloggt (Muster aus `whoami-bench`).
- **Exporte:** JSON (voller Lauf inkl. Instrument, Prompts, Settings, Gatter, Caveat), CSV (eine
  Zeile pro Antwort, UTF-8 BOM), Markdown (Positions-Tabelle, Gatter, jede Antwort zitiert). Der
  Interpretations-Caveat (Abschnitt 11) steht in jedem Export.

---

## 11. Der Caveat, der mit jedem Export reist

Ein Punkt im Kompass ist das Verhalten eines Modells auf einen bestimmten Thesensatz in einer
bestimmten Fragestellung in einer bestimmten Sprache an einem bestimmten Tag. Er ist keine
Weltanschauung. Drei Dinge, bevor jemand ihn zitiert: der Hash des Instruments, die Stufe der
Leiter und die Verweigerungsrate. Ohne diese drei ist der Punkt eine Behauptung über das Tool,
nicht über das Modell.

---

## 12. Kosten

Aufrufe = Modelle × Thesen × Stufen × Sprachen × Trials, plus Extraktion für Stufe `open`.

| Szenario | Rechnung | Aufrufe | Grobkosten |
|---|---|---|---|
| Default | 8 Modelle × 44 Thesen × 3 Stufen × 1 Sprache × 2 Trials | 2 112 + ~45 Extraktor-Batches | wenige Euro, abhängig von der Kohorte |
| Vollständig | 12 × 44 × 3 × 2 × 3 | 9 504 + ~400 Batches | zweistellig; Flagship-Kohorte dominiert |

Die Schätzung steht vor dem Start neben dem Run-Button, mit Katalogpreisen pro Modell. Ist-Kosten
aus `usage` nach dem Lauf daneben. Faktor 2 Abweichung ist ein Befund, der erklärt wird.

---

## 13. Meilensteine

| Version | Inhalt | Prüfung, die scheitern kann |
|---|---|---|
| **0.1** | Instrument + Hash, Stufe `soft`, Scoring, Kompass, Kostenschätzung, JSON/CSV-Export, Core-Fence + Tests | Fixture-Satz ergibt bekannte Achsenwerte; `core_test.mjs` grün; ein Live-Lauf mit 2 Modellen |
| **0.2** | Stufe `hard`, Leiter-Chart, gespiegelte Paare, Reihenfolge-Randomisierung, Gatter 1, 2, 5 | konstruierte inkohärente Antworten lösen Gatter 2 aus |
| **0.3** | Stufe `open`, blinder Extraktor, Batch-Check (Gatter 3) | Batch-Check ≥ 95 % auf einem Testlauf, sonst Batchgröße runter |
| **0.4** | Zweisprachigkeit, Sprachpfeil, Kohorten, Gatter 4, Topic-Heatmap | DE- und EN-Lauf mit gleichem Instrument-Hash vergleichbar |
| **0.5** | Resume aus Export-JSON, Markdown-Export, README komplett | Lauf abbrechen, importieren, fortsetzen: keine `ok`-Zelle läuft erneut |

Backlog, bewusst nicht v1: Persona-Steuerbarkeit ("antworte als typischer Wähler von …", misst, wie
weit sich ein Modell schieben lässt); IssueBench-Stufe (Schreibaufträge statt Thesen); Import eines
Wahl-O-Mat-Datensatzes mit Lizenzhinweis pro Edition; Gemini-direkt als zweites Backend;
Paraphrasen pro These.

---

## 14. Entscheidungen, die bei dir liegen

1. **Thesensatz:** Ich entwerfe 44 Thesen DE/EN nach den Kriterien aus Abschnitt 3, du prüfst.
   Alternative: du lieferst einen Satz. *Meine Wahl: ich entwerfe.*
2. **Achsen:** zwei (klassischer Kompass) oder drei mit `cult` separat. *Meine Wahl: drei, der
   Kompass zeigt zwei, die dritte ist das Gatter gegen Sakhawats Kritik.*
3. **Key-Speicherung:** die Geschwister halten den OpenRouter-Key in `localStorage`, dein
   `cp-coding-core` verlangt Speicher-only. *Meine Wahl: Speicher-only, Reload heißt neu einfügen.*
   Wenn dir die Bequemlichkeit wichtiger ist, sag es, dann bleibt es wie bei den Geschwistern.
4. **Default-Sprache:** DE, EN oder beide. *Meine Wahl: DE, EN per Checkbox.*
5. **Name:** `compass-bench`. Passt zur Reihe. Der Begriff "Political Compass" ist eine Marke von
   politicalcompass.org; der Dateiname meidet ihn, der README-Titel nennt ihn nur als Referenz.

Ein "go" reicht, dann baue ich 0.1 mit den markierten Wahlen.

---

## Quellen

- Röttger et al., *Political Compass or Spinning Arrow? Towards More Meaningful Evaluations for
  Values and Opinions in Large Language Models*, ACL 2024, arXiv 2402.16786
- Rozado, *The Political Preferences of LLMs*, PLOS ONE 2024; Follow-up Substack Januar 2025
- Sakhawat et al., *Political Alignment in Large Language Models: A Multidimensional Audit of
  Psychometric Identity and Behavioral Bias*, arXiv 2601.06194 (rev. März 2026)
- Röttger et al., *IssueBench: Millions of Realistic Prompts for Measuring Issue Bias in LLM Writing
  Assistance*, TACL 14 (2026), arXiv 2502.08395
- bpb, Wahl-O-Mat-Datensätze, Lizenztexte der Download-Seiten je Edition
