# Audio-Erzeugung — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aus den Texten in `data/pois.json` abspielbare MP3-Dateien erzeugen — mit dem lokalen macOS-TTS, inkrementell, sodass eine Textkorrektur nur die betroffenen Dateien neu rendert.

**Architecture:** Drei seiteneffektfreie Bibliotheksmodule treffen alle Entscheidungen (Aussprache, Dateiname, was neu gerendert werden muss). Ein viertes Modul kapselt als einziges die Aufrufe von `say`, `ffmpeg` und `ffprobe`. Darüber liegen zwei CLI-Skripte. `pois.json` wird ausschließlich gelesen; alle Audio-Metadaten stehen in `data/audio-manifest.json`.

**Tech Stack:** Node 26, eingebauter Testrunner `node --test`, ausschließlich Node-Standardbibliothek (keine neue npm-Abhängigkeit). Extern: `say`, `ffmpeg`, `ffprobe` — alle auf dem Zielrechner geprüft vorhanden.

**Grundlage:** [Audio-Erzeugung (Baustein 3) — Design](../specs/2026-08-08-audio-erzeugung-design.md)

## Global Constraints

- Alle Texte, Feldwerte und Commit-Messages auf Deutsch, mit korrekten Umlauten (ä, ö, ü, ß). Niemals ASCII-Ersatz wie "ae" oder "ss".
- Datumsformat in Daten: ISO-8601 UTC, z.B. `2026-08-08T12:00:00.000Z`.
- `data/pois.json` und `data/tour.json` werden **nur gelesen, nie geschrieben**. Sie gehören der Datenpipeline.
- Keine neue npm-Abhängigkeit. Was die Node-Standardbibliothek nicht kann, erledigen `say`, `ffmpeg` und `ffprobe`.
- Nichts still überspringen: Fehlt ein Werkzeug, eine Stimme oder ein Text, bricht das Programm mit einer Meldung ab, die Ursache und betroffene ID nennt.
- Distanzen in Kilometern (`...Km`), Höhen in Metern (`...M`), Zeiten in Sekunden (`...Sek`), Größen in Bytes (`...Bytes`).
- Jede Task endet mit einem Commit.

## Parallelbetrieb mit der Datenpipeline

Dieser Plan entsteht und läuft **parallel** zum Plan [Datenpipeline](2026-08-08-datenpipeline.md), möglicherweise in einer zweiten Claude-Session im selben Arbeitsverzeichnis. Daraus folgen drei Regeln, die in jedem Commit-Schritt gelten:

1. **Niemals `git add .` oder `git add -A`.** Immer die konkreten Pfade nennen, die der Schritt vorgibt. Sonst landen halbfertige Dateien der anderen Session im Commit.
2. **`package.json` nur ergänzen, nie neu schreiben.** Der Eintrag `scripts` bekommt zwei zusätzliche Zeilen; alles andere bleibt unangetastet. Vor dem Commit `git diff package.json` prüfen — stehen dort fremde Änderungen, diese unangetastet lassen und nur die eigenen Zeilen committen.
3. **Tasks 1 bis 6 brauchen `data/pois.json` nicht.** Sie arbeiten gegen das Schema, nicht gegen die Inhalte, und sind sofort ausführbar. Erst Tasks 7 und 8 setzen die fertige Datei voraus.

## Dateistruktur

| Datei | Verantwortung |
|---|---|
| `scripts/lib/aussprache.js` | Schreibweise auf Sprechweise abbilden |
| `scripts/lib/audioNamen.js` | Dateipfad aus ID und Variante bilden |
| `scripts/lib/audioPlan.js` | Hash, Soll-Ist-Vergleich gegen das Manifest, Manifest bauen |
| `scripts/lib/tts.js` | Einziger Ort mit Seiteneffekten: `say`, `ffmpeg`, `ffprobe` |
| `scripts/proben-stimmen.js` | CLI: Hörproben für die Stimmenauswahl |
| `scripts/build-audio.js` | CLI: plant, rendert, schreibt das Manifest |
| `test/aussprache.test.js` | Tests zu `aussprache.js` |
| `test/audioNamen.test.js` | Tests zu `audioNamen.js` |
| `test/audioPlan.test.js` | Tests zu `audioPlan.js` |
| `test/tts.test.js` | Rauchtest, rendert tatsächlich einen Satz |
| `data/audio-profil.json` | Gewählte Stimme, Sprechgeschwindigkeit, Bitrate, Abtastrate |
| `data/aussprache.json` | Gepflegte Aussprachetabelle |
| `data/audio-manifest.json` | Erzeugt: Dateiliste mit Hash, Dauer, Größe |
| `audio/*.mp3` | Erzeugt: die Sprachdateien |

`data/audio-profil.json` steht nicht wörtlich in der Spec. Die Spec legt fest, dass Stimme, Sprechgeschwindigkeit und Bitrate das Ergebnis der Hörprobe sind und in den Hash eingehen; sie brauchen deshalb einen Ort, der schon vor dem ersten Manifest existiert. Das ist diese Datei.

---

### Task 1: Hörprobe und Profilfestlegung

**Files:**
- Create: `scripts/proben-stimmen.js`
- Create: `data/audio-profil.json`
- Modify: `package.json` (zwei Zeilen unter `scripts`)
- Modify: `.gitignore` (eine Zeile)

**Interfaces:**
- Consumes: nichts
- Produces: `data/audio-profil.json` mit `{ stimme: string, rate: number, bitrate: number, abtastrate: number }` — jede folgende Task liest diese vier Felder

Diese Task enthält zwei Stellen, an denen ein Mensch zuhören und entscheiden muss. Sie lassen sich nicht automatisieren und dürfen nicht übersprungen werden: Die Stimme geht in den Hash ein, eine spätere Änderung rendert den gesamten Bestand neu.

- [ ] **Step 1: `.gitignore` um das Probenverzeichnis ergänzen**

An das Ende von `.gitignore` anfügen:

```
audio-proben/
```

Die Zeile `audio/` bleibt vorerst stehen — sie wird erst in Task 8 entfernt, wenn tatsächlich Dateien eingecheckt werden.

- [ ] **Step 2: `package.json` um zwei Skripte ergänzen**

Im Abschnitt `scripts` hinzufügen, ohne bestehende Einträge zu verändern:

```json
    "proben:stimmen": "node scripts/proben-stimmen.js",
    "build:audio": "node scripts/build-audio.js"
```

- [ ] **Step 3: Probenskript schreiben**

`scripts/proben-stimmen.js`:

```javascript
#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const WURZEL = path.resolve(import.meta.dirname, '..');
const AUSGABE = path.join(WURZEL, 'audio-proben');

// Enthält bewusst die Stolpersteine: Ortsnamen mit unregelmäßiger Aussprache,
// einen Bindestrich-Namen und zwei Jahreszahlen in unterschiedlicher Schreibweise.
const BEISPIELTEXT = [
  'Guten Morgen. Heute erwartet dich Tag fünf, von Bergweiler nach Nehren.',
  'Vor euch liegt der Hochmoselübergang, eines der größten Brückenbauwerke Deutschlands.',
  'Rechts unten seht ihr Traben-Trarbach, das um 1900 durch den Weinhandel reich wurde.',
  'Weiter geht es nach Cochem mit seiner Reichsburg, 1689 zerstört und im 19. Jahrhundert wieder aufgebaut.'
].join(' ');

function stimmenListe() {
  const ausgabe = execFileSync('say', ['-v', '?'], { encoding: 'utf8' });
  return ausgabe
    .split('\n')
    .map((zeile) => zeile.match(/^(.+?)\s+de_DE\s+#/))
    .filter(Boolean)
    .map((treffer) => treffer[1].trim());
}

function rendere(text, { stimme, rate, bitrate, abtastrate, ziel }) {
  const aiff = `${ziel}.aiff`;
  // Text über eine Datei statt über die Kommandozeile: unempfindlich gegen
  // Umlaute, Anführungszeichen und Längengrenzen. Gleiches Vorgehen wie später
  // in scripts/lib/tts.js.
  const textDatei = path.join(AUSGABE, 'beispieltext.txt');
  fs.writeFileSync(textDatei, text, 'utf8');

  execFileSync('say', ['-v', stimme, '-r', String(rate), '-f', textDatei, '-o', aiff]);
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', aiff,
    '-ac', '1', '-ar', String(abtastrate),
    '-codec:a', 'libmp3lame', '-b:a', `${bitrate}k`,
    ziel
  ]);
  fs.rmSync(aiff, { force: true });
  return fs.statSync(ziel).size;
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const stimme = process.argv[2];
fs.mkdirSync(AUSGABE, { recursive: true });

if (!stimme) {
  // Durchgang 1: alle deutschen Stimmen bei mittlerer Sprechgeschwindigkeit.
  for (const name of stimmenListe()) {
    const ziel = path.join(AUSGABE, `stimme-${slug(name)}.mp3`);
    try {
      const bytes = rendere(BEISPIELTEXT, { stimme: name, rate: 180, bitrate: 32, abtastrate: 22050, ziel });
      console.log(`${name}: ${(bytes / 1024).toFixed(0)} kB — ${ziel}`);
    } catch (fehler) {
      // Bei der Erkundung ist Weitermachen richtig: eine unbrauchbare Stimme
      // soll die übrigen acht nicht verhindern.
      console.log(`${name}: FEHLER — ${fehler.message.split('\n')[0]}`);
    }
  }
  console.log('\nAlle Proben liegen in audio-proben/. Danach erneut aufrufen mit:');
  console.log('  npm run proben:stimmen -- "<Stimmenname>"');
} else {
  // Durchgang 2: gewählte Stimme in drei Geschwindigkeiten und zwei Bitraten.
  for (const rate of [160, 180, 200]) {
    const ziel = path.join(AUSGABE, `${slug(stimme)}-rate${rate}.mp3`);
    const bytes = rendere(BEISPIELTEXT, { stimme, rate, bitrate: 32, abtastrate: 22050, ziel });
    console.log(`Rate ${rate}: ${(bytes / 1024).toFixed(0)} kB — ${ziel}`);
  }
  for (const bitrate of [32, 64]) {
    const ziel = path.join(AUSGABE, `${slug(stimme)}-bitrate${bitrate}.mp3`);
    const bytes = rendere(BEISPIELTEXT, { stimme, rate: 180, bitrate, abtastrate: 22050, ziel });
    console.log(`Bitrate ${bitrate}: ${(bytes / 1024).toFixed(0)} kB — ${ziel}`);
  }
}
```

- [ ] **Step 4: Stimmenproben erzeugen**

Run: `npm run proben:stimmen`
Expected: eine Zeile je deutscher Stimme, neun MP3-Dateien in `audio-proben/`.

Meldet eine Stimme `FEHLER`, liegt das meist am Namen in Klammern (etwa `Eddy (Deutsch (Deutschland))`). Diese Stimme fällt dann aus der Auswahl — kein Grund zum Abbruch.

- [ ] **Step 5: Anhören und Stimme wählen**

Alle erzeugten Dateien anhören. Bewertungsmaßstab: Wie klingt sie nach dem zwanzigsten Mal an einem Tag? Achte besonders auf „Hochmoselübergang", „Traben-Trarbach" und die beiden Jahreszahlen — dort trennt sich brauchbar von störend.

**Diese Entscheidung trifft der Mensch, nicht der Agent.** Ohne sie geht es nicht weiter.

- [ ] **Step 6: Geschwindigkeit und Bitrate wählen**

Run: `npm run proben:stimmen -- "<gewählte Stimme>"`
Expected: fünf weitere Dateien — drei Geschwindigkeiten, zwei Bitraten.

Anhören und festlegen. Zur Einordnung: Bei 32 kbit/s ist mit rund 34 MB Gesamtgröße zu rechnen, bei 64 kbit/s mit rund 67 MB. Hörst du keinen Unterschied, nimm 32.

- [ ] **Step 7: `data/audio-profil.json` schreiben**

Mit den gewählten Werten, hier als Beispiel:

```json
{
  "stimme": "Anna",
  "rate": 180,
  "bitrate": 32,
  "abtastrate": 22050
}
```

- [ ] **Step 8: Commit**

```bash
git add scripts/proben-stimmen.js data/audio-profil.json package.json .gitignore
git commit -m "feat: Hörproben-Skript und festgelegtes Sprachprofil"
```

---

### Task 2: Aussprache-Modul

**Files:**
- Create: `scripts/lib/aussprache.js`
- Create: `data/aussprache.json`
- Test: `test/aussprache.test.js`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `wendeAusspracheAn(text, tabelle)` → `string`
  - `tabelle` ist ein flaches Objekt `{ [schreibweise: string]: sprechweise: string }`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

Hintergrund für den Implementierenden: Die naheliegende Lösung — `text.replaceAll(schluessel, wert)` in einer Schleife — hat drei Fehler. Sie ersetzt mitten in Wörtern („Burg" in „Burgund"), sie hängt von der Reihenfolge der Objektschlüssel ab („Traben" schlägt zu, bevor „Traben-Trarbach" drankommt), und sie behandelt Schlüssel mit Sonderzeichen nicht. Alle drei sind hier getestet.

Die übliche Wortgrenze `\b` scheitert an deutschen Umlauten, weil `\w` nur ASCII kennt: Bei einem Schlüssel wie „Öl" säße `\b` an der falschen Stelle. Deshalb Lookaround über Unicode-Buchstaben und -Ziffern.

`test/aussprache.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wendeAusspracheAn } from '../scripts/lib/aussprache.js';

test('ersetzt ein einzelnes Wort', () => {
  const ergebnis = wendeAusspracheAn('Weiter nach Cochem.', { Cochem: 'Kochem' });
  assert.equal(ergebnis, 'Weiter nach Kochem.');
});

test('ersetzt jedes Vorkommen', () => {
  const ergebnis = wendeAusspracheAn('Cochem, und noch einmal Cochem.', { Cochem: 'Kochem' });
  assert.equal(ergebnis, 'Kochem, und noch einmal Kochem.');
});

test('ersetzt nicht innerhalb eines Wortes', () => {
  const ergebnis = wendeAusspracheAn('Die Burg in Burgund.', { Burg: 'Burk' });
  assert.equal(ergebnis, 'Die Burk in Burgund.');
});

test('längere Schlüssel gewinnen gegen kürzere', () => {
  const tabelle = { Traben: 'Trahben', 'Traben-Trarbach': 'Trahben-Trahrbach' };
  const ergebnis = wendeAusspracheAn('Blick auf Traben-Trarbach.', tabelle);
  assert.equal(ergebnis, 'Blick auf Trahben-Trahrbach.');
});

test('erkennt Wortgrenzen auch bei Umlauten am Wortanfang', () => {
  const ergebnis = wendeAusspracheAn('Öl und Ölberg.', { 'Öl': 'Öhl' });
  assert.equal(ergebnis, 'Öhl und Ölberg.');
});

test('erkennt Wortgrenzen auch bei Umlauten am Wortende', () => {
  const ergebnis = wendeAusspracheAn('Nach Prüm und weiter.', { 'Prüm': 'Prühm' });
  assert.equal(ergebnis, 'Nach Prühm und weiter.');
});

test('ersetzt Jahreszahlen', () => {
  const ergebnis = wendeAusspracheAn('Im Jahr 1689 zerstört.', { '1689': 'sechzehnhundertneunundachtzig' });
  assert.equal(ergebnis, 'Im Jahr sechzehnhundertneunundachtzig zerstört.');
});

test('behandelt Sonderzeichen im Schlüssel als Text, nicht als Muster', () => {
  const ergebnis = wendeAusspracheAn('Die Kirche St. Kastor.', { 'St. Kastor': 'Sankt Kastor' });
  assert.equal(ergebnis, 'Die Kirche Sankt Kastor.');
});

test('eine leere Tabelle lässt den Text unverändert', () => {
  const text = 'Nichts zu ersetzen.';
  assert.equal(wendeAusspracheAn(text, {}), text);
});

test('eine fehlende Tabelle lässt den Text unverändert', () => {
  const text = 'Nichts zu ersetzen.';
  assert.equal(wendeAusspracheAn(text, undefined), text);
});

test('der Ersatztext wird nicht erneut ersetzt', () => {
  const ergebnis = wendeAusspracheAn('Zell an der Mosel.', { Zell: 'Zelle', Zelle: 'FALSCH' });
  assert.equal(ergebnis, 'Zelle an der Mosel.');
});
```

Der letzte Test schützt vor Kettenersetzung: Erzeugt eine Regel Text, auf den eine andere Regel passt, darf diese nicht mehr greifen.

- [ ] **Step 2: Test ausführen und Fehlschlag bestätigen**

Run: `node --test test/aussprache.test.js`
Expected: FAIL mit `Cannot find module '../scripts/lib/aussprache.js'`

- [ ] **Step 3: Modul implementieren**

`scripts/lib/aussprache.js`:

```javascript
/** Maskiert alle Zeichen, die in einem regulären Ausdruck eine Sonderbedeutung haben. */
function maskiere(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Ersetzt Schreibweisen durch Sprechweisen — nur an Wortgrenzen und in einem
 * einzigen Durchgang, damit erzeugter Text nicht erneut ersetzt wird.
 *
 * Die Wortgrenzen sind bewusst nicht `\b`: Dessen `\w` kennt nur ASCII, sodass
 * Schlüssel mit Umlaut am Rand falsch behandelt würden.
 */
export function wendeAusspracheAn(text, tabelle) {
  const schluessel = Object.keys(tabelle ?? {});
  if (schluessel.length === 0) return text;

  // Längste zuerst, damit "Traben-Trarbach" vor "Traben" greift.
  schluessel.sort((a, b) => b.length - a.length);

  const muster = new RegExp(
    `(?<![\\p{L}\\p{N}])(${schluessel.map(maskiere).join('|')})(?![\\p{L}\\p{N}])`,
    'gu'
  );

  return text.replace(muster, (treffer) => tabelle[treffer]);
}
```

Die Alternation aus allen Schlüsseln in einem einzigen Ausdruck ist der Kern: Sie ersetzt in einem Durchgang, wodurch Kettenersetzung strukturell ausgeschlossen ist.

- [ ] **Step 4: Tests ausführen**

Run: `node --test test/aussprache.test.js`
Expected: PASS, 11 Tests

- [ ] **Step 5: Startfassung der Tabelle anlegen**

`data/aussprache.json` — die Einträge, die aus der Recherche bereits absehbar sind. Die Datei wächst in Task 7 beim Abhören:

```json
{
  "Cochem": "Kochem",
  "1689": "sechzehnhundertneunundachtzig",
  "1900": "neunzehnhundert"
}
```

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/aussprache.js test/aussprache.test.js data/aussprache.json
git commit -m "feat: Aussprache-Modul mit wortgenauer Ersetzung"
```

---

### Task 3: Dateinamen-Modul

**Files:**
- Create: `scripts/lib/audioNamen.js`
- Test: `test/audioNamen.test.js`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `VARIANTEN` → `['kurz', 'lang', 'briefing']`
  - `dateiname(id, variante)` → `string`, ein Pfad relativ zur Projektwurzel
  - `id` ist bei POIs deren `id` aus `pois.json` (Muster `tag<N>-<name>`), bei Briefings `tag<N>`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

Hintergrund: Die Funktion ist trivial — genau deshalb gehört sie in ein eigenes Modul. Sie ist der einzige Ort, an dem der Zusammenhang zwischen POI-ID und Dateipfad festgelegt ist, und drei verschiedene Stellen verlassen sich darauf. Die Prüfungen fangen ab, dass ein Briefing und ein POI je auf denselben Pfad zeigen.

`test/audioNamen.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateiname, VARIANTEN } from '../scripts/lib/audioNamen.js';

test('bildet den Pfad für die Kurzfassung', () => {
  assert.equal(dateiname('tag1-deutsches-eck', 'kurz'), 'audio/tag1-deutsches-eck-kurz.mp3');
});

test('bildet den Pfad für die Langfassung', () => {
  assert.equal(dateiname('tag1-deutsches-eck', 'lang'), 'audio/tag1-deutsches-eck-lang.mp3');
});

test('bildet den Pfad für ein Briefing', () => {
  assert.equal(dateiname('tag1', 'briefing'), 'audio/tag1-briefing.mp3');
});

test('kennt genau drei Varianten', () => {
  assert.deepEqual(VARIANTEN, ['kurz', 'lang', 'briefing']);
});

test('weist eine unbekannte Variante zurück', () => {
  assert.throws(() => dateiname('tag1-deutsches-eck', 'mittel'), /Variante/);
});

test('weist eine leere ID zurück', () => {
  assert.throws(() => dateiname('', 'kurz'), /ID/);
});

test('verlangt für ein Briefing eine Tages-ID', () => {
  assert.throws(() => dateiname('tag1-deutsches-eck', 'briefing'), /Briefing/);
});

test('weist eine POI-ID zurück, die wie eine Tages-ID aussieht', () => {
  assert.throws(() => dateiname('tag1', 'kurz'), /Briefing/);
});

test('erzeugt für verschiedene Eingaben verschiedene Pfade', () => {
  const pfade = [
    dateiname('tag1-deutsches-eck', 'kurz'),
    dateiname('tag1-deutsches-eck', 'lang'),
    dateiname('tag1-burg-metternich', 'kurz'),
    dateiname('tag1', 'briefing'),
    dateiname('tag2', 'briefing')
  ];
  assert.equal(new Set(pfade).size, pfade.length);
});
```

- [ ] **Step 2: Test ausführen und Fehlschlag bestätigen**

Run: `node --test test/audioNamen.test.js`
Expected: FAIL mit `Cannot find module '../scripts/lib/audioNamen.js'`

- [ ] **Step 3: Modul implementieren**

`scripts/lib/audioNamen.js`:

```javascript
export const VARIANTEN = ['kurz', 'lang', 'briefing'];

const TAGES_ID = /^tag\d+$/;

/**
 * Bildet den Dateipfad aus ID und Variante. Einziger Ort, an dem diese Regel steht.
 *
 * Briefings tragen eine reine Tages-ID (`tag3`), POIs das Muster `tag3-<name>`.
 * Die Prüfungen schließen aus, dass beide je auf denselben Pfad zeigen.
 */
export function dateiname(id, variante) {
  if (typeof id !== 'string' || id.trim() === '') {
    throw new Error(`Ungültige ID: ${JSON.stringify(id)}`);
  }
  if (!VARIANTEN.includes(variante)) {
    throw new Error(`Unbekannte Variante "${variante}". Erlaubt: ${VARIANTEN.join(', ')}`);
  }

  const istTagesId = TAGES_ID.test(id);
  if (variante === 'briefing' && !istTagesId) {
    throw new Error(`Briefing verlangt eine Tages-ID wie "tag3", war "${id}".`);
  }
  if (variante !== 'briefing' && istTagesId) {
    throw new Error(`Die ID "${id}" ist für Briefings reserviert und darf keinem POI gehören.`);
  }

  return `audio/${id}-${variante}.mp3`;
}
```

- [ ] **Step 4: Tests ausführen**

Run: `node --test test/audioNamen.test.js`
Expected: PASS, 9 Tests

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/audioNamen.js test/audioNamen.test.js
git commit -m "feat: Dateinamen-Modul mit Kollisionsprüfung"
```

---

### Task 4: Planungsmodul

**Files:**
- Create: `scripts/lib/audioPlan.js`
- Test: `test/audioPlan.test.js`

**Interfaces:**
- Consumes: `wendeAusspracheAn` aus `scripts/lib/aussprache.js`, `dateiname` aus `scripts/lib/audioNamen.js`
- Produces:
  - `textHash(text, profil)` → `string` (SHA-256, hexadezimal)
  - `berechneAufgaben(pois, manifest, profil, tabelle)` → `{ zuRendern, unveraendert, verwaist }`
    - `zuRendern`: `Array<{ id, variante, pfad, text, hash }>` — `text` ist bereits aussprachekorrigiert
    - `unveraendert`: `Array<{ pfad, poiId, variante, hash, dauerSek, groesseBytes }>` (Einträge aus dem alten Manifest)
    - `verwaist`: `string[]` (Pfade)
    - `manifest` darf `null` sein (Erstlauf)
  - `baueManifest(profil, eintraege)` → das vollständige Manifest-Objekt

Dies ist das Herzstück: Hier fällt jede Entscheidung darüber, was gerendert wird — und zwar ohne einen einzigen `say`-Aufruf, also in Millisekunden testbar.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`test/audioPlan.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textHash, berechneAufgaben, baueManifest } from '../scripts/lib/audioPlan.js';

const PROFIL = { stimme: 'Anna', rate: 180, bitrate: 32, abtastrate: 22050 };

function storyPoi(ueberschreibungen = {}) {
  return {
    id: 'tag1-deutsches-eck',
    day: 1,
    name: 'Deutsches Eck',
    kind: 'story',
    textShort: 'Kurzfassung zum Deutschen Eck.',
    textLong: 'Langfassung zum Deutschen Eck mit mehr Einzelheiten.',
    ...ueberschreibungen
  };
}

function poiDaten(pois, briefingText = 'Guten Morgen, heute geht es los.') {
  return { days: [{ day: 1, briefing: { text: briefingText }, pois }] };
}

/** Baut ein Manifest, das exakt zum übergebenen Planungsergebnis passt. */
function manifestAus(aufgaben) {
  return baueManifest(
    PROFIL,
    aufgaben.zuRendern.map((a) => ({
      pfad: a.pfad,
      poiId: a.id,
      variante: a.variante,
      hash: a.hash,
      dauerSek: 12.5,
      groesseBytes: 50000
    }))
  );
}

test('beim Erstlauf ohne Manifest wird alles gerendert', () => {
  const ergebnis = berechneAufgaben(poiDaten([storyPoi()]), null, PROFIL, {});
  assert.equal(ergebnis.zuRendern.length, 3, 'Briefing plus Kurz- und Langfassung');
  assert.deepEqual(ergebnis.unveraendert, []);
  assert.deepEqual(ergebnis.verwaist, []);
});

test('unveränderte Texte werden nicht erneut gerendert', () => {
  const daten = poiDaten([storyPoi()]);
  const manifest = manifestAus(berechneAufgaben(daten, null, PROFIL, {}));
  const ergebnis = berechneAufgaben(daten, manifest, PROFIL, {});
  assert.deepEqual(ergebnis.zuRendern, []);
  assert.equal(ergebnis.unveraendert.length, 3);
});

test('ein geänderter Text rendert genau eine Datei neu', () => {
  const daten = poiDaten([storyPoi()]);
  const manifest = manifestAus(berechneAufgaben(daten, null, PROFIL, {}));

  const geaendert = poiDaten([storyPoi({ textShort: 'Ein völlig neuer Kurztext.' })]);
  const ergebnis = berechneAufgaben(geaendert, manifest, PROFIL, {});

  assert.equal(ergebnis.zuRendern.length, 1);
  assert.equal(ergebnis.zuRendern[0].pfad, 'audio/tag1-deutsches-eck-kurz.mp3');
  assert.equal(ergebnis.unveraendert.length, 2);
});

test('eine geänderte Stimme rendert den gesamten Bestand neu', () => {
  const daten = poiDaten([storyPoi()]);
  const manifest = manifestAus(berechneAufgaben(daten, null, PROFIL, {}));

  const ergebnis = berechneAufgaben(daten, manifest, { ...PROFIL, stimme: 'Sandy' }, {});
  assert.equal(ergebnis.zuRendern.length, 3);
  assert.deepEqual(ergebnis.unveraendert, []);
});

test('eine geänderte Bitrate rendert den gesamten Bestand neu', () => {
  const daten = poiDaten([storyPoi()]);
  const manifest = manifestAus(berechneAufgaben(daten, null, PROFIL, {}));

  const ergebnis = berechneAufgaben(daten, manifest, { ...PROFIL, bitrate: 64 }, {});
  assert.equal(ergebnis.zuRendern.length, 3);
});

test('eine geänderte Aussprachetabelle rendert die betroffene Datei neu', () => {
  const daten = poiDaten([storyPoi({ textShort: 'Weiter nach Cochem.' })]);
  const manifest = manifestAus(berechneAufgaben(daten, null, PROFIL, {}));

  const ergebnis = berechneAufgaben(daten, manifest, PROFIL, { Cochem: 'Kochem' });
  assert.equal(ergebnis.zuRendern.length, 1);
  assert.equal(ergebnis.zuRendern[0].pfad, 'audio/tag1-deutsches-eck-kurz.mp3');
});

test('der übergebene Text ist bereits aussprachekorrigiert', () => {
  const daten = poiDaten([storyPoi({ textShort: 'Weiter nach Cochem.' })]);
  const ergebnis = berechneAufgaben(daten, null, PROFIL, { Cochem: 'Kochem' });
  const kurz = ergebnis.zuRendern.find((a) => a.variante === 'kurz');
  assert.equal(kurz.text, 'Weiter nach Kochem.');
});

test('ein service-POI erzeugt gar keinen Eintrag', () => {
  const service = { id: 'tag1-rastplatz', day: 1, name: 'Schutzhütte', kind: 'service' };
  const ergebnis = berechneAufgaben(poiDaten([service]), null, PROFIL, {});
  assert.equal(ergebnis.zuRendern.length, 1, 'nur das Briefing');
  assert.equal(ergebnis.zuRendern[0].variante, 'briefing');
});

test('ein entfernter POI hinterlässt verwaiste Dateien', () => {
  const manifest = manifestAus(berechneAufgaben(poiDaten([storyPoi()]), null, PROFIL, {}));
  const ergebnis = berechneAufgaben(poiDaten([]), manifest, PROFIL, {});
  assert.deepEqual(ergebnis.verwaist.sort(), [
    'audio/tag1-deutsches-eck-kurz.mp3',
    'audio/tag1-deutsches-eck-lang.mp3'
  ]);
});

test('ein neuer POI wird zusätzlich gerendert', () => {
  const manifest = manifestAus(berechneAufgaben(poiDaten([storyPoi()]), null, PROFIL, {}));
  const neuer = storyPoi({ id: 'tag1-burg-metternich', name: 'Burg Metternich' });
  const ergebnis = berechneAufgaben(poiDaten([storyPoi(), neuer]), manifest, PROFIL, {});
  assert.equal(ergebnis.zuRendern.length, 2);
  assert.equal(ergebnis.unveraendert.length, 3);
});

test('ein story-POI ohne Langtext wird abgelehnt', () => {
  const daten = poiDaten([storyPoi({ textLong: '' })]);
  assert.throws(() => berechneAufgaben(daten, null, PROFIL, {}), /textLong/);
});

test('ein fehlender Briefing-Text wird abgelehnt', () => {
  const daten = poiDaten([storyPoi()], '');
  assert.throws(() => berechneAufgaben(daten, null, PROFIL, {}), /Briefing/);
});

test('ein unbekanntes kind wird abgelehnt', () => {
  const daten = poiDaten([storyPoi({ kind: 'sonstiges' })]);
  assert.throws(() => berechneAufgaben(daten, null, PROFIL, {}), /kind/);
});

test('der Hash ändert sich mit dem Text', () => {
  assert.notEqual(textHash('Eins', PROFIL), textHash('Zwei', PROFIL));
});

test('der Hash ändert sich mit dem Profil', () => {
  assert.notEqual(textHash('Eins', PROFIL), textHash('Eins', { ...PROFIL, rate: 200 }));
});

test('gleicher Text und gleiches Profil ergeben denselben Hash', () => {
  assert.equal(textHash('Eins', PROFIL), textHash('Eins', { ...PROFIL }));
});

test('das Manifest summiert Anzahl, Größe und Dauer', () => {
  const manifest = baueManifest(PROFIL, [
    { pfad: 'audio/b.mp3', poiId: 'tag1-b', variante: 'kurz', hash: 'x', dauerSek: 10.5, groesseBytes: 1000 },
    { pfad: 'audio/a.mp3', poiId: 'tag1-a', variante: 'kurz', hash: 'y', dauerSek: 4.5, groesseBytes: 2000 }
  ]);
  assert.equal(manifest.summe.anzahl, 2);
  assert.equal(manifest.summe.gesamtBytes, 3000);
  assert.equal(manifest.summe.gesamtDauerSek, 15);
  assert.deepEqual(manifest.profil, PROFIL);
});

test('das Manifest sortiert die Dateien nach Pfad', () => {
  const manifest = baueManifest(PROFIL, [
    { pfad: 'audio/b.mp3', poiId: 'tag1-b', variante: 'kurz', hash: 'x', dauerSek: 1, groesseBytes: 1 },
    { pfad: 'audio/a.mp3', poiId: 'tag1-a', variante: 'kurz', hash: 'y', dauerSek: 1, groesseBytes: 1 }
  ]);
  assert.deepEqual(manifest.dateien.map((d) => d.pfad), ['audio/a.mp3', 'audio/b.mp3']);
});

test('das Manifest trägt einen ISO-8601-Zeitstempel', () => {
  const manifest = baueManifest(PROFIL, []);
  assert.match(manifest.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});
```

Die Sortierung im Manifest ist kein Selbstzweck: Ohne sie erzeugt jeder Lauf eine andere Reihenfolge, und jeder Commit zeigt einen unlesbaren Diff.

- [ ] **Step 2: Test ausführen und Fehlschlag bestätigen**

Run: `node --test test/audioPlan.test.js`
Expected: FAIL mit `Cannot find module '../scripts/lib/audioPlan.js'`

- [ ] **Step 3: Modul implementieren**

`scripts/lib/audioPlan.js`:

```javascript
import { createHash } from 'node:crypto';
import { wendeAusspracheAn } from './aussprache.js';
import { dateiname } from './audioNamen.js';

/**
 * Hash über den fertig aufbereiteten Text und das vollständige Sprachprofil.
 * Dass das Profil eingeht, ist Absicht: Ein Wechsel von Stimme, Geschwindigkeit
 * oder Bitrate macht jede vorhandene Datei ungültig, ohne dass jemand daran
 * denken muss.
 */
export function textHash(text, profil) {
  const inhalt = JSON.stringify({
    text,
    stimme: profil.stimme,
    rate: profil.rate,
    bitrate: profil.bitrate,
    abtastrate: profil.abtastrate
  });
  return createHash('sha256').update(inhalt, 'utf8').digest('hex');
}

function baueAufgabe(id, variante, rohText, tabelle, profil) {
  const text = wendeAusspracheAn(rohText, tabelle);
  return { id, variante, pfad: dateiname(id, variante), text, hash: textHash(text, profil) };
}

/** Alle Audiodateien, die es laut pois.json geben muss. Wirft bei unvollständigen Daten. */
function sollBestand(pois, tabelle, profil) {
  const aufgaben = [];

  for (const tag of pois.days ?? []) {
    const briefingText = tag.briefing?.text?.trim();
    if (!briefingText) {
      throw new Error(`Tag ${tag.day}: Briefing-Text fehlt — ohne ihn entsteht kein Briefing-Audio.`);
    }
    aufgaben.push(baueAufgabe(`tag${tag.day}`, 'briefing', briefingText, tabelle, profil));

    for (const poi of tag.pois ?? []) {
      if (poi.kind === 'service') continue;
      if (poi.kind !== 'story') {
        throw new Error(`POI ${poi.id}: unbekanntes kind "${poi.kind}". Erlaubt: story, service.`);
      }

      for (const [variante, feld] of [['kurz', 'textShort'], ['lang', 'textLong']]) {
        const text = poi[feld]?.trim();
        if (!text) {
          throw new Error(`POI ${poi.id}: ${feld} fehlt, obwohl kind "story" ist.`);
        }
        aufgaben.push(baueAufgabe(poi.id, variante, text, tabelle, profil));
      }
    }
  }

  return aufgaben;
}

export function berechneAufgaben(pois, manifest, profil, tabelle = {}) {
  const soll = sollBestand(pois, tabelle, profil);
  const ist = new Map((manifest?.dateien ?? []).map((eintrag) => [eintrag.pfad, eintrag]));

  const zuRendern = [];
  const unveraendert = [];

  for (const aufgabe of soll) {
    const vorhanden = ist.get(aufgabe.pfad);
    if (vorhanden && vorhanden.hash === aufgabe.hash) {
      unveraendert.push(vorhanden);
    } else {
      zuRendern.push(aufgabe);
    }
  }

  const sollPfade = new Set(soll.map((a) => a.pfad));
  const verwaist = [...ist.keys()].filter((pfad) => !sollPfade.has(pfad));

  return { zuRendern, unveraendert, verwaist };
}

export function baueManifest(profil, eintraege) {
  // Feste Sortierung, damit aufeinanderfolgende Läufe lesbare Diffs erzeugen.
  const dateien = [...eintraege].sort((a, b) => a.pfad.localeCompare(b.pfad, 'de'));

  return {
    generatedAt: new Date().toISOString(),
    profil,
    dateien,
    summe: {
      anzahl: dateien.length,
      gesamtBytes: dateien.reduce((summe, d) => summe + d.groesseBytes, 0),
      gesamtDauerSek: Number(dateien.reduce((summe, d) => summe + d.dauerSek, 0).toFixed(1))
    }
  };
}
```

- [ ] **Step 4: Tests ausführen**

Run: `node --test test/audioPlan.test.js`
Expected: PASS, 18 Tests

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/audioPlan.js test/audioPlan.test.js
git commit -m "feat: Planungsmodul mit hashbasierter Änderungserkennung"
```

---

### Task 5: TTS-Modul

**Files:**
- Create: `scripts/lib/tts.js`
- Test: `test/tts.test.js`

**Interfaces:**
- Consumes: `node:child_process`, `node:fs`, `node:os`, `node:path`
- Produces:
  - `verfuegbareStimmen()` → `string[]` (Namen der deutschen Stimmen)
  - `pruefeWerkzeuge(profil)` → `void`, wirft bei fehlendem Werkzeug oder fehlender Stimme
  - `rendereSprache(text, { stimme, rate, bitrate, abtastrate, ziel })` → `{ pfad, dauerSek, groesseBytes }`
  - `ziel` ist ein absoluter Pfad

Dies ist das einzige Modul mit Seiteneffekten. Alles, was mit der Außenwelt spricht, steht hier — und nur hier wäre bei einem späteren Wechsel des TTS-Dienstes etwas zu ändern.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

Hintergrund: Dieser Test rendert tatsächlich Audio und braucht daher ein bis zwei Sekunden. Deshalb genau einer — die eigentliche Logik ist in den Tasks 2 bis 4 bereits ohne Audio geprüft. Er legt seine Dateien in einem temporären Verzeichnis an, nicht in `audio/`.

`test/tts.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verfuegbareStimmen, pruefeWerkzeuge, rendereSprache } from '../scripts/lib/tts.js';

test('findet deutsche Stimmen', () => {
  const stimmen = verfuegbareStimmen();
  assert.ok(stimmen.length > 0, 'keine deutsche Stimme gefunden');
  assert.ok(stimmen.includes('Anna'), `Anna fehlt, gefunden: ${stimmen.join(', ')}`);
});

test('weist eine nicht installierte Stimme zurück', () => {
  assert.throws(
    () => pruefeWerkzeuge({ stimme: 'Rumpelstilzchen' }),
    /Rumpelstilzchen/
  );
});

test('rendert einen kurzen Satz in eine abspielbare Datei', () => {
  const verzeichnis = fs.mkdtempSync(path.join(os.tmpdir(), 'ahrtal-test-'));
  const ziel = path.join(verzeichnis, 'probe.mp3');

  try {
    const ergebnis = rendereSprache('Guten Morgen. Heute geht es nach Cochem.', {
      stimme: 'Anna',
      rate: 180,
      bitrate: 32,
      abtastrate: 22050,
      ziel
    });

    assert.equal(ergebnis.pfad, ziel);
    assert.ok(fs.existsSync(ziel), 'Zieldatei fehlt');
    assert.ok(ergebnis.dauerSek > 0.5, `unplausible Dauer: ${ergebnis.dauerSek}`);
    assert.ok(ergebnis.groesseBytes > 1000, `unplausible Größe: ${ergebnis.groesseBytes}`);
    assert.equal(ergebnis.groesseBytes, fs.statSync(ziel).size);
  } finally {
    fs.rmSync(verzeichnis, { recursive: true, force: true });
  }
});

test('hinterlässt bei einem Fehlschlag keine halbe Datei', () => {
  const verzeichnis = fs.mkdtempSync(path.join(os.tmpdir(), 'ahrtal-test-'));
  const ziel = path.join(verzeichnis, 'probe.mp3');

  try {
    assert.throws(() =>
      rendereSprache('Text', {
        stimme: 'Rumpelstilzchen',
        rate: 180,
        bitrate: 32,
        abtastrate: 22050,
        ziel
      })
    );
    assert.ok(!fs.existsSync(ziel), 'trotz Fehlschlag ist eine Datei entstanden');
    assert.ok(!fs.existsSync(`${ziel}.tmp`), 'temporäre Datei wurde nicht aufgeräumt');
  } finally {
    fs.rmSync(verzeichnis, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Test ausführen und Fehlschlag bestätigen**

Run: `node --test test/tts.test.js`
Expected: FAIL mit `Cannot find module '../scripts/lib/tts.js'`

- [ ] **Step 3: Modul implementieren**

`scripts/lib/tts.js`:

```javascript
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Führt ein Kommando aus und wirft mit lesbarer Meldung statt mit rohem Fehlerobjekt. */
function fuehreAus(kommando, argumente) {
  try {
    return execFileSync(kommando, argumente, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (fehler) {
    const details = String(fehler.stderr ?? '').trim() || fehler.message;
    throw new Error(`Aufruf fehlgeschlagen: ${kommando} ${argumente.join(' ')}\n${details}`);
  }
}

/**
 * Namen der installierten deutschen Stimmen.
 *
 * Die Ausgabe von `say -v ?` trennt Name und Sprachkürzel je nach Stimme durch
 * ein oder mehrere Leerzeichen — "Anna" steht in einer ausgerichteten Spalte,
 * "Eddy (Deutsch (Deutschland))" nicht. Das Muster fängt beides ab.
 */
export function verfuegbareStimmen() {
  return fuehreAus('say', ['-v', '?'])
    .split('\n')
    .map((zeile) => zeile.match(/^(.+?)\s+de_DE\s+#/))
    .filter(Boolean)
    .map((treffer) => treffer[1].trim());
}

/** Prüft vorab alles, was fehlen könnte — bevor die erste Datei entsteht. */
export function pruefeWerkzeuge(profil) {
  for (const werkzeug of ['say', 'ffmpeg', 'ffprobe']) {
    try {
      fuehreAus('which', [werkzeug]);
    } catch {
      throw new Error(`"${werkzeug}" ist nicht installiert. Ohne dieses Werkzeug entsteht kein Audio.`);
    }
  }

  const stimmen = verfuegbareStimmen();
  if (!stimmen.includes(profil.stimme)) {
    throw new Error(
      `Die Stimme "${profil.stimme}" ist nicht installiert. Verfügbar: ${stimmen.join(', ')}`
    );
  }
}

/**
 * Rendert einen Text nach MP3.
 *
 * Der Text geht über eine Datei an `say`, nicht als Argument: Das ist unempfindlich
 * gegen Sonderzeichen und gegen die Längengrenze der Kommandozeile.
 *
 * Die Zieldatei entsteht unter `<ziel>.tmp` und wird erst nach erfolgreicher
 * Konvertierung umbenannt. Ein Abbruch hinterlässt damit nie eine halbe MP3-Datei,
 * die beim nächsten Lauf für fertig gehalten würde.
 */
export function rendereSprache(text, { stimme, rate, bitrate, abtastrate, ziel }) {
  const arbeitsverzeichnis = fs.mkdtempSync(path.join(os.tmpdir(), 'ahrtal-tts-'));
  const textDatei = path.join(arbeitsverzeichnis, 'text.txt');
  const aiffDatei = path.join(arbeitsverzeichnis, 'sprache.aiff');
  const tempZiel = `${ziel}.tmp`;

  try {
    fs.writeFileSync(textDatei, text, 'utf8');
    fs.mkdirSync(path.dirname(ziel), { recursive: true });

    fuehreAus('say', ['-v', stimme, '-r', String(rate), '-f', textDatei, '-o', aiffDatei]);

    fuehreAus('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-i', aiffDatei,
      '-ac', '1',
      '-ar', String(abtastrate),
      '-codec:a', 'libmp3lame',
      '-b:a', `${bitrate}k`,
      tempZiel
    ]);

    const rohDauer = fuehreAus('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      tempZiel
    ]).trim();

    const dauerSek = Number(rohDauer);
    if (!Number.isFinite(dauerSek) || dauerSek <= 0) {
      throw new Error(`Die erzeugte Datei ${ziel} hat keine messbare Dauer (ffprobe: "${rohDauer}").`);
    }

    fs.renameSync(tempZiel, ziel);

    return {
      pfad: ziel,
      dauerSek: Number(dauerSek.toFixed(1)),
      groesseBytes: fs.statSync(ziel).size
    };
  } finally {
    fs.rmSync(arbeitsverzeichnis, { recursive: true, force: true });
    fs.rmSync(tempZiel, { force: true });
  }
}
```

- [ ] **Step 4: Tests ausführen**

Run: `node --test test/tts.test.js`
Expected: PASS, 4 Tests. Der Lauf dauert ein bis zwei Sekunden — das ist der eine Test, der wirklich rendert.

- [ ] **Step 5: Gesamten Testlauf prüfen**

Run: `npm test`
Expected: PASS. Alle Tests dieses Plans **und** die der Datenpipeline laufen zusammen durch.

Schlägt hier etwas fehl, das nicht zu diesem Plan gehört, ist es eine Baustelle der anderen Session — nicht anfassen, sondern melden.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/tts.js test/tts.test.js
git commit -m "feat: TTS-Modul mit Werkzeugprüfung und atomarem Schreiben"
```

---

### Task 6: Das CLI

**Files:**
- Create: `scripts/build-audio.js`

**Interfaces:**
- Consumes: `berechneAufgaben`, `baueManifest` aus `scripts/lib/audioPlan.js`; `pruefeWerkzeuge`, `rendereSprache` aus `scripts/lib/tts.js`
- Produces: `audio/*.mp3` und `data/audio-manifest.json`
- Flags: `--nur-planen` (rendert nichts, zeigt nur die Zahlen), `--aufraeumen` (löscht verwaiste Dateien)

- [ ] **Step 1: CLI schreiben**

`scripts/build-audio.js`:

```javascript
#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { berechneAufgaben, baueManifest } from './lib/audioPlan.js';
import { pruefeWerkzeuge, rendereSprache } from './lib/tts.js';

const WURZEL = path.resolve(import.meta.dirname, '..');
const PFADE = {
  pois: path.join(WURZEL, 'data', 'pois.json'),
  aussprache: path.join(WURZEL, 'data', 'aussprache.json'),
  profil: path.join(WURZEL, 'data', 'audio-profil.json'),
  manifest: path.join(WURZEL, 'data', 'audio-manifest.json')
};

const flags = new Set(process.argv.slice(2));
const nurPlanen = flags.has('--nur-planen');
const aufraeumen = flags.has('--aufraeumen');

function leseJson(pfad, standard) {
  if (!fs.existsSync(pfad)) {
    if (standard === undefined) {
      throw new Error(`${path.relative(WURZEL, pfad)} fehlt.`);
    }
    return standard;
  }
  return JSON.parse(fs.readFileSync(pfad, 'utf8'));
}

function schreibeManifest(profil, eintraege) {
  const manifest = baueManifest(profil, eintraege);
  fs.writeFileSync(PFADE.manifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

function megabyte(bytes) {
  return (bytes / 1024 / 1024).toFixed(1);
}

const profil = leseJson(PFADE.profil);
const pois = leseJson(PFADE.pois);
const tabelle = leseJson(PFADE.aussprache, {});
const altesManifest = leseJson(PFADE.manifest, null);

// Erst prüfen, dann arbeiten: ein fehlendes Werkzeug soll nicht nach
// vierzig Minuten auffallen.
pruefeWerkzeuge(profil);

const { zuRendern, unveraendert, verwaist } = berechneAufgaben(pois, altesManifest, profil, tabelle);

console.log(`Stimme ${profil.stimme}, Rate ${profil.rate}, ${profil.bitrate} kbit/s`);
console.log(`${zuRendern.length} zu rendern, ${unveraendert.length} unverändert, ${verwaist.length} verwaist\n`);

if (nurPlanen) {
  for (const aufgabe of zuRendern) console.log(`  neu:      ${aufgabe.pfad}`);
  for (const pfad of verwaist) console.log(`  verwaist: ${pfad}`);
  process.exit(0);
}

const eintraege = [...unveraendert];
let nummer = 0;

for (const aufgabe of zuRendern) {
  nummer += 1;
  process.stdout.write(`[${nummer}/${zuRendern.length}] ${aufgabe.pfad} … `);

  const { dauerSek, groesseBytes } = rendereSprache(aufgabe.text, {
    ...profil,
    ziel: path.join(WURZEL, aufgabe.pfad)
  });

  eintraege.push({
    pfad: aufgabe.pfad,
    poiId: aufgabe.id,
    variante: aufgabe.variante,
    hash: aufgabe.hash,
    dauerSek,
    groesseBytes
  });

  // Nach jeder fertigen Datei schreiben: Ein Abbruch nach 150 von 200 Dateien
  // kostet dann nur die 50 verbleibenden.
  schreibeManifest(profil, eintraege);

  console.log(`${dauerSek} s, ${(groesseBytes / 1024).toFixed(0)} kB`);
}

if (verwaist.length > 0) {
  console.log('');
  for (const pfad of verwaist) {
    const vollerPfad = path.join(WURZEL, pfad);
    if (aufraeumen) {
      fs.rmSync(vollerPfad, { force: true });
      console.log(`gelöscht: ${pfad}`);
    } else {
      console.log(`verwaist: ${pfad}  (mit --aufraeumen löschen)`);
    }
  }
}

const manifest = schreibeManifest(profil, eintraege);
const minuten = Math.round(manifest.summe.gesamtDauerSek / 60);

console.log(
  `\n${manifest.summe.anzahl} Dateien, ${megabyte(manifest.summe.gesamtBytes)} MB, ${minuten} Minuten Sprechzeit.`
);
```

- [ ] **Step 2: Gegen fehlende Daten prüfen**

Solange die Datenpipeline `data/pois.json` noch nicht erzeugt hat, muss das CLI sauber scheitern statt mit einem Stapelauszug abzustürzen.

Run: `npm run build:audio`
Expected: entweder `data/pois.json fehlt.` — oder, falls die andere Session die Datei bereits angelegt hat, ein regulärer Planungslauf.

- [ ] **Step 3: Gegen erfundene Daten prüfen**

Ein Probelauf mit einem Miniaturdatensatz zeigt, dass die Kette vollständig funktioniert, ohne auf die Datenpipeline zu warten:

```bash
mkdir -p /tmp/ahrtal-probe
cat > /tmp/ahrtal-probe/pois.json <<'JSON'
{
  "days": [
    {
      "day": 9,
      "briefing": { "text": "Guten Morgen. Dies ist ein Probelauf." },
      "pois": [
        {
          "id": "tag9-probe",
          "day": 9,
          "name": "Probepunkt",
          "kind": "story",
          "textShort": "Ein kurzer Probetext für die Vorbeifahrt.",
          "textLong": "Ein längerer Probetext, der die Langfassung nachbildet und etwas mehr erzählt."
        }
      ]
    }
  ]
}
JSON
node -e "
import('./scripts/lib/audioPlan.js').then(async ({ berechneAufgaben }) => {
  const fs = await import('node:fs');
  const pois = JSON.parse(fs.readFileSync('/tmp/ahrtal-probe/pois.json', 'utf8'));
  const profil = JSON.parse(fs.readFileSync('./data/audio-profil.json', 'utf8'));
  const tabelle = JSON.parse(fs.readFileSync('./data/aussprache.json', 'utf8'));
  const e = berechneAufgaben(pois, null, profil, tabelle);
  console.log('zu rendern:', e.zuRendern.map(a => a.pfad).join(', '));
});
"
```

Expected: drei Pfade — `audio/tag9-briefing.mp3`, `audio/tag9-probe-kurz.mp3`, `audio/tag9-probe-lang.mp3`.

Anschließend aufräumen: `rm -rf /tmp/ahrtal-probe`

- [ ] **Step 4: Commit**

```bash
git add scripts/build-audio.js
git commit -m "feat: CLI zur inkrementellen Audio-Erzeugung"
```

---

### Task 7: Erstlauf über die echten Daten

**Voraussetzung:** Die Datenpipeline ist bis einschließlich ihrer Task 16 fertig — `data/pois.json` enthält alle sechs Tage mit recherchierten Texten und gefüllten Briefings. Ist das nicht der Fall, wartet diese Task.

**Files:**
- Modify: `data/aussprache.json`
- Create: `data/audio-manifest.json` (erzeugt)
- Create: `audio/*.mp3` (erzeugt)

**Interfaces:**
- Consumes: `data/pois.json` aus der Datenpipeline, alle Module der Tasks 2 bis 6
- Produces: vollständiger Audiobestand und Manifest

- [ ] **Step 1: Trockenlauf**

Run: `npm run build:audio -- --nur-planen`
Expected: Zwischen 126 und 206 Dateien zu rendern (60 bis 100 `story`-POIs mal zwei, plus sechs Briefings), null verwaist.

Liegt die Zahl außerhalb dieser Spanne, stimmt etwas mit `pois.json` nicht — nicht rendern, sondern klären.

- [ ] **Step 2: Vollständigen Lauf ausführen**

Run: `npm run build:audio`
Expected: eine Zeile je Datei, am Ende eine Summenzeile. Bei 32 kbit/s sollte die Gesamtgröße zwischen 25 und 45 MB liegen.

Liegt sie deutlich darüber, war die Bitrate-Entscheidung aus Task 1 zu großzügig — dann `data/audio-profil.json` anpassen und erneut laufen lassen. Der Bestand wird dann vollständig neu gerendert, weil die Bitrate in den Hash eingeht.

- [ ] **Step 3: Alle sechs Briefings anhören**

```bash
afplay audio/tag1-briefing.mp3
```

und entsprechend für Tag 2 bis 6.

Worauf zu achten ist: Zahlen und Steigungsangaben („4,5 Prozent"), Ortsnamen, und ob der Text als gesprochener Satz trägt. Jede falsch ausgesprochene Stelle kommt in `data/aussprache.json`.

- [ ] **Step 4: Stichprobe der POI-Texte anhören**

Mindestens zehn Langfassungen, verteilt über alle sechs Tage — bevorzugt die mit auffälligen Eigennamen: Hochmoselübergang, Traben-Trarbach, Reichsburg Cochem, Winninger Uhlen, Burg Thurant, Kobern-Gondorf.

```bash
ls audio/*-lang.mp3 | head -40
afplay audio/<datei>.mp3
```

Alles Auffällige nach `data/aussprache.json`.

- [ ] **Step 5: Korrekturlauf**

Run: `npm run build:audio`
Expected: Es werden **nur** die Dateien neu gerendert, deren Text von einem neuen Aussprache-Eintrag betroffen ist. Rendert das Skript alles neu, wurde versehentlich `data/audio-profil.json` verändert.

Schritte 3 bis 5 wiederholen, bis nichts mehr stört.

- [ ] **Step 6: Commit**

Das Audio selbst wird noch nicht eingecheckt — das ist Task 8.

```bash
git add data/aussprache.json data/audio-manifest.json
git commit -m "feat: Audiobestand erzeugt, Aussprachetabelle nach dem Abhören ergänzt"
```

---

### Task 8: Audio einchecken und abschließen

**Files:**
- Modify: `.gitignore`
- Modify: `README.md`
- Add: `audio/*.mp3`

**Interfaces:**
- Consumes: alles Vorherige
- Produces: versionierter, dokumentierter Audiobestand

- [ ] **Step 1: Größe prüfen**

```bash
du -sh audio
ls audio/*.mp3 | wc -l
node -e "
import('node:fs').then((fs) => {
  const m = JSON.parse(fs.readFileSync('./data/audio-manifest.json', 'utf8'));
  console.log('Manifest:', m.summe.anzahl, 'Dateien,', (m.summe.gesamtBytes/1024/1024).toFixed(1), 'MB');
});
"
```

Expected: Die Dateizahl auf der Platte stimmt mit `summe.anzahl` überein. Weichen sie ab, liegen verwaiste Dateien herum — dann `npm run build:audio -- --aufraeumen` und erneut prüfen.

Liegt die Größe über 60 MB, vor dem Einchecken innehalten: Das ist mehr, als die Spec vorsieht, und Binärdaten lassen sich aus der Git-Historie nicht mehr entfernen.

- [ ] **Step 2: `.gitignore` anpassen**

Die Zeile `audio/` entfernen. `audio-proben/` bleibt stehen — Hörproben gehören nicht ins Repository.

- [ ] **Step 3: Audio einchecken**

```bash
git add audio/
git commit -m "feat: erzeugte Sprachdateien für alle sechs Etappen"
```

- [ ] **Step 4: README ergänzen**

An das bestehende `README.md` anfügen — es entsteht in Task 17 der Datenpipeline, deshalb hier anfügen statt neu schreiben:

````markdown
## Audio-Erzeugung

`data/audio-profil.json` legt Stimme, Sprechgeschwindigkeit und Bitrate fest. Alle vier Werte gehen
in den Datei-Hash ein: Wird einer geändert, rendert der nächste Lauf den gesamten Bestand neu.

`data/aussprache.json` bildet Schreibweise auf Sprechweise ab, etwa `"Cochem": "Kochem"`. Die
Ersetzung wirkt nur auf den gesprochenen Text; die Anzeige in der App bleibt unverändert.

```bash
npm run proben:stimmen                 # Hörproben aller deutschen Stimmen
npm run proben:stimmen -- "Anna"       # Geschwindigkeiten und Bitraten einer Stimme
npm run build:audio -- --nur-planen    # zeigt, was gerendert würde
npm run build:audio                    # rendert, was sich geändert hat
npm run build:audio -- --aufraeumen    # löscht zusätzlich verwaiste Dateien
```

`data/audio-manifest.json` führt je Datei Pfad, Text-Hash, Dauer und Größe sowie die Summen über
den gesamten Bestand. Der Service Worker nutzt es später für Precache und Fortschrittsanzeige.

Die Erzeugung setzt macOS voraus (`say`) sowie `ffmpeg` und `ffprobe`. Die fertigen MP3-Dateien
sind eingecheckt, damit ein Build auch ohne diese Werkzeuge auskommt.
````

- [ ] **Step 5: Abschlussprüfung**

```bash
npm test
npm run build:audio -- --nur-planen
git status --short
```

Expected: alle Tests grün; null zu rendern, null verwaist; ein sauberes Arbeitsverzeichnis.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: README um die Audio-Erzeugung ergänzt"
```

---

## Was dieser Plan nicht enthält

Bewusst dem dritten Plan überlassen:

- Umbau der PWA (Datenmodul, Audio-Player mit MediaSession, GPS-Auslösung, Kartenansicht, Oberfläche)
- Service Worker mit Versionierung und Vorab-Download samt Fortschrittsanzeige
- Deployment über die vorhandenen Docker- und k8s-Dateien

Grundlage dafür sind `audio/*.mp3` und `data/audio-manifest.json`, die dieser Plan liefert. Die
Felder `audioShort`, `audioLong` und `briefing.audio` in `pois.json` bleiben ungenutzt: Die Pfade
leiten sich fest aus der POI-ID ab und stehen im Manifest.
