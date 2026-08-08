import fs from 'node:fs/promises';
import path from 'node:path';
import { parseGpx } from './lib/gpx.js';
import { kumulierteDistanzen, gesamtDistanzKm, naechsterRoutenpunkt } from './lib/geo.js';
import { gesamtAnstiegM } from './lib/elevation.js';
import { erkenneAnstiege } from './lib/climbs.js';
import { duenneAus, boundingBox } from './lib/route.js';

const WURZEL = path.resolve(import.meta.dirname, '..');

/**
 * Prüft für Tag 1, ob der Track eine Anfahrt zum markanten Startpunkt „Deutsches Eck“
 * enthält (siehe Task-7-Spec, Step 4). Der Wegpunkt „Deutsches Eck“ liegt laut Spec rund
 * 10 km vom ersten Trackpunkt entfernt (50.2739/7.6459 vs. 50.3650/7.6065). Prüfung: Liegt
 * der ihm am nächsten liegende Trackpunkt nahe Index 0, sitzt der Wegpunkt einfach nicht
 * exakt auf dem Startpunkt. Liegt er weit im Track (wie hier: Index 350 von 1470, km 14.9),
 * enthält die Datei tatsächlich eine Anfahrt, die in der Gesamtlänge des Tages mitgezählt
 * wird — das wird als `hinweis` im betroffenen Tageseintrag dokumentiert.
 */
function anfahrtHinweisTag1(gpx, punkte, kmWerte) {
  const deutschesEck = gpx.waypoints.find((w) => w.name === 'Deutsches Eck');
  if (!deutschesEck) return undefined;

  const treffer = naechsterRoutenpunkt(deutschesEck.lat, deutschesEck.lon, punkte);
  const NAHE_AM_START_INDEX = 10;
  if (treffer.index <= NAHE_AM_START_INDEX) return undefined;

  const kmBisEck = kmWerte[treffer.index];
  return (
    `Der Track beginnt rund ${kmBisEck.toFixed(1)} km vor dem eigentlichen Startpunkt ` +
    `„Deutsches Eck“ (Trackindex ${treffer.index} von ${punkte.length}, ` +
    `${treffer.distanzKm.toFixed(3)} km vom nächsten Trackpunkt entfernt). ` +
    'Die GPX-Datei enthält vermutlich eine Anfahrt zum touristischen Startpunkt der Tour; ' +
    'die ausgewiesene Gesamtlänge des Tages schließt diese Anfahrt mit ein.'
  );
}

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

    const tagesEintrag = {
      day,
      title: `${startOrt} nach ${zielOrt}`,
      file: datei,
      startOrt,
      zielOrt,
      lengthKm: Number(gesamtDistanzKm(punkte).toFixed(1)),
      // gesamtAnstiegM und erkenneAnstiege werden mit den Standardparametern der Module
      // aufgerufen (mindestDifferenzM = 3, fensterGroesse = 9, mindestSteigungPct = 2).
      // Die damit erzeugten Werte wurden gegen die in Task 3–5 unabhängig verifizierten
      // Sollwerte geprüft (siehe task-7-report.md) und stimmen exakt überein — eine
      // Anpassung der Parameter war nicht nötig.
      elevationGainM: Math.round(gesamtAnstiegM(eleWerte)),
      climbs: erkenneAnstiege(kmWerte, eleWerte),
      estimatedRidingTimeMin: fahrzeitMinuten(punkte),
      routeLine: linie,
      bbox: boundingBox(punkte)
    };

    if (day === 1) {
      const hinweis = anfahrtHinweisTag1(gpx, punkte, kmWerte);
      if (hinweis) tagesEintrag.hinweis = hinweis;
    }

    days.push(tagesEintrag);
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
