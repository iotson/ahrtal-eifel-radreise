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
