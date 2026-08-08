import fs from 'node:fs/promises';
import path from 'node:path';
import { parseGpx } from './lib/gpx.js';
import { kumulierteDistanzen, gesamtDistanzKm, naechsterRoutenpunkt } from './lib/geo.js';
import { gesamtAnstiegM } from './lib/elevation.js';
import { erkenneAnstiege } from './lib/climbs.js';
import { duenneAus, boundingBox } from './lib/route.js';

const WURZEL = path.resolve(import.meta.dirname, '..');

/**
 * Tag 1 beginnt südlich von Koblenz, nicht am Deutschen Eck. Der Nutzer hat das am
 * 2026-08-08 als gewollt bestätigt — es ist keine Anfahrt und kein Datenfehler. Der
 * `hinweis` hält die Lage sachlich fest, damit sie in der App und im Briefing nicht
 * für einen Fehler gehalten wird. Der Text wird vorgelesen: Dezimalzahlen mit Komma,
 * keine Klammern, keine Abkürzungen.
 */
function startHinweisTag1(gpx, punkte, kmWerte) {
  const deutschesEck = gpx.waypoints.find((w) => w.name === 'Deutsches Eck');
  if (!deutschesEck) return undefined;

  const treffer = naechsterRoutenpunkt(deutschesEck.lat, deutschesEck.lon, punkte);
  const NAHE_AM_START_INDEX = 10;
  if (treffer.index <= NAHE_AM_START_INDEX) return undefined;

  const kmBisEck = kmWerte[treffer.index].toFixed(1).replace('.', ',');
  return (
    'Die Etappe beginnt südlich von Koblenz. ' +
    `Das Deutsche Eck erreichst du bei Kilometer ${kmBisEck}.`
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
      const hinweis = startHinweisTag1(gpx, punkte, kmWerte);
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
