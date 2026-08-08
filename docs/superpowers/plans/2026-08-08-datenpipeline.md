# Datenpipeline Audio-Reiseführer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aus den sechs Komoot-GPX-Dateien und recherchierten Inhalten die beiden Datendateien `data/tour.json` und `data/pois.json` erzeugen, die der Audio-Reiseführer als Grundlage nutzt.

**Architecture:** Reine Node-Skripte ohne Laufzeitabhängigkeit zur PWA. Kleine, einzeln getestete Bibliotheksmodule unter `scripts/lib/`, darüber CLI-Skripte, die die Datendateien schreiben. Schnittstelle zur App sind ausschließlich die JSON-Dateien.

**Tech Stack:** Node 26 (vorhanden), eingebauter Testrunner `node --test`, `fast-xml-parser` als einzige Laufzeitabhängigkeit.

## Global Constraints

- Alle Texte, Feldwerte und Commit-Messages auf Deutsch, mit korrekten Umlauten (ä, ö, ü, ß). Niemals ASCII-Ersatz wie "ae" oder "ss".
- Datumsformat in Daten: ISO-8601 UTC, z.B. `2026-08-08T12:00:00.000Z`.
- Keine erfundenen Inhalte. Jeder `story`-POI trägt mindestens eine Quelle in `sources[]`. Findet sich nichts Belastbares, wird der POI zu `kind: "service"` herabgestuft.
- Koordinaten immer als `lat`, `lon` in dieser Reihenfolge, Dezimalgrad, WGS84.
- Distanzen in Kilometern (`...Km`), Höhen in Metern (`...M`), Zeiten in Minuten (`...Min`).
- Die sechs GPX-Dateien im Projektwurzelverzeichnis werden nur gelesen, nie verändert.
- Jede Task endet mit einem Commit.

## Dateistruktur

| Datei | Verantwortung |
|---|---|
| `scripts/lib/gpx.js` | GPX-Datei einlesen, Track- und Waypoints extrahieren |
| `scripts/lib/geo.js` | Entfernungsrechnung, Kilometrierung, Projektion auf die Route |
| `scripts/lib/elevation.js` | Höhenreihe glätten, Anstiegssumme berechnen |
| `scripts/lib/climbs.js` | Zusammenhängende Anstiege erkennen |
| `scripts/lib/route.js` | Routenlinie ausdünnen, Bounding Box |
| `scripts/lib/poiSchema.js` | `pois.json` gegen die Regeln prüfen |
| `scripts/lib/briefing.js` | Briefing-Text aus Kennzahlen formulieren |
| `scripts/build-tour.js` | CLI: GPX → `data/tour.json` |
| `scripts/classify-waypoints.js` | CLI: Kuratierungstabelle erzeugen |
| `scripts/validate-pois.js` | CLI: `data/pois.json` prüfen |
| `scripts/build-briefings.js` | CLI: Briefing-Texte erzeugen |
| `test/*.test.js` | Je ein Test pro Bibliotheksmodul |
| `data/waypoint-kuratierung.md` | Nachvollziehbare Kuratierungsentscheidungen je Waypoint |

---

### Task 1: Projekt-Setup

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `test/setup.test.js`

**Interfaces:**
- Consumes: nichts
- Produces: lauffähiges `npm test`, Verzeichnisse `scripts/lib/`, `test/`, `data/`

- [ ] **Step 1: Git-Repository anlegen**

Der Workspace ist noch kein Git-Repository. Ohne Versionierung sind die folgenden Commit-Schritte nicht ausführbar.

```bash
cd /Users/haverland/workspaces/Ahrtal
git init
```

- [ ] **Step 2: `.gitignore` anlegen**

```
node_modules/
audio/
*.aiff
.DS_Store
```

`audio/` bleibt draußen, weil dort später 20–40 MB generierte MP3-Dateien landen, die jederzeit reproduzierbar sind.

- [ ] **Step 3: `package.json` anlegen**

```json
{
  "name": "ahrtal-eifel-reisefuehrer",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test test/",
    "build:tour": "node scripts/build-tour.js",
    "validate:pois": "node scripts/validate-pois.js",
    "build:briefings": "node scripts/build-briefings.js"
  },
  "dependencies": {
    "fast-xml-parser": "^5.0.0"
  }
}
```

- [ ] **Step 4: Abhängigkeit installieren und Verzeichnisse anlegen**

```bash
npm install
mkdir -p scripts/lib test data
```

- [ ] **Step 5: Rauchtest schreiben**

`test/setup.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser } from 'fast-xml-parser';

test('Testrunner und XML-Parser sind verfügbar', () => {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const result = parser.parse('<gpx><wpt lat="50.1" lon="7.2"><name>Test</name></wpt></gpx>');
  assert.equal(result.gpx.wpt['@_lat'], '50.1');
  assert.equal(result.gpx.wpt.name, 'Test');
});
```

- [ ] **Step 6: Test ausführen**

Run: `npm test`
Expected: PASS, 1 Test

- [ ] **Step 7: Commit**

```bash
git add .gitignore package.json package-lock.json test/setup.test.js
git commit -m "chore: Projekt-Setup mit Node-Testrunner und XML-Parser"
```

---

### Task 2: GPX-Modul

**Files:**
- Create: `scripts/lib/gpx.js`
- Test: `test/gpx.test.js`

**Interfaces:**
- Consumes: `fast-xml-parser`
- Produces:
  - `parseGpx(xmlText)` → `{ name: string, trackPoints: Array<{lat: number, lon: number, ele: number, time: string}>, waypoints: Array<{name: string, lat: number, lon: number, sym: string|null}> }`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`test/gpx.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGpx } from '../scripts/lib/gpx.js';

const BEISPIEL_GPX = `<?xml version='1.0' encoding='UTF-8'?>
<gpx version="1.1" creator="https://www.komoot.de" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Testtour</name></metadata>
  <wpt lat="50.364997" lon="7.606475"><name>Deutsches Eck</name><sym>Flag, Blue</sym></wpt>
  <wpt lat="50.423420" lon="7.528403"><name>Eisenbahnbrücke Urmitz</name><sym>Bridge</sym></wpt>
  <trk><trkseg>
    <trkpt lat="50.273949" lon="7.645975"><ele>69.386223</ele><time>2026-08-08T10:00:35.030Z</time></trkpt>
    <trkpt lat="50.273882" lon="7.645894"><ele>70.500000</ele><time>2026-08-08T10:00:36.553Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

test('liest den Tournamen aus den Metadaten', () => {
  const result = parseGpx(BEISPIEL_GPX);
  assert.equal(result.name, 'Testtour');
});

test('liest alle Waypoints mit Namen, Koordinaten und Symbol', () => {
  const result = parseGpx(BEISPIEL_GPX);
  assert.equal(result.waypoints.length, 2);
  assert.deepEqual(result.waypoints[0], {
    name: 'Deutsches Eck',
    lat: 50.364997,
    lon: 7.606475,
    sym: 'Flag, Blue'
  });
  assert.equal(result.waypoints[1].name, 'Eisenbahnbrücke Urmitz');
  assert.equal(result.waypoints[1].sym, 'Bridge');
});

test('liest Trackpunkte mit Höhe und Zeit als Zahlen bzw. ISO-String', () => {
  const result = parseGpx(BEISPIEL_GPX);
  assert.equal(result.trackPoints.length, 2);
  assert.equal(result.trackPoints[0].lat, 50.273949);
  assert.equal(result.trackPoints[0].ele, 69.386223);
  assert.equal(result.trackPoints[0].time, '2026-08-08T10:00:35.030Z');
  assert.equal(typeof result.trackPoints[0].lat, 'number');
  assert.equal(typeof result.trackPoints[0].ele, 'number');
});

test('kommt mit einer Datei ohne Waypoints zurecht', () => {
  const ohneWpt = BEISPIEL_GPX.replace(/<wpt[\s\S]*?<\/wpt>/g, '');
  const result = parseGpx(ohneWpt);
  assert.deepEqual(result.waypoints, []);
  assert.equal(result.trackPoints.length, 2);
});
```

Der letzte Test ist wichtig: `fast-xml-parser` liefert bei genau einem Element ein Objekt statt eines Arrays. Ohne Normalisierung bricht der Code bei Dateien mit nur einem Waypoint.

- [ ] **Step 2: Test ausführen und Fehlschlag bestätigen**

Run: `node --test test/gpx.test.js`
Expected: FAIL mit `Cannot find module '../scripts/lib/gpx.js'`

- [ ] **Step 3: Modul implementieren**

`scripts/lib/gpx.js`:

```javascript
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true
});

/** Liefert immer ein Array, auch wenn der Parser ein Einzelobjekt oder undefined zurückgibt. */
function alsArray(wert) {
  if (wert === undefined || wert === null) return [];
  return Array.isArray(wert) ? wert : [wert];
}

export function parseGpx(xmlText) {
  const doc = parser.parse(xmlText);
  const gpx = doc.gpx;

  const name = gpx.metadata?.name ?? '';

  const waypoints = alsArray(gpx.wpt).map((wpt) => ({
    name: String(wpt.name ?? ''),
    lat: Number(wpt['@_lat']),
    lon: Number(wpt['@_lon']),
    sym: wpt.sym !== undefined ? String(wpt.sym) : null
  }));

  const segmente = alsArray(gpx.trk).flatMap((trk) => alsArray(trk.trkseg));
  const trackPoints = segmente.flatMap((seg) =>
    alsArray(seg.trkpt).map((pt) => ({
      lat: Number(pt['@_lat']),
      lon: Number(pt['@_lon']),
      ele: Number(pt.ele),
      time: String(pt.time)
    }))
  );

  return { name: String(name), trackPoints, waypoints };
}
```

- [ ] **Step 4: Tests ausführen**

Run: `node --test test/gpx.test.js`
Expected: PASS, 4 Tests

- [ ] **Step 5: Gegen die echten Dateien prüfen**

```bash
node -e "
import('./scripts/lib/gpx.js').then(async ({ parseGpx }) => {
  const fs = await import('node:fs/promises');
  const dateien = (await fs.readdir('.')).filter(f => f.endsWith('.gpx')).sort();
  for (const datei of dateien) {
    const r = parseGpx(await fs.readFile(datei, 'utf8'));
    console.log(r.trackPoints.length + ' Trackpunkte, ' + r.waypoints.length + ' Waypoints — ' + r.name);
  }
});
"
```

Expected: sechs Zeilen. Die Waypointzahlen müssen 19, 6, 26, 14, 22, 22 ergeben (Summe 109). Weicht etwas ab, liegt ein Parserfehler vor — nicht weitermachen, sondern beheben.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/gpx.js test/gpx.test.js
git commit -m "feat: GPX-Modul liest Track- und Waypoints"
```

---

### Task 3: Geo-Modul

**Files:**
- Create: `scripts/lib/geo.js`
- Test: `test/geo.test.js`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `haversineKm(lat1, lon1, lat2, lon2)` → `number` (Entfernung in km)
  - `kumulierteDistanzen(points)` → `number[]` (Länge = points.length, erster Wert 0, Kilometerstand je Punkt)
  - `gesamtDistanzKm(points)` → `number`
  - `naechsterRoutenpunkt(lat, lon, points)` → `{ index: number, distanzKm: number }`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`test/geo.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, kumulierteDistanzen, gesamtDistanzKm, naechsterRoutenpunkt } from '../scripts/lib/geo.js';

test('identische Punkte haben Abstand null', () => {
  assert.equal(haversineKm(50.1, 7.2, 50.1, 7.2), 0);
});

test('ein Grad Breitengrad entspricht rund 111,2 km', () => {
  const d = haversineKm(0, 0, 1, 0);
  assert.ok(Math.abs(d - 111.19) < 0.1, `erwartet ~111.19, war ${d}`);
});

test('ein Grad Längengrad am Äquator entspricht rund 111,2 km', () => {
  const d = haversineKm(0, 0, 0, 1);
  assert.ok(Math.abs(d - 111.19) < 0.1, `erwartet ~111.19, war ${d}`);
});

test('ein Grad Längengrad auf 60 Grad Breite entspricht rund der Hälfte', () => {
  const d = haversineKm(60, 0, 60, 1);
  assert.ok(Math.abs(d - 55.6) < 0.2, `erwartet ~55.6, war ${d}`);
});

test('die Entfernung ist symmetrisch', () => {
  const hin = haversineKm(50.364997, 7.606475, 50.423156, 7.543823);
  const zurueck = haversineKm(50.423156, 7.543823, 50.364997, 7.606475);
  assert.equal(hin, zurueck);
});

test('kumulierte Distanzen beginnen bei null und wachsen monoton', () => {
  const punkte = [
    { lat: 0, lon: 0 },
    { lat: 1, lon: 0 },
    { lat: 2, lon: 0 }
  ];
  const km = kumulierteDistanzen(punkte);
  assert.equal(km.length, 3);
  assert.equal(km[0], 0);
  assert.ok(km[1] > 111 && km[1] < 112);
  assert.ok(km[2] > 222 && km[2] < 223);
});

test('kumulierte Distanzen einer leeren Liste sind leer', () => {
  assert.deepEqual(kumulierteDistanzen([]), []);
});

test('die Gesamtdistanz ist der letzte kumulierte Wert', () => {
  const punkte = [{ lat: 0, lon: 0 }, { lat: 1, lon: 0 }];
  assert.equal(gesamtDistanzKm(punkte), kumulierteDistanzen(punkte)[1]);
});

test('die Gesamtdistanz eines einzelnen Punktes ist null', () => {
  assert.equal(gesamtDistanzKm([{ lat: 5, lon: 5 }]), 0);
});

test('findet den nächstgelegenen Routenpunkt mit Index und Abstand', () => {
  const route = [
    { lat: 50.0, lon: 7.0 },
    { lat: 50.1, lon: 7.0 },
    { lat: 50.2, lon: 7.0 }
  ];
  const treffer = naechsterRoutenpunkt(50.09, 7.0, route);
  assert.equal(treffer.index, 1);
  assert.ok(treffer.distanzKm < 1.5, `erwartet unter 1.5 km, war ${treffer.distanzKm}`);
});
```

- [ ] **Step 2: Test ausführen und Fehlschlag bestätigen**

Run: `node --test test/geo.test.js`
Expected: FAIL mit `Cannot find module '../scripts/lib/geo.js'`

- [ ] **Step 3: Modul implementieren**

`scripts/lib/geo.js`:

```javascript
const ERDRADIUS_KM = 6371.0088;

function inBogenmass(grad) {
  return (grad * Math.PI) / 180;
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = inBogenmass(lat2 - lat1);
  const dLon = inBogenmass(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(inBogenmass(lat1)) * Math.cos(inBogenmass(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * ERDRADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function kumulierteDistanzen(points) {
  if (points.length === 0) return [];
  const werte = [0];
  for (let i = 1; i < points.length; i += 1) {
    const schritt = haversineKm(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
    werte.push(werte[i - 1] + schritt);
  }
  return werte;
}

export function gesamtDistanzKm(points) {
  const werte = kumulierteDistanzen(points);
  return werte.length === 0 ? 0 : werte[werte.length - 1];
}

export function naechsterRoutenpunkt(lat, lon, points) {
  let bester = { index: -1, distanzKm: Infinity };
  for (let i = 0; i < points.length; i += 1) {
    const d = haversineKm(lat, lon, points[i].lat, points[i].lon);
    if (d < bester.distanzKm) {
      bester = { index: i, distanzKm: d };
    }
  }
  return bester;
}
```

- [ ] **Step 4: Tests ausführen**

Run: `node --test test/geo.test.js`
Expected: PASS, 10 Tests

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/geo.js test/geo.test.js
git commit -m "feat: Geo-Modul mit Haversine, Kilometrierung und Routenprojektion"
```

---

### Task 4: Höhenmodul

**Files:**
- Create: `scripts/lib/elevation.js`
- Test: `test/elevation.test.js`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `glaetteHoehen(eleWerte, fensterGroesse = 9)` → `number[]` (gleitender Mittelwert, gleiche Länge)
  - `gesamtAnstiegM(eleWerte, mindestDifferenzM = 3)` → `number`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

Hintergrund für den Implementierenden: GPS-Höhenwerte schwanken um mehrere Meter, auch wenn man auf ebener Strecke fährt. Summiert man jede positive Differenz auf, entstehen absurd hohe Werte — bei einer 43-km-Tour leicht das Doppelte des tatsächlichen Anstiegs. Deshalb zwei Stufen: erst glätten, dann nur Differenzen ab einer Mindestschwelle zählen.

`test/elevation.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glaetteHoehen, gesamtAnstiegM } from '../scripts/lib/elevation.js';

test('Glättung erhält die Länge der Reihe', () => {
  const roh = [100, 102, 101, 103, 105, 104, 106];
  assert.equal(glaetteHoehen(roh, 3).length, roh.length);
});

test('Glättung einer konstanten Reihe ändert nichts', () => {
  const roh = [200, 200, 200, 200, 200];
  const geglaettet = glaetteHoehen(roh, 3);
  geglaettet.forEach((wert) => assert.ok(Math.abs(wert - 200) < 0.001));
});

test('Glättung dämpft einen einzelnen Ausreißer', () => {
  const roh = [100, 100, 160, 100, 100];
  const geglaettet = glaetteHoehen(roh, 3);
  assert.ok(geglaettet[2] < 140, `Ausreißer nicht gedämpft: ${geglaettet[2]}`);
  assert.ok(geglaettet[2] > 100, `zu stark gedämpft: ${geglaettet[2]}`);
});

test('Glättung einer leeren Reihe ergibt eine leere Reihe', () => {
  assert.deepEqual(glaetteHoehen([], 3), []);
});

test('gleichmäßiger Anstieg wird vollständig gezählt', () => {
  const roh = [100, 110, 120, 130, 140];
  assert.ok(Math.abs(gesamtAnstiegM(roh, 3) - 40) < 1, `war ${gesamtAnstiegM(roh, 3)}`);
});

test('Abstieg zählt nicht zum Anstieg', () => {
  const roh = [200, 190, 180, 170];
  assert.equal(gesamtAnstiegM(roh, 3), 0);
});

test('kleines Rauschen auf ebener Strecke wird nicht als Anstieg gezählt', () => {
  const roh = [];
  for (let i = 0; i < 200; i += 1) {
    roh.push(100 + (i % 2 === 0 ? 1 : -1));
  }
  const anstieg = gesamtAnstiegM(roh, 3);
  assert.ok(anstieg < 10, `Rauschen wurde als Anstieg gewertet: ${anstieg} m`);
});

test('Anstieg gefolgt von Abstieg gefolgt von Anstieg wird korrekt summiert', () => {
  const roh = [100, 150, 100, 150];
  const anstieg = gesamtAnstiegM(roh, 3);
  assert.ok(Math.abs(anstieg - 100) < 5, `erwartet ~100, war ${anstieg}`);
});
```

- [ ] **Step 2: Test ausführen und Fehlschlag bestätigen**

Run: `node --test test/elevation.test.js`
Expected: FAIL mit `Cannot find module '../scripts/lib/elevation.js'`

- [ ] **Step 3: Modul implementieren**

`scripts/lib/elevation.js`:

```javascript
/** Gleitender Mittelwert über ein zentriertes Fenster. Ränder nutzen ein verkürztes Fenster. */
export function glaetteHoehen(eleWerte, fensterGroesse = 9) {
  if (eleWerte.length === 0) return [];
  const halb = Math.floor(fensterGroesse / 2);
  return eleWerte.map((_, i) => {
    const von = Math.max(0, i - halb);
    const bis = Math.min(eleWerte.length - 1, i + halb);
    let summe = 0;
    for (let j = von; j <= bis; j += 1) summe += eleWerte[j];
    return summe / (bis - von + 1);
  });
}

/**
 * Kumulierter Anstieg. Zählt erst, wenn seit dem letzten Referenzpunkt
 * mindestens `mindestDifferenzM` Höhengewinn zusammengekommen ist. Dadurch
 * fällt GPS-Rauschen heraus, ohne echte flache Anstiege zu verlieren.
 */
export function gesamtAnstiegM(eleWerte, mindestDifferenzM = 3) {
  const werte = glaetteHoehen(eleWerte);
  if (werte.length < 2) return 0;

  let anstieg = 0;
  let referenz = werte[0];

  for (let i = 1; i < werte.length; i += 1) {
    const differenz = werte[i] - referenz;
    if (differenz >= mindestDifferenzM) {
      anstieg += differenz;
      referenz = werte[i];
    } else if (differenz <= -mindestDifferenzM) {
      referenz = werte[i];
    }
  }

  return anstieg;
}
```

- [ ] **Step 4: Tests ausführen**

Run: `node --test test/elevation.test.js`
Expected: PASS, 8 Tests

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/elevation.js test/elevation.test.js
git commit -m "feat: Höhenmodul mit Glättung und rauschresistenter Anstiegssumme"
```

---

### Task 5: Anstiegserkennung

**Files:**
- Create: `scripts/lib/climbs.js`
- Test: `test/climbs.test.js`

**Interfaces:**
- Consumes: `glaetteHoehen` aus `scripts/lib/elevation.js`
- Produces:
  - `erkenneAnstiege(kmWerte, eleWerte, optionen)` → `Array<{ startKm, lengthKm, gainM, avgGradientPct }>`
  - `optionen` = `{ mindestGewinnM = 40, mindestLaengeKm = 0.5, maxAbfallM = 10 }`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

Hintergrund: Ein Anstieg ist ein Streckenabschnitt, auf dem es überwiegend bergauf geht. Kurze Zwischenabfahrten sollen ihn nicht zerschneiden — deshalb `maxAbfallM`: erst wenn seit dem bisherigen Höchststand mehr als dieser Betrag verloren geht, gilt der Anstieg als beendet.

`test/climbs.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erkenneAnstiege } from '../scripts/lib/climbs.js';

/** Hilfsfunktion: erzeugt km- und Höhenreihen aus Segmentbeschreibungen. */
function baueProfil(segmente) {
  const km = [0];
  const ele = [segmente[0].vonM];
  for (const seg of segmente) {
    const schritte = Math.max(1, Math.round(seg.laengeKm * 20));
    for (let i = 1; i <= schritte; i += 1) {
      km.push(km[km.length - 1] + seg.laengeKm / schritte);
      ele.push(seg.vonM + ((seg.bisM - seg.vonM) * i) / schritte);
    }
  }
  return { km, ele };
}

test('erkennt einen einzelnen deutlichen Anstieg', () => {
  const { km, ele } = baueProfil([
    { laengeKm: 2, vonM: 100, bisM: 100 },
    { laengeKm: 3, vonM: 100, bisM: 250 },
    { laengeKm: 2, vonM: 250, bisM: 250 }
  ]);
  const anstiege = erkenneAnstiege(km, ele);
  assert.equal(anstiege.length, 1);
  assert.ok(Math.abs(anstiege[0].startKm - 2) < 0.4, `startKm war ${anstiege[0].startKm}`);
  assert.ok(Math.abs(anstiege[0].lengthKm - 3) < 0.4, `lengthKm war ${anstiege[0].lengthKm}`);
  assert.ok(Math.abs(anstiege[0].gainM - 150) < 10, `gainM war ${anstiege[0].gainM}`);
  assert.ok(Math.abs(anstiege[0].avgGradientPct - 5) < 0.5, `Steigung war ${anstiege[0].avgGradientPct}`);
});

test('ignoriert Anstiege unterhalb der Mindesthöhe', () => {
  const { km, ele } = baueProfil([
    { laengeKm: 1, vonM: 100, bisM: 100 },
    { laengeKm: 1, vonM: 100, bisM: 120 },
    { laengeKm: 1, vonM: 120, bisM: 120 }
  ]);
  assert.deepEqual(erkenneAnstiege(km, ele), []);
});

test('erkennt zwei durch eine lange Abfahrt getrennte Anstiege', () => {
  const { km, ele } = baueProfil([
    { laengeKm: 2, vonM: 100, bisM: 250 },
    { laengeKm: 3, vonM: 250, bisM: 100 },
    { laengeKm: 2, vonM: 100, bisM: 260 }
  ]);
  const anstiege = erkenneAnstiege(km, ele);
  assert.equal(anstiege.length, 2);
});

test('eine kurze Zwischenabfahrt zerschneidet einen Anstieg nicht', () => {
  const { km, ele } = baueProfil([
    { laengeKm: 2, vonM: 100, bisM: 200 },
    { laengeKm: 0.3, vonM: 200, bisM: 195 },
    { laengeKm: 2, vonM: 195, bisM: 300 }
  ]);
  const anstiege = erkenneAnstiege(km, ele);
  assert.equal(anstiege.length, 1, 'Anstieg wurde fälschlich geteilt');
  assert.ok(anstiege[0].gainM > 180, `gainM war ${anstiege[0].gainM}`);
});

test('flache Strecke ergibt keine Anstiege', () => {
  const { km, ele } = baueProfil([{ laengeKm: 10, vonM: 100, bisM: 105 }]);
  assert.deepEqual(erkenneAnstiege(km, ele), []);
});

test('leere Eingabe ergibt eine leere Liste', () => {
  assert.deepEqual(erkenneAnstiege([], []), []);
});
```

- [ ] **Step 2: Test ausführen und Fehlschlag bestätigen**

Run: `node --test test/climbs.test.js`
Expected: FAIL mit `Cannot find module '../scripts/lib/climbs.js'`

- [ ] **Step 3: Modul implementieren**

`scripts/lib/climbs.js`:

```javascript
import { glaetteHoehen } from './elevation.js';

export function erkenneAnstiege(kmWerte, eleWerte, optionen = {}) {
  const { mindestGewinnM = 40, mindestLaengeKm = 0.5, maxAbfallM = 10 } = optionen;
  if (kmWerte.length < 2) return [];

  const ele = glaetteHoehen(eleWerte);
  const anstiege = [];

  let startIndex = 0;
  let hoechstIndex = 0;

  const abschliessen = () => {
    const gewinn = ele[hoechstIndex] - ele[startIndex];
    const laenge = kmWerte[hoechstIndex] - kmWerte[startIndex];
    if (gewinn >= mindestGewinnM && laenge >= mindestLaengeKm) {
      anstiege.push({
        startKm: Number(kmWerte[startIndex].toFixed(2)),
        lengthKm: Number(laenge.toFixed(2)),
        gainM: Math.round(gewinn),
        avgGradientPct: Number(((gewinn / (laenge * 1000)) * 100).toFixed(1))
      });
    }
  };

  for (let i = 1; i < ele.length; i += 1) {
    if (ele[i] > ele[hoechstIndex]) {
      hoechstIndex = i;
      continue;
    }
    if (ele[hoechstIndex] - ele[i] > maxAbfallM) {
      abschliessen();
      startIndex = i;
      hoechstIndex = i;
    }
  }
  abschliessen();

  return anstiege;
}
```

- [ ] **Step 4: Tests ausführen**

Run: `node --test test/climbs.test.js`
Expected: PASS, 6 Tests

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/climbs.js test/climbs.test.js
git commit -m "feat: Anstiegserkennung mit Toleranz für Zwischenabfahrten"
```

---

### Task 6: Routenlinie ausdünnen

**Files:**
- Create: `scripts/lib/route.js`
- Test: `test/route.test.js`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `duenneAus(points, maxPunkte = 400)` → `Array<{lat, lon}>` (Anfang und Ende bleiben immer erhalten)
  - `boundingBox(points)` → `{ minLat, minLon, maxLat, maxLon }`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`test/route.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duenneAus, boundingBox } from '../scripts/lib/route.js';

function baueRoute(anzahl) {
  return Array.from({ length: anzahl }, (_, i) => ({ lat: 50 + i * 0.001, lon: 7 + i * 0.001 }));
}

test('kürzt eine lange Route auf die Obergrenze', () => {
  const ergebnis = duenneAus(baueRoute(1470), 400);
  assert.ok(ergebnis.length <= 400, `war ${ergebnis.length}`);
  assert.ok(ergebnis.length > 300, `zu stark ausgedünnt: ${ergebnis.length}`);
});

test('behält Anfangs- und Endpunkt exakt bei', () => {
  const route = baueRoute(1000);
  const ergebnis = duenneAus(route, 100);
  assert.deepEqual(ergebnis[0], route[0]);
  assert.deepEqual(ergebnis[ergebnis.length - 1], route[route.length - 1]);
});

test('lässt eine kurze Route unverändert', () => {
  const route = baueRoute(50);
  assert.deepEqual(duenneAus(route, 400), route);
});

test('eine leere Route bleibt leer', () => {
  assert.deepEqual(duenneAus([], 400), []);
});

test('berechnet die Bounding Box über alle Punkte', () => {
  const punkte = [
    { lat: 50.1, lon: 7.5 },
    { lat: 49.9, lon: 7.9 },
    { lat: 50.3, lon: 7.2 }
  ];
  assert.deepEqual(boundingBox(punkte), { minLat: 49.9, minLon: 7.2, maxLat: 50.3, maxLon: 7.9 });
});
```

- [ ] **Step 2: Test ausführen und Fehlschlag bestätigen**

Run: `node --test test/route.test.js`
Expected: FAIL mit `Cannot find module '../scripts/lib/route.js'`

- [ ] **Step 3: Modul implementieren**

`scripts/lib/route.js`:

```javascript
/** Nimmt jeden n-ten Punkt, behält aber Anfang und Ende exakt bei. */
export function duenneAus(points, maxPunkte = 400) {
  if (points.length <= maxPunkte) return points;

  const schrittweite = Math.ceil(points.length / maxPunkte);
  const ergebnis = [];
  for (let i = 0; i < points.length; i += schrittweite) {
    ergebnis.push(points[i]);
  }

  const letzter = points[points.length - 1];
  if (ergebnis[ergebnis.length - 1] !== letzter) {
    ergebnis.push(letzter);
  }
  return ergebnis;
}

export function boundingBox(points) {
  return points.reduce(
    (box, p) => ({
      minLat: Math.min(box.minLat, p.lat),
      minLon: Math.min(box.minLon, p.lon),
      maxLat: Math.max(box.maxLat, p.lat),
      maxLon: Math.max(box.maxLon, p.lon)
    }),
    { minLat: Infinity, minLon: Infinity, maxLat: -Infinity, maxLon: -Infinity }
  );
}
```

- [ ] **Step 4: Tests ausführen**

Run: `node --test test/route.test.js`
Expected: PASS, 5 Tests

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/route.js test/route.test.js
git commit -m "feat: Routenlinie ausdünnen und Bounding Box berechnen"
```

---

### Task 7: tour.json erzeugen

**Files:**
- Create: `scripts/build-tour.js`
- Create: `data/tour.json` (erzeugt)

**Interfaces:**
- Consumes: `parseGpx`, `kumulierteDistanzen`, `gesamtDistanzKm`, `gesamtAnstiegM`, `erkenneAnstiege`, `duenneAus`, `boundingBox`
- Produces: `data/tour.json` mit der Struktur
  `{ generatedAt: string, days: [{ day, title, file, startOrt, zielOrt, lengthKm, elevationGainM, climbs[], estimatedRidingTimeMin, routeLine: [[lat, lon]], bbox }] }`

- [ ] **Step 1: CLI-Skript schreiben**

`scripts/build-tour.js`:

```javascript
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseGpx } from './lib/gpx.js';
import { kumulierteDistanzen, gesamtDistanzKm } from './lib/geo.js';
import { gesamtAnstiegM } from './lib/elevation.js';
import { erkenneAnstiege } from './lib/climbs.js';
import { duenneAus, boundingBox } from './lib/route.js';

const WURZEL = path.resolve(import.meta.dirname, '..');

/** Zieht "Tag 3 - von Waldkönigen nach Pittenbach" aus dem Dateinamen. */
function leseTagInfo(dateiname) {
  const treffer = dateiname.match(/Tag (\d+) - von (.+?) nach (.+?)\.gpx$/);
  if (!treffer) {
    throw new Error(`Dateiname folgt nicht dem erwarteten Muster: ${dateiname}`);
  }
  return { day: Number(treffer[1]), startOrt: treffer[2], zielOrt: treffer[3] };
}

function fahrzeitMinuten(trackPoints) {
  if (trackPoints.length < 2) return 0;
  const start = Date.parse(trackPoints[0].time);
  const ende = Date.parse(trackPoints[trackPoints.length - 1].time);
  if (Number.isNaN(start) || Number.isNaN(ende)) return 0;
  return Math.round((ende - start) / 60000);
}

async function main() {
  const dateien = (await fs.readdir(WURZEL)).filter((f) => f.endsWith('.gpx')).sort();
  if (dateien.length !== 6) {
    throw new Error(`Erwartet wurden 6 GPX-Dateien, gefunden: ${dateien.length}`);
  }

  const days = [];
  for (const datei of dateien) {
    const { day, startOrt, zielOrt } = leseTagInfo(datei);
    const gpx = parseGpx(await fs.readFile(path.join(WURZEL, datei), 'utf8'));
    const punkte = gpx.trackPoints;

    const kmWerte = kumulierteDistanzen(punkte);
    const eleWerte = punkte.map((p) => p.ele);
    const linie = duenneAus(punkte).map((p) => [
      Number(p.lat.toFixed(5)),
      Number(p.lon.toFixed(5))
    ]);

    days.push({
      day,
      title: `${startOrt} nach ${zielOrt}`,
      file: datei,
      startOrt,
      zielOrt,
      lengthKm: Number(gesamtDistanzKm(punkte).toFixed(1)),
      elevationGainM: Math.round(gesamtAnstiegM(eleWerte)),
      climbs: erkenneAnstiege(kmWerte, eleWerte),
      estimatedRidingTimeMin: fahrzeitMinuten(punkte),
      routeLine: linie,
      bbox: boundingBox(punkte)
    });
  }

  days.sort((a, b) => a.day - b.day);

  const ausgabe = { generatedAt: new Date().toISOString(), days };
  const ziel = path.join(WURZEL, 'data', 'tour.json');
  await fs.writeFile(ziel, `${JSON.stringify(ausgabe, null, 2)}\n`, 'utf8');

  for (const d of days) {
    console.log(
      `Tag ${d.day}: ${d.lengthKm} km, ${d.elevationGainM} hm, ` +
        `${d.climbs.length} Anstiege, ${d.routeLine.length} Linienpunkte`
    );
  }
}

await main();
```

- [ ] **Step 2: Skript ausführen**

Run: `npm run build:tour`
Expected: sechs Zeilen Ausgabe, `data/tour.json` entsteht.

- [ ] **Step 3: Ergebnisse gegen Komoot plausibilisieren**

Die alten Schätzwerte aus `app.js` lauteten: Tag 1: 43 km / 490 hm, Tag 2: 52 / 720, Tag 3: 58 / 820, Tag 4: 68 / 980, Tag 5: 61 / 640, Tag 6: 47 / 430.

Die berechneten Längen müssen nahe daran liegen (Abweichung unter etwa 15 %). Die Höhenmeter dürfen deutlicher abweichen, da die alten Werte geschätzt waren — aber sie müssen **plausibel** sein:

- Weicht eine **Länge** um mehr als 15 % ab, stimmt etwas an der Kilometrierung nicht. Prüfen, ob der Track mehrere Segmente enthält oder Ausreißer-Koordinaten vorliegen.
- Liegt ein **Höhenmeterwert** über 2000 m für einen Tag, greift die Rauschunterdrückung nicht. Dann `mindestDifferenzM` in `gesamtAnstiegM` schrittweise auf 4 oder 5 erhöhen und erneut prüfen.
- Liegt ein Wert unter 100 m für einen Eifel-Tag, ist die Glättung zu stark. Dann `fensterGroesse` von 9 auf 5 senken.

Die gewählten Werte im Code als Kommentar mit Begründung festhalten.

- [ ] **Step 4: Trackanfang von Tag 1 klären**

Die Spec vermerkt: erster Trackpunkt von Tag 1 bei 50.2739/7.6459, erster Waypoint „Deutsches Eck" bei 50.3650/7.6065 — rund 10 km auseinander.

```bash
node -e "
import('./scripts/lib/gpx.js').then(async ({ parseGpx }) => {
  const fs = await import('node:fs/promises');
  const { naechsterRoutenpunkt } = await import('./scripts/lib/geo.js');
  const datei = (await fs.readdir('.')).find(f => f.includes('Tag 1'));
  const g = parseGpx(await fs.readFile(datei, 'utf8'));
  const t = naechsterRoutenpunkt(50.364997, 7.606475, g.trackPoints);
  console.log('Deutsches Eck liegt bei Trackindex', t.index, 'von', g.trackPoints.length, '— Abstand', t.distanzKm.toFixed(3), 'km');
});
"
```

Liegt der Index nahe 0, ist alles in Ordnung und der erste Waypoint sitzt einfach nicht exakt auf dem Startpunkt. Liegt er weit im Track, enthält die Datei eine Anfahrt — das dann in `data/tour.json` als Feld `hinweis` beim betroffenen Tag vermerken und beim Briefing-Text berücksichtigen.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-tour.js data/tour.json
git commit -m "feat: tour.json aus den GPX-Tracks erzeugen"
```

---

### Task 8: POI-Schema und Validator

**Files:**
- Create: `scripts/lib/poiSchema.js`
- Create: `scripts/validate-pois.js`
- Test: `test/poiSchema.test.js`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `validierePois(daten, optionen)` → `{ fehler: string[], warnungen: string[] }`
  - `optionen` = `{ briefingPflicht = false }`
  - `KATEGORIEN` → `string[]`
  - Erlaubte Werte für `kind`: `"story"`, `"service"`

**Warum `briefingPflicht` abschaltbar ist:** Die Briefing-Texte entstehen erst in Task 16, weil sie die Highlights der recherchierten POIs brauchen. Während der Recherche-Tasks 10–15 sind sie also zwangsläufig leer. Ohne diese Option könnten jene Tasks nie fehlerfrei validieren. Task 17 schaltet die Pflicht als Endprüfung scharf.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

Die Regeln, die der Validator durchsetzt, sind die Qualitätszusage aus der Spec: Belegpflicht, sinnvolle Textlängen, vollständige Felder.

`test/poiSchema.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validierePois } from '../scripts/lib/poiSchema.js';

function gueltigerStoryPoi(ueberschreibungen = {}) {
  return {
    id: 'tag1-deutsches-eck',
    day: 1,
    name: 'Deutsches Eck',
    lat: 50.364997,
    lon: 7.606475,
    category: 'Historie',
    kind: 'story',
    accessNote: 'direkt an der Strecke',
    textShort: Array(45).fill('Wort').join(' '),
    textLong: Array(200).fill('Wort').join(' '),
    sources: ['https://de.wikipedia.org/wiki/Deutsches_Eck'],
    triggerRadius: 150,
    routeKm: 0.2,
    ...ueberschreibungen
  };
}

function daten(pois) {
  return {
    generatedAt: '2026-08-08T12:00:00.000Z',
    days: [{ day: 1, briefing: { text: 'Heute erwartet dich eine Etappe.' }, pois }]
  };
}

test('ein vollständiger story-POI erzeugt keine Fehler', () => {
  const ergebnis = validierePois(daten([gueltigerStoryPoi()]));
  assert.deepEqual(ergebnis.fehler, []);
});

test('ein story-POI ohne Quelle wird abgelehnt', () => {
  const ergebnis = validierePois(daten([gueltigerStoryPoi({ sources: [] })]));
  assert.ok(ergebnis.fehler.some((f) => f.includes('Quelle')), ergebnis.fehler.join(' | '));
});

test('ein service-POI braucht keine Quelle und keine Texte', () => {
  const service = {
    id: 'tag1-rastplatz',
    day: 1,
    name: 'Schutzhütte mit Sitzbank',
    lat: 50.4,
    lon: 7.5,
    category: 'Service',
    kind: 'service',
    accessNote: 'direkt an der Strecke',
    routeKm: 12.4
  };
  assert.deepEqual(validierePois(daten([service])).fehler, []);
});

test('ein zu kurzer Kurztext wird abgelehnt', () => {
  const ergebnis = validierePois(daten([gueltigerStoryPoi({ textShort: 'Zu kurz.' })]));
  assert.ok(ergebnis.fehler.some((f) => f.includes('textShort')), ergebnis.fehler.join(' | '));
});

test('ein zu langer Langtext wird abgelehnt', () => {
  const ergebnis = validierePois(daten([gueltigerStoryPoi({ textLong: Array(600).fill('Wort').join(' ') })]));
  assert.ok(ergebnis.fehler.some((f) => f.includes('textLong')), ergebnis.fehler.join(' | '));
});

test('doppelte IDs werden abgelehnt', () => {
  const ergebnis = validierePois(daten([gueltigerStoryPoi(), gueltigerStoryPoi()]));
  assert.ok(ergebnis.fehler.some((f) => f.includes('doppelt')), ergebnis.fehler.join(' | '));
});

test('Koordinaten außerhalb des Tourgebiets werden abgelehnt', () => {
  const ergebnis = validierePois(daten([gueltigerStoryPoi({ lat: 12.5, lon: 100.2 })]));
  assert.ok(ergebnis.fehler.some((f) => f.includes('Koordinate')), ergebnis.fehler.join(' | '));
});

test('eine unbekannte Kategorie wird abgelehnt', () => {
  const ergebnis = validierePois(daten([gueltigerStoryPoi({ category: 'Erfunden' })]));
  assert.ok(ergebnis.fehler.some((f) => f.includes('category')), ergebnis.fehler.join(' | '));
});

test('ein fehlender Briefing-Text ist ohne briefingPflicht nur eine Warnung', () => {
  const d = daten([gueltigerStoryPoi()]);
  d.days[0].briefing = { text: '' };
  const ergebnis = validierePois(d);
  assert.deepEqual(ergebnis.fehler, []);
  assert.ok(ergebnis.warnungen.some((w) => w.includes('Briefing')), ergebnis.warnungen.join(' | '));
});

test('ein fehlender Briefing-Text wird mit briefingPflicht abgelehnt', () => {
  const d = daten([gueltigerStoryPoi()]);
  d.days[0].briefing = { text: '' };
  const ergebnis = validierePois(d, { briefingPflicht: true });
  assert.ok(ergebnis.fehler.some((f) => f.includes('Briefing')), ergebnis.fehler.join(' | '));
});

test('ein Tag mit weniger als drei story-POIs erzeugt eine Warnung', () => {
  const ergebnis = validierePois(daten([gueltigerStoryPoi()]));
  assert.ok(ergebnis.warnungen.some((w) => w.includes('story-POIs')), ergebnis.warnungen.join(' | '));
});
```

- [ ] **Step 2: Test ausführen und Fehlschlag bestätigen**

Run: `node --test test/poiSchema.test.js`
Expected: FAIL mit `Cannot find module '../scripts/lib/poiSchema.js'`

- [ ] **Step 3: Validator implementieren**

`scripts/lib/poiSchema.js`:

```javascript
export const KATEGORIEN = [
  'Historie', 'Architektur', 'Burg', 'Kirche', 'Natur',
  'Technik', 'Wein', 'Ort', 'Aussicht', 'Service'
];

// Grobes Rechteck um Rheinland-Pfalz / Eifel. Fängt vertauschte oder verrutschte Koordinaten ab.
const GEBIET = { minLat: 49.5, maxLat: 51.0, minLon: 6.0, maxLon: 8.0 };

const KURZTEXT_WOERTER = { min: 30, max: 70 };
const LANGTEXT_WOERTER = { min: 120, max: 280 };

function woerter(text) {
  return String(text ?? '').trim().split(/\s+/).filter(Boolean).length;
}

export function validierePois(daten, optionen = {}) {
  const { briefingPflicht = false } = optionen;
  const fehler = [];
  const warnungen = [];
  const gesehenIds = new Set();

  if (!daten?.days?.length) {
    fehler.push('Keine Tage in den Daten gefunden.');
    return { fehler, warnungen };
  }

  for (const tag of daten.days) {
    const praefix = `Tag ${tag.day}`;

    if (!tag.briefing?.text?.trim()) {
      const meldung = `${praefix}: Briefing-Text fehlt.`;
      // Briefings entstehen erst nach der Recherche — bis dahin nur eine Warnung.
      if (briefingPflicht) fehler.push(meldung);
      else warnungen.push(meldung);
    }

    const pois = tag.pois ?? [];
    const storyAnzahl = pois.filter((p) => p.kind === 'story').length;
    if (storyAnzahl < 3) {
      warnungen.push(`${praefix}: nur ${storyAnzahl} story-POIs — für einen Reisetag wenig.`);
    }

    for (const poi of pois) {
      const wo = `${praefix} / ${poi.name ?? poi.id ?? '(namenlos)'}`;

      if (!poi.id) fehler.push(`${wo}: id fehlt.`);
      else if (gesehenIds.has(poi.id)) fehler.push(`${wo}: id "${poi.id}" ist doppelt vergeben.`);
      else gesehenIds.add(poi.id);

      if (poi.day !== tag.day) fehler.push(`${wo}: day-Feld passt nicht zum Tag.`);
      if (!poi.name?.trim()) fehler.push(`${wo}: name fehlt.`);

      if (
        typeof poi.lat !== 'number' || typeof poi.lon !== 'number' ||
        poi.lat < GEBIET.minLat || poi.lat > GEBIET.maxLat ||
        poi.lon < GEBIET.minLon || poi.lon > GEBIET.maxLon
      ) {
        fehler.push(`${wo}: Koordinate liegt außerhalb des Tourgebiets (${poi.lat}, ${poi.lon}).`);
      }

      if (!KATEGORIEN.includes(poi.category)) {
        fehler.push(`${wo}: unbekannte category "${poi.category}".`);
      }

      if (!['story', 'service'].includes(poi.kind)) {
        fehler.push(`${wo}: kind muss "story" oder "service" sein, war "${poi.kind}".`);
        continue;
      }

      if (!poi.accessNote?.trim()) fehler.push(`${wo}: accessNote fehlt.`);
      if (typeof poi.routeKm !== 'number') fehler.push(`${wo}: routeKm fehlt oder ist keine Zahl.`);

      if (poi.kind === 'story') {
        if (!Array.isArray(poi.sources) || poi.sources.length === 0) {
          fehler.push(`${wo}: story-POI ohne Quelle. Belegen oder auf kind "service" herabstufen.`);
        }

        const kurz = woerter(poi.textShort);
        if (kurz < KURZTEXT_WOERTER.min || kurz > KURZTEXT_WOERTER.max) {
          fehler.push(`${wo}: textShort hat ${kurz} Wörter, erlaubt sind ${KURZTEXT_WOERTER.min}–${KURZTEXT_WOERTER.max}.`);
        }

        const lang = woerter(poi.textLong);
        if (lang < LANGTEXT_WOERTER.min || lang > LANGTEXT_WOERTER.max) {
          fehler.push(`${wo}: textLong hat ${lang} Wörter, erlaubt sind ${LANGTEXT_WOERTER.min}–${LANGTEXT_WOERTER.max}.`);
        }

        if (typeof poi.triggerRadius !== 'number') {
          fehler.push(`${wo}: triggerRadius fehlt oder ist keine Zahl.`);
        }
      }
    }
  }

  return { fehler, warnungen };
}
```

- [ ] **Step 4: Tests ausführen**

Run: `node --test test/poiSchema.test.js`
Expected: PASS, 11 Tests

- [ ] **Step 5: CLI-Wrapper schreiben**

`scripts/validate-pois.js`:

```javascript
import fs from 'node:fs/promises';
import path from 'node:path';
import { validierePois } from './lib/poiSchema.js';

// --streng macht fehlende Briefing-Texte zum Fehler. Erst nach Task 16 sinnvoll.
const streng = process.argv.includes('--streng');

const ziel = path.resolve(import.meta.dirname, '..', 'data', 'pois.json');
const daten = JSON.parse(await fs.readFile(ziel, 'utf8'));
const { fehler, warnungen } = validierePois(daten, { briefingPflicht: streng });

warnungen.forEach((w) => console.warn(`WARNUNG  ${w}`));
fehler.forEach((f) => console.error(`FEHLER   ${f}`));

const anzahl = daten.days.reduce((summe, tag) => summe + (tag.pois?.length ?? 0), 0);
console.log(`\n${anzahl} POIs geprüft: ${fehler.length} Fehler, ${warnungen.length} Warnungen.`);

if (fehler.length > 0) process.exit(1);
```

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/poiSchema.js scripts/validate-pois.js test/poiSchema.test.js
git commit -m "feat: POI-Schema mit Belegpflicht und Textlängenprüfung"
```

---

### Task 9: Waypoints klassifizieren

**Files:**
- Create: `scripts/classify-waypoints.js`
- Create: `data/waypoint-kuratierung.md`

**Interfaces:**
- Consumes: `parseGpx`, `kumulierteDistanzen`, `naechsterRoutenpunkt`
- Produces: `data/waypoint-kuratierung.md` — die Arbeitsgrundlage für die Recherche-Tasks 10–15, mit allen 109 Waypoints, je Tag, mit Kilometerangabe und Klassifizierungsvorschlag

- [ ] **Step 1: Klassifizierungsskript schreiben**

Das Skript macht einen **Vorschlag** anhand des Komoot-Symbols und offensichtlicher Namensmuster. Die Entscheidung trifft in den folgenden Tasks der recherchierende Agent — das Skript spart nur Tipparbeit.

`scripts/classify-waypoints.js`:

```javascript
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseGpx } from './lib/gpx.js';
import { kumulierteDistanzen, naechsterRoutenpunkt } from './lib/geo.js';

const WURZEL = path.resolve(import.meta.dirname, '..');

/** Namensmuster, die verlässlich auf reine Infrastruktur ohne Erzählwert hindeuten. */
const SERVICE_MUSTER = [
  /schutzhütte/i, /rastplatz/i, /picknickplatz/i, /spielplatz/i,
  /wohnmobil/i, /ladestation/i, /mülleimer/i, /sitzbank/i,
  /café/i, /bistro/i, /restaurant/i, /biergarten/i, /hotel/i
];

function vorschlag(waypoint) {
  if (SERVICE_MUSTER.some((muster) => muster.test(waypoint.name))) return 'service';
  if (waypoint.sym === 'Restaurant') return 'service';
  return 'story';
}

const dateien = (await fs.readdir(WURZEL)).filter((f) => f.endsWith('.gpx')).sort();
const zeilen = [
  '# Kuratierung der Waypoints',
  '',
  'Vorschlag maschinell erzeugt — Entscheidung erfolgt bei der Recherche.',
  ''
];

for (const datei of dateien) {
  const tag = Number(datei.match(/Tag (\d+)/)[1]);
  const gpx = parseGpx(await fs.readFile(path.join(WURZEL, datei), 'utf8'));
  const kmWerte = kumulierteDistanzen(gpx.trackPoints);

  zeilen.push(`## Tag ${tag} — ${gpx.name}`, '');
  zeilen.push('| km | Name | Symbol | Vorschlag | Entscheidung | Begründung |');
  zeilen.push('|---|---|---|---|---|---|');

  const zeilenDesTages = gpx.waypoints.map((wpt) => {
    const treffer = naechsterRoutenpunkt(wpt.lat, wpt.lon, gpx.trackPoints);
    const km = kmWerte[treffer.index];
    const abstand = treffer.distanzKm > 0.2 ? ` (${Math.round(treffer.distanzKm * 1000)} m abseits)` : '';
    return { km, text: `| ${km.toFixed(1)}${abstand} | ${wpt.name} | ${wpt.sym ?? '—'} | ${vorschlag(wpt)} | | |` };
  });

  zeilenDesTages.sort((a, b) => a.km - b.km);
  zeilenDesTages.forEach((z) => zeilen.push(z.text));
  zeilen.push('');
}

await fs.writeFile(path.join(WURZEL, 'data', 'waypoint-kuratierung.md'), `${zeilen.join('\n')}\n`, 'utf8');
console.log('data/waypoint-kuratierung.md geschrieben.');
```

Die Sortierung nach Kilometer ist bewusst: Komoot legt Waypoints nicht zwingend in Fahrtreihenfolge ab, und für die Recherche ist die Reihenfolge entlang der Strecke die brauchbare.

- [ ] **Step 2: Skript ausführen**

Run: `node scripts/classify-waypoints.js`
Expected: `data/waypoint-kuratierung.md` entsteht mit sechs Tabellen und insgesamt 109 Datenzeilen.

- [ ] **Step 3: Ergebnis sichten**

Die Tabelle öffnen und stichprobenartig prüfen: Stehen „Schutzhütte mit Sitzbank und Mülleimer", „Spielplatz Pittenbach", „Wohnmobilstellplatz Lösnich" und „E-Bike-Ladestation bei Kaffeekultur, Eifel" auf `service`? Stehen „Deutsches Eck", „Abtei Himmerod" und „Schloss Malberg" auf `story`? Sind die Kilometerangaben aufsteigend und decken sie die volle Tageslänge ab?

- [ ] **Step 4: Commit**

```bash
git add scripts/classify-waypoints.js data/waypoint-kuratierung.md
git commit -m "feat: Waypoints klassifizieren und Kuratierungstabelle erzeugen"
```

---

## Recherche-Protokoll

Die Tasks 10 bis 15 wenden alle dasselbe Verfahren an, jeweils auf einen Tag. Es ist hier einmal vollständig festgelegt; die Tasks verweisen darauf und nennen nur ihre jeweiligen Waypoints und regionalen Schwerpunkte.

**Schritt A — Bestandswaypoints entscheiden.** Für jeden Waypoint des Tages in `data/waypoint-kuratierung.md` die Spalte „Entscheidung" füllen mit `story`, `service` oder `verworfen`, dazu eine kurze Begründung. Verworfen wird nur bei Dubletten oder wenn der Punkt weder erzählenswert noch praktisch nützlich ist.

**Schritt B — Recherche je story-POI.** Websuche durchführen. Vorrangige Quellen: Wikipedia, Ortsgemeinde- und Kreisseiten, Denkmallisten, regionale Tourismusverbände (Ahrtal, Eifel, Mosel), Vereins- und Museumsseiten. Mindestens eine belastbare Quelle je POI, URL vollständig in `sources[]`.

Findet sich nichts Belastbares: POI auf `kind: "service"` herabstufen oder — bei reinen Landschaftspunkten wie „Blick auf die Eifel" — einen Text schreiben, der ausschließlich beschreibt, was tatsächlich zu sehen ist, ohne Faktenbehauptungen. Auch dieser Text braucht dann eine Quelle für die geografischen Angaben.

**Schritt C — Texte verfassen.**
- `textShort`: 30–70 Wörter. Was man gerade sieht und die eine Sache, die man wissen sollte. Wird im Fahren gehört.
- `textLong`: 120–280 Wörter. Geschichte, Einordnung, Besonderheiten. Wird am Halt gehört.
- Beide Texte werden **vorgelesen**, nicht gelesen: kurze Hauptsätze, keine Klammern, keine Abkürzungen, Dezimalzahlen mit Komma, Jahreszahlen ausgeschrieben, wo es dem Sprachfluss dient.
- Keine ausgedachten Anekdoten, keine unbelegten Superlative.

**Schritt D — Lücken schließen.** Die Route des Tages gegen Sehenswürdigkeiten der durchfahrenen Orte abgleichen. Aufgenommen wird, was innerhalb rund 2 km zur Route liegt und in Komoot fehlt. Koordinaten aus der Quelle übernehmen, dann Kilometerstand und Abstand mit `naechsterRoutenpunkt` bestimmen und in `accessNote` festhalten: `"direkt an der Strecke"`, `"<N> m Abstecher"` oder `"nur Blickkontakt"`.

**Schritt E — Eintragen und prüfen.** POIs nach `routeKm` sortiert in `data/pois.json` unter dem jeweiligen Tag eintragen. `id` nach dem Muster `tag<N>-<kebab-case-name>`. `triggerRadius` auf 150, bei POIs in einer engen Ortsdurchfahrt auf 80, bei weiträumigen Landschaftspunkten auf 300.

Danach `npm run validate:pois` ausführen. Der Task gilt erst als fertig, wenn der Validator fehlerfrei durchläuft.

---

### Task 10: Recherche Tag 1 — Koblenz nach Findling

**Files:**
- Create: `data/pois.json`
- Modify: `data/waypoint-kuratierung.md` (Entscheidungsspalten für Tag 1)

**Interfaces:**
- Consumes: `data/waypoint-kuratierung.md`, `validierePois`
- Produces: `data/pois.json` mit dem ersten Eintrag in `days[]`; Grundgerüst `{ generatedAt, days: [] }` für die folgenden Tasks

- [ ] **Step 1: Datei anlegen**

`data/pois.json` mit dem Grundgerüst:

```json
{
  "generatedAt": "2026-08-08T12:00:00.000Z",
  "days": []
}
```

- [ ] **Step 2: Recherche-Protokoll auf Tag 1 anwenden**

Die 19 Waypoints von Tag 1 stehen in `data/waypoint-kuratierung.md`, darunter: Deutsches Eck, Blick auf Neuendorf und den Rhein, Schloss Engers, Eisenbahnbrücke Urmitz, Silbersee, Dyckerhoff Zement-Mahlwerk, Neuwieder Rheinpromenaden-Biergarten, Mündung der Wied in den Rhein, Schloss Arenfels, Sinziger Mineralbrunnen, Gedenkstein für das Kriegsgefangenenlager „Goldene Meile", Behelfsbrücke Heimersheim und Reste der alten Brücke, Blick auf die Marienkapelle auf der Landskrone, Blick auf die Weinberge von Altenahr.

Region: Koblenz, Mittelrhein zwischen Koblenz und Sinzig, unteres Ahrtal.

Für Schritt D besonders zu prüfen: Festung Ehrenbreitstein, die römische Vergangenheit von Remagen und Sinzig, die Brücke von Remagen, Burg Are bei Altenahr.

Der Gedenkstein „Goldene Meile" und die Behelfsbrücke Heimersheim sind zwei POIs, die Zurückhaltung verlangen: das eine betrifft die alliierten Kriegsgefangenenlager von 1945, das andere die Flutkatastrophe von 2021. Beide gehören in den Reiseführer, weil sie die Gegend prägen — sachlich, belegt, ohne Pathos.

- [ ] **Step 3: Validator ausführen**

Run: `npm run validate:pois`
Expected: 0 Fehler. Solange nur Tag 1 in der Datei steht, betreffen etwaige Warnungen nur diesen Tag.

- [ ] **Step 4: Zwei Texte laut lesen**

Zwei beliebige `textShort` und einen `textLong` laut vorlesen. Stolpert man über Satzbau, Klammern oder Abkürzungen, umformulieren. Das ist die einzige verlässliche Prüfung auf Vorlesbarkeit vor der Audio-Erzeugung.

- [ ] **Step 5: Commit**

```bash
git add data/pois.json data/waypoint-kuratierung.md
git commit -m "feat: recherchierte POI-Texte für Tag 1 (Koblenz nach Findling)"
```

---

### Task 11: Recherche Tag 2 — Findling nach Waldkönigen

**Files:**
- Modify: `data/pois.json`
- Modify: `data/waypoint-kuratierung.md`

**Interfaces:**
- Consumes: `data/pois.json` aus Task 10, `validierePois`
- Produces: `data/pois.json` mit dem zweiten Eintrag in `days[]`

- [ ] **Step 1: Recherche-Protokoll auf Tag 2 anwenden**

Tag 2 hat nur **6** Waypoints — mit Abstand die dünnste Datenlage aller Tage. Schritt D des Protokolls ist hier deshalb der Schwerpunkt, nicht die Nebensache: die Route führt durch das mittlere und obere Ahrtal in die Vulkaneifel, und dort liegt deutlich mehr an der Strecke, als Komoot markiert hat.

Aus der Kuratierungstabelle für Tag 2 gehören unter anderem dazu: Ahr in Schuld, Insul-Tunnel am Ahr-Radweg, Mohn- und Kamillenfeld in Insul, Alte Kapelle am Ahr-Radweg.

Besonders zu prüfen für Schritt D: Altenahr mit Burg Are, die Ahrschleifen und Weinlagen, die Spuren der Flutkatastrophe von 2021 im Ahrtal, der Übergang in die Vulkaneifel, Maare und Trockenmaare rund um Daun und Waldkönigen.

Der Hinweis auf die Flut ist bewusst gesetzt: Wer heute durch das Ahrtal fährt, sieht Wiederaufbau, fehlende Brücken und neue Radwegabschnitte. Ein Reiseführer, der das ausspart, wirkt seltsam. Sachlich bleiben, belegte Angaben verwenden, nichts dramatisieren.

- [ ] **Step 2: Validator ausführen**

Run: `npm run validate:pois`
Expected: 0 Fehler. Bei Tag 2 die Warnung „nur N story-POIs" ernst nehmen — sie zeigt an, ob Schritt D genug Lücken geschlossen hat. Unter 6 story-POIs für einen 52-Kilometer-Tag ist zu wenig.

- [ ] **Step 3: Zwei Texte laut lesen**

Wie in Task 10, Schritt 4.

- [ ] **Step 4: Commit**

```bash
git add data/pois.json data/waypoint-kuratierung.md
git commit -m "feat: recherchierte POI-Texte für Tag 2 (Findling nach Waldkönigen)"
```

---

### Task 12: Recherche Tag 3 — Waldkönigen nach Pittenbach

**Files:**
- Modify: `data/pois.json`
- Modify: `data/waypoint-kuratierung.md`

**Interfaces:**
- Consumes: `data/pois.json` aus Task 11, `validierePois`
- Produces: `data/pois.json` mit dem dritten Eintrag in `days[]`

- [ ] **Step 1: Recherche-Protokoll auf Tag 3 anwenden**

Tag 3 hat mit **26** die meisten Waypoints. Aus der Kuratierungstabelle unter anderem: Bahnbetriebswerk Gerolstein, Lokschuppen Gerolstein mit Eisenbahnmuseum, Kyllbrücke in Gerolstein, Brunnenplatz Gerolstein, Aussichtspunkt Lissingen mit Blick auf Gerolstein, Burg Lissingen, Ausblick auf die Kasselburg, Blick auf Schloss Malberg, Schloss Malberg, Pelmer Brücke über die Kyll und die Eisenbahn, Kalkhöhlen zwischen Pelm und Berlingen, Naturschutzgebiet Kirchweiler Rohr, Naturschutzgebiet zwischen Berlingen und Kirchweiler, Dreiser Weiher, Müllenborner Weiher, Sterenbachsee, Vulkania Heilquelle, Windräder bei Hinterweiler, Ernstberg-Wanderhütte, Blick auf das Lava-Steinwerk Bettendorf.

Region: Kylltal, Gerolsteiner Land, Vulkaneifel. Hier liegt viel echte Substanz — Gerolsteiner Dolomiten, Devon-Riffkalke, römische Spuren, Eisenbahngeschichte, Mineralwasser. Die Waypoints sind diesmal gut gewählt; Schritt D wird entsprechend weniger ergeben als bei Tag 2.

Bei den Naturpunkten: Geologische Angaben zu Vulkaneifel und Devon-Kalken sind gut belegbar, gehören aber knapp gehalten — es ist ein Reiseführer, kein Lehrbuch.

- [ ] **Step 2: Validator ausführen**

Run: `npm run validate:pois`
Expected: 0 Fehler.

- [ ] **Step 3: Zwei Texte laut lesen**

Wie in Task 10, Schritt 4.

- [ ] **Step 4: Commit**

```bash
git add data/pois.json data/waypoint-kuratierung.md
git commit -m "feat: recherchierte POI-Texte für Tag 3 (Waldkönigen nach Pittenbach)"
```

---

### Task 13: Recherche Tag 4 — Pittenbach nach Bergweiler

**Files:**
- Modify: `data/pois.json`
- Modify: `data/waypoint-kuratierung.md`

**Interfaces:**
- Consumes: `data/pois.json` aus Task 12, `validierePois`
- Produces: `data/pois.json` mit dem vierten Eintrag in `days[]`

- [ ] **Step 1: Recherche-Protokoll auf Tag 4 anwenden**

Die 14 Waypoints umfassen laut Kuratierungstabelle unter anderem: Abtei Himmerod, Blick auf Großlittgen, Bahnhofstraße Bleialf, Bleialfer Radweg, Blick auf Waxweiler, Ehemaliger Bahnhof Waxweiler, Brücke über die Prüm bei Watzerath, Fluss Prüm, Obere Prüm, Ehemaliger Prüm-Bahnrad- und Wanderweg, Eifel-Ardennen-Radweg, Eifel-Ardennen und Prümtal-Radweg, Karl Friedrich Renner Skulpturengarten in Habscheid, Lascheid an der Pilgerroute Via Coloniensis, Blick auf die Kanonenbahn-Doppelstockbrücke, Picknickplatz im Naturpark Hohes Venn-Eifel.

Region: Westeifel, Prümtal, Grenzraum zu Belgien und Luxemburg. Ergiebige Themen mit guter Quellenlage: die Zisterzienserabtei Himmerod und ihre Geschichte bis zur Aufgabe des Konvents, die Kanonenbahn als preußische Militärbahn, die Umwandlung stillgelegter Eifelbahnstrecken in Radwege, die Via Coloniensis als Jakobsweg-Zubringer, der Westwall im Raum Bleialf und die Ardennenoffensive.

Der militärhistorische Teil ist gut dokumentiert und für die Gegend prägend. Sachlich und knapp halten.

Mehrere Waypoints dieses Tages benennen denselben Radweg (Eifel-Ardennen-Radweg, Prümtal-Radweg) — hier ist Schritt A gefragt: einen davon behalten, die übrigen als Dublette verwerfen.

- [ ] **Step 2: Validator ausführen**

Run: `npm run validate:pois`
Expected: 0 Fehler.

- [ ] **Step 3: Zwei Texte laut lesen**

Wie in Task 10, Schritt 4.

- [ ] **Step 4: Commit**

```bash
git add data/pois.json data/waypoint-kuratierung.md
git commit -m "feat: recherchierte POI-Texte für Tag 4 (Pittenbach nach Bergweiler)"
```

---

### Task 14: Recherche Tag 5 — Bergweiler nach Nehren

**Files:**
- Modify: `data/pois.json`
- Modify: `data/waypoint-kuratierung.md`

**Interfaces:**
- Consumes: `data/pois.json` aus Task 13, `validierePois`
- Produces: `data/pois.json` mit dem fünften Eintrag in `days[]`

- [ ] **Step 1: Recherche-Protokoll auf Tag 5 anwenden**

Die 22 Waypoints umfassen laut Kuratierungstabelle unter anderem: Stadtzentrum Wittlich, Blick auf die Landschaft bei Wittlich, Hochmoselübergang — Wunderwerk der Technik, Zeltinger Brücke, Traben-Trarbach, Stadtzentrum Traben-Trarbach, Blick auf Traben-Trarbach, Lauschpunkt am Mosel-Radweg bei Enkirch, Zell an der Mosel, Eisenbahnbrücke über die Mosel bei Neef, Wohnmobilstellplatz Lösnich, Ehemalige Bellthal-Moselsprudel Abfüllanlage, Weinberge entlang des Moselradwegs, Blick auf die Mosel und die Weinberge, Mosel-Uferweg.

Region: Wittlicher Senke, Mittelmosel. Ergiebige Themen: der Hochmoselübergang als eines der größten Brückenbauwerke Deutschlands samt der jahrelangen Kontroverse um seinen Bau, der Jugendstil in Traben-Trarbach und die Rolle der Stadt im internationalen Weinhandel, die Moselschleifen, die Zeller Schwarze Katz, Steillagenweinbau und Schieferböden.

Mehrere Waypoints beschreiben ähnliche Moselblicke — Schritt A anwenden und Dubletten verwerfen, statt sechsmal dasselbe zu erzählen.

- [ ] **Step 2: Validator ausführen**

Run: `npm run validate:pois`
Expected: 0 Fehler.

- [ ] **Step 3: Zwei Texte laut lesen**

Wie in Task 10, Schritt 4.

- [ ] **Step 4: Commit**

```bash
git add data/pois.json data/waypoint-kuratierung.md
git commit -m "feat: recherchierte POI-Texte für Tag 5 (Bergweiler nach Nehren)"
```

---

### Task 15: Recherche Tag 6 — Nehren nach Koblenz

**Files:**
- Modify: `data/pois.json`
- Modify: `data/waypoint-kuratierung.md`

**Interfaces:**
- Consumes: `data/pois.json` aus Task 14, `validierePois`
- Produces: `data/pois.json` mit dem sechsten Eintrag in `days[]` — Datei damit vollständig

- [ ] **Step 1: Recherche-Protokoll auf Tag 6 anwenden**

Die 22 Waypoints umfassen laut Kuratierungstabelle unter anderem: Blick auf die Reichsburg Cochem, Weindorf Klotten, Blick auf Beilstein und Burg Metternich, 50. Breitengrad-Denkmal Burg an der Mosel, Löf an der Mosel, Moselradweg bei Alken, Rastplatz in der Nähe der Burg, Historische Altstadt von Kobern-Gondorf, Winningen — historische Altstadt, Winninger Hamm Weinberg, Weinberg Winninger Uhlen und Moselradweg, Lehmer Razejunge Rastplatz, Lavendel- und Naturkräuterfelsterrassen der Lehmer Razejunge, Mosella-Tanzburg, Wohnmobilsplatz Ediger, Blick auf die Koblenzer Brauerei, Kastanienallee, Wegkreuz, Strand.

Region: Untere Mosel zwischen Cochem und Koblenz. Ergiebige Themen: Reichsburg Cochem mit Zerstörung 1689 und Wiederaufbau im 19. Jahrhundert, Beilstein als besonders gut erhaltener Ortskern, Burg Thurant bei Alken, die Steillagen des Winninger Uhlen als eine der steilsten Weinlagen Europas, das 50. Breitengrad-Denkmal, der Abschluss am Deutschen Eck als Klammer zu Tag 1.

Für Schritt D besonders zu prüfen: Burg Eltz — sie liegt abseits der Mosel im Elzbachtal. Entfernung zur Route sauber bestimmen und in `accessNote` ehrlich angeben, statt sie als „an der Strecke" auszuweisen.

Waypoints wie „Wegkreuz", „Strand" und „Kastanienallee" sind Kandidaten für `verworfen` oder `service` — es sei denn, die Recherche fördert etwas Konkretes zutage.

- [ ] **Step 2: Vollständigen Validator-Lauf ausführen**

Run: `npm run validate:pois`
Expected: 0 Fehler, keine Warnung über zu wenige story-POIs. Alle sechs Tage sind gefüllt. Die Warnungen „Briefing-Text fehlt" für alle sechs Tage sind hier korrekt — die Briefings entstehen in Task 16.

- [ ] **Step 3: Gesamtzahl prüfen**

```bash
node -e "
import('node:fs/promises').then(async (fs) => {
  const d = JSON.parse(await fs.readFile('./data/pois.json', 'utf8'));
  let story = 0, service = 0;
  for (const tag of d.days) for (const p of tag.pois) p.kind === 'story' ? story++ : service++;
  console.log('story:', story, '| service:', service, '| gesamt:', story + service);
});
"
```

Expected: `story` liegt zwischen 60 und 100. Deutlich weniger bedeutet, dass zu viel verworfen wurde; deutlich mehr bedeutet vermutlich, dass Servicepunkte fälschlich als `story` geführt werden.

- [ ] **Step 4: Commit**

```bash
git add data/pois.json data/waypoint-kuratierung.md
git commit -m "feat: recherchierte POI-Texte für Tag 6 (Nehren nach Koblenz)"
```

---

### Task 16: Briefing-Texte erzeugen

**Files:**
- Create: `scripts/lib/briefing.js`
- Create: `scripts/build-briefings.js`
- Test: `test/briefing.test.js`
- Modify: `data/pois.json`

**Interfaces:**
- Consumes: `data/tour.json`, `data/pois.json`
- Produces:
  - `baueBriefingText(tag, highlights)` → `string`
  - `tag` = ein Eintrag aus `tour.json.days`, `highlights` = `string[]` mit POI-Namen
  - `data/pois.json` mit gefüllten `briefing.text`-Feldern

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`test/briefing.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baueBriefingText } from '../scripts/lib/briefing.js';

const TAG = {
  day: 3,
  startOrt: 'Waldkönigen',
  zielOrt: 'Pittenbach',
  lengthKm: 58.4,
  elevationGainM: 812,
  estimatedRidingTimeMin: 245,
  climbs: [
    { startKm: 12.5, lengthKm: 3.1, gainM: 140, avgGradientPct: 4.5 },
    { startKm: 41.0, lengthKm: 1.8, gainM: 95, avgGradientPct: 5.3 }
  ]
};

test('nennt Tag, Start und Ziel', () => {
  const text = baueBriefingText(TAG, ['Burg Lissingen']);
  assert.ok(text.includes('Tag 3'), text);
  assert.ok(text.includes('Waldkönigen'), text);
  assert.ok(text.includes('Pittenbach'), text);
});

test('nennt Länge und Höhenmeter', () => {
  const text = baueBriefingText(TAG, []);
  assert.ok(/58/.test(text), text);
  assert.ok(/812/.test(text), text);
});

test('beschreibt jeden Anstieg mit Position, Höhengewinn und Steigung', () => {
  const text = baueBriefingText(TAG, []);
  assert.ok(text.includes('140'), text);
  assert.ok(text.includes('95'), text);
  assert.ok(text.includes('4,5'), `Steigung muss mit Dezimalkomma erscheinen: ${text}`);
});

test('nennt die Highlights', () => {
  const text = baueBriefingText(TAG, ['Burg Lissingen', 'Schloss Malberg']);
  assert.ok(text.includes('Burg Lissingen'), text);
  assert.ok(text.includes('Schloss Malberg'), text);
});

test('kommt mit einem Tag ohne nennenswerte Anstiege zurecht', () => {
  const flach = { ...TAG, climbs: [], elevationGainM: 120 };
  const text = baueBriefingText(flach, []);
  assert.ok(text.length > 50, text);
  assert.ok(!text.includes('undefined'), text);
});

test('verwendet keinen Punkt als Dezimaltrenner', () => {
  const text = baueBriefingText(TAG, []);
  assert.ok(!/\d\.\d/.test(text), `Dezimalpunkt gefunden, für Sprachausgabe ungeeignet: ${text}`);
});
```

Der letzte Test ist der wichtige: „4.5 Prozent" wird von der Sprachausgabe als „vier Punkt fünf" gelesen. Im Deutschen muss dort ein Komma stehen.

- [ ] **Step 2: Test ausführen und Fehlschlag bestätigen**

Run: `node --test test/briefing.test.js`
Expected: FAIL mit `Cannot find module '../scripts/lib/briefing.js'`

- [ ] **Step 3: Modul implementieren**

`scripts/lib/briefing.js`:

```javascript
function komma(zahl, stellen = 1) {
  return zahl.toFixed(stellen).replace('.', ',');
}

function stundenUndMinuten(minuten) {
  const std = Math.floor(minuten / 60);
  const min = minuten % 60;
  if (std === 0) return `${min} Minuten`;
  if (min === 0) return `${std} Stunden`;
  return `${std} Stunden und ${min} Minuten`;
}

function beschreibeAnstiege(climbs) {
  if (climbs.length === 0) {
    return 'Nennenswerte Anstiege gibt es heute nicht.';
  }

  const teile = climbs.map((c) => {
    const wertung = c.avgGradientPct >= 7 ? 'ordentlich steil' : c.avgGradientPct >= 4 ? 'gut spürbar' : 'sanft';
    return (
      `Nach ${Math.round(c.startKm)} Kilometern folgt ein Anstieg über ${komma(c.lengthKm)} Kilometer ` +
      `mit ${c.gainM} Höhenmetern, im Schnitt ${komma(c.avgGradientPct)} Prozent — ${wertung}.`
    );
  });

  const einleitung =
    climbs.length === 1 ? 'Ein Anstieg wartet auf euch.' : `${climbs.length} Anstiege warten auf euch.`;
  return `${einleitung} ${teile.join(' ')}`;
}

export function baueBriefingText(tag, highlights) {
  const saetze = [
    `Guten Morgen. Heute erwartet dich Tag ${tag.day}, von ${tag.startOrt} nach ${tag.zielOrt}.`,
    `Die Etappe ist ${komma(tag.lengthKm)} Kilometer lang und hat ${tag.elevationGainM} Höhenmeter.`
  ];

  if (tag.estimatedRidingTimeMin > 0) {
    saetze.push(`Die reine Fahrzeit liegt bei etwa ${stundenUndMinuten(tag.estimatedRidingTimeMin)}.`);
  }

  saetze.push(beschreibeAnstiege(tag.climbs));

  if (highlights.length > 0) {
    const liste =
      highlights.length === 1
        ? highlights[0]
        : `${highlights.slice(0, -1).join(', ')} und ${highlights[highlights.length - 1]}`;
    saetze.push(`Unterwegs erwarten euch ${liste}.`);
  }

  saetze.push('Gute Fahrt.');

  return saetze.join(' ');
}
```

- [ ] **Step 4: Tests ausführen**

Run: `node --test test/briefing.test.js`
Expected: PASS, 6 Tests

- [ ] **Step 5: CLI-Skript schreiben**

`scripts/build-briefings.js`:

```javascript
import fs from 'node:fs/promises';
import path from 'node:path';
import { baueBriefingText } from './lib/briefing.js';

const WURZEL = path.resolve(import.meta.dirname, '..');
const tourPfad = path.join(WURZEL, 'data', 'tour.json');
const poiPfad = path.join(WURZEL, 'data', 'pois.json');

const tour = JSON.parse(await fs.readFile(tourPfad, 'utf8'));
const pois = JSON.parse(await fs.readFile(poiPfad, 'utf8'));

for (const poiTag of pois.days) {
  const tourTag = tour.days.find((d) => d.day === poiTag.day);
  if (!tourTag) {
    throw new Error(`Tag ${poiTag.day} fehlt in tour.json`);
  }

  // Die drei erstgenannten story-POIs des Tages gelten als Highlights.
  const highlights = poiTag.pois
    .filter((p) => p.kind === 'story')
    .slice(0, 3)
    .map((p) => p.name);

  poiTag.briefing = {
    ...poiTag.briefing,
    text: baueBriefingText(tourTag, highlights)
  };

  console.log(`Tag ${poiTag.day}: Briefing mit ${poiTag.briefing.text.split(/\s+/).length} Wörtern`);
}

pois.generatedAt = new Date().toISOString();
await fs.writeFile(poiPfad, `${JSON.stringify(pois, null, 2)}\n`, 'utf8');
```

- [ ] **Step 6: Skript ausführen und Ergebnis prüfen**

```bash
npm run build:briefings
npm run validate:pois -- --streng
```

Expected: sechs Zeilen Ausgabe, Validator ohne Fehler und ohne Briefing-Warnungen. `--streng` macht fehlende Briefings zum Fehler — ab hier müssen alle sechs vorliegen.

Anschließend ein Briefing laut vorlesen. Klingt es wie etwas, das man morgens am Frühstückstisch hören will? Falls nicht, die Formulierungen in `briefing.js` anpassen — die Tests decken Inhalt und Zahlenformat ab, nicht den Ton.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/briefing.js scripts/build-briefings.js test/briefing.test.js data/pois.json
git commit -m "feat: Tages-Briefings aus den berechneten Kennzahlen erzeugen"
```

---

### Task 17: Gesamtlauf und Abschluss

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: alle vorigen Tasks
- Produces: reproduzierbare, dokumentierte Pipeline

- [ ] **Step 1: Vollständigen Testlauf ausführen**

Run: `npm test`
Expected: PASS, alle Tests aus allen Modulen.

- [ ] **Step 2: Pipeline von vorn durchlaufen**

```bash
npm run build:tour
npm run build:briefings
npm run validate:pois -- --streng
```

Expected: kein Fehler, keine Warnung. `data/tour.json` und `data/pois.json` sind vollständig.

- [ ] **Step 3: README schreiben**

`README.md`:

````markdown
# Audio-Reiseführer Ahrtal & Eifel

Datenpipeline für den Reiseführer zur sechstägigen Radtour.

## Aufbau

- `scripts/lib/` — getestete Bibliotheksmodule (GPX, Geo, Höhen, Anstiege, Route, POI-Schema, Briefing)
- `scripts/build-tour.js` — erzeugt `data/tour.json` aus den GPX-Dateien
- `scripts/classify-waypoints.js` — erzeugt die Kuratierungstabelle
- `scripts/build-briefings.js` — erzeugt die Tages-Briefings
- `scripts/validate-pois.js` — prüft `data/pois.json`

## Pipeline ausführen

```bash
npm install
npm test
npm run build:tour
npm run build:briefings
npm run validate:pois -- --streng
```

## Datendateien

`data/tour.json` — Kennzahlen und Routenlinien je Tag, vollständig aus den GPX-Tracks berechnet.

`data/pois.json` — kuratierte Sehenswürdigkeiten mit recherchierten Texten und Quellenangaben.
Jeder POI mit `kind: "story"` trägt mindestens eine Quelle; das setzt `validate:pois` durch.

`data/waypoint-kuratierung.md` — nachvollziehbare Entscheidung je Komoot-Waypoint.
````

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README zur Datenpipeline"
```

---

## Was dieser Plan nicht enthält

Bewusst ausgelagert in einen zweiten Plan:

- Audio-Erzeugung aus den Texten (macOS-TTS über `say`, MP3-Konvertierung mit `lame` oder `ffmpeg`, inkrementelles Rendern nur geänderter Texte)
- Umbau der PWA (Datenmodul, Audio-Player mit MediaSession, GPS-Auslösung, Kartenansicht, Oberfläche)
- Service Worker mit Versionierung und Vorab-Download
- Deployment über die vorhandenen Docker- und k8s-Dateien

Grundlage dafür sind die beiden Datendateien, die dieser Plan liefert. Die Felder `audioShort`, `audioLong` und `briefing.audio` bleiben in diesem Plan leer und werden im zweiten Plan gefüllt.
