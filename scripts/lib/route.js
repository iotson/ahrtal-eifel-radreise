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
