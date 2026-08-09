# Anforderungen an den Audio-Plan

Zwei Befunde aus dem Abschlussreview der Datenpipeline (2026-08-09) betreffen nicht die
Pipeline selbst, sondern den nachfolgenden Plan zur Audio-Erzeugung
(`docs/superpowers/plans/2026-08-08-audio-erzeugung.md`). Sie sind hier festgehalten, damit sie
dort nicht neu entdeckt werden müssen.

## 1. Ansagen brauchen eine Warteschlange mit Mindestabstand

**Anforderung:** Der Audio-Plan muss die GPS-Auslösung über eine Warteschlange führen, nicht
über direkte Wiedergabe je POI. Diese Warteschlange muss zwei Regeln durchsetzen:

1. **Mindestabstand zwischen zwei Story-Ansagen: rund 300 Meter.** Bei Reisegeschwindigkeit
   entspricht das gut einer Minute Fahrt. Fällt ein POI in diese Sperrfrist, wird seine Ansage
   nach hinten geschoben oder — wenn sie inzwischen weit hinter dem Fahrer läge —
   verworfen. Sie darf nicht einfach entfallen, ohne dass die Oberfläche das anzeigt.
2. **Gleichzeitig fällige Texte werden nacheinander abgespielt, nie überlagert.** Zwei
   Tonspuren übereinander sind unterwegs vollständig unverständlich.

**Warum:** In `data/pois.json` überlappen sich die Auslöseradien von 15 POI-Paaren entlang der
Route, gezählt als `|routeKm_A − routeKm_B| < r_A + r_B` innerhalb desselben Tages. Die vier
engsten:

| Abstand entlang der Route | POI A (Radius) | POI B (Radius) |
|---|---|---|
| 0 m | `tag2-burg-are` (150 m) | `tag2-winzergenossenschaft-mayschoss-altenahr` (80 m) |
| 10 m | `tag1-rheinpromenade-neuwied` (80 m) | `tag1-schloss-neuwied` (150 m) |
| 50 m | `tag2-regierungsbunker-marienthal` (750 m) | `tag2-roemervilla-ahrweiler` (300 m) |
| 140 m | `tag1-schloss-arenfels` (300 m) | `tag1-rheinpromenade-bad-breisig` (80 m) |

Das erste Paar liegt auf demselben `routeKm` (15,80) — dort werden beide Auslöser garantiert im
selben Moment scharf. Bei den ersten drei Paaren liegen weniger als sechzig Meter dazwischen,
also bei Reisegeschwindigkeit weniger als zehn Sekunden.

**Was ausdrücklich nicht die Lösung ist:** die Radien in `data/pois.json` zu verkleinern. `lat`,
`lon`, `routeKm` und `triggerRadius` folgen einer vom Nutzer bestätigten Formel und wurden
deshalb nicht angefasst. Die Überlappung ist kein Datenfehler, sondern eine Eigenschaft einer
Route, auf der mehrere sehenswerte Dinge dicht beieinander liegen — Burg Are und die
Winzergenossenschaft *sind* nun einmal am selben Punkt. Das gehört im Abspielverhalten gelöst,
nicht in den Daten.

**Für die heutige App folgenlos:** `app.js` zeigt Text an und spricht nur auf Knopfdruck, nie
GPS-ausgelöst. Erst die Audio-Ausgabe macht die Überlappung hörbar.

**Vorarbeit ist geleistet:** `startWholeTour` in `app.js` spricht seit dem Abschlussreview eine
Äußerung je Station und startet die nächste im `onend` der vorigen, abgesichert über eine
Laufmarke, die jeden Stopp erkennt. Das ist genau die Kettenstruktur, auf der eine
Warteschlange mit Sperrfrist aufsetzen kann.

## 2. Nur `textShort` vertonen

**Anforderung:** Von den 153 Erzähl-POIs (`kind: "story"`) wird ausschließlich `textShort`
vertont. `textLong` bleibt Text.

**Warum:** `textLong` ist der Text für den Halt. Wer angehalten hat, kann lesen — im Fahren ist
er ohnehin zu lang, um ihn am Stück zu hören (120 bis 280 Wörter je POI). Die Vertonung nur der
Kurztexte halbiert Renderzeit und Download-Größe: **153 statt 306 Dateien.**

**Folge für das Schema:** Es genügt ein Audiofeld je Story-POI (`audioShort`) plus eines je
Tages-Briefing (`briefing.audio`). Ein `audioLong` wird nicht angelegt. Sollte sich das später
ändern, ist es eine additive Schemaerweiterung und kein Umbau.

**Nicht betroffen:** die sechs Tages-Briefings (`briefing.text`, 53 bis 75 Wörter). Die werden
vertont — sie sind der Text, den man vor der Abfahrt hört.
