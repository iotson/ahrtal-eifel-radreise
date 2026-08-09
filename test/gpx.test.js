import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGpx } from '../scripts/lib/gpx.js';

const BEISPIEL_GPX = `<?xml version='1.0' encoding='UTF-8'?>
<gpx version="1.1" creator="https://www.komoot.de" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Testtour</name></metadata>
  <wpt lat="50.364997" lon="7.606475"><name>Deutsches Eck</name><sym>Flag, Blue</sym></wpt>
  <wpt lat="50.423420" lon="7.528403"><name>Eisenbahnbrücke Urmitz</name><sym>Bridge</sym></wpt>
  <trk><trkseg>
    <trkpt lat="50.273949" lon="7.645975"><ele>69.386223</ele><time>2026-08-08T10:00:35.030Z</time></trkpt>
    <trkpt lat="50.273882" lon="7.645894"><ele>70.500000</ele><time>2026-08-08T10:00:36.553Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

test('liest den Tournamen aus den Metadaten', () => {
  const result = parseGpx(BEISPIEL_GPX);
  assert.equal(result.name, 'Testtour');
});

test('liest alle Waypoints mit Namen, Koordinaten und Symbol', () => {
  const result = parseGpx(BEISPIEL_GPX);
  assert.equal(result.waypoints.length, 2);
  assert.deepEqual(result.waypoints[0], {
    name: 'Deutsches Eck',
    lat: 50.364997,
    lon: 7.606475,
    sym: 'Flag, Blue'
  });
  assert.equal(result.waypoints[1].name, 'Eisenbahnbrücke Urmitz');
  assert.equal(result.waypoints[1].sym, 'Bridge');
});

test('liest Trackpunkte mit Höhe und Zeit als Zahlen bzw. ISO-String', () => {
  const result = parseGpx(BEISPIEL_GPX);
  assert.equal(result.trackPoints.length, 2);
  assert.equal(result.trackPoints[0].lat, 50.273949);
  assert.equal(result.trackPoints[0].ele, 69.386223);
  assert.equal(result.trackPoints[0].time, '2026-08-08T10:00:35.030Z');
  assert.equal(typeof result.trackPoints[0].lat, 'number');
  assert.equal(typeof result.trackPoints[0].ele, 'number');
});

test('kommt mit einer Datei ohne Waypoints zurecht', () => {
  const ohneWpt = BEISPIEL_GPX.replace(/<wpt[\s\S]*?<\/wpt>/g, '');
  const result = parseGpx(ohneWpt);
  assert.deepEqual(result.waypoints, []);
  assert.equal(result.trackPoints.length, 2);
});
