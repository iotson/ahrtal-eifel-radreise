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
