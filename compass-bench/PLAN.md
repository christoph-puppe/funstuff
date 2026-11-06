# compass-bench · Plan

Ein Browser-Tool in einer `.html`-Datei, das vielen LLMs die **bekannten politischen Kompass-Tests**
vorlegt, in **fünf Sprachen**, die Antworten mit dem jeweils veröffentlichten Scoring auswertet und
jedes Modell dort einzeichnet, wo der jeweilige Test es einzeichnen würde. Dazu misst es, wie stabil
dieser Punkt ist: über Wiederholungen, über den Fragezwang, über die Optionsreihenfolge, über die
Sprachen und über die Tests hinweg. Ein Punkt ohne diese Zahlen ist eine Anekdote.

Status: **Meilensteine 0.1 und 0.2 gebaut** (`compass-bench.html` 0.2.0, Build 2026-11-06.2), Rest Plan. Geschwistertools im Verzeichnis: `whoami-bench`, `phylo-bench`,
`nihilartikel-bench`. Gleiche Bauweise, gleiches Backend (OpenRouter), gleiches Design-System.

Revision 6: Übersetzung einmalig durch Claude mit Sub-Agenten, Ergebnis als JSON im Repo; Stufen,
Sprachen und Trials sind Opt-in, der Default ist ein Durchgang `soft`, nur Englisch, ein Trial:
182 Aufrufe pro Modell.

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
- **"An error budget for political-bias measurement in LLMs" (2026, Zenodo 10.5281/zenodo.22968158,
  eingereicht bei *Political Analysis*)**: 19 Modelle, 11 Labs, PCT und 8values je 60-mal, dazu
  SapplyValues und Pew; alles über OpenRouter. Instrument- und Achsenwahl erklären **52 %** der
  Varianz eines Scores, Modellidentität **13 %**, Wiederholungsrauschen **35 %**. Wer fragt (Asker-
  Identität, η² = 0,79), ob Items invertiert sind (17 von 18 Modellen verschieben sich) und das
  Antwortformat wiegen jeweils schwerer als das Modell. PCT und 8values scheitern am Test auf
  konvergente Validität (r = −0,26 zwischen den Instrumenten). Die Richtung des Links-Lehnens
  reproduziert sich, die Beträge sind zwischen Studien nicht vergleichbar. Die Autoren fordern einen
  Mindeststandard: Instrument nennen, Asker-Bedingung angeben, Wiederholungen und Streuung berichten,
  Varianzzerlegung liefern, Kontaminationscheck, Item-Ergebnisse. → Das Tool rechnet die
  **Varianzzerlegung selbst** (Abschnitt 7) und schreibt den Mindeststandard in jeden Export
  (Abschnitt 13). Die Asker-Identität bleibt neutral und steht im Export; Item-Inversion wandert aus
  dem Backlog in Meilenstein 0.6, weil derselbe Sub-Agenten-Durchgang wie für die Übersetzung das
  erledigt.
- **Sprachabhängigkeit:** Vorarbeiten messen fast ausschließlich englisch. Mehrsprachige Studien zu
  Werten in LLMs zeigen, dass Antworten mit der Sprache wandern, ohne dass klar ist, wie viel davon
  Übersetzung und wie viel Modell ist. → Übersetzungen als geprüftes, gehashtes Artefakt
  (Abschnitt 4), Rückübersetzung im Export, damit ein Kritiker den Anteil der Übersetzung nachprüfen kann.

---

## 3. Die Instrumente: die bekannten Tests, unverändert

Fünf Tests, alle mit Text und Scoring eingebettet. Quelldateien aus den GitHub-Repositories
geprüft am 6. November 2026:

| Test | Items | Achsen | Antwortskala | Lizenz | Im Tool |
|---|---|---|---|---|---|
| **8values** ("Test Edition #1") | 70 | 4: `econ` Equality↔Markets, `dipl` Nation↔Globe, `govt` Liberty↔Authority, `scty` Tradition↔Progress | 5-stufig: +1, +0.5, 0, −0.5, −1 | MIT | eingebettet |
| **6axes** | 70, davon **64 wortgleich mit 8values** | 6: Economic Aspiration (Equality↔Markets), Economic Control (Labour↔Capital), Nationalism (Civic↔Ethnic), Cosmopolitanism (Open Borders↔Chauvinist), Akraetia (Anarchist↔Totalitarian), Anarche (Revolutionary↔Reactionary) | 5-stufig wie 8values | MIT (8values-Fork, 2019) | eingebettet |
| **SapplyValues** | 46 | 3: `right` Links↔Rechts, `auth` Lib↔Auth, `prog` Prog↔Kons | 5-stufig plus "don't know", das verworfen wird | MIT | eingebettet |
| **9Axes** | Pool 216 = 9 Achsen × 8 Intensitäten × 3 | 9 | 5-stufig | MIT | eingebettet, Ziehung deterministisch |
| **Political Compass Test** | 62 | 2: economic Left↔Right, social Libertarian↔Authoritarian | 4-stufig, keine Mitte | Texte © Pace News Ltd, Scoring unveröffentlicht | eingebettet; Scoring rekonstruiert (unten) |

**6axes** ist der Sechs-Achsen-Test, nach dem du gefragt hast: ein 8values-Fork mit denselben
Fragen, neu gewichtet (Gewichte bis 15, die Autoritätsachse mit 45 Items und 11 : 34 unbalanciert).
Weil 64 Items wortgleich sind, werden sie **einmal gefragt und zweimal gewertet**: Items werden über
alle Instrumente per normalisiertem Text dedupliziert (Kleinschreibung, typografische Zeichen,
`shouldn't` = `should not`), eine Antwort fließt in jedes Instrument, das den Satz enthält. Über
8values, 6axes, SapplyValues und PCT bleiben so **182 einzigartige Items** von 248. Zwei weitere
Paare sind fast gleich ("Sex outside marriage is immoral" / "… is usually immoral"; "the freer the
markets" / "the freer the market") und werden absichtlich getrennt gefragt: der Wortlaut gehört zum
Instrument, und der Unterschied zwischen beiden Antworten ist eine kostenlose Paraphrasen-Kontrolle.

**Nicht aufgenommen:** PolitiScales (8 Achsen, Original 2020 eingestellt, Quellcode und Lizenz
unklar, der Fork schreibt neue Fragen); IDRlabs-Tests und Pew Typology, proprietär; Wahl-O-Mat,
Lizenz je Edition restriktiv bis verboten.

**Die Instrumente werden nicht editiert.** Jedes trägt SHA-256 über das kanonische JSON aus Items,
Gewichten und Versionsstring, sichtbar in der Topbar und in jedem Export. Läufe mit
unterschiedlichem Hash werden nicht zusammengeführt.

**PCT, vollständig eingebettet.** Die 62 Thesen stammen aus `data/templates/pct_propositions.csv`
im Repo zu Röttger et al. (CC BY 4.0 für das Repo; die Thesen selbst bleiben © Pace News Ltd). Sie
sind in sechs Seiten gruppiert, wie auf der Website (your country and the world, economy, personal
social values, wider society, religion, sex). **Du trägst das urheberrechtliche Risiko der
Wiedergabe, das README sagt das ausdrücklich** und nennt Pace News als Rechteinhaber.

Das Scoring ist eine Rekonstruktion: `compass_calc.py` aus `h4fide/politicalcompassbot` enthält
zwei Tabellen 62 × 4 (Gewicht je Item und Antwortoption, Werte zwischen −10 und +8), dazu die
Konstanten der Website: `ec = Σ/8 + 0,375`, `soc = Σ/19,5 + 47/19,5`, kaufmännisch auf zwei Stellen
gerundet, auf [−10, +10] geklemmt. Das Repo trägt keine Lizenzdatei; die Tabelle ist gemessenes
Zahlenmaterial und wird mit Quelle übernommen. **Belegt wird sie nicht durch die Behauptung des
Autors, sondern durch Golden-Vektoren**: die Error-Budget-Studie hat 1 140 PCT-Durchläufe mit
Antworten *und* dem Ergebnis der Website-Ergebnisseite veröffentlicht (`data/raw_trials/`). Eine
Stichprobe davon liegt im Testharness; trifft die Tabelle sie nicht, läuft der PCT als
`scoring: approximate` und die Topbar sagt es. Die Lizenz des Datensatzes steht bei Zenodo und wird
vor der Übernahme geprüft (von hier aus nicht erreichbar).

Der PCT wird **wie die anderen übersetzt** (Abschnitt 4). Seine native Skala hat keine Mitte;
`soft` ergänzt nur `no_position`, `hard` ist exakt die Website.

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
| `hi` | Hindi | für "indisch"; siehe Entscheidung 1 |

**Was übersetzt wird:** die Thesen, die Antwortoptionen (Labels der Skala) und die Instruktion der
Stufe. Ein Lauf in `zh` ist komplett chinesisch; ein englischer Rahmen um eine chinesische These
würde die Sprachfrage verwässern. Die Enum-Werte im JSON-Schema bleiben englische Codes
(`strongly_agree`, `no_position`), damit das Scoring sprachunabhängig ist; der Prompt bildet Label
auf Code ab.

**Übersetzung einmalig, durch mich, Ergebnis im Repo.** Kein Übersetzen im Tool, kein Skript,
kein API-Key, keine Kosten. Ich übersetze die 182 Items plus Antwortlabels und Instruktionen in
einem Durchgang in der Build-Session, nach Maker-Checker aus `cp-coding-core`, mit Sub-Agenten:

1. **Maker**: ein Sub-Agent pro Sprache übersetzt alle Items, mit den Regeln (Register des
   Originals halten, keine Glättung, politische Begriffe im Zielland geläufig, Zahlen und
   Negationen exakt).
2. **Checker**: ein zweiter Sub-Agent pro Sprache bekommt Original und Übersetzung, übersetzt zurück
   und urteilt fünfstufig: `faithful`, `minor_shift`, `major_shift`, `wrong`, `uncertain`. Er
   repariert nicht. Items mit `major_shift` oder schlechter gehen einmal zurück an den Maker, dann
   ist Schluss; was dann noch nicht `faithful` oder `minor_shift` ist, bleibt markiert.
3. Ich schreibe **`compass-bench-items.json`**: alle Items mit `text.{en,de,zh,ja,hi}`,
   Instrument-Zugehörigkeit und Gewichten, pro Übersetzung Rückübersetzung, Verdikt und Datum,
   dazu ein Hash pro Sprachfassung. Die Datei liegt im Repo, ist diffbar und der Ort für
   Review-Korrekturen; eine korrigierte Zeile ändert den Hash der Sprache.

**Die HTML-Datei bettet dieselbe JSON ein** (ein `<script type="application/json">`-Block zwischen
Markern), damit sie weiter ohne Server von `file://` läuft. Ein Test im Harness prüft, dass der
eingebettete Block und `compass-bench-items.json` byteidentisch sind. Items mit Verdikt `wrong` oder
`uncertain` bleiben in der Datei, sind aber für die betreffende Sprache als ausgeschlossen markiert
(Gatter 6). 9Axes wird erst übersetzt, wenn es gebraucht wird, auf demselben Weg.

**Was die Sprachverschiebung misst:** Modell und Übersetzung zusammen. Die Rückübersetzung und die
Checker-Verdikte liegen im Export, damit sich der Übersetzungsanteil prüfen lässt. Items mit
Verdikt `wrong` oder `uncertain` sind aus dem Scoring der betreffenden Sprache ausgeschlossen
(Gatter 6). Mehr Ehrlichkeit gibt es ohne Muttersprachler nicht; für `de` liefert dein Review sie, als Diff
auf `compass-bench-items.json`.

**Extraktor** für Stufe `open`: pro Sprache ein Batch-Check (Gatter 3). `whoami-bench` hat gezeigt,
dass günstige Extraktoren bei nicht-englischem Text am schwächsten sind; der Check zeigt es, bevor
die Zahlen gelesen werden.

---

## 5. Die Zwangsleiter: drei Stufen, eine Achse

Die Antwortoptionen sind immer die des jeweiligen Tests, in der Sprache des Laufs. **Default ist eine
Stufe, `soft`.** Die beiden anderen sind Opt-in; die Leiter-Karte erscheint erst, wenn mindestens
zwei Stufen gelaufen sind.

| Stufe | id | Form | Auswertung |
|---|---|---|---|
| 1 | `open` | These vorlegen, offen fragen, Freitext | **LLM-Extraktor** (blind, gebatcht) bildet auf die native Skala ab, dazu `refused` |
| 2 | `soft` | Strukturierte Antwort, native Skala **plus** `no_position` | deterministisch, JSON-Schema |
| 3 | `hard` | Strukturierte Antwort, **genau die Optionen der Website**, kein Ausweg | deterministisch, JSON-Schema |

Warum `soft` als Default: die Skala ist exakt die des Tests, ein Modell, das antwortet, wird genau
wie auf der Website gewertet; ein Modell, das nicht antworten will, bekommt mit `no_position` einen
Ausweg und wird als Verweigerung gezählt statt in eine erfundene Position gezwungen. Das ist die
Minimalkonsequenz aus Röttger et al.

Warum es die anderen beiden überhaupt gibt: `hard` ist das Format der Website und der zwölf
Vorarbeiten, also der Vergleichspunkt zur Literatur. `open` ist Freitext, worauf Röttger hinauswill,
und die einzige Stufe mit einem Modell in der Auswertung. Wer beide dazuschaltet, bekommt die
Leiter: Abstand `soft` → `hard` ist die Zwangs-Sensitivität, `open` → `soft` die Format-Sensitivität.
Ein Modell, dessen Punkt über die Stufen stehen bleibt, hat eine Position; eines, das von `open`
(verweigert) nach `hard` (deutlich links) springt, hat eine Default-Completion unter Druck. Für die
Sprachfrage reicht eine Stufe.

Jede Stufe hat ihren Prompt in einer editierbaren Textarea mit Reset und `localStorage`-Kopie, pro
Sprache eine Fassung; Thesen und Optionen werden per Platzhalter eingesetzt.

**Keine Websuche.** Kein `web`-Plugin, kein `:online`-Suffix, kein Grounding-Schalter in der Rail.
Jede Anfrage wird mit leerer Plugin-Liste geloggt. Eine Position, die das Modell erst nachschlägt,
ist keine Position des Modells.

---

## 6. Kontrollen, alle deterministisch

| Kontrolle | Mechanik | Ergibt |
|---|---|---|
| **Wiederholung** | *Trials* = dieselbe Frage an dasselbe Modell mehrfach gestellt. Modelle antworten stochastisch; zwei identische Anfragen können verschieden ausfallen. Default 1 Trial; ab 2 misst das Tool, ob der Punkt steht. Temperatur Provider-Default, keine Sampling-Parameter | Instabilität pro Modell, Test, Sprache; bei 1 Trial zeigt die Karte `n=1: keine Stabilitätsaussage` |
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
`refused`, Gatter 6) werden überall wie SapplyValues' "don't know" behandelt: Item raus aus Σ und
max. Bei 8values, 6axes und PCT ist das eine dokumentierte Abweichung von der Website, die keine
Lücke zulässt; Gatter 1 begrenzt sie.

9Axes zieht auf der Website 5 von 24 Items je Achse zufällig. Das Tool bietet den vollen Pool oder
eine Ziehung mit festem Seed im Export. Default: Ziehung, 45 Items wie auf der Website.

**Error Budget, deterministisch:** eine gekreuzte Varianzzerlegung des normierten Scores über die
Faktoren Instrument × Achse, Modell, Sprache, Stufe, Reihenfolge und Trial (Residuum), nach dem
Modell der Error-Budget-Studie, als Anteile in Prozent mit Bootstrap-Intervallen. Die Karte sagt dem
Nutzer, wie viel seines Ergebnisses das Modell ist und wie viel die Apparatur; 13 % Modell bei 52 %
Instrument ist der Erwartungswert aus der Literatur, der hier pro Lauf nachgerechnet wird.

**Golden-Tests:** pro Test Antwortvektoren im Harness, deren Erwartungswerte mit dem Original-JS
der Website berechnet wurden; für den PCT die Website-Ergebnisse aus der Error-Budget-Studie. 8values' Ideologie-Label (`ideologies.js`, MIT) als deterministische
Dreingabe. Konfidenzintervall per Bootstrap über Items × Trials (1000 Ziehungen, PRNG mit Run-Seed).

Kohorten wie in `whoami-bench`: Vendor über die Alias-Tabelle, Open-Weights über `hugging_face_id`,
Jurisdiktion über die Lab-Liste. Die Tabellen werden übernommen.

**Deterministisch/Modell-Split:** Im Tool liefert das Modell die Antworten und extrahiert bei
`open` die Haltung; die Übersetzung ist einmalig in der Build-Session passiert. Alles andere ist JS. Der Split
steht im Log.

---

## 8. Validitätsgatter, die das Tool erzwingt

1. **Antwortquote** pro Modell × Test × Achse × Sprache unter der Schwelle (Default 60 %) → Punkt
   hohl, nicht in Kohortenmitteln.
2. **Instabilität** über Trials über der Schwelle → Intervall statt Punkt. Braucht mindestens
   2 Trials; bei 1 Trial trägt der Punkt das Flag `n=1`.
3. **Extraktor-Batch-Check** pro Sprache (nur `open`): unter 95 % Übereinstimmung mit Batchgröße 1
   → Tabelle der Abweichungen.
4. **Konvergenz**: Tests uneinig über den Quadranten → beide Punkte, verbunden, kein Mittelwert.
5. **Kohortengröße** unter 3 → keine Kohortenmittel.
6. **Übersetzungsgatter**: Items mit Checker-Verdikt `wrong` oder `uncertain` raus aus dem Scoring
   der Sprache; über 10 % ausgeschlossene Items → Sprache als `translation-limited` markiert.
7. **Sprachverschiebung vs. Instabilität**: eine Verschiebung zwischen Sprachen, die kleiner ist als
   die Wiederholungsvarianz des Modells, wird als "innerhalb des Rauschens" markiert, nicht als Befund.
8. **PCT-Scoring**: Golden-Vektoren aus der Website nicht getroffen → `scoring: approximate` in
   Topbar und Export.

---

## 9. Modellauswahl für den Nutzer

Der Nutzer wählt die Modelle, die getestet werden, **aus der Live-Liste von openrouter.ai**, eines
oder mehrere. Keine Vorauswahl, keine Presets, kein hart kodierter Slug.

- Die Liste kommt bei jedem Laden von `GET /api/v1/models` (ohne Key), gefiltert auf Modelle, die
  `structured_outputs` können, mit Vendor, Name, Preis pro 1M Tokens (ein/aus), Kontext und
  Open-Weights-Flag; 24 h in `localStorage` gecacht, ein Knopf lädt neu.
- Suchfeld über id und Name, Filter nach Vendor; Checkbox pro Modell; Zähler der Auswahl.
- Ein Freitextfeld für einen Slug, der im Filter nicht auftaucht, mit Prüfung gegen die Liste.
- Neben jeder Auswahl steht ihr Anteil an der Kostenschätzung (Abschnitt 14), die sich mit jeder
  Checkbox aktualisiert.
- Die Auswahl bleibt in `localStorage`, der Key nicht.

Die Kohorten-Logik aus `whoami-bench` (Vendor-Alias-Tabelle, Open-Weights über `hugging_face_id`,
Jurisdiktion) wird nur für Farbe und Gruppierung in den Charts übernommen, nicht für die Auswahl.

---

## 10. Oberfläche

Layout-Shell wie die Geschwister: Glas-Topbar (Brand, `TOOL_VERSION`, Instrument- und
Sprach-Hashes, Backend-Pill), linke Rail, Hauptbereich mit Karten, Log-Konsole unten, Splitter.

1. **Models** — Abschnitt 9: Live-Liste, Suche, Checkboxen, Kostenanteil.
2. **Instruments** — fünf Zeilen mit Checkbox, Itemzahl, Achsen, Lizenz, Hash, beim PCT der
   Scoring-Status (`validated` / `approximate`); 9Axes mit Seed/voller Pool; Zähler der
   deduplizierten Items.
3. **Languages** — fünf Checkboxen, `en` vorangekreuzt, die anderen Opt-in; je Hash der
   Sprachfassung, Zahl der ausgeschlossenen Items (Gatter 6), Link auf `compass-bench-items.json`.
4. **Prompts** — Stufen-Prompts × Sprachen plus Extraktor-Prompt, je Textarea, Reset; nur die
   aktivierten Kombinationen sind aufgeklappt.
5. **Run** — Kostenschätzung *vor* dem Lauf (Aufrufe, Tokens, Preis, Dauer), Start, `■ cancel`,
   Fortschritt, Ist-Kosten danach.
6. **Validity gates** — Abschnitt 8.
7. **Error budget** — Balken der Varianzanteile (Instrument, Modell, Sprache, Stufe, Reihenfolge,
   Rauschen) mit Intervallen; daneben der Literaturwert als Referenzstrich.
8. **Compasses** — pro Test die Darstellung der Website: 8values vier Balken plus Projektion;
   6axes sechs Balken plus Projektion Economic Aspiration × Akraetia; SapplyValues Kompass plus
   `prog`-Balken; PCT der klassische Kompass; 9Axes neun Balken. Ein Marker pro Modell, Fehlerbalken,
   Vendor-Farbe, hohl bei insufficient, Umschalter für Stufe und Sprache.
9. **Language shift** — nur bei zwei oder mehr Sprachen: normierter Kompass mit einem Marker je
   Sprache pro Modell, verbunden
   ab `en`; daneben Heatmap Modell × Sprache mit dem Abstand zu `en`, grau wo Gatter 7 greift.
10. **Convergence** — normierter Kompass Wirtschaft × Autorität, je Modell ein Marker je Test.
11. **Ladder** — nur bei zwei oder mehr Stufen: Position pro Stufe, eine Linie pro Modell,
    Kohortenmittel gestrichelt.
12. **Results** — jede Antwort mit Modell, Test(s), Item, Sprache, Stufe, Trial, Reihenfolge, Rohwert.

SVG/CSS, keine Chart-Bibliothek, kein Emoji, kein Icon-Font. CJK- und Devanagari-Text in den
Karten braucht einen Font-Fallback (`system-ui` nach Inter), nichts weiter.

---

## 11. Einstellungen in der Rail

| Einstellung | Default | Hinweis |
|---|---|---|
| OpenRouter-Key | leer | nur im Speicher, `type=password` (Entscheidung 3) |
| Instrumente | 8values, 6axes, SapplyValues, PCT | 9Axes opt-in |
| Sprachen | `en` | `de`, `zh`, `ja`, `hi` je Checkbox, Opt-in |
| Stufen | `soft` | `hard` und `open` Opt-in; `open` mit Mehrkosten, Entscheidung 4 |
| Trials / Zelle | 1 | Wiederholungen derselben Frage. 1 = Punkt ohne Stabilitätsaussage; 3 für alles, was zitiert werden soll |
| Items pro Aufruf | 1 | 1 = wie die Literatur, eine These pro Prompt. `page` = die Seiten der Website (PCT 5–18, sonst 10). Antwortformat ist laut Error-Budget-Studie ein größerer Faktor als das Modell; der Modus steht im Zellen-Schlüssel, Läufe mit verschiedenen Modi werden nicht gemischt |
| Optionsreihenfolge randomisieren | an | deterministisch aus Hash |
| 9Axes-Modus | Seed-Ziehung, 45 Items | oder voller Pool |
| Concurrency | 4 | bei 429s senken |
| Max Retries | 2 | Obergrenze 5, nur transiente Fehler |
| Reasoning effort | low | fällt zurück, wenn der Provider es ablehnt |
| Max Tokens (open) | 600 | |
| Extraktor-Modell | günstigstes mit `structured_outputs` | pro Sprache Batch-Check |
| Antwortquoten-Schwelle | 60 % | Gatter 1 |
| Instabilitäts-Schwelle | 0,25 | Gatter 2 |

Keine Temperatur, kein `top_p`, kein Websuche-Schalter.

---

## 12. Architektur

- **Eigenes Verzeichnis `compass-bench/`** im Repo mit `compass-bench.html` (das Tool, läuft allein),
  `compass-bench-items.json` (Items, Gewichte, Übersetzungen mit Verdikten; im HTML eingebettet,
  Gleichheit per Test), `compass-bench.test.mjs` (der Test-Harness), `README.md` mit den
  Lizenzhinweisen, dem Copyright-Hinweis zum PCT und den Hashes aller Instrument- und Sprachfassungen,
  `PLAN.md` und `compass-bench.zip` (Tool, Datendatei, README) zum Download. `TOOL_VERSION` im Code,
  `BUILD` sichtbar.
- **Backend OpenRouter**, wie die Geschwister. Gemini-direkt bleibt Backlog.
- **Instrumente als Daten**: `INSTRUMENTS` mit `id, name, source, licence, version, scale, axes,
  score(answers)`; die Items kommen aus dem eingebetteten JSON, dedupliziert über Instrumente, jedes
  mit `text.{en,de,zh,ja,hi}` und Übersetzungs-Metadaten. Neue Tests sind ein Eintrag plus
  Golden-Test plus ein Übersetzungsdurchgang.
- **Call-Layer DOM-frei** zwischen `// ===== core (DOM-free) =====` und `// ===== end core =====`:
  `openrouterOnce`, `llm`, `runPool`, `apiError`, `isTransient`, Scoring, Hashing, Dedup, Ziehung,
  Normierung. `node compass-bench.test.mjs` muss laufen (der generische `core_test.mjs` des Skills ist
  Gemini-spezifisch und passt nicht auf ein reines OpenRouter-Tool); darin Golden-Tests je Instrument, Dedup-Test (64 geteilte Items), Reihenfolge-Hash reproduzierbar, Gatter feuern auf
  konstruierte Verstöße, eingebettetes JSON gleich der Datei im Repo, jede Sprachfassung hat für
  jedes Item einen Text und ein Verdikt.
- **Zellen-Schlüssel** = Hash(Item-Hash, Sprach-Hash, Modell, Stufe, Trial, Reihenfolge,
  Items-pro-Aufruf, Prompt-Version). Export-JSON ist der Checkpoint; Import setzt fort, `ok` übersprungen,
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
liegt bei. Beim PCT zusätzlich: das Scoring ist eine Rekonstruktion, der Export nennt seinen Validierungsstatus.

Der Export erfüllt den Mindeststandard der Error-Budget-Studie als eigenen Block `reporting_standard`:
Instrument und Hash, Asker-Bedingung (der Stufen-Prompt im Wortlaut), Wiederholungen und Streuung,
Varianzzerlegung, Status des Kontaminationschecks (bis Meilenstein 0.6: `not run`), Item-Ergebnisse.

---

## 14. Kosten

Aufrufe pro Modell = Items × Stufen × Sprachen × Trials, bei einer These pro Aufruf.

| Konfiguration | Rechnung | Aufrufe pro Modell | Dauer bei Concurrency 4 |
|---|---|---|---|
| **Default** | 182 × 1 Stufe × 1 Sprache (`en`) × 1 Trial | **182** | rund 2 Minuten |
| Sprachfrage | 182 × 1 × 5 × 1 | 910 | rund 8 Minuten |
| Sprachfrage, stabil | 182 × 1 × 5 × 3 | 2 730 | rund 25 Minuten |
| Alles außer `open` | 182 × 2 × 5 × 3 | 5 460 | rund 45 Minuten |
| `open` dazu | + 182 × 5 × 3 lange Antworten + Extraktor-Batches | + 2 730 | Freitext, deutlich länger |

Pro strukturiertem Aufruf etwa 270 Tokens (250 ein, 20 aus): der Default kostet bei einem Flagship
zu 3/15 $ pro 1M etwa 15 Cent, die stabile Sprachfrage etwa 2,50 $, ein günstiges Modell jeweils
Cents. Die Zahl der Modelle multipliziert alles; der Nutzer wählt sie (Abschnitt 9).

Der `page`-Modus (Website-Seiten statt einzelner Thesen, PCT 5–18 Items, sonst 10) teilt die
Aufrufe durch rund neun, ist aber ein anderes Antwortformat, das laut Error-Budget-Studie mehr
Varianz erklärt als das Modell. Der Modus steht im Zellen-Schlüssel, Läufe mit verschiedenen Modi
werden nicht gemischt.

Die Übersetzung kostet nichts: sie passiert einmal in der Build-Session (Abschnitt 4).

Schätzung vor dem Start neben dem Run-Button, mit Katalogpreisen je gewähltem Modell; Ist-Kosten aus
`usage` danach. Faktor 2 Abweichung ist ein Befund.

---

## 15. Meilensteine

| Version | Inhalt | Prüfung, die scheitern kann |
|---|---|---|
| **0.1** ✓ | 8values, 6axes, SapplyValues, PCT eingebettet und dedupliziert, `en`, Stufe `soft`, natives Scoring mit Golden-Tests (PCT gegen Website-Ergebnisse der Error-Budget-Studie), Website-Darstellungen, Modellauswahl aus der Live-Liste, `items pro Aufruf`, Kostenschätzung, JSON/CSV, Core-Fence | Golden-Tests treffen die Website-Werte (30 Vektoren + 12 PCT-Trials); Dedup findet 182; `compass-bench.test.mjs` grün (19 Tests); Headless-Lauf mit gemocktem OpenRouter; **Live-Lauf mit echtem Key steht aus** |
| **0.2** ✓ | Stufe `hard` (Opt-in), Leiter, Trials ≥ 2, Reihenfolge-Randomisierung, Ja-Sage-Quote, Konvergenz-Kompass, Error-Budget-Karte, Gatter 1, 2, 4, 5, 8 | konstruierte instabile Antworten lösen Gatter 2 aus (Unit-Test und Headless-Lauf mit einem Modell, das zwischen Trials kippt); Varianzzerlegung auf einem synthetischen Datensatz mit bekannten Anteilen stimmt (80/20/0 und mit Trial-Rauschen); 25 Tests grün |
| **0.3** | Übersetzung de/zh/ja/hi durch Sub-Agenten (Maker, Checker, eine Korrekturrunde), `compass-bench-items.json` im Repo, Einbettung plus Gleichheitstest, Sprachen-Karte, Language-shift-Kompass und Heatmap, Gatter 6, 7 | jedes Item in jeder Sprache hat Text, Rückübersetzung und Verdikt; Anteil `faithful` + `minor_shift` pro Sprache im Log; dein `de`-Review als Diff; Lauf in fünf Sprachen vergleichbar |
| **0.4** | Stufe `open`, blinder Extraktor, Batch-Check pro Sprache (Gatter 3) | ≥ 95 % in jeder Sprache, sonst Extraktor wechseln |
| **0.5** | 9Axes (Seed/Pool, Übersetzung on demand), 8values-Ideologielabel, Resume, Markdown, README mit Lizenz- und Copyright-Block | Lauf abbrechen, importieren, fortsetzen: keine `ok`-Zelle läuft erneut |
| **0.6** | Kontaminationscheck: invertierte Items durch Sub-Agenten (Maker invertiert, Checker prüft), Ergebnis als zweite Datei im Repo, Lauf auf Original und Inversion, Verschiebung pro Modell, `reporting_standard.contamination` gefüllt | Checker flaggt Fixture-Fehlinversionen; ein Modell mit konstruiert symmetrischen Antworten zeigt null Verschiebung |

Backlog: Persona-Steuerbarkeit (Asker-Identität ist laut Error-Budget-Studie der größte Faktor,
deshalb gehört sie als eigene Dimension gemessen, nicht nebenbei); IssueBench-Stufe; Wahl-O-Mat-Import mit
Lizenzhinweis; weitere Sprachen (das Schema trägt beliebig viele); Gemini-direkt.

---

## 16. Entscheidungen

**Entschieden:** Die 62 PCT-Thesen werden eingebettet und übersetzt, das urheberrechtliche Risiko
trägst du, das README sagt es (Rev. 4). Übersetzung einmalig, Ergebnis als JSON im Repo
(Rev. 5). Modellauswahl durch den Nutzer aus der OpenRouter-Liste, eines oder mehrere, ohne
Vorauswahl (Rev. 5). Übersetzung durch Claude mit Sub-Agenten, kein Skript (Rev. 6). Stufen,
Sprachen und Trials Opt-in, Default `soft` / `en` / 1 Trial (Rev. 6).

Offen, jeweils mit meiner Wahl:

1. **"Indisch":** Hindi, meistgesprochene Sprache Indiens und in den Trainingsdaten am besten
   vertreten. Alternativen Bengali, Tamil, Telugu kosten je 182 Übersetzungen und eine Spalte; das
   Schema trägt sie. *Meine Wahl: Hindi.*
2. **Übersetzungs-Review:** `de` durch dich; `zh`, `ja`, `hi` durch den Checker, ohne
   Muttersprachler, mit Rückübersetzung im Export. *Meine Wahl: so starten, Review nachreichen.*
3. **Key-Speicherung:** Speicher-only nach `cp-coding-core` statt `localStorage` wie die
   Geschwister. *Meine Wahl: Speicher-only.*
4. **`open`:** aussagekräftigste und teuerste Stufe. *Meine Wahl: Opt-in wie `hard`.*

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
- Political Compass Test: Thesen aus `paul-rottger/llm-values-pct`, `data/templates/pct_propositions.csv`
  (62 Zeilen, 6 Seiten; Repo CC BY 4.0, Thesen © Pace News Ltd); Scoring aus
  `h4fide/politicalcompassbot`, `compass_calc.py` (Gewichtstabellen 62 × 4, Offsets 3/8 und 47/19,5,
  Divisoren 8 und 19,5; keine Lizenzdatei), geprüft 6. Nov. 2026
- *An error budget for political-bias measurement in large language models* (2026), Repo
  `sletch1/AI-Political-Bias-Research-Paper`, Zenodo 10.5281/zenodo.22968158 (Release v0.4.1);
  `data/raw_trials/` mit Website-Ergebnissen als Golden-Vektoren, Lizenz bei Zenodo zu prüfen
- Röttger et al., *Political Compass or Spinning Arrow?*, ACL 2024, arXiv 2402.16786; Repo
  `paul-rottger/llm-values-pct` (CC BY 4.0) mit `notebooks/pct_validation`
- Feng et al., *From Pretraining Data to Language Models to Downstream Tasks*, ACL 2023; Repo
  `BunsenFeng/PoliLean` (MIT)
- Rozado, *The Political Preferences of LLMs*, PLOS ONE 2024; Substack Januar 2025
- Sakhawat et al., *Political Alignment in Large Language Models*, arXiv 2601.06194 (rev. März 2026)
- Röttger et al., *IssueBench*, TACL 14 (2026), arXiv 2502.08395
- PolitiScales: rotek.fr (Achsen, "nicht open source"), Fork `Conobi/politiscales` (Neufassung)
- bpb, Wahl-O-Mat-Datensätze, Lizenztexte je Edition
