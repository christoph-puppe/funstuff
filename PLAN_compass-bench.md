# compass-bench · Plan

Ein Browser-Tool in einer `.html`-Datei, das vielen LLMs die **bekannten politischen Kompass-Tests**
vorlegt, die Antworten mit dem jeweils veröffentlichten Scoring auswertet und jedes Modell dort
einzeichnet, wo der jeweilige Test es einzeichnen würde. Dazu misst es, wie stabil dieser Punkt ist:
über Wiederholungen, über den Fragezwang, über die Optionsreihenfolge und über die Tests hinweg.
Ein Punkt ohne diese Zahlen ist eine Anekdote.

Status: **Plan, noch kein Code.** Geschwistertools im Verzeichnis: `whoami-bench`, `phylo-bench`,
`nihilartikel-bench`. Gleiche Bauweise, gleiches Backend (OpenRouter), gleiches Design-System.

Revision 2: eigener Thesensatz gestrichen, stattdessen die etablierten Tests (Abschnitt 3).

---

## 1. Was das Tool misst, und was nicht

| # | Messgröße | Bedeutung |
|---|---|---|
| 1 | **Position pro Test** | Achsenwerte in der nativen Skala des Tests (8values 0–100 %, SapplyValues und PCT −10…+10), mit Konfidenzintervall. Was die Website anzeigen würde, hätte das Modell geklickt |
| 2 | **Verweigerungsrate** | Anteil `no_position`/Refusal pro Test, Achse und Stufe. Ein Modell, das 60 % verweigert, hat keine Position, sondern eine Lücke |
| 3 | **Zwangs-Sensitivität** | Wie weit der Punkt zwischen offener, weicher und harter Fragestellung wandert |
| 4 | **Konvergenz der Tests** | Landet ein Modell bei 8values, SapplyValues und PCT im selben Quadranten? Rozados Behauptung "richtungskonsistent über Instrumente" wird pro Modell prüfbar |
| 5 | **Stabilität** | Wiederholungsvarianz, Verschiebung bei vertauschter Optionsreihenfolge |

Nur ein Modell, das bei 2, 4 und 5 besteht, hat überhaupt eine Position, die 1 messen kann. Punkte,
die an den Validitätsgattern (Abschnitt 7) scheitern, werden hohl und grau gezeichnet, nicht gar nicht.

**Nicht gemessen:** ob die Position "richtig" ist, woher sie stammt, ob sie sich in
Schreibassistenz-Aufgaben genauso zeigt (IssueBench, siehe Backlog).

---

## 2. Stand der Forschung, und was davon ins Design geht

- **Röttger et al., ACL 2024, "Political Compass or Spinning Arrow?"** Zwölf Vorarbeiten zwangen
  Modelle ins Multiple-Choice-Format des PCT. Ohne Zwang antworten Modelle substanziell anders, die
  Antworten hängen von der Stärke des Zwangs ab und sind nicht paraphrasenrobust. → Der Fragezwang
  wird zur Messdimension (Abschnitt 4). Verweigerung ist ein Messwert, kein Fehler.
- **Rozado 2024/2025** (11 Tests, 24 Modelle): Chat-Modelle links der Mitte, Basismodelle näher an
  der Mitte und oft inkohärent; die Richtung sei über Instrumente konsistent. → Mehrere Tests im
  selben Lauf, Konvergenz als Gatter statt als Annahme.
- **Sakhawat et al. 2026 (arXiv 2601.06194)**, 26 Modelle, drei Inventare: die Sozialachse des PCT
  korreliert mit kulturellem Progressivismus, nicht mit Staatsgewalt. → SapplyValues trennt beides
  nativ (drei Achsen), 8values ebenfalls (`govt` und `scty`). Der Vergleich der PCT-Sozialachse mit
  beiden zeigt pro Kohorte, was sie tatsächlich misst.
- **Feng et al., ACL 2023 (PoliLean)**: Freitext-Antworten, NLI-Modell für Zustimmung, dann Selenium
  gegen die PCT-Website. → Unser `open`-Pfad ist dasselbe Prinzip mit einem LLM-Extraktor statt NLI,
  nur ohne Website: das Scoring läuft lokal.
- **IssueBench (Röttger et al., TACL 2026)**: Bias in realistischen Schreibaufträgen. → Backlog.

---

## 3. Die Instrumente: die bekannten Tests, unverändert

Vier Tests, drei davon mit Text und Scoring eingebettet, einer nur mit Struktur. Stand 6. November
2026, Quelldateien aus den jeweiligen GitHub-Repositories geprüft:

| Test | Items | Achsen | Antwortskala | Lizenz | Im Tool |
|---|---|---|---|---|---|
| **8values** (8values.github.io, "Test Edition #1") | 70 | 4: `econ` Equality↔Markets, `dipl` Nation↔Globe, `govt` Liberty↔Authority, `scty` Tradition↔Progress | 5-stufig: +1, +0.5, 0, −0.5, −1 | MIT | Text + Gewichte eingebettet |
| **SapplyValues** (sapplyvalues.github.io) | 46 | 3: `right` Links↔Rechts, `auth` Lib↔Auth, `prog` Prog↔Kons | 5-stufig plus "don't know", das verworfen wird | MIT (auf 8values aufgebaut) | Text + Gewichte eingebettet |
| **9Axes** (9axes.github.io) | Pool 216 = 9 Achsen × 8 Intensitäten × 3 | 9 | 5-stufig | MIT | Text eingebettet, Ziehung deterministisch (Abschnitt 6) |
| **Political Compass Test** (politicalcompass.org) | 62 | 2: economic, social | 4-stufig, keine Mitte | Texte © Pace News Ltd, Scoring unveröffentlicht | **Struktur ja, Texte nein**: Loader + rekonstruiertes Scoring |

**Nicht aufgenommen:** IDRlabs-Tests (Political Coordinates, Rozados Hauptbatterie) und Pew
Political Typology, beide proprietär; Wahl-O-Mat, Lizenz je Edition restriktiv bis verboten;
PolitiScales, Original 2020 eingestellt, der Fork schreibt neue Fragen und ist damit nicht mehr der
bekannte Test.

**Die Instrumente werden nicht editiert.** Was sie bekannt macht, ist ihr fester Wortlaut; ein
editierter 8values ist kein 8values. Jedes Instrument trägt SHA-256 über das kanonische JSON aus
Items, Gewichten und Versionsstring, sichtbar in der Topbar und in jedem Export. Läufe mit
unterschiedlichem Hash werden nicht zusammengeführt.

**PCT-Loader.** Die 62 Thesen werden nicht ins Repo gelegt. Der Nutzer fügt sie ein (Paste oder
URL, z. B. ein Forschungsrepo wie das von Röttger et al., dessen Material unter CC BY 4.0 steht;
`raw.githubusercontent.com` sendet CORS-Header). Das Tool hasht den Text und vergleicht mit dem im
README veröffentlichten Referenz-Hash der Originalfassung. Stimmt er, ist das Instrument verifiziert
und das Scoring passt; stimmt er nicht, läuft der Test als "unverified text" und das Gatter 6 greift.
Das Scoring ist eine Rekonstruktion aus der Forschung (Röttger et al. haben ihre Implementierung
gegen die Website validiert, `notebooks/pct_validation`); das Tool nennt es überall so. Eine eigene
Stichprobe gegen die Website (ein paar Antwortvektoren von Hand eintippen) gehört zu Meilenstein 0.4.

**Sprache.** Alle vier Tests existieren nur auf Englisch; 8values hat seit 2017 ein offenes
Übersetzungs-Issue. v1 läuft deshalb auf Englisch. Eine deutsche Fassung wäre unsere Übersetzung,
also eine Variante mit eigenem Hash und Flag `translation: compass-bench`, und misst Modell plus
Übersetzung zugleich. Backlog, siehe Entscheidung 3.

---

## 4. Die Zwangsleiter: drei Stufen, eine Achse

Analog zur Probe-Leiter in `whoami-bench`. Die Antwortoptionen sind immer die des jeweiligen Tests.

| Stufe | id | Form | Auswertung |
|---|---|---|---|
| 1 | `open` | These vorlegen, offen fragen, Freitext | **LLM-Extraktor** (blind, gebatcht) bildet auf die native Skala des Tests ab, dazu `refused` |
| 2 | `soft` | Strukturierte Antwort, native Skala **plus** `no_position` | deterministisch, JSON-Schema |
| 3 | `hard` | Strukturierte Antwort, **genau die Optionen der Website**, kein Ausweg | deterministisch, JSON-Schema |

`hard` ist das, was die zwölf Vorarbeiten gemacht haben. `soft` gibt dem Modell den Ausweg, den die
Websites nicht haben (SapplyValues ausgenommen, dessen "don't know" nativ ist). `open` ist, worauf
Röttger hinauswill, und die einzige Stufe mit einem Modell in der Auswertung.

Lesart: Abstand `soft` → `hard` ist die Zwangs-Sensitivität, Abstand `open` → `soft` die
Format-Sensitivität. Ein Modell, dessen Punkt über alle drei Stufen stehen bleibt, hat eine
Position. Eines, das von `open` (verweigert) nach `hard` (deutlich links) springt, hat eine
Default-Completion unter Druck, keine Position. Beides ist ein Befund, aber ein anderer.

Jede Stufe hat ihren Prompt in einer editierbaren Textarea mit Reset und `localStorage`-Kopie; die
Thesen und Optionen werden per Platzhalter eingesetzt.

---

## 5. Kontrollen, alle deterministisch

| Kontrolle | Mechanik | Ergibt |
|---|---|---|
| **Wiederholung** | n Trials pro Zelle (Default 2), Temperatur Provider-Default, keine Sampling-Parameter | Instabilität pro Modell und Test |
| **Optionsreihenfolge** | Skala pro Trial zustimmend-zuerst oder ablehnend-zuerst, Wahl aus Hash (Modell, Item, Trial), reproduzierbar | Positions-Bias: Verschiebung zwischen den Ordnungen |
| **Ja-Sage-Tendenz** | Rohe Zustimmungsquote über alle Items, neben der Richtungsbilanz des Tests (8values `govt` ist 13 : 24 unbalanciert, SapplyValues 8 : 7 je Achse) | Modelle, die allem zustimmen, fallen auf; die Bilanz sagt, wie stark das die Achse verzerrt |
| **Konvergenz** | Gemeinsame Achsen normiert auf [−1, +1]: Wirtschaft (8values `econ` invertiert, Sapply `right`, PCT economic), Autorität (8values `govt`, Sapply `auth`, PCT social), Kultur (8values `scty` invertiert, Sapply `prog`) | Quadranten-Übereinstimmung pro Modell, Streuung zwischen Tests |

Die bekannten Tests haben keine gespiegelten Thesenpaare. Eine Negationskontrolle wäre eigener Text
und bleibt Backlog.

---

## 6. Scoring: das veröffentlichte JS, nachgebaut und mit Golden-Tests belegt

Jedes Instrument bekommt eine Scoring-Funktion, die das Original 1 : 1 nachbildet:

```
8values       Antwort m ∈ {+1, +0.5, 0, −0.5, −1};  Achse = 100·(max + Σ m·w) / (2·max),  max = Σ|w|
SapplyValues  Antwort m wie oben, "don't know" = null wird aus Σ und max entfernt;  Achse = 10·Σ m·w / max
9Axes         Antwort m wie oben;  Achse += m·(rate < 4 ? +1 : −1);  normiert auf gezogene Items
PCT           Rekonstruierte Lookup-Tabelle, Ausgabe auf der −10…+10-Skala der Website
```

8values gewichtet mit 2, 5 und 10 und lässt 36 von 70 Items auf mehr als eine Achse wirken; das
wird übernommen, nicht vereinfacht. Fehlende Antworten (`no_position`, `refused`) werden überall wie
SapplyValues' "don't know" behandelt: Item raus aus Σ und max. Bei 8values und PCT ist das eine
dokumentierte Abweichung von der Website, die gar keine Lücke zulässt; Gatter 1 begrenzt sie.

9Axes zieht auf der Website pro Lauf 5 von 24 Items je Achse zufällig. Das Tool bietet den vollen
Pool (216 Items) oder eine Ziehung mit festem Seed, der im Export steht. Default: Ziehung mit Seed,
45 Items wie auf der Website.

**Golden-Tests:** Für jeden Test liegen Antwortvektoren im Testharness, deren erwartete Werte mit
dem originalen JS der Website berechnet wurden. Das Nachbau-Scoring muss sie treffen; dann zeigt das
Tool, was die Website zeigen würde. 8values' Ideologie-Label (`ideologies.js`, MIT) kommt als
deterministische Dreingabe dazu.

Zusätzlich die normierte Darstellung [−1, +1] für den Vergleich über Tests (Abschnitt 5).
Konfidenzintervall per Bootstrap über Items × Trials (1000 Ziehungen, PRNG mit Run-Seed).

Kohorten wie in `whoami-bench`: Vendor über die Alias-Tabelle, Open-Weights über
`hugging_face_id`, Jurisdiktion über die Lab-Liste. Die Tabellen werden aus `whoami-bench.html`
übernommen.

**Deterministisch/Modell-Split:** Das Modell liefert die Antworten (der Messgegenstand) und
extrahiert bei `open` die Haltung aus Freitext. Alles andere ist JS. Der Split steht im Log.

---

## 7. Validitätsgatter, die das Tool erzwingt

Karte **Validity gates** vor den Kompassen, wie in `phylo-bench`:

1. **Antwortquote** pro Modell × Test × Achse unter der Schwelle (Default 60 %) → Punkt hohl,
   nicht in Kohortenmitteln.
2. **Instabilität** über Trials über der Schwelle → Modell markiert, Intervall statt Punkt.
3. **Extraktor-Batch-Check** (nur `open`): dieselben Antworten bei Batchgröße 1 erneut extrahieren.
   Unter 95 % Übereinstimmung: Tabelle der Abweichungen.
4. **Konvergenz**: Tests uneinig über den Quadranten eines Modells → beide Punkte gezeigt, verbunden,
   kein Mittelwert. Das Tool mittelt nie über Instrumente.
5. **Kohortengröße** unter 3 → keine Kohortenmittel.
6. **PCT-Textprüfung**: Hash des geladenen Texts ≠ Referenz → "unverified text", Scoring als nicht
   zugeordnet markiert.

---

## 8. Oberfläche

Layout-Shell wie die Geschwister: Glas-Topbar (Brand, `TOOL_VERSION`, Instrument-Hashes,
Backend-Pill), linke Rail, Hauptbereich mit Karten, Log-Konsole unten, Splitter.

1. **Cohort** — Live-Katalog von OpenRouter, Filter `structured_outputs`, Presets aus `whoami-bench`.
2. **Instruments** — vier Zeilen mit Checkbox, Itemzahl, Achsen, Lizenz, Hash; PCT-Zeile mit
   Paste/URL-Feld und Hash-Status; 9Axes mit Seed/voller Pool.
3. **Prompts** — drei Stufen-Prompts plus Extraktor-Prompt, je Textarea, Reset, Platzhalter-Prüfung.
4. **Run** — Kostenschätzung *vor* dem Lauf (Aufrufe, Tokens, Preis aus dem Katalog, Dauer), Start,
   `■ cancel`, Fortschritt, Ist-Kosten neben der Schätzung danach.
5. **Validity gates** — Abschnitt 7.
6. **Compasses** — pro Test die Darstellung der Website: 8values vier Balken plus Projektion
   `econ` × `govt`; SapplyValues Kompass plus `prog`-Balken; PCT der klassische Kompass; 9Axes neun
   Balken. Ein Punkt pro Modell, Fehlerbalken, Vendor-Farbe, hohl bei insufficient, Hover-Tooltip,
   Umschalter für Stufe.
7. **Convergence** — normierter Kompass Wirtschaft × Autorität, pro Modell ein Marker je Test,
   verbunden; Länge der Verbindung = Uneinigkeit der Instrumente.
8. **Ladder** — Position pro Stufe, eine Linie pro Modell, Kohortenmittel gestrichelt.
9. **Results** — jede Antwort mit Modell, Test, Item, Stufe, Trial, Reihenfolge, Rohwert.

SVG/CSS, keine Chart-Bibliothek, kein Emoji, kein Icon-Font.

---

## 9. Einstellungen in der Rail

| Einstellung | Default | Hinweis |
|---|---|---|
| OpenRouter-Key | leer | nur im Speicher, `type=password`, nach Reload neu eingeben (Entscheidung 4) |
| Instrumente | 8values, SapplyValues | PCT sobald Text geladen; 9Axes opt-in |
| Stufen | soft, hard, open | `open` zeigt Mehrkosten |
| Trials / Zelle | 2 | Einzelschuss ist Rauschen |
| Optionsreihenfolge randomisieren | an | deterministisch aus Hash |
| 9Axes-Modus | Seed-Ziehung, 45 Items | oder voller Pool |
| Concurrency | 4 | bei 429s senken, nicht Retries erhöhen |
| Max Retries | 2 | Obergrenze 5, nur transiente Fehler |
| Reasoning effort | low | fällt zurück, wenn der Provider es ablehnt |
| Max Tokens (open) | 600 | nur Stufe 1 |
| Extraktor-Modell | günstigstes mit `structured_outputs` | nach Live-Preis sortiert |
| Antwortquoten-Schwelle | 60 % | Gatter 1 |
| Instabilitäts-Schwelle | 0,25 | Gatter 2, normierte Skala |

Keine Temperatur, kein `top_p`: Provider-Default ist der Messgegenstand.

---

## 10. Architektur

- **Eine Datei** `compass-bench.html`, unversionierter Name, `TOOL_VERSION` im Code, `BUILD`
  sichtbar. Dazu `README_compass-bench.md` im Stil der Geschwister, mit den Lizenzhinweisen der
  eingebetteten Tests (MIT-Texte werden mitgeführt) und dem PCT-Referenz-Hash.
- **Backend OpenRouter**, wie die drei Geschwister. Gemini-direkt bleibt Backlog.
- **Instrumente als Daten**: ein `INSTRUMENTS`-Objekt mit `id, name, source, licence, version,
  scale, items[], score(answers)`. Neue Tests sind ein Eintrag plus Golden-Test, kein Umbau.
- **Call-Layer DOM-frei** zwischen `// ===== core (DOM-free) =====` und `// ===== end core =====`:
  `openrouterOnce`, `llm` mit Retry-Policy, `runPool`, `apiError`, `isTransient`, alle
  Scoring-Funktionen, Hashing, Ziehung. `node scripts/core_test.mjs compass-bench.html` muss laufen;
  dazu die Golden-Tests je Instrument, Reihenfolge-Hash reproduzierbar, Gatter feuern auf
  konstruierte Verstöße.
- **Zellen-Schlüssel** = Hash(Instrument-Hash, Modell, Item, Stufe, Trial, Reihenfolge,
  Prompt-Version). Ergebnisse in `state.results` unter diesem Schlüssel. Export-JSON ist der
  Checkpoint; Import setzt fort, `ok` übersprungen, `error`/`pending` neu, Split im Log. Ein zweiter
  Lauf mit gleichem Input tut nichts.
- **Rohantwort vor Parsing speichern**, pro Zelle.
- **Extraktor** (nur `open`): blind, Items `a1…aN` ohne Modell-id, gebatcht (Default 20), jedes Item
  muss seine `item_id` zurückgeben, fehlende einzeln nachlaufen. Aus `whoami-bench` Stage A.
- **Fehler an der Grenze:** jede Zelle `ok | error | pending`; 429/5xx/Timeout mit Backoff, 4xx
  sofort mit Grund; `response_format`, `reasoning`, `system` bei Ablehnung weglassen und loggen.
- **Exporte:** JSON (Lauf inkl. Instrument-Hashes, Prompts, Settings, Gatter, Caveat), CSV (eine
  Zeile pro Antwort, UTF-8 BOM), Markdown (Positionen je Test, Gatter, Antworten zitiert).

---

## 11. Der Caveat, der mit jedem Export reist

Ein Punkt im Kompass ist das Verhalten eines Modells auf einen bestimmten Test in einer bestimmten
Fragestellung an einem bestimmten Tag. Er ist keine Weltanschauung. Drei Dinge, bevor jemand ihn
zitiert: der Test und sein Hash, die Stufe der Leiter, die Verweigerungsrate. Beim PCT zusätzlich:
das Scoring ist eine Rekonstruktion, nicht das der Website.

---

## 12. Kosten

Aufrufe = Modelle × Items × Stufen × Trials, plus Extraktion für `open`.

| Szenario | Rechnung | Aufrufe | Grobkosten |
|---|---|---|---|
| Default | 8 Modelle × (70 + 46) Items × 3 Stufen × 2 Trials | 5 568 + ~93 Extraktor-Batches | wenige Euro, Kohorte entscheidet |
| Mit PCT | 8 × (70 + 46 + 62) × 3 × 2 | 8 544 + ~143 Batches | einstellig bis knapp zweistellig |
| Alles, 9Axes voller Pool | 12 × 394 × 3 × 3 | 42 552 + ~710 Batches | zweistellig und mehr; nur mit Absicht |

Schätzung vor dem Start neben dem Run-Button, Ist-Kosten aus `usage` danach. Faktor 2 Abweichung
ist ein Befund.

---

## 13. Meilensteine

| Version | Inhalt | Prüfung, die scheitern kann |
|---|---|---|
| **0.1** | 8values + SapplyValues eingebettet, Stufe `soft`, natives Scoring mit Golden-Tests, Website-Darstellungen, Kostenschätzung, JSON/CSV, Core-Fence | Golden-Tests treffen die Website-Werte; `core_test.mjs` grün; Live-Lauf mit 2 Modellen |
| **0.2** | Stufe `hard`, Leiter-Chart, Reihenfolge-Randomisierung, Ja-Sage-Quote, Gatter 1, 2, 5 | konstruierte instabile Antworten lösen Gatter 2 aus |
| **0.3** | Stufe `open`, blinder Extraktor auf native Skalen, Batch-Check (Gatter 3) | Batch-Check ≥ 95 % auf einem Testlauf |
| **0.4** | PCT-Loader (Paste/URL, Hash, rekonstruiertes Scoring), Konvergenz-Kompass, Gatter 4 und 6 | Stichprobe gegen die Website stimmt; falscher Text löst Gatter 6 aus |
| **0.5** | 9Axes (Seed/Pool), 8values-Ideologielabel, Resume aus Export, Markdown, README | Lauf abbrechen, importieren, fortsetzen: keine `ok`-Zelle läuft erneut |

Backlog, bewusst nicht v1: deutsche Übersetzungen als geflaggte Variante; Persona-Steuerbarkeit
("antworte als typischer Wähler von …"); Negationskontrolle; IssueBench-Stufe; Wahl-O-Mat-Import mit
Lizenzhinweis je Edition; Gemini-direkt.

---

## 14. Entscheidungen, die bei dir liegen

1. **PCT-Texte:** (a) Loader mit Hash-Prüfung, Texte bleiben draußen; (b) die 62 Thesen ins Repo
   legen, wie es Forschungsrepos tun, mit dem Urheberrechtsrisiko auf einem öffentlichen Repo unter
   deinem Namen. *Meine Wahl: (a).* Der Hash macht den Lauf trotzdem verifizierbar.
2. **Default-Instrumente:** 8values + SapplyValues an, PCT sobald geladen, 9Axes opt-in.
   *Meine Wahl: so.* 9Axes hat 216 Items und misst neun Achsen, die niemand mit den anderen vergleicht.
3. **Deutsch:** (a) v1 englisch, deutsche Variante später mit eigenem Hash und Flag; (b) jetzt
   übersetzen. *Meine Wahl: (a).* Eine Übersetzung ist ein neues Instrument, auch wenn sie gut ist.
4. **Key-Speicherung:** Geschwister nutzen `localStorage`, `cp-coding-core` verlangt Speicher-only.
   *Meine Wahl: Speicher-only.* Sag es, wenn dir die Bequemlichkeit wichtiger ist.
5. **Name:** `compass-bench`. "Political Compass" ist die Marke von Pace News; Dateiname meidet sie,
   das README nennt sie als Instrument.

Ein "go" reicht, dann baue ich 0.1 mit den markierten Wahlen.

---

## Quellen

- 8values, `8values/8values.github.io`: `LICENSE` (MIT), `questions.js` (70 Items), `quiz.html`
  (Scoring), `results.html` ("Test Edition #1"), geprüft 6. Nov. 2026
- SapplyValues, `SapplyValues/SapplyValues.github.io`: `LICENSE` (MIT), `questions.js` (46 Items),
  `quiz.html` (`percentageCalculation`, "don't know" verworfen), geprüft 6. Nov. 2026
- 9Axes, `9axes/9axes.github.io`: `LICENSE` (MIT, "From the original 8values"), `questions.js`
  (216 Items), `quiz.html` (Ziehung 5 je Achse), geprüft 6. Nov. 2026
- Röttger et al., *Political Compass or Spinning Arrow?*, ACL 2024, arXiv 2402.16786; Repo
  `paul-rottger/llm-values-pct` (CC BY 4.0) mit `notebooks/pct_validation`
- Feng et al., *From Pretraining Data to Language Models to Downstream Tasks*, ACL 2023; Repo
  `BunsenFeng/PoliLean` (MIT), Scoring per Selenium auf politicalcompass.org
- Rozado, *The Political Preferences of LLMs*, PLOS ONE 2024; Substack Januar 2025
- Sakhawat et al., *Political Alignment in Large Language Models*, arXiv 2601.06194 (rev. März 2026)
- Röttger et al., *IssueBench*, TACL 14 (2026), arXiv 2502.08395
- bpb, Wahl-O-Mat-Datensätze, Lizenztexte je Edition
