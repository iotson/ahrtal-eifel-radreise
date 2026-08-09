# Audio-Reiseführer Ahrtal & Eifel

Datenpipeline für den Reiseführer zu einer sechstägigen Radrundtour durch Eifel, Ahrtal und
Mosel: 428,2 km, 3073 Höhenmeter, Braubach → Bad Neuenahr-Ahrweiler → Steinborn → Bleialf →
Eisenschmitt → Sankt Aldegund → zurück nach Braubach.

Dieses Repository liefert zwei Dinge: die Datenpipeline (dieses Dokument) und die Anwendung im
Wurzelverzeichnis, die die erzeugten Daten zur Laufzeit anzeigt (Abschnitt
[Anwendung und Veröffentlichung](#anwendung-und-veröffentlichung)).

## Die Etappen

| Tag | Start → Ziel | Länge | Höhenmeter | Fahrzeit (Schätzung) | Anstiege |
|---|---|---|---|---|---|
| 1 | Braubach → Bad Neuenahr-Ahrweiler | 71,9 km | 207 hm | 248 Min | 0 |
| 2 | Bad Neuenahr-Ahrweiler → Steinborn | 74,5 km | 765 hm | 258 Min | 1 |
| 3 | Steinborn → Bleialf | 62 km | 653 hm | 204 Min | 1 |
| 4 | Bleialf → Eisenschmitt | 58,1 km | 736 hm | 185 Min | 6 |
| 5 | Eisenschmitt → Sankt Aldegund | 72,5 km | 431 hm | 230 Min | 1 |
| 6 | Sankt Aldegund → Braubach | 89,2 km | 281 hm | 289 Min | 0 |
| **Summe** | **Rundtour** | **428,2 km** | **3073 hm** | | |

Diese Zahlen stammen aus `data/tour.json`. Sollte die Pipeline neu laufen und andere Werte
liefern, hat sich an den GPX-Tracks oder der Berechnung etwas geändert — dann sind diese
Tabellenwerte hier im README nachzuziehen.

### Woher die Etappennamen kommen

Die Start- und Zielorte stammen **nicht** aus den GPX-Dateinamen im Wurzelverzeichnis. Die
Dateinamen (z. B. „…Tag 1 - von Koblenz nach Findling.gpx“) nennen eine ältere Routenplanung;
„Findling“, „Pittenbach“ und „Nehren“ liegen nirgends auf dem tatsächlich gefahrenen Track. Die
gültigen Ortsnamen stehen in der Tabelle `ETAPPENORTE` in `scripts/build-tour.js` und wurden
durch Rückwärtsgeokodierung von Start- und Endpunkt jedes Tracks ermittelt. Aus dem Dateinamen
wird nur noch die Tagesnummer gelesen.

Damit diese Tabelle nicht stillschweigend falsch wird, prüft `build-tour.js` nach dem Einlesen
die Zusicherung, auf der sie beruht: Jedes Etappenende liegt auf dem Startpunkt des Folgetags,
und Tag 6 endet am Startpunkt von Tag 1 — jeweils auf 100 Meter genau (`pruefeRundtour` in
`scripts/lib/route.js`). Wird eine GPX-Datei ausgetauscht, bricht der Lauf mit Tagesnummern und
gemessenem Abstand ab, statt einen falschen Ortsnamen zu erzeugen, der später vorgelesen wird.

### Wie die Höhenmeter berechnet werden

`gesamtAnstiegM` (in `scripts/lib/elevation.js`) summiert standardmäßig **jede positive
Höhendifferenz zwischen aufeinanderfolgenden Trackpunkten**, ohne Glättung und ohne
Mindestschwelle. Das ist bewusst so: Die sechs GPX-Dateien sind Komoot-Planungsrouten, deren
Höhenwerte aus einem Geländemodell stammen und bereits glatt sind — es gibt kein GPS-Rauschen,
das herausgefiltert werden müsste. Eine frühere Version filterte trotzdem und zog die Werte
dadurch um rund ein Drittel zu tief (Gesamtanstieg 2361 statt 3073 Höhenmeter). Die ungefilterte
Summe wurde gegen zwei unabhängige Quellen geprüft — ein Höhenmodell über die Streckenkoordinaten
und die Anstiegsangabe von bikerouter.de — und trifft beide auf rund sechs Prozent, die gefilterte
Variante lag 31 % darunter.

Für echte, verrauschte GPS-Aufzeichnungen (nicht für diese sechs Tourdateien) stehen die
Parameter `mindestDifferenzM` und `glaettung` weiterhin bereit, um das alte, filternde Verhalten
herzustellen.

## Aufbau

- `scripts/lib/` — getestete Bibliotheksmodule:
  - `gpx.js` — liest GPX-Dateien (Track, Waypoints, Metadaten)
  - `geo.js` — Distanzen und nächstgelegener Routenpunkt
  - `elevation.js` — Höhenmeter-Berechnung und Glättung
  - `climbs.js` — erkennt und segmentiert Anstiege
  - `route.js` — dünnt Routen für die Kartendarstellung aus, berechnet die Bounding Box und
    prüft, dass die sechs Etappen tatsächlich eine geschlossene Rundtour bilden
  - `poiSchema.js` — validiert einzelne POI-Objekte gegen das Schema
  - `briefing.js` — baut die vorlesbaren Tages-Briefingtexte
- `scripts/build-tour.js` — erzeugt `data/tour.json` aus den sechs GPX-Dateien
- `scripts/build-briefings.js` — erzeugt die Tages-Briefingtexte und schreibt sie in
  `data/pois.json`
- `scripts/validate-pois.js` — prüft `data/pois.json` gegen das Schema
- `scripts/classify-waypoints.js` — **nicht ausführen, siehe Warnung unten**
- `test/` — 83 Tests für alle Bibliotheksmodule (`node --test`)

## Pipeline ausführen

```bash
npm install
npm test
npm run build:tour
npm run build:briefings
npm run validate:pois -- --streng
```

Die Pipeline ist reproduzierbar: Ein vollständiger Neulauf erzeugt `data/tour.json` und
`data/pois.json` byte-identisch zum vorherigen Stand, mit Ausnahme des Feldes `generatedAt`, das
bei jedem Lauf neu gesetzt wird. Das wurde beim Abschluss dieser Pipeline geprüft, indem beide
Dateien vor und nach einem Neulauf verglichen wurden (Vergleich ohne `generatedAt` per
`jq 'del(.generatedAt)'`).

## ⚠️ `scripts/classify-waypoints.js` nicht ausführen

Das Skript steht zwar in der obigen Liste, darf aber **nicht mehr ausgeführt werden**. Es erzeugt
`data/waypoint-kuratierung.md` komplett neu aus den GPX-Waypoints und würde damit die von Hand
eingetragenen Kuratierungsentscheidungen aller sechs Tage (Spalten „Entscheidung“ und
„Begründung“, das Ergebnis von sechs Recherche-Durchläufen) unwiederbringlich überschreiben. Das
Skript kannte diese Entscheidungen beim ersten Lauf noch nicht — es liefert nur einen
maschinellen Vorschlag als Ausgangspunkt. Ein erneuter Lauf würde diesen Vorschlag stumpf
wiederholen und die inzwischen recherchierten Texte darunter begraben.

Falls neue GPX-Tracks eine neue Kuratierung erfordern: `data/waypoint-kuratierung.md` vorher
sichern (z. B. per `git`) und die Ausgabe des Skripts von Hand mit der bisherigen Datei
zusammenführen — niemals einfach überschreiben.

## Datendateien

`data/tour.json` — Kennzahlen und Routenlinien je Tag, vollständig aus den GPX-Tracks berechnet.
Enthält je Tag Start-/Zielort, Länge, Höhenmeter, geschätzte Fahrzeit, erkannte Anstiege und eine
ausgedünnte Routenlinie für die Kartendarstellung.

`data/pois.json` — 183 kuratierte Sehenswürdigkeiten (POIs) mit recherchierten Texten,
Quellenangaben und den Tages-Briefingtexten. Davon tragen 153 POIs `kind: "story"` mit
Erzähltext; die restlichen 30 sind `kind: "service"` (Infrastruktur ohne Erzählwert, z. B.
Rastplätze). Jeder `story`-POI trägt mindestens eine Quelle in `sources[]` — das setzt
`validate:pois -- --streng` durch. Findet sich für einen Waypoint nichts Belastbares, wird er zu
`kind: "service"` herabgestuft statt mit erfundenem Text versehen.

`data/waypoint-kuratierung.md` — nachvollziehbare Entscheidung je Komoot-Waypoint (maschineller
Vorschlag, tatsächliche Entscheidung, Begründung). Von Hand gepflegt, siehe Warnung oben.

## Anwendung und Veröffentlichung

Im Wurzelverzeichnis liegt die eigentliche Anwendung — `index.html`, `app.js`, `sw.js` (Service
Worker), `styles.css`, `manifest.json` —, die `data/tour.json` und `data/pois.json` zur Laufzeit
per `fetch` lädt und daraus die Tagesansicht zusammensetzt. Sie ist als installierbare PWA
angelegt (Service Worker mit Netz-zuerst-Strategie und 2,5-Sekunden-Zeitlimit, danach Cache;
App-Manifest) und wird über GitHub Pages
veröffentlicht unter:

<https://iotson.github.io/ahrtal-eifel-radreise/>

Die Pflege dieser Anwendung ist nicht Teil dieser Datenpipeline; sie liest die beiden
Datendateien lediglich als fertiges Ergebnis.

## Was diese Pipeline nicht enthält

Bewusst ausgelagert in einen zweiten Plan, der auf den beiden Datendateien aufbaut:

- Audio-Erzeugung aus den Texten (macOS-TTS über `say`, MP3-Konvertierung mit `lame` oder
  `ffmpeg`, inkrementelles Rendern nur geänderter Texte)
- Umbau der PWA (Datenmodul, Audio-Player mit MediaSession, GPS-Auslösung, Kartenansicht,
  Oberfläche)
- Vorab-Download der Tourdaten im Service Worker (die Cache-Versionierung samt Aufräumen
  alter Caches steckt bereits in `sw.js`)
- Deployment über die vorhandenen Docker- und k8s-Dateien

Zwei Anforderungen an diesen zweiten Plan sind bereits festgehalten — eine Warteschlange mit
Mindestabstand zwischen zwei Ansagen und die Beschränkung der Vertonung auf `textShort`:
[`docs/superpowers/anforderungen-audio-plan.md`](docs/superpowers/anforderungen-audio-plan.md).

Felder für Audiodateien (z. B. `audioShort`, `audioLong`, `briefing.audio`) sind im aktuellen
Schema noch **nicht angelegt** — sie werden erst mit dem zweiten Plan eingeführt, wenn die
Audio-Erzeugung selbst gebaut wird. `textShort`, `textLong` und `briefing.text` sind die
Textgrundlage dafür.
