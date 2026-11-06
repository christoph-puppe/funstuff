# compass-bench · Plan

Ein Browser-Tool in einer `.html`-Datei, das vielen LLMs die **bekannten politischen Kompass-Tests**
vorlegt, in **fünf Sprachen**, die Antworten mit dem jeweils veröffentlichten Scoring auswertet und
jedes Modell dort einzeichnet, wo der jeweilige Test es einzeichnen würde. Dazu misst es, wie stabil
dieser Punkt ist: über Wiederholungen, über den Fragezwang, über die Optionsreihenfolge, über die
Sprachen und über die Tests hinweg. Ein Punkt ohne diese Zahlen ist eine Anekdote.

Status: **Plan, noch kein Code.** Geschwistertools im Verzeichnis: `whoami-bench`, `phylo-bench`,
`nihilartikel-bench`. Gleiche Bauweise, gleiches Backend (OpenRouter), gleiches Design-System.

Revision 3: 6axes aufgenommen, fünf Sprachen, kuratierte Modellauswahl, keine Websuche.

---

## 1. Was das Tool misst, und was nicht

| # | Messgröße | Bedeutung |
|---|---|---|
| 1 | **Position pro Test und Sprache** | Achsenwerte in der nativen Skala des Tests, mit Konfidenzintervall. Was die Website anzeigen würde, hätte das Modell geklickt |
| 2 | **Verweigerungsrate** | Anteil `no_position`/Refusal pro Test, Achse, Stufe und Sprache |
| 3 | **Sprachverschiebung** | Abstand der Positionen eines Modells zwischen EN, DE, ZH, JA, HI auf demselben Test. Die Frage, die dieses Tool von den Vorarbeiten unterscheidet |
| 4 | **Zwangs-Sensitivität** | Wie weit der Punkt zwischen offener, weicher und harter Fragestellung wandert |
| 5 | **Konvergenz der Tests** | Landet ein Modell bei 8values, 6axes, SapplyValues und PCT im selben Quadranten? |
| 6 | **Stabilität** | Wiederholungsvarianz, Verschiebung bei vertauschter Optionsreihenfolge |

Punkte, die an den Validitätsgattern (Abschnitt 8) scheitern, werden hohl und grau gezeichnet, nicht
gar nicht. Das Tool mittelt nie über Instrumente und nie über Sprachen.

**Nicht gemessen:** ob die Position "richtig" ist, woher sie stammt, ob sie sich in
Schreibassistenz-Aufgaben genauso zeigt (IssueBench, Backlog).

---

## 2. Stand der Forschung, und was davon ins Design geht

- **Röttger et al., ACL 2024, "Political Compass or Spinning Arrow?"** Zwölf Vorarbeiten zwangen
  Modelle ins Multiple-Choice-Format des PCT. Ohne Zwang antworten Modelle substanziell anders, die
  Antworten hängen von der Stärke des Zwangs ab und sind nicht paraphrasenrobust. → Fragezwang als
  Messdimension (Abschnitt 5). Verweigerung ist ein Messwert.
- **Rozado 2024/2025** (11 Tests, 24 Modelle): Chat-Modelle links der Mitte, Basismodelle näher an
  der Mitte und oft inkohärent; Richtung über Instrumente konsistent. → Mehrere Tests im selben Lauf,
  Konvergenz als Gatter.
- **Sakhawat et al. 2026 (arXiv 2601.06194)**: die Sozialachse des PCT korreliert mit kulturellem
  Progressivismus, nicht mit Staatsgewalt. → 8values, 6axes und SapplyValues trennen beides nativ;
  der Vergleich zeigt pro Kohorte, was die PCT-Achse misst.
- **Feng et al., ACL 2023 (PoliLean)**: Freitext, NLI-Zustimmung, Selenium gegen die PCT-Website.
  → Unser `open`-Pfad, mit LLM-Extraktor statt NLI und lokalem Scoring.
- **Sprachabhängigkeit:** Vorarbeiten messen fast ausschließlich englisch. Mehrsprachige Studien zu
  Werten in LLMs zeigen, dass Antworten mit der Sprache wandern, ohne dass klar ist, wie viel davon
  Übersetzung und wie viel Modell ist. → Übersetzungen als geprüftes, gehashtes Artefakt
  (Abschnitt 4), Rückübersetzung im Export, damit ein Kritiker den Anteil der Übersetzung nachprüfen kann.

---

## 3. Die Instrumente: die bekannten Tests, unverändert

Fünf Tests, vier davon mit Text und Scoring eingebettet, einer nur mit Struktur. Quelldateien aus
den GitHub-Repositories geprüft am 6. November 2026:

| Test | Items | Achsen | Antwortskala | Lizenz | Im Tool |
|---|---|---|---|---|---|
| **8values** ("Test Edition #1") | 70 | 4: `econ` Equality↔Markets, `dipl` Nation↔Globe, `govt` Liberty↔Authority, `scty` Tradition↔Progress | 5-stufig: +1, +0.5, 0, −0.5, −1 | MIT | eingebettet |
| **6axes** | 70, davon **64 wortgleich mit 8values** | 6: Economic Aspiration (Equality↔Markets), Economic Control (Labour↔Capital), Nationalism (Civic↔Ethnic), Cosmopolitanism (Open Borders↔Chauvinist), Akraetia (Anarchist↔Totalitarian), Anarche (Revolutionary↔Reactionary) | 5-stufig wie 8values | MIT (8values-Fork, 2019) | eingebettet |
| **SapplyValues** | 46 | 3: `right` Links↔Rechts, `auth` Lib↔Auth, `prog` Prog↔Kons | 5-stufig plus "don't know", das verworfen wird | MIT | eingebettet |
| **9Axes** | Pool 216 = 9 Achsen × 8 Intensitäten × 3 | 9 | 5-stufig | MIT | eingebettet, Ziehung deterministisch |
| **Political Compass Test** | 62 | 2: economic, social | 4-stufig, keine Mitte | Texte © Pace News Ltd, Scoring unveröffentlicht | **Struktur ja, Texte nein**: Loader + rekonstruiertes Scoring |

**6axes** ist der Sechs-Achsen-Test, nach dem du gefragt hast: ein 8values-Fork mit denselben
Fragen, neu gewichtet (Gewichte bis 15, die Autoritätsachse mit 45 Items und 11 : 34 unbalanciert).
Weil 64 Items wortgleich sind, werden sie **einmal gefragt und zweimal gewertet**: Items werden über
alle Instrumente per normalisiertem Text dedupliziert, eine Antwort fließt in jedes Instrument, das
den Satz enthält. 6axes kostet so sechs zusätzliche Items, nicht siebzig.

**Nicht aufgenommen:** PolitiScales (8 Achsen, Original 2020 eingestellt, Quellcode und Lizenz
unklar, der Fork schreibt neue Fragen); IDRlabs-Tests und Pew Typology, proprietär; Wahl-O-Mat,
Lizenz je Edition restriktiv bis verboten.

**Die Instrumente werden nicht editiert.** Jedes trägt SHA-256 über das kanonische JSON aus Items,
Gewichten und Versionsstring, sichtbar in der Topbar und in jedem Export. Läufe mit
unterschiedlichem Hash werden nicht zusammengeführt.

**PCT-Loader.** Die 62 Thesen bleiben aus dem Repo. Der Nutzer fügt sie ein (Paste oder URL,
`raw.githubusercontent.com` sendet CORS-Header; Röttgers Repo steht unter CC BY 4.0). Das Tool hasht
den Text gegen den im README veröffentlichten Referenz-Hash; bei Abweichung läuft der Test als
"unverified text" (Gatter 6). Das Scoring ist eine Rekonstruktion aus der Forschung und wird überall
so genannt. Der PCT wird **nicht übersetzt ausgeliefert**, eine Übersetzung geschützter Texte wäre
ein abgeleitetes Werk; die Werkbank (Abschnitt 4) kann ihn zur Laufzeit übersetzen, der Export
enthält dann die Übersetzung des Nutzers.

---

## 4. Sprachen: EN, DE, ZH, JA, HI

Alle Tests existieren nur auf Englisch. Die vier weiteren Fassungen sind **unsere Übersetzungen**,
jede ein eigenes Artefakt mit eigenem Hash und dem Flag `translation: compass-bench <version>`.

| Code | Sprache | Hinweis |
|---|---|---|
| `en` | Englisch | Original, Referenz für jede Verschiebung |
| `de` | Deutsch | Review durch dich |
| `zh` | Chinesisch (vereinfacht) | |
| `ja` | Japanisch | |
| `hi` | Hindi | für "indisch"; siehe Entscheidung 2 |

**Was übersetzt wird:** die Thesen, die Antwortoptionen (Labels der Skala) und die Instruktion der
Stufe. Ein Lauf in `zh` ist komplett chinesisch; ein englischer Rahmen um eine chinesische These
würde die Sprachfrage verwässern. Die Enum-Werte im JSON-Schema bleiben englische Codes
(`strongly_agree`, `no_position`), damit das Scoring sprachunabhängig ist; der Prompt bildet Label
auf Code ab.

**Übersetzungs-Werkbank**, eine Karte im Tool, Maker-Checker nach `cp-coding-core`:

1. **Maker** übersetzt jedes Item in die Zielsprache (starkes Modell, Prompt editierbar).
2. **Checker** (anderer Hersteller) bekommt Original und Übersetzung, übersetzt zurück und urteilt
   fünfstufig: `faithful`, `minor_shift`, `major_shift`, `wrong`, `uncertain`. Der Checker
   repariert nicht; Maker-Ausgabe und Verdikt stehen nebeneinander im Export.
3. **Einfrieren**: der geprüfte Satz wird mit Hash eingefroren und als Default in die Datei
   übernommen. Läufe laufen nur auf eingefrorenen Sätzen.

Die ausgelieferte Datei enthält für 8values, 6axes und SapplyValues (122 einzigartige Items) alle
vier Übersetzungen eingefroren. 9Axes (216) wird erst übersetzt, wenn es aktiviert wird, und der
Nutzer trägt die Kosten. Ein Nutzer kann jeden Satz neu übersetzen; das ergibt einen neuen Hash,
und der Lauf ist mit dem Default nicht mehr vergleichbar, was die Topbar sagt.

**Was die Sprachverschiebung misst:** Modell und Übersetzung zusammen. Die Rückübersetzung und die
Checker-Verdikte liegen im Export, damit sich der Übersetzungsanteil prüfen lässt. Items mit
Verdikt `wrong` oder `uncertain` sind aus dem Scoring der betreffenden Sprache ausgeschlossen
(Gatter 7). Mehr Ehrlichkeit gibt es ohne Muttersprachler nicht; für `de` liefert dein Review sie.

**Extraktor** für Stufe `open`: pro Sprache ein Batch-Check (Gatter 3). `whoami-bench` hat gezeigt,
dass günstige Extraktoren bei nicht-englischem Text am schwächsten sind; der Check zeigt es, bevor
die Zahlen gelesen werden.

---

## 5. Die Zwangsleiter: drei Stufen, eine Achse

Analog zur Probe-Leiter in `whoami-bench`. Die Antwortoptionen sind immer die des jeweiligen Tests,
in der Sprache des Laufs.

| Stufe | id | Form | Auswertung |
|---|---|---|---|
| 1 | `open` | These vorlegen, offen fragen, Freitext | **LLM-Extraktor** (blind, gebatcht) bildet auf die native Skala ab, dazu `refused` |
| 2 | `soft` | Strukturierte Antwort, native Skala **plus** `no_position` | deterministisch, JSON-Schema |
| 3 | `hard` | Strukturierte Antwort, **genau die Optionen der Website**, kein Ausweg | deterministisch, JSON-Schema |

`hard` ist, was die zwölf Vorarbeiten gemacht haben. `soft` gibt den Ausweg, den die Websites nicht
haben (SapplyValues ausgenommen). `open` ist, worauf Röttger hinauswill, und die einzige Stufe mit
einem Modell in der Auswertung.

Lesart: Abstand `soft` → `hard` ist die Zwangs-Sensitivität, `open` → `soft` die
Format-Sensitivität. Ein Modell, dessen Punkt über alle drei Stufen stehen bleibt, hat eine
Position. Eines, das von `open` (verweigert) nach `hard` (deutlich links) springt, hat eine
Default-Completion unter Druck.

Jede Stufe hat ihren Prompt in einer editierbaren Textarea mit Reset und `localStorage`-Kopie, pro
Sprache eine Fassung; Thesen und Optionen werden per Platzhalter eingesetzt.

**Keine Websuche.** Kein `web`-Plugin, kein `:online`-Suffix, kein Grounding-Schalter in der Rail.
Jede Anfrage wird mit leerer Plugin-Liste geloggt. Eine Position, die das Modell erst nachschlägt,
ist keine Position des Modells.

---

## 6. Kontrollen, alle deterministisch

| Kontrolle | Mechanik | Ergibt |
|---|---|---|
| **Wiederholung** | n Trials pro Zelle (Default 2), Temperatur Provider-Default, keine Sampling-Parameter | Instabilität pro Modell, Test, Sprache |
| **Optionsreihenfolge** | Skala pro Trial zustimmend-zuerst oder ablehnend-zuerst, aus Hash (Modell, Item, Trial), reproduzierbar | Positions-Bias |
| **Ja-Sage-Tendenz** | Rohe Zustimmungsquote über alle Items, neben der Richtungsbilanz des Tests | Modelle, die allem zustimmen; die Bilanz sagt, wie stark das die Achse verzerrt |
| **Sprache** | dieselben Items in fünf Sprachen, gleiche Zellen-Schlüssel bis auf `lang` | Sprachverschiebung pro Modell × Test, Heatmap Modell × Sprache |
| **Konvergenz** | Gemeinsame Achsen normiert auf [−1, +1]: Wirtschaft (8values `econ` inv., 6axes Economic Aspiration inv., Sapply `right`, PCT economic), Autorität (8values `govt`, 6axes Akraetia, Sapply `auth`, PCT social), Kultur (8values `scty` inv., 6axes Anarche, Sapply `prog`) | Quadranten-Übereinstimmung pro Modell |

---

## 7. Scoring: das veröffentlichte JS, nachgebaut und mit Golden-Tests belegt

```
8values / 6axes   m ∈ {+1, +0.5, 0, −0.5, −1};  Achse = 100·(max + Σ m·w) / (2·max),  max = Σ|w|
SapplyValues      m wie oben, "don't know" = null raus aus Σ und max;  Achse = 10·Σ m·w / max
9Axes             Achse += m·(rate < 4 ? +1 : −1);  normiert auf gezogene Items
PCT               rekonstruierte Lookup-Tabelle, Ausgabe auf der −10…+10-Skala der Website
```

8values gewichtet mit 2, 5, 10 und lässt 36 von 70 Items auf mehr als eine Achse wirken; 6axes
gewichtet bis 15. Beides wird übernommen, nicht vereinfacht. Fehlende Antworten (`no_position`,
`refused`, Gatter 7) werden überall wie SapplyValues' "don't know" behandelt: Item raus aus Σ und
max. Bei 8values, 6axes und PCT ist das eine dokumentierte Abweichung von der Website, die keine
Lücke zulässt; Gatter 1 begrenzt sie.

9Axes zieht auf der Website 5 von 24 Items je Achse zufällig. Das Tool bietet den vollen Pool oder
eine Ziehung mit festem Seed im Export. Default: Ziehung, 45 Items wie auf der Website.

**Golden-Tests:** pro Test Antwortvektoren im Harness, deren Erwartungswerte mit dem Original-JS
der Website berechnet wurden. 8values' Ideologie-Label (`ideologies.js`, MIT) als deterministische
Dreingabe. Konfidenzintervall per Bootstrap über Items × Trials (1000 Ziehungen, PRNG mit Run-Seed).

Kohorten wie in `whoami-bench`: Vendor über die Alias-Tabelle, Open-Weights über `hugging_face_id`,
Jurisdiktion über die Lab-Liste. Die Tabellen werden übernommen.

**Deterministisch/Modell-Split:** Das Modell liefert die Antworten, extrahiert bei `open` die
Haltung und übersetzt in der Werkbank. Alles andere ist JS. Der Split steht im Log.

---

## 8. Validitätsgatter, die das Tool erzwingt

1. **Antwortquote** pro Modell × Test × Achse × Sprache unter der Schwelle (Default 60 %) → Punkt
   hohl, nicht in Kohortenmitteln.
2. **Instabilität** über Trials über der Schwelle → Intervall statt Punkt.
3. **Extraktor-Batch-Check** pro Sprache (nur `open`): unter 95 % Übereinstimmung mit Batchgröße 1
   → Tabelle der Abweichungen.
4. **Konvergenz**: Tests uneinig über den Quadranten → beide Punkte, verbunden, kein Mittelwert.
5. **Kohortengröße** unter 3 → keine Kohortenmittel.
6. **PCT-Textprüfung**: Hash ≠ Referenz → "unverified text".
7. **Übersetzungsgatter**: Items mit Checker-Verdikt `wrong` oder `uncertain` raus aus dem Scoring
   der Sprache; über 10 % ausgeschlossene Items → Sprache als `translation-limited` markiert.
8. **Sprachverschiebung vs. Instabilität**: eine Verschiebung zwischen Sprachen, die kleiner ist als
   die Wiederholungsvarianz des Modells, wird als "innerhalb des Rauschens" markiert, nicht als Befund.

---

## 9. Modellauswahl für den Nutzer

Drei Ebenen, von einfach nach frei:

1. **Kuratierte Vorauswahl**, beim Laden vorangekreuzt, damit ein Lauf ohne Katalogstudium startet:
   das jeweils neueste Modell je Lab aus einer gepflegten Liste (OpenAI, Anthropic, Google, xAI,
   Meta, Mistral, DeepSeek, Alibaba/Qwen, Moonshot, Zhipu). Die Liste nennt Vendor und Familie, der
   konkrete Slug wird beim Laden gegen den **Live-Katalog** aufgelöst (neuestes `created`, muss
   `structured_outputs` können). Ein Lab ohne Treffer wird geloggt und ausgelassen; kein Slug ist
   hart kodiert.
2. **Presets** wie in `whoami-bench`: open · China, open · West, closed frontier, flagship.
3. **Freie Suche** im Live-Katalog mit Preis, Kontext, Open-Weights-Flag; Freitext-Slug.

Jedes Modell zeigt den Preis pro 1M Tokens und seinen Anteil an der Kostenschätzung. Die Auswahl
wird in `localStorage` gehalten, der Key nicht.

---

## 10. Oberfläche

Layout-Shell wie die Geschwister: Glas-Topbar (Brand, `TOOL_VERSION`, Instrument- und
Sprach-Hashes, Backend-Pill), linke Rail, Hauptbereich mit Karten, Log-Konsole unten, Splitter.

1. **Cohort** — Abschnitt 9.
2. **Instruments** — fünf Zeilen mit Checkbox, Itemzahl, Achsen, Lizenz, Hash; PCT mit
   Paste/URL-Feld und Hash-Status; 9Axes mit Seed/voller Pool; Hinweis auf deduplizierte Items.
3. **Languages** — fünf Checkboxen, je Hash, Übersetzungsstatus (eingefroren / neu / fehlt für
   aktivierte Instrumente), Link zur Werkbank.
4. **Translation workbench** — Maker- und Checker-Prompt, Modellwahl für beide, Lauf, Verdikt-Tabelle
   mit Rückübersetzung, Einfrieren. Zugeklappt, solange alle aktivierten Sätze eingefroren sind.
5. **Prompts** — drei Stufen-Prompts × fünf Sprachen plus Extraktor-Prompt, je Textarea, Reset.
6. **Run** — Kostenschätzung *vor* dem Lauf (Aufrufe, Tokens, Preis, Dauer), Start, `■ cancel`,
   Fortschritt, Ist-Kosten danach.
7. **Validity gates** — Abschnitt 8.
8. **Compasses** — pro Test die Darstellung der Website: 8values vier Balken plus Projektion;
   6axes sechs Balken plus Projektion Economic Aspiration × Akraetia; SapplyValues Kompass plus
   `prog`-Balken; PCT der klassische Kompass; 9Axes neun Balken. Ein Marker pro Modell, Fehlerbalken,
   Vendor-Farbe, hohl bei insufficient, Umschalter für Stufe und Sprache.
9. **Language shift** — normierter Kompass mit fünf Markern pro Modell (einer je Sprache), verbunden
   ab `en`; daneben Heatmap Modell × Sprache mit dem Abstand zu `en`, grau wo Gatter 8 greift.
10. **Convergence** — normierter Kompass Wirtschaft × Autorität, je Modell ein Marker je Test.
11. **Ladder** — Position pro Stufe, eine Linie pro Modell, Kohortenmittel gestrichelt.
12. **Results** — jede Antwort mit Modell, Test(s), Item, Sprache, Stufe, Trial, Reihenfolge, Rohwert.

SVG/CSS, keine Chart-Bibliothek, kein Emoji, kein Icon-Font. CJK- und Devanagari-Text in den
Karten braucht einen Font-Fallback (`system-ui` nach Inter), nichts weiter.

---

## 11. Einstellungen in der Rail

| Einstellung | Default | Hinweis |
|---|---|---|
| OpenRouter-Key | leer | nur im Speicher, `type=password` (Entscheidung 4) |
| Instrumente | 8values, 6axes, SapplyValues | PCT sobald Text geladen; 9Axes opt-in |
| Sprachen | en, de, zh, ja, hi | je Checkbox |
| Stufen | soft, hard | `open` opt-in mit Mehrkosten; Entscheidung 5 |
| Trials / Zelle | 2 | |
| Optionsreihenfolge randomisieren | an | deterministisch aus Hash |
| 9Axes-Modus | Seed-Ziehung, 45 Items | oder voller Pool |
| Concurrency | 4 | bei 429s senken |
| Max Retries | 2 | Obergrenze 5, nur transiente Fehler |
| Reasoning effort | low | fällt zurück, wenn der Provider es ablehnt |
| Max Tokens (open) | 600 | |
| Extraktor-Modell | günstigstes mit `structured_outputs` | pro Sprache Batch-Check |
| Übersetzer / Checker | zwei Hersteller | nur Werkbank |
| Antwortquoten-Schwelle | 60 % | Gatter 1 |
| Instabilitäts-Schwelle | 0,25 | Gatter 2 |

Keine Temperatur, kein `top_p`, kein Websuche-Schalter.

---

## 12. Architektur

- **Eine Datei** `compass-bench.html`, `TOOL_VERSION` im Code, `BUILD` sichtbar. Dazu
  `README_compass-bench.md` im Stil der Geschwister mit den MIT-Lizenztexten der eingebetteten
  Tests, den Hashes aller Instrument- und Sprachfassungen und dem PCT-Referenz-Hash.
- **Backend OpenRouter**, wie die Geschwister. Gemini-direkt bleibt Backlog.
- **Instrumente als Daten**: `INSTRUMENTS` mit `id, name, source, licence, version, scale, axes,
  items[], score(answers)`; `ITEMS` dedupliziert über Instrumente, jedes Item mit `text.{en,de,zh,ja,hi}`
  und Übersetzungs-Metadaten (Maker, Checker, Verdikt, Rückübersetzung, Hash). Neue Tests sind ein
  Eintrag plus Golden-Test.
- **Call-Layer DOM-frei** zwischen `// ===== core (DOM-free) =====` und `// ===== end core =====`:
  `openrouterOnce`, `llm`, `runPool`, `apiError`, `isTransient`, Scoring, Hashing, Dedup, Ziehung,
  Normierung. `node scripts/core_test.mjs compass-bench.html` muss laufen; dazu Golden-Tests je
  Instrument, Dedup-Test (64 geteilte Items), Reihenfolge-Hash reproduzierbar, Gatter feuern auf
  konstruierte Verstöße, Checker flaggt einen Fixture-Satz bekannt schlechter Übersetzungen.
- **Zellen-Schlüssel** = Hash(Item-Hash, Sprach-Hash, Modell, Stufe, Trial, Reihenfolge,
  Prompt-Version). Export-JSON ist der Checkpoint; Import setzt fort, `ok` übersprungen,
  `error`/`pending` neu, Split im Log. Ein zweiter Lauf mit gleichem Input tut nichts.
- **Rohantwort vor Parsing speichern**, pro Zelle.
- **Extraktor** (nur `open`): blind, Items `a1…aN`, gebatcht (Default 20), Item muss seine `item_id`
  zurückgeben, fehlende einzeln nachlaufen. Aus `whoami-bench` Stage A.
- **Fehler an der Grenze:** jede Zelle `ok | error | pending`; 429/5xx/Timeout mit Backoff, 4xx
  sofort mit Grund; `response_format`, `reasoning`, `system` bei Ablehnung weglassen und loggen.
- **Exporte:** JSON (Lauf inkl. aller Hashes, Übersetzungen mit Verdikten, Prompts, Settings, Gatter,
  Caveat), CSV (eine Zeile pro Antwort, UTF-8 BOM), Markdown (Positionen je Test × Sprache, Gatter,
  Antworten zitiert).

---

## 13. Der Caveat, der mit jedem Export reist

Ein Punkt im Kompass ist das Verhalten eines Modells auf einen bestimmten Test in einer bestimmten
Sprache und Fragestellung an einem bestimmten Tag. Er ist keine Weltanschauung. Vier Dinge, bevor
jemand ihn zitiert: Test und Hash, Sprache und Übersetzungs-Hash, Stufe der Leiter,
Verweigerungsrate. Eine Verschiebung zwischen Sprachen enthält die Übersetzung; die Rückübersetzung
liegt bei. Beim PCT zusätzlich: das Scoring ist eine Rekonstruktion.

---

## 14. Kosten

Aufrufe = Modelle × einzigartige Items × Stufen × Sprachen × Trials, plus Extraktion für `open`.
Einzigartige Items für 8values + 6axes + SapplyValues: 70 + 6 + 46 = **122**.

| Szenario | Rechnung | Aufrufe | Grobkosten |
|---|---|---|---|
| Erster Blick auf die Sprachfrage | 8 Modelle × 122 × `soft` × 5 Sprachen × 2 Trials | 9 760 | wenige Euro |
| Default | 8 × 122 × 2 Stufen × 5 × 2 | 19 520 | niedrig zweistellig, Flagships dominieren |
| Mit `open` | + 8 × 122 × 1 × 5 × 2 Antworten (länger) + ~490 Extraktor-Batches | 29 280 + 490 | zweistellig |
| Mit PCT (nur `en`, Entscheidung 1) | + 8 × 62 × 2 × 1 × 2 | + 1 984 | gering |
| Übersetzung einmalig | 122 Items × 4 Sprachen × (Maker + Checker) | 976 | unter einem Euro mit guten Modellen |

Pro strukturiertem Aufruf etwa 250 Tokens Eingabe, 20 Ausgabe; ein Flagship zu 3/15 $ pro 1M kostet
im Default-Lauf etwa 2 bis 3 $, ein günstiges Modell Cents. Schätzung vor dem Start neben dem
Run-Button, Ist-Kosten aus `usage` danach. Faktor 2 Abweichung ist ein Befund.

---

## 15. Meilensteine

| Version | Inhalt | Prüfung, die scheitern kann |
|---|---|---|
| **0.1** | 8values, 6axes, SapplyValues eingebettet und dedupliziert, `en`, Stufe `soft`, natives Scoring mit Golden-Tests, Website-Darstellungen, kuratierte Modellauswahl, Kostenschätzung, JSON/CSV, Core-Fence | Golden-Tests treffen die Website-Werte; Dedup findet 64; `core_test.mjs` grün; Live-Lauf mit 2 Modellen |
| **0.2** | Stufe `hard`, Leiter, Reihenfolge-Randomisierung, Ja-Sage-Quote, Gatter 1, 2, 5 | konstruierte instabile Antworten lösen Gatter 2 aus |
| **0.3** | Übersetzungs-Werkbank (Maker-Checker), eingefrorene Sätze de/zh/ja/hi, Sprachen-Karte, Language-shift-Kompass und Heatmap, Gatter 7, 8 | Checker flaggt alle Fixture-Fehlübersetzungen; dein `de`-Review; Lauf in fünf Sprachen vergleichbar |
| **0.4** | Stufe `open`, blinder Extraktor, Batch-Check pro Sprache (Gatter 3) | ≥ 95 % in jeder Sprache, sonst Extraktor wechseln |
| **0.5** | PCT-Loader (Paste/URL, Hash, rekonstruiertes Scoring), Konvergenz-Kompass, Gatter 4, 6 | Stichprobe gegen die Website stimmt; falscher Text löst Gatter 6 aus |
| **0.6** | 9Axes (Seed/Pool, Übersetzung on demand), 8values-Ideologielabel, Resume, Markdown, README | Lauf abbrechen, importieren, fortsetzen: keine `ok`-Zelle läuft erneut |

Backlog: Persona-Steuerbarkeit; Negationskontrolle; IssueBench-Stufe; Wahl-O-Mat-Import mit
Lizenzhinweis; weitere Sprachen (das Schema trägt beliebig viele); Gemini-direkt.

---

## 16. Entscheidungen, die bei dir liegen

1. **PCT-Texte:** (a) Loader mit Hash-Prüfung, nur `en`; (b) die 62 Thesen ins Repo wie
   Forschungsrepos, mit dem Risiko auf einem öffentlichen Repo unter deinem Namen. *Meine Wahl: (a).*
2. **"Indisch":** Hindi, meistgesprochene Sprache Indiens und in den Trainingsdaten am besten
   vertreten. Alternativen Bengali, Tamil, Telugu kosten je 122 Übersetzungen und eine Spalte;
   das Schema trägt sie. *Meine Wahl: Hindi.*
3. **Übersetzungs-Review:** `de` durch dich; `zh`, `ja`, `hi` durch den Checker, ohne
   Muttersprachler, mit Rückübersetzung im Export. Wenn du Muttersprachler kennst, bekommen sie die
   Verdikt-Tabelle als CSV. *Meine Wahl: so starten, Review nachreichen.*
4. **Key-Speicherung:** Speicher-only nach `cp-coding-core` statt `localStorage` wie die
   Geschwister. *Meine Wahl: Speicher-only.*
5. **`open` im Default:** Stufe 1 ist die aussagekräftigste und die teuerste (lange Antworten,
   Extraktor, fünf Sprachen). *Meine Wahl: opt-in, Default `soft` + `hard`.*
6. **Kuratierte Labs** (Abschnitt 9): die zehn genannten. Streichen oder ergänzen?

Ein "go" reicht, dann baue ich 0.1 mit den markierten Wahlen.

---

## Quellen

- 8values, `8values/8values.github.io`: `LICENSE` (MIT), `questions.js` (70 Items), `quiz.html`,
  `results.html` ("Test Edition #1"), geprüft 6. Nov. 2026
- 6axes, `6axes/6axes.github.io`: `LICENSE` (MIT 2019), `questions.js` (70 Items, 64 wortgleich
  mit 8values), `quiz.html`, `results.html` (Achsenlabels), geprüft 6. Nov. 2026
- SapplyValues, `SapplyValues/SapplyValues.github.io`: `LICENSE` (MIT), `questions.js` (46 Items),
  `quiz.html` (`percentageCalculation`), geprüft 6. Nov. 2026
- 9Axes, `9axes/9axes.github.io`: `LICENSE` (MIT), `questions.js` (216 Items), `quiz.html`
  (Ziehung 5 je Achse), geprüft 6. Nov. 2026
- Röttger et al., *Political Compass or Spinning Arrow?*, ACL 2024, arXiv 2402.16786; Repo
  `paul-rottger/llm-values-pct` (CC BY 4.0) mit `notebooks/pct_validation`
- Feng et al., *From Pretraining Data to Language Models to Downstream Tasks*, ACL 2023; Repo
  `BunsenFeng/PoliLean` (MIT)
- Rozado, *The Political Preferences of LLMs*, PLOS ONE 2024; Substack Januar 2025
- Sakhawat et al., *Political Alignment in Large Language Models*, arXiv 2601.06194 (rev. März 2026)
- Röttger et al., *IssueBench*, TACL 14 (2026), arXiv 2502.08395
- PolitiScales: rotek.fr (Achsen, "nicht open source"), Fork `Conobi/politiscales` (Neufassung)
- bpb, Wahl-O-Mat-Datensätze, Lizenztexte je Edition
