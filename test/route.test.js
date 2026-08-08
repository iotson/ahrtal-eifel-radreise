import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duenneAus, boundingBox } from '../scripts/lib/route.js';

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
