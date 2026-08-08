# Audio-Erzeugung (Baustein 3) — Design

**Datum:** 2026-08-08
**Status:** Freigegeben, bereit für Implementierungsplanung
**Grundlage:** [Audio-Reiseführer Ahrtal & Eifel — Design](2026-08-08-audio-reisefuehrer-design.md), Baustein 3

## Ziel

Aus den recherchierten POI-Texten und Tages-Briefings in `data/pois.json` abspielbare MP3-Dateien
erzeugen — mit dem lokal verfügbaren macOS-TTS, ohne Cloud, ohne Kosten. Textkorrekturen sollen nur
die betroffenen Dateien neu erzeugen, nicht den gesamten Bestand.

## Einordnung

Der Plan [Datenpipeline](../plans/2026-08-08-datenpipeline.md) erzeugt `data/tour.json` und
`data/pois.json`. Er lagert die Audio-Erzeugung ausdrücklich in einen zweiten Plan aus. Diese Spec
beschreibt diesen zweiten Plan.

Die Schnittstelle ist das POI-Schema, das der erste Plan in Task 8 festlegt und in Task 16 um die
Briefing-Texte ergänzt. Es steht damit bereits fest, obwohl die Inhalte noch entstehen. Deshalb ist
diese Spec schreibbar, während die Datenpipeline noch implementiert wird.

## Ausgangslage

Auf dem Zielrechner geprüft und vorhanden:

- **Deutsche Stimmen:** `Anna` sowie `Eddy`, `Flo`, `Grandma`, `Grandpa`, `Reed`, `Rocko`, `Sandy`,
  `Shelley` (alle `de_DE`). Keine Premium-Varianten installiert.
- **Konverter:** `ffmpeg`, `lame` und `afconvert` sind alle verfügbar.

**Umfang.** Die Datenpipeline erwartet 60 bis 100 `story`-POIs. Je POI entstehen zwei Dateien, dazu
sechs Briefings — also 126 bis 206 MP3-Dateien.

## Entwurfsentscheidungen

| Entscheidung | Gewählt | Begründung |
|---|---|---|
| Stimmenwahl | Hörprobe vor der Massenerzeugung | Neun Stimmen stehen zur Wahl; die Spec des Gesamtsystems nennt die TTS-Qualität als bekannte Schwachstelle. Ein Vergleich vorab kostet Minuten und verhindert, dass der gesamte Bestand mit der falschen Stimme entsteht. |
| Aussprachekorrektur | Gepflegte Tabelle `data/aussprache.json` | Die Texte werden in der App auch angezeigt. Aussprachegerechte Schreibweise direkt im Text würde die Anzeige verunstalten. Die Tabelle hält Korrekturen dauerhaft fest, statt sie bei jeder Neuerzeugung zu verlieren. |
| Audio-Metadaten | Eigene Datei `data/audio-manifest.json` | `pois.json` wird nur gelesen, nie geschrieben — keine Kollision mit der Datenpipeline. Zudem braucht der Service Worker für den geforderten Vorab-Download-Fortschritt ohnehin eine Dateiliste mit Größen, und die gehört nicht in `pois.json`. |
| Auslieferung | MP3-Dateien werden eingecheckt | Jeder Build — auch außerhalb des Macs — hat den Ton dabei, und der ausgelieferte Stand ist versioniert. |
| Bitrate | 32 kbit/s, mono, 22,05 kHz | Bei 64 kbit/s entstünden rund 67 MB. Für gesprochene Sprache über einen Handylautsprecher am Lenker reichen 32 kbit/s; das ergibt rund 34 MB und bleibt im Rahmen der Gesamt-Spec (20–40 MB). Die Hörprobe prüft beide Bitraten im direkten Vergleich. |
| Modulzuschnitt | Reine Bibliotheksmodule plus ein CLI | Die Gesamt-Spec verlangt, dass Baustein 3 später gegen einen anderen TTS-Dienst tauschbar ist. Eine einzelne Funktionsgrenze leistet das; eine Provider-Architektur mit Registry löst ein Problem, das es nicht gibt. |

### Abweichung von der Datenpipeline

Der erste Plan setzt `audio/` in die `.gitignore` (Task 1, Step 2) mit der Begründung, die Dateien
seien reproduzierbar. Diese Spec nimmt den Eintrag wieder heraus. Das ist eine bewusste Abweichung,
kein Versehen: Reproduzierbar sind die Dateien nur auf einem Mac mit denselben installierten
Stimmen. Der Preis ist ein um rund 34 MB größeres Repository.

Ebenso lässt der erste Plan die Felder `audioShort`, `audioLong` und `briefing.audio` in `pois.json`
leer und kündigt an, sie im zweiten Plan zu füllen. Diese Spec füllt sie **nicht**. Die Pfade leiten
sich fest aus der POI-ID ab und stehen im Manifest; dieselbe Information an zwei Orten zu halten,
brächte nur die Gefahr, dass die Stände auseinanderlaufen. Die Felder bleiben ungenutzt.

## Architektur

```
data/pois.json ──────────┐
                         ├──▶ [Aufgabenplanung] ──▶ neu rendern / unverändert / verwaist
data/aussprache.json ────┤              ▲
                         │              │
data/audio-manifest.json ┘              │
                                        ▼
                     [TTS-Rendern] ── say ──▶ .aiff ── ffmpeg ──▶ audio/*.mp3
                                        │
                                        ▼
                          data/audio-manifest.json (neu geschrieben)
```

### Module

| Datei | Verantwortung |
|---|---|
| `scripts/lib/aussprache.js` | `wendeAusspracheAn(text, tabelle)` → `string` |
| `scripts/lib/audioNamen.js` | `dateiname(id, variante)` → `string` |
| `scripts/lib/audioPlan.js` | `berechneAufgaben(pois, manifest, profil)` → `{ zuRendern, unveraendert, verwaist }` |
| `scripts/lib/tts.js` | `rendereSprache(text, { stimme, rate, bitrate, ziel })` → `{ pfad, dauerSek, groesseBytes }` |
| `scripts/build-audio.js` | CLI: liest, plant, rendert, schreibt das Manifest |
| `scripts/proben-stimmen.js` | CLI: erzeugt Hörproben aller Stimmen für die Auswahl |

Die ersten drei Module sind frei von Seiteneffekten. Sämtliche Entscheidungen — welcher Dateiname,
ob neu gerendert werden muss, was verwaist ist — fallen dort und sind ohne einen einzigen
`say`-Aufruf testbar. `tts.js` ist der einzige Ort, der Prozesse startet und Dateien schreibt.

### Aussprachekorrektur

`data/aussprache.json` bildet Schreibweise auf Sprechweise ab:

```json
{
  "Cochem": "Kochem",
  "1689": "sechzehnhundertneunundachtzig"
}
```

Regeln der Ersetzung:

- Nur an Wortgrenzen. „Burg" ersetzt nichts in „Burgund".
- Längste Schlüssel zuerst, damit „Traben-Trarbach" greift, bevor „Traben" es tut.
- Die Ersetzung wirkt ausschließlich auf den Text, der an `say` geht. `pois.json` bleibt unberührt.

Die Tabelle wächst beim Abhören: Was falsch klingt, wird eingetragen, und der nächste Lauf rendert
genau die betroffenen Dateien neu.

### Dateinamen

`dateiname(id, variante)` bildet den Pfad aus zwei Bestandteilen. Als `id` dient bei POIs deren
`id` aus `pois.json`, bei Briefings die Zeichenkette `tag<N>`. Erlaubte Varianten sind `kurz`,
`lang` und `briefing`:

| `id` | `variante` | Ergebnis |
| --- | --- | --- |
| `tag1-deutsches-eck` | `kurz` | `audio/tag1-deutsches-eck-kurz.mp3` |
| `tag1-deutsches-eck` | `lang` | `audio/tag1-deutsches-eck-lang.mp3` |
| `tag1` | `briefing` | `audio/tag1-briefing.mp3` |

Da die IDs in `pois.json` bereits eindeutig sind, sind es die Dateinamen ebenfalls. Die App kann den
Pfad selbst bilden und muss ihn nicht nachschlagen. Ein POI dürfte allerdings nicht die ID `tag1`
tragen, sonst kollidierte er mit dem Briefing — die IDs der Datenpipeline folgen dem Muster
`tag<N>-<name>` und schließen das aus. `audioNamen.js` prüft es zusätzlich.

### Änderungserkennung

Je Datei hält das Manifest einen SHA-256-Hash über:

```
{ text nach Aussprache-Ersetzung, stimme, rate, bitrate }
```

Dass das Stimmprofil in den Hash eingeht, ist der entscheidende Punkt: Wechselt die Stimme nach dem
Probehören, rendert der nächste Lauf den gesamten Bestand neu, ohne dass jemand daran denken muss.
Eine Korrektur an einem einzelnen POI-Text erzeugt dagegen genau die betroffenen Dateien neu.

### Struktur von `data/audio-manifest.json`

```
generatedAt, profil: { stimme, rate, bitrate, abtastrate },
dateien: [ { pfad, poiId, variante, hash, dauerSek, groesseBytes } ],
summe: { anzahl, gesamtBytes, gesamtDauerSek }
```

`summe` und die Einzelgrößen sind das, was der Service Worker später für Precache und
Fortschrittsanzeige braucht.

## Fehlerverhalten

Leitsatz: nichts still überspringen. Ein Reiseführer, bei dem an Tag 4 drei POIs stumm bleiben,
fällt erst am Berg auf.

- **Werkzeugprüfung vorab.** Bevor die erste Datei entsteht, prüft das CLI, dass `say`, die gewählte
  Stimme, `ffmpeg` und `ffprobe` verfügbar sind. Fehlt etwas, bricht es sofort ab, statt nach
  40 Minuten mit halbem Ergebnis dazustehen.
- **`say` oder `ffmpeg` schlagen fehl** → Abbruch mit POI-ID und dem Kommando im Klartext.
- **`kind: "story"` ohne Text** → Fehler. Der Validator der Datenpipeline fängt das zwar ab, doch
  `build-audio.js` läuft auch auf Zwischenständen.
- **`kind: "service"`** → kein Audio, kein Fehler. Wird gezählt, nicht gemeldet.
- **Verwaiste Dateien** (POI umbenannt oder verworfen) werden gemeldet und nur mit `--aufraeumen`
  gelöscht. Da das Audio eingecheckt wird, verlangt der Abschlusslauf: keine verwaisten Dateien.
- **Abbruch mitten im Lauf** kostet nichts. Jede Datei entsteht temporär und wird erst nach
  erfolgreicher Konvertierung an ihren Platz verschoben; das Manifest wird nach jeder fertigen Datei
  geschrieben. Ein Abbruch nach 150 von 200 Dateien lässt beim nächsten Start 50 übrig.

## Testkonzept

Die drei reinen Module werden mit `node --test` geprüft, ohne einen einzigen `say`-Aufruf. Damit
bleibt die Suite bei Millisekunden.

Aufschlussreich sind vor allem die Fälle in `audioPlan.js`:

| Ausgangslage | Erwartung |
|---|---|
| Text unverändert | wird nicht gerendert |
| Text geändert | genau die betroffene Datei |
| Stimme oder Bitrate geändert | der gesamte Bestand |
| POI aus `pois.json` entfernt | erscheint unter `verwaist` |
| POI mit `kind: "service"` | erzeugt gar keinen Eintrag |
| neuer POI | wird gerendert |

Für `aussprache.js` sind die Wortgrenzen und die Reihenfolge nach Schlüssellänge zu prüfen, für
`audioNamen.js` die Eindeutigkeit über alle Varianten hinweg.

Dazu ein einziger Rauchtest, der tatsächlich einen kurzen Satz rendert und prüft, dass eine
abspielbare Datei mit Dauer größer null entsteht.

Was Tests nicht leisten: ob es gut klingt. Dafür sieht der Plan feste Abhör-Schritte vor.

## Zeitliche Zweiteilung

Der Implementierungsplan zerfällt in zwei Hälften — wichtig, weil die Datenpipeline parallel
entsteht:

**Sofort baubar** (braucht nur das Schema, nicht die Inhalte):

1. Hörprobe: alle neun Stimmen mit demselben Beispieltext, dazu 32 gegen 64 kbit/s. Ergebnis ist die
   Festlegung von Stimme, Sprechgeschwindigkeit und Bitrate.
2. `aussprache.js` mit Tests
3. `audioNamen.js` mit Tests
4. `audioPlan.js` mit Tests
5. `tts.js` mit Rauchtest
6. `build-audio.js` als CLI

**Wartet auf die fertige `data/pois.json`:**

7. Erstlauf über die echten Daten, vollständiges Abhören, Nachpflegen der Aussprachetabelle
8. `audio/` aus der `.gitignore` nehmen, Dateien einchecken, Abschlussprüfung

## Bekannte Grenzen

- **Klangqualität.** Auch die beste der neun Stimmen bleibt synthetisch. Sollte das unterwegs
  stören, ist `tts.js` die einzige Datei, die für einen anderen TTS-Dienst anzufassen wäre.
- **Repository-Größe.** Rund 34 MB Binärdaten, und jede spätere Textkorrektur legt eine neue
  Version daneben. Bei einem Projekt mit dieser Lebensdauer vertretbar.
- **Bindung an macOS.** `say` gibt es nur dort. Die Audio-Erzeugung läuft auf dem Mac, nirgends
  sonst — ein Grund mehr, die Ergebnisse einzuchecken.

## Nicht Teil dieser Spec

Umbau der PWA, Service Worker mit Versionierung und Vorab-Download, Deployment über Docker und k8s,
Cloud-TTS. Diese Spec liefert `audio/*.mp3` und `data/audio-manifest.json` — mehr nicht.
