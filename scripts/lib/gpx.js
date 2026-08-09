import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true
});

/** Liefert immer ein Array, auch wenn der Parser ein Einzelobjekt oder undefined zurückgibt. */
function alsArray(wert) {
  if (wert === undefined || wert === null) return [];
  return Array.isArray(wert) ? wert : [wert];
}

export function parseGpx(xmlText) {
  const doc = parser.parse(xmlText);
  const gpx = doc.gpx;

  const name = gpx.metadata?.name ?? '';

  const waypoints = alsArray(gpx.wpt).map((wpt) => ({
    name: String(wpt.name ?? ''),
    lat: Number(wpt['@_lat']),
    lon: Number(wpt['@_lon']),
    sym: wpt.sym !== undefined ? String(wpt.sym) : null
  }));

  const segmente = alsArray(gpx.trk).flatMap((trk) => alsArray(trk.trkseg));
  const trackPoints = segmente.flatMap((seg) =>
    alsArray(seg.trkpt).map((pt) => ({
      lat: Number(pt['@_lat']),
      lon: Number(pt['@_lon']),
      ele: Number(pt.ele),
      time: String(pt.time)
    }))
  );

  return { name: String(name), trackPoints, waypoints };
}
