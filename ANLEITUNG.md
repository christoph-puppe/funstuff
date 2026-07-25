# Meme-Archiv auf Billig-Webspace

Ziel: 2 GB Bilder zum Stöbern auf einem einfachen Hosting-Paket, ohne Datenbank,
ohne PHP-Framework, ohne dass die Seite bei jedem Aufruf 40 MB überträgt.

Das Skript `build_gallery.py` baut die Seite auf deinem Rechner fertig zusammen.
Hochgeladen wird nur noch ein Ordner mit statischen Dateien.

## Vorbereitung

Python 3.9 oder neuer, dann einmalig:

    pip install pillow

## Bauen

Das Skript liest wahlweise einen Ordner oder direkt die ZIP-Datei — letzteres
spart dir das Entpacken von 2 GB unter Windows komplett:

    python build_gallery.py --src memes.zip --out site --title "Das Archiv"

Sinnvolle Zusätze:

    --max-side 1600     Originale auf 1600 px längste Kante verkleinern.
                        Bei alten Memes ist mehr ohnehin sinnlos und halbiert
                        oft den Speicherbedarf.
    --thumb-size 320    Kantenlänge der Vorschaubilder (Standard 320).
    --page-size 60      Bilder pro Seite (Standard 60).
    --split-mb 400      Zusätzlich Upload-Pakete zu je 400 MB bauen.

Nach dem Lauf liegt in `site/` die fertige Seite und darin `build-report.txt`
mit allem, was aussortiert wurde: Duplikate (per SHA-256 erkannt) und kaputte
Dateien, jeweils mit Pfad.

Zum Anschauen vor dem Upload nicht die `index.html` doppelklicken — Chrome
blockiert bei `file://` das Nachladen von `data.json`. Stattdessen:

    cd site
    python -m http.server 8000

und dann http://localhost:8000 aufrufen.

## Hochladen

Der wunde Punkt bei Billig-Hosting ist nicht das Volumen, sondern die Anzahl
Dateien. Bei 8.000 Bildern hast du mit Thumbnails rund 16.000 Dateien. Per FTP
einzeln übertragen dauert Stunden und bricht gern mittendrin ab.

Deshalb `--split-mb 400` benutzen. Du bekommst dann einen Ordner `site-upload`
mit `site-01.zip`, `site-02.zip` … und `unzip.php`:

1. In `unzip.php` das Token oben im Kopf durch etwas Eigenes ersetzen.
2. Alle ZIPs und `unzip.php` per FTP ins Web-Verzeichnis legen.
3. Pro Paket einmal aufrufen:
   `https://deine-domain.de/unzip.php?token=DEINTOKEN&file=site-01.zip`
4. Danach `unzip.php` und die ZIPs **löschen**. Ein offener Entpacker auf dem
   Webspace ist eine Einladung.

Falls dein Paket kein PHP hat: manche Anbieter haben im Kunden-Dateimanager
eine Entpacken-Funktion, das tut es auch.

Vorher im Vertrag nachsehen: Wie viel Webspace, und gibt es ein Limit für die
Dateianzahl (Inodes)? Viele Einsteigerpakete liegen bei 10 GB Platz, aber
manche deckeln bei 100.000 Dateien. Beides passt hier, aber prüfen kostet
nichts.

## Traffic absichern

Der Punkt, an dem so ein Projekt teuer oder abgeschaltet wird: Ein Link landet
irgendwo, und plötzlich ziehen 50.000 Leute Bilder. „Unbegrenzter Traffic" bei
Billig-Hosting heißt in den AGB fast immer Fair Use.

Gegenmittel kostet nichts: Domain über **Cloudflare** (Free-Plan) laufen lassen,
DNS-Eintrag auf Proxy stellen. Cloudflare liefert die Bilder dann aus dem Cache
aus, dein Webspace sieht davon fast nichts. Die mitgelieferte `.htaccess` setzt
dafür bereits ein Jahr Cache-Zeit auf alle Bilder — das ist unbedenklich, weil
jeder Dateiname den Hash des Inhalts enthält und sich also nie ändert.

## Was die Seite kann

Kachel-Raster mit Blättern, Klick öffnet ein Bild in einem Fenster im
Windows-95-Stil, Pfeiltasten blättern, Escape schließt. Alles clientseitig aus
einer `data.json`, kein Server-Code. Animierte GIFs bekommen ein rotes Badge und
werden im Vollbild animiert abgespielt, das Thumbnail ist ein Standbild.

Suchfeld und Zufalls-Button sind bewusst nicht drin — sag Bescheid, wenn du sie
willst, beides sind kleine Ergänzungen in derselben Datei.

## Rechtliches, kurz

`impressum.html` wird mitgeneriert, aber mit Platzhaltern. Die musst du
ausfüllen, ein Impressum nach § 5 DDG ist für eine öffentlich erreichbare Seite
Pflicht, und eine erreichbare Adresse ist auch die beste Versicherung: Wer sich
beschweren kann, mahnt seltener direkt ab.

Zwei Dinge vor dem Livegang durchsehen:

Fotos erkennbarer Personen. Das Recht am eigenen Bild ist bei so einem Archiv
das realistischere Risiko als das Urheberrecht — die Leute auf 20 Jahre alten
Fotos sind heute erwachsen und googeln sich selbst.

Material, das nach § 86a StGB problematisch ist. In Sammlungen dieser Ära steckt
erfahrungsgemäß der eine oder andere „ironische" Hakenkreuz-Witz, und das ist
kein Bereich, in dem man auf Kulanz hoffen sollte.

Ich bin kein Anwalt. Wenn das Archiv unter deinem Namen und deiner Adresse
läuft, ist eine kurze Einschätzung von jemandem, der es ist, gut angelegtes
Geld.
