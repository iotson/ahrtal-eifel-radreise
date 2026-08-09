import { haversineKm } from './geo.js';

/**
 * Toleranz, ab der zwei Trackpunkte nicht mehr als derselbe Ort durchgehen. Die Etappen
 * wurden einzeln in Komoot geplant; Ende und Anfang liegen deshalb nie exakt aufeinander,
 * aber deutlich näher als hundert Meter.
 */
export const RUNDTOUR_TOLERANZ_KM = 0.1;

/**
 * Prüft die Zusicherung, auf der die Etappennamen beruhen: Jedes Etappenende ist der
 * Startpunkt des Folgetags, und der letzte Tag endet am Startpunkt des ersten. Ohne diese
 * Prüfung würde eine ausgetauschte GPX-Datei stillschweigend einen falschen Ortsnamen
 * erzeugen, der anschließend vorgelesen wird.
 *
 * `etappen` ist eine nach `day` sortierte Liste von `{ day, start, ende }`, wobei `start`
 * und `ende` je `{ lat, lon }` sind. Wirft bei der ersten Abweichung.
 */
export function pruefeRundtour(etappen, toleranzKm = RUNDTOUR_TOLERANZ_KM) {
  if (etappen.length < 2) {
    throw new Error(`Rundtour-Prüfung braucht mindestens zwei Etappen, bekam ${etappen.length}.`);
  }

  for (let i = 0; i < etappen.length; i += 1) {
    const dieser = etappen[i];
    const folgender = etappen[(i + 1) % etappen.length];

    const abstandKm = haversineKm(
      dieser.ende.lat, dieser.ende.lon,
      folgender.start.lat, folgender.start.lon
    );

    if (abstandKm > toleranzKm) {
      const wohin = folgender.day === etappen[0].day
        ? `zum Startpunkt von Tag ${folgender.day} (Rundtour-Schluss)`
        : `zum Startpunkt von Tag ${folgender.day}`;
      throw new Error(
        `Rundtour unterbrochen: Vom Ende von Tag ${dieser.day} ${wohin} sind es ` +
        `${Math.round(abstandKm * 1000)} m, erlaubt sind ${Math.round(toleranzKm * 1000)} m. ` +
        'Entweder wurde eine GPX-Datei ausgetauscht oder die Tabelle ETAPPENORTE in ' +
        'scripts/build-tour.js passt nicht mehr zu den Tracks.'
      );
    }
  }
}

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
