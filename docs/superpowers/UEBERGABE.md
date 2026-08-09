# Übergabe — Stand nach Task 9 (2026-08-08)

## Wie es weitergeht

In einer **frischen Claude-Code-Session** im Verzeichnis `/Users/haverland/workspaces/Ahrtal` sagen:

> Führe Plan `docs/superpowers/plans/2026-08-08-datenpipeline.md` ab Task 10 weiter aus,
> mit dem Skill `superpowers:subagent-driven-development`. Der Fortschritt steht in
> `.superpowers/sdd/2026-08-08-datenpipeline/progress.md` — Tasks 1 bis 9 sind fertig.

Die Tasks 10 bis 15 sind die Recherche der POI-Texte, je ein Tag pro Task. Sie sind die
inhaltliche Hauptarbeit und brauchen viel Websuche. Danach folgen Task 16 (Briefing-Texte),
Task 17 (Abschluss) und das finale Whole-Branch-Review.

## Was fertig ist

Branch `feature/datenpipeline`, 12 Commits, 52 Tests grün (`npm test`).

| Datei | Inhalt |
|---|---|
| `data/tour.json` | Kennzahlen und Routenlinien aller sechs Etappen, reproduzierbar über `npm run build:tour` |
| `data/waypoint-kuratierung.md` | alle 109 Komoot-Waypoints, je Tag nach Streckenkilometer sortiert, mit maschinellem Vorschlag |
| `scripts/lib/` | `gpx.js`, `geo.js`, `elevation.js`, `climbs.js`, `route.js`, `poiSchema.js` |
| `scripts/` | `build-tour.js`, `classify-waypoints.js`, `validate-pois.js` |

`data/pois.json` existiert **noch nicht** — sie entsteht in Task 10.

## Verifizierte Kennzahlen der Tour

Gesamt: **428 km, 2361 Höhenmeter**.

| Tag | Strecke | Länge | Höhenmeter | Anstiege | Fahrzeit |
|---|---|---|---|---|---|
| 1 | Koblenz → Findling | 71,9 km | 113 m | 0 | 248 min |
| 2 | Findling → Waldkönigen | 74,5 km | 599 m | 1 | 258 min |
| 3 | Waldkönigen → Pittenbach | 62,0 km | 578 m | 1 | 204 min |
| 4 | Pittenbach → Bergweiler | 58,1 km | 646 m | 6 | 185 min |
| 5 | Bergweiler → Nehren | 72,5 km | 314 m | 1 | 230 min |
| 6 | Nehren → Koblenz | 89,2 km | 111 m | 0 | 289 min |

Die Zahlen in der alten `app.js` (43/52/58/68/61/47 km) waren frei erfunden und sind keine
gültige Referenz.

## Was bei der Recherche zu beachten ist

**Die Kuratierung stuft zu großzügig ein.** 97 von 109 Waypoints stehen auf `story`, nur 12 auf
`service`. Mindestens diese elf sind reine Wegweiser ohne Erzählwert und gehören herabgestuft
oder verworfen: Kastanienallee (Tag 1), Wegkreuz (Tag 4), Strand (Tag 6, dreimal),
Eifel-Ardennen-Radweg (Tag 3, zweimal), Bleialfer Radweg (Tag 3),
Eifel-Ardennen und Prümtal-Radweg (Tag 4), Mosel-Uferweg (Tag 6), Moselradweg bei Alken (Tag 6).

Umgekehrt zwei milde Zweifelsfälle auf `service`, die erzählenswert sein könnten:
Hotel Anker (Tag 1, direkt neben Schloss Arenfels) und Rambo's Garten Café-Bistro (Tag 5).

**Tag 2 hat nur sechs Waypoints auf 74,5 km.** Schritt D des Recherche-Protokolls (Lücken gegen
die Route schließen) ist dort der Schwerpunkt, nicht die Nebensache.

**Der Validator ist scharf.** `npm run validate:pois` verlangt je `story`-POI mindestens eine
Quelle mit mindestens acht Zeichen, `textShort` 30–70 Wörter, `textLong` 120–280 Wörter.
Fehlende Briefing-Texte sind bis Task 16 nur Warnungen; ab Task 17 macht `-- --streng` sie
zu Fehlern.

**Alle 109 Waypoints liegen direkt an der Route** — größter Abstand 62 m. Der Abstandshinweis
in der Kuratierungstabelle wird deshalb nie ausgelöst.

## Offene Punkte

**Tag 1 beginnt 15 km südlich von Koblenz.** Der Track startet bei 50,274 / 7,646; das Deutsche
Eck wird erst bei Kilometer 14,94 erreicht (Trackindex 350 von 1470). Ob das eine Anfahrt ist
oder der gewollte Start, ist ungeklärt — in `data/tour.json` als Feld `hinweis` bei Tag 1
dokumentiert. **Der Nutzer wollte das in Komoot gegenprüfen.**

**Bei Tag 2 verschluckt die Anstiegserkennung eine echte Rampe** von rund 45 Höhenmetern auf
unter einem Kilometer (etwa 5 %) kurz vor dem Ziel, weil die `maxAbfallM`-Logik sie mit 43 km
Flachstück zusammenfasst. Der Nutzer hat am 2026-08-08 entschieden, das **so zu lassen**.

**GitHub Pages statt Heimserver** ist ein Nutzerwunsch für Plan 2 — Notizen dazu in
`.superpowers/sdd/2026-08-08-datenpipeline/plan2-notizen.md`. Wichtig: Geolocation und Service
Worker verlangen HTTPS, ein Heimserver über HTTP wäre kein gültiger sicherer Kontext.

**Zwei unbeauftragte Commits** (`6a34ecb`, `ac34ec4`) enthalten Design und Plan für die
Audio-Erzeugung, 1598 Zeilen. Ein Subagent hat sie eigenmächtig geschrieben; sie sind durch kein
Review gelaufen und kennen den GitHub-Pages-Wunsch nicht. Der Nutzer hat entschieden, sie
**liegen zu lassen** — vor einer Verwendung als Plan 2 also prüfen.

## Aufgeschobene Kleinigkeiten

Beim finalen Review zu triagieren, vollständig im Ledger:

- Tippfehler „Fenstergrößße" (dreifaches ß) in `scripts/lib/elevation.js` und Commit `74f9745`
- `hinweis`-Feld in `tour.json` nutzt Dezimalpunkt statt Komma — vor der Sprachausgabe korrigieren
- `classify-waypoints.js` escaped keine Pipe-Zeichen in Waypoint-Namen (latent)
- Quellenprüfung prüft nur Länge, keine Form — `sources: ['xxxxxxxxxx']` rutscht durch
- Geparkte Randfälle: `parseGpx` liefert `NaN`/`"undefined"` bei unvollständigen GPX-Dateien;
  `naechsterRoutenpunkt([])` und `boundingBox([])` liefern Infinity statt Fehler. Alle
  plan-mandiert, vom Nutzer bewusst so belassen.
