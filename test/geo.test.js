import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, kumulierteDistanzen, gesamtDistanzKm, naechsterRoutenpunkt } from '../scripts/lib/geo.js';

test('identische Punkte haben Abstand null', () => {
  assert.equal(haversineKm(50.1, 7.2, 50.1, 7.2), 0);
});

test('ein Grad Breitengrad entspricht rund 111,2 km', () => {
  const d = haversineKm(0, 0, 1, 0);
  assert.ok(Math.abs(d - 111.19) < 0.1, `erwartet ~111.19, war ${d}`);
});

test('ein Grad Längengrad am Äquator entspricht rund 111,2 km', () => {
  const d = haversineKm(0, 0, 0, 1);
  assert.ok(Math.abs(d - 111.19) < 0.1, `erwartet ~111.19, war ${d}`);
});

test('ein Grad Längengrad auf 60 Grad Breite entspricht rund der Hälfte', () => {
  const d = haversineKm(60, 0, 60, 1);
  assert.ok(Math.abs(d - 55.6) < 0.2, `erwartet ~55.6, war ${d}`);
});

test('die Entfernung ist symmetrisch', () => {
  const hin = haversineKm(50.364997, 7.606475, 50.423156, 7.543823);
  const zurueck = haversineKm(50.423156, 7.543823, 50.364997, 7.606475);
  assert.equal(hin, zurueck);
});

test('kumulierte Distanzen beginnen bei null und wachsen monoton', () => {
  const punkte = [
    { lat: 0, lon: 0 },
    { lat: 1, lon: 0 },
    { lat: 2, lon: 0 }
  ];
  const km = kumulierteDistanzen(punkte);
  assert.equal(km.length, 3);
  assert.equal(km[0], 0);
  assert.ok(km[1] > 111 && km[1] < 112);
  assert.ok(km[2] > 222 && km[2] < 223);
});

test('kumulierte Distanzen einer leeren Liste sind leer', () => {
  assert.deepEqual(kumulierteDistanzen([]), []);
});

test('die Gesamtdistanz ist der letzte kumulierte Wert', () => {
  const punkte = [{ lat: 0, lon: 0 }, { lat: 1, lon: 0 }];
  assert.equal(gesamtDistanzKm(punkte), kumulierteDistanzen(punkte)[1]);
});

test('die Gesamtdistanz eines einzelnen Punktes ist null', () => {
  assert.equal(gesamtDistanzKm([{ lat: 5, lon: 5 }]), 0);
});

test('findet den nächstgelegenen Routenpunkt mit Index und Abstand', () => {
  const route = [
    { lat: 50.0, lon: 7.0 },
    { lat: 50.1, lon: 7.0 },
    { lat: 50.2, lon: 7.0 }
  ];
  const treffer = naechsterRoutenpunkt(50.09, 7.0, route);
  assert.equal(treffer.index, 1);
  assert.ok(treffer.distanzKm < 1.5, `erwartet unter 1.5 km, war ${treffer.distanzKm}`);
});
