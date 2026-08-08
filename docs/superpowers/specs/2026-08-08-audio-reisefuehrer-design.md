# Audio-Reiseführer Ahrtal & Eifel — Design

**Datum:** 2026-08-08
**Status:** Freigegeben, bereit für Implementierungsplanung

## Ziel

Eine Offline-PWA, die während einer sechstägigen Fahrradtour durch Ahrtal, Eifel und Moseltal an
Sehenswürdigkeiten automatisch eine reiseführerartige Erzählung vorliest — historisch, landschaftlich,
architektonisch. Dazu je Tag ein abspielbares Morgen-Briefing mit Streckenkennzahlen.

Nutzung: iPhone am Lenker, Gruppe von Freunden, Mobilfunk streckenweise nicht verfügbar.

## Ausgangslage

Im Workspace liegen sechs Komoot-GPX-Dateien (Tag 1–6) sowie eine bestehende PWA-Version
(`index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.json`, `Dockerfile`, `k8s/`).

### GPX-Datenbestand

| Tag | Strecke | Waypoints |
|-----|---------|-----------|
| 1 | Koblenz → Findling | 19 |
| 2 | Findling → Waldkönigen | 6 |
| 3 | Waldkönigen → Pittenbach | 26 |
| 4 | Pittenbach → Bergweiler | 14 |
| 5 | Bergweiler → Nehren | 22 |
| 6 | Nehren → Koblenz | 22 |
| **Summe** | | **109** |

Die Tracks enthalten vollständige Höhen- und Zeitdaten (Tag 1: 1470 Trackpunkte, je mit `<ele>` und
`<time>`). Ein `<trkseg>` pro Datei. Die Zeitstempel sind Komoot-Planungszeiten, keine
Aufzeichnungen — als Fahrzeitschätzung verwendbar, nicht als Messwert.

### Befunde zur bestehenden Version

Diese Mängel begründen den Umbau:

1. **Der Reiseführer ist praktisch leer.** `poiLibrary` in `app.js` enthält 13 Einträge, die per
   exaktem Namensvergleich (`poiLibrary[name]`) gegen die GPX-Waypointnamen gematcht werden. Die
   Namen stimmen überwiegend nicht überein — die Bibliothek kennt `'Kobern-Gondorf'`, der Waypoint
   heißt `'Historische Altstadt von Kobern-Gondorf'`; ebenso bei Burg Metternich, Reichsburg Cochem,
   Hochmoselübergang und Wittlich. **Effektiv greifen 8 von 109 POIs.** Die übrigen 101 erhalten den
   generischen Fallback ohne Informationsgehalt.
2. **Die vorhandenen Texte sind generisch und teils frei erfunden.** Formulierungen wie „Solche
   Kapellen markieren die Wege" oder „Diese Monasterien prägten die Eifel" enthalten keine
   recherchierten Fakten.
3. **Vorlesen bricht unterwegs ab.** `SpeechSynthesisUtterance` stoppt auf iOS, sobald das Display
   sperrt oder die App in den Hintergrund wechselt — genau der Normalfall beim Radfahren. Zusätzlich
   sendet „Ganze Tour vorlesen" alle POI-Texte als eine einzige Utterance; iOS Safari kappt lange
   Utterances.
4. **Kennzahlen sind geschätzt.** Länge, Höhenmeter und Anstiege sind im Code hart hinterlegt,
   obwohl die GPX-Tracks die echten Werte hergeben.
5. **Keine Karte.** Die „Karte" besteht aus CSS-Dekoration ohne Bezug zur Route.
6. **Service Worker ohne Versionierung.** Er cacht blind und liefert dauerhaft veraltete Dateien aus.

## Entwurfsentscheidungen

| Entscheidung | Gewählt | Begründung |
|---|---|---|
| Inhaltsquelle | Vorab recherchiert, statisch eingebaut | Funklöcher in der Eifel; VPN hilft ohne Mobilfunk nicht. Keine Halluzinationen unterwegs, Texte vor der Tour prüfbar. |
| Sprachausgabe | Vorproduzierte MP3 pro POI | Läuft bei gesperrtem Display weiter, Steuerung im Sperrbildschirm, offline. Web Speech kann das auf iOS prinzipbedingt nicht. |
| Auslösung | Automatisch bei Annäherung per GPS | Gewünschter Reiseführer-Effekt. Handy am Lenker, Display aktiv. |
| Kartendarstellung | Gezeichnete Routenlinie ohne Kartenkacheln | Offline ohne Tile-Server, klein, ausreichend zur Orientierung entlang einer bekannten Route. |

## Architektur

Vier voneinander unabhängige Bausteine. Die ersten drei laufen vor der Tour auf dem Mac, der vierte
auf dem iPhone.

```
GPX-Dateien ──▶ [1] Routen-Analyse ──▶ tour.json (Kennzahlen, Anstiege, Routenlinie)
                                          │
GPX-Waypoints ─▶ [2] POI-Kuratierung ────▶ pois.json (kuratierte POIs mit Texten + Quellen)
                     + Recherche           │
                                           ▼
                                    [3] Audio-Erzeugung ──▶ audio/*.mp3
                                                                │
                                                                ▼
                                                         [4] PWA (Auslieferung)
```

Die Schnittstellen zwischen den Bausteinen sind Dateien. Jeder Baustein ist einzeln ausführbar und
prüfbar; ein Fehler in der Recherche erfordert kein Neu-Rendern der App.

### Baustein 1 — Routen-Analyse

Ein Node-Skript liest die sechs GPX-Dateien und erzeugt `data/tour.json`.

Berechnet pro Tag:

- **Streckenlänge**: Haversine-Summe über alle Trackpunkte.
- **Höhenmeter**: kumulierter Anstieg über die `<ele>`-Werte. Zur Unterdrückung von GPS-Rauschen wird
  die Höhenreihe vorab geglättet und nur Differenzen oberhalb einer Mindestschwelle gezählt.
  Andernfalls summieren sich Messfehler zu unrealistisch hohen Werten.
- **Anstiege**: zusammenhängende Segmente mit durchgehendem Höhengewinn oberhalb einer Mindesthöhe
  und Mindestlänge. Je Anstieg werden ausgegeben: Startkilometer, Länge, Höhengewinn und
  Durchschnittssteigung.
- **Fahrzeitschätzung**: aus den Komoot-Zeitstempeln (erster bis letzter Trackpunkt).
- **Routenlinie**: auf wenige hundert Punkte ausgedünnte Koordinatenfolge für die Kartenanzeige,
  plus Bounding Box.

Die konkreten Schwellenwerte für Glättung und Anstiegserkennung werden im Implementierungsplan
festgelegt und gegen die Komoot-Angaben plausibilisiert.

**Zu klären bei der Implementierung:** Der erste Trackpunkt von Tag 1 liegt bei 50.2739/7.6459,
der erste Waypoint („Deutsches Eck") bei 50.3650/7.6065. Track- und Waypoint-Anfang fallen also
nicht zusammen. Vor der Kilometrierung ist zu prüfen, ob der Track eine Anfahrt enthält.

Struktur je Tag in `tour.json`:

```
day, lengthKm, elevationGainM,
climbs[]: { startKm, lengthKm, gainM, avgGradientPct },
estimatedRidingTime, routeLine[]: [lat, lon], bbox
```

### Baustein 2 — POI-Kuratierung und Recherche

Erzeugt `data/pois.json`. Zwei Arbeitsschritte:

**Schritt A — Bestehende Waypoints sortieren.** Die 109 Komoot-Waypoints sind keine kuratierte
Sehenswürdigkeitenliste. Sie werden in drei Kategorien eingeteilt:

- `story` — Erzähl-POI mit historischem, landschaftlichem, architektonischem oder technischem Gehalt.
  Erhält recherchierten Text und Audio.
- `service` — praktischer Punkt ohne Erzählwert (Einkehr, Ladestation, Rastplatz, Spielplatz,
  Wohnmobilstellplatz, Schutzhütte). Bleibt in der Liste sichtbar, weil unterwegs nützlich, erhält
  aber weder Text noch Audio-Auslösung.
- verworfen — Dubletten und Nichtssagendes, erscheint nicht in der App.

**Schritt B — Lücken schließen.** Abgleich der Trackverläufe gegen recherchierte Sehenswürdigkeiten
der durchfahrenen Regionen. Aufgenommen wird, was innerhalb rund 2 km zur Route liegt und in Komoot
fehlt. Jeder ergänzte POI erhält Koordinaten und einen Vermerk zur Erreichbarkeit („direkt an der
Strecke" / „X m Abstecher" / „nur Blickkontakt").

**Recherche und Belegpflicht.** Jeder `story`-POI wird per Websuche recherchiert (Wikipedia,
Ortschroniken, Tourismus- und Denkmalseiten). Jeder Text führt seine Quellen in den Daten mit.
Lässt sich nichts Belastbares finden, erhält der POI entweder einen ehrlichen Landschafts- und
Kontexttext ohne Faktenbehauptungen oder wird zu `service` herabgestuft. **Erfundene Inhalte sind
ausgeschlossen** — das ist der Hauptmangel der Vorgängerversion.

Je `story`-POI werden zwei Textlängen verfasst:

- `textShort` — rund 15 Sekunden gesprochen, für die Vorbeifahrt.
- `textLong` — rund 60 bis 90 Sekunden, zum Anhalten.

Struktur je POI in `pois.json`:

```
id, day, name, lat, lon, category, kind ("story" | "service"), accessNote,
textShort, textLong, sources[], audioShort, audioLong, triggerRadius, routeKm
```

Zusätzlich enthält `pois.json` je Tag den Briefing-Datensatz: den gesprochenen Text „Heute erwartet
dich …", der die Kennzahlen aus Baustein 1 und die Tageshighlights zusammenführt, samt Audioverweis.

### Baustein 3 — Audio-Erzeugung

Ein Skript rendert aus den Texten MP3-Dateien mit dem lokal verfügbaren macOS-TTS
(`say -v <Stimme>`, deutsche Stimmen sind vorhanden, u.a. Anna), gefolgt von einer Konvertierung
nach MP3 in sprachtauglicher Bitrate. Keine Cloud, keine Kosten.

Erzeugt werden: je `story`-POI eine Kurz- und eine Langfassung, je Tag ein Briefing. Größenordnung
rund 20–40 MB gesamt.

Das Skript rendert nur Dateien neu, deren Text sich geändert hat, damit Textkorrekturen keinen
kompletten Neulauf erzwingen.

### Baustein 4 — Die PWA

Die bestehende Hülle bleibt: statische Auslieferung per nginx im Container, Deployment über die
vorhandenen k8s-Manifeste im Heimnetz. `app.js` wird umgebaut und in klar abgegrenzte Module geteilt,
statt weiter als eine Datei zu wachsen:

- **Datenzugriff** — lädt `tour.json` und `pois.json`. Der Namensvergleich gegen GPX entfällt
  vollständig; damit verschwindet der 8-von-109-Fehler strukturell.
- **Standortverfolgung** — `watchPosition`, ermittelt POIs im Auslöseradius (Vorgabe rund 150 m,
  je POI über `triggerRadius` überschreibbar). Ein in `localStorage` geführter „bereits gehört"-Merker
  verhindert Wiederholungen beim Stehenbleiben und übersteht einen Neustart der App.
- **Audio-Wiedergabe** — ein `<audio>`-Element mit Warteschlange, damit sich dicht aufeinander
  folgende POIs nicht ins Wort fallen. MediaSession-Metadaten liefern Titel und Steuerung im
  Sperrbildschirm.
- **Kartenansicht** — zeichnet die Routenlinie aus `tour.json`, die POI-Marker und die aktuelle
  Position. Ohne Kartenkacheln, damit offline und leichtgewichtig.
- **Oberfläche** — Tagesauswahl, Briefing-Knopf, POI-Liste mit Kategorie-Kennzeichnung,
  Detailansicht mit Kurz-/Langfassung und Quellenangabe.

**Service Worker**: Precache aller Dateien inklusive Audio, mit Cache-Namen pro Version und
Aufräumen alter Caches beim `activate`. Beim ersten Öffnen wird der Fortschritt des Vorab-Downloads
angezeigt, damit vor Abfahrt erkennbar ist, ob alles geladen wurde.

## Ablauf für die Nutzer

1. **Vor der Tour, zuhause im WLAN:** App öffnen, Vorab-Download abwarten, „Zum Home-Bildschirm
   hinzufügen". Danach ist die gesamte Tour ohne Netz verfügbar.
2. **Morgens:** Tag auswählen, Briefing abspielen — Länge, Höhenmeter, Anstiege, Highlights.
3. **Unterwegs:** Handy am Lenker, App im Vordergrund. Bei Annäherung startet die Kurzfassung
   automatisch; die Langfassung lässt sich am Halt nachhören.
4. **WireGuard** wird nur benötigt, um unterwegs Änderungen nachzuladen — für den Normalbetrieb nicht.

## Bekannte Grenzen

- **Hintergrund-Ortung:** iOS lässt Web-Apps im Hintergrund nicht dauerhaft orten. Die automatische
  Auslösung setzt aktives Display und App im Vordergrund voraus. Bereits gestartetes Audio läuft
  dagegen auch bei gesperrtem Display weiter. Das ist eine Plattformgrenze, keine Implementierungslücke.
- **Akkuverbrauch:** Dauerhaftes GPS bei aktivem Display zieht spürbar Strom. Eine Powerbank am
  Lenker ist einzuplanen.
- **TTS-Qualität:** Die macOS-Stimmen klingen synthetisch. Sie sind verständlich und kostenfrei;
  falls die Qualität stört, lässt sich Baustein 3 später gegen einen anderen TTS-Dienst tauschen,
  ohne die übrigen Bausteine zu berühren.

## Umfang

Der Aufwand liegt eindeutig in Baustein 2: Kuratierung und Recherche von rund 100 POIs. Bausteine 1,
3 und 4 sind überschaubare, klar umrissene Umbauten.

Nicht Teil dieses Entwurfs: Navigation und Routenführung (dafür bleibt Komoot zuständig),
Unterkunfts- und Einkehrplanung, Mehrsprachigkeit, Teilen von Inhalten zwischen den Mitfahrenden.
