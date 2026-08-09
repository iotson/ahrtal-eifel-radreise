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
