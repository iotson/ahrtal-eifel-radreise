import fs from 'node:fs/promises';
import path from 'node:path';
import { baueBriefingText, zaehleZahlangaben } from './lib/briefing.js';

const WURZEL = path.resolve(import.meta.dirname, '..');
const tourPfad = path.join(WURZEL, 'data', 'tour.json');
const poiPfad = path.join(WURZEL, 'data', 'pois.json');

const MAX_ZAHLANGABEN = 8;

// Zwei Eigenheiten der Route stehen nicht in tour.json, würden unterwegs aber
// verwundern. Tag 1 bringt seinen Hinweis selbst mit.
const ZUSATZHINWEISE = {
  4: 'Rund zehn Kilometer lang folgst du derselben Bahntrasse wie gestern zum Schluss, nur in die andere Richtung.',
  6: 'Koblenz und das Deutsche Eck passierst du kurz vor Schluss. Die Runde endet erst danach am Rhein, unter der Marksburg, wo sie begonnen hat.'
};

// Handverlesen aus data/pois.json: je Tag die stärksten Punkte, über die
// Etappe verteilt. Die Namen werden unten gegen die Daten geprüft.
const HIGHLIGHTS = {
  1: ['Festung Ehrenbreitstein', 'Ruine Hammerstein', 'Schloss Arenfels'],
  2: ['Bunte Kuh bei Walporzheim', 'Burg Are über Altenahr', 'Dreimühlen-Wasserfall'],
  3: ['Lokschuppen Gerolstein', 'Burg Lissingen', 'Salvatorbasilika in Prüm'],
  4: ['Skulpturengarten in Habscheid', 'Schloss Malberg', 'Kyllburg'],
  5: ['Abtei Himmerod', 'Festung Mont Royal', 'Marienburg über der Moselschleife'],
  6: ['Reichsburg Cochem', 'Burg Eltz im Elzbachtal', 'Sankt Castor in Karden']
};

const tour = JSON.parse(await fs.readFile(tourPfad, 'utf8'));
const pois = JSON.parse(await fs.readFile(poiPfad, 'utf8'));

for (const poiTag of pois.days) {
  const tourTag = tour.days.find((d) => d.day === poiTag.day);
  if (!tourTag) {
    throw new Error(`Tag ${poiTag.day} fehlt in tour.json`);
  }

  const erzaehlpunkte = new Set(poiTag.pois.filter((p) => p.kind === 'story').map((p) => p.name));
  const highlights = HIGHLIGHTS[poiTag.day] ?? [];
  for (const name of highlights) {
    if (!erzaehlpunkte.has(name)) {
      throw new Error(`Tag ${poiTag.day}: Highlight "${name}" ist kein Erzählpunkt in pois.json`);
    }
  }

  const text = baueBriefingText({ ...tourTag, hinweis: tourTag.hinweis ?? ZUSATZHINWEISE[poiTag.day] }, highlights);
  const zahlangaben = zaehleZahlangaben(text);
  if (zahlangaben > MAX_ZAHLANGABEN) {
    throw new Error(`Tag ${poiTag.day}: ${zahlangaben} Zahlangaben, erlaubt sind ${MAX_ZAHLANGABEN}`);
  }

  poiTag.briefing = { ...poiTag.briefing, text };

  console.log(
    `Tag ${poiTag.day}: ${text.split(/\s+/).length} Wörter, ${zahlangaben} Zahlangaben, ${highlights.length} Highlights`
  );
}

pois.generatedAt = new Date().toISOString();
await fs.writeFile(poiPfad, `${JSON.stringify(pois, null, 2)}\n`, 'utf8');
