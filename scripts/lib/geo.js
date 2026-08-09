const ERDRADIUS_KM = 6371.0088;

function inBogenmass(grad) {
  return (grad * Math.PI) / 180;
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = inBogenmass(lat2 - lat1);
  const dLon = inBogenmass(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(inBogenmass(lat1)) * Math.cos(inBogenmass(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * ERDRADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function kumulierteDistanzen(points) {
  if (points.length === 0) return [];
  const werte = [0];
  for (let i = 1; i < points.length; i += 1) {
    const schritt = haversineKm(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
    werte.push(werte[i - 1] + schritt);
  }
  return werte;
}

export function gesamtDistanzKm(points) {
  const werte = kumulierteDistanzen(points);
  return werte.length === 0 ? 0 : werte[werte.length - 1];
}

export function naechsterRoutenpunkt(lat, lon, points) {
  let bester = { index: -1, distanzKm: Infinity };
  for (let i = 0; i < points.length; i += 1) {
    const d = haversineKm(lat, lon, points[i].lat, points[i].lon);
    if (d < bester.distanzKm) {
      bester = { index: i, distanzKm: d };
    }
  }
  return bester;
}
