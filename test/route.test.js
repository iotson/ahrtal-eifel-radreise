import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duenneAus, boundingBox, pruefeRundtour } from '../scripts/lib/route.js';

function baueRoute(anzahl) {
  return Array.from({ length: anzahl }, (_, i) => ({ lat: 50 + i * 0.001, lon: 7 + i * 0.001 }));
}

test('kürzt eine lange Route auf die Obergrenze', () => {
  const ergebnis = duenneAus(baueRoute(1470), 400);
  assert.ok(ergebnis.length <= 400, `war ${ergebnis.length}`);
  assert.ok(ergebnis.length > 300, `zu stark ausgedünnt: ${ergebnis.length}`);
});

test('behält Anfangs- und Endpunkt exakt bei', () => {
  const route = baueRoute(1000);
  const ergebnis = duenneAus(route, 100);
  assert.deepEqual(ergebnis[0], route[0]);
  assert.deepEqual(ergebnis[ergebnis.length - 1], route[route.length - 1]);
});

test('lässt eine kurze Route unverändert', () => {
  const route = baueRoute(50);
  assert.deepEqual(duenneAus(route, 400), route);
});

test('eine leere Route bleibt leer', () => {
  assert.deepEqual(duenneAus([], 400), []);
});

test('berechnet die Bounding Box über alle Punkte', () => {
  const punkte = [
    { lat: 50.1, lon: 7.5 },
    { lat: 49.9, lon: 7.9 },
    { lat: 50.3, lon: 7.2 }
  ];
  assert.deepEqual(boundingBox(punkte), { minLat: 49.9, minLon: 7.2, maxLat: 50.3, maxLon: 7.9 });
});

/**
 * Eine geschlossene Beispiel-Rundtour über vier Etappen. Die Punkte sind frei gewählt;
 * geprüft wird nur, dass Ende und Folgestart zusammenfallen.
 */
function baueRundtour() {
  const orte = [
    { lat: 50.27, lon: 7.65 },
    { lat: 50.54, lon: 7.11 },
    { lat: 50.19, lon: 6.83 },
    { lat: 50.06, lon: 7.14 }
  ];

  return orte.map((ort, i) => ({
    day: i + 1,
    start: { ...ort },
    ende: { ...orte[(i + 1) % orte.length] }
  }));
}

test('akzeptiert eine geschlossene Rundtour', () => {
  assert.doesNotThrow(() => pruefeRundtour(baueRundtour()));
});

test('akzeptiert Abweichungen unterhalb der Toleranz', () => {
  const etappen = baueRundtour();
  // Rund 55 m nach Norden — innerhalb der 100-m-Toleranz.
  etappen[0].ende.lat += 0.0005;
  assert.doesNotThrow(() => pruefeRundtour(etappen));
});

test('meldet ein Etappenende, das nicht am Start des Folgetags liegt', () => {
  const etappen = baueRundtour();
  // Rund 1,1 km nach Norden — deutlich über der Toleranz.
  etappen[1].ende.lat += 0.01;

  assert.throws(() => pruefeRundtour(etappen), (fehler) => {
    assert.match(fehler.message, /Tag 2/);
    assert.match(fehler.message, /Tag 3/);
    assert.match(fehler.message, /Rundtour unterbrochen/);
    return true;
  });
});

test('meldet einen letzten Tag, der nicht am Startpunkt von Tag 1 endet', () => {
  const etappen = baueRundtour();
  etappen[etappen.length - 1].ende = { lat: 50.5, lon: 7.6 };

  assert.throws(() => pruefeRundtour(etappen), (fehler) => {
    assert.match(fehler.message, /Rundtour-Schluss/);
    return true;
  });
});

test('verlangt mindestens zwei Etappen', () => {
  assert.throws(() => pruefeRundtour([]), /mindestens zwei Etappen/);
});
