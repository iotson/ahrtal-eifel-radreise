import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glaetteHoehen, gesamtAnstiegM } from '../scripts/lib/elevation.js';

test('Glättung erhält die Länge der Reihe', () => {
  const roh = [100, 102, 101, 103, 105, 104, 106];
  assert.equal(glaetteHoehen(roh, 3).length, roh.length);
});

test('Glättung einer konstanten Reihe ändert nichts', () => {
  const roh = [200, 200, 200, 200, 200];
  const geglaettet = glaetteHoehen(roh, 3);
  geglaettet.forEach((wert) => assert.ok(Math.abs(wert - 200) < 0.001));
});

test('Glättung dämpft einen einzelnen Ausreißer', () => {
  const roh = [100, 100, 160, 100, 100];
  const geglaettet = glaetteHoehen(roh, 3);
  assert.ok(geglaettet[2] < 140, `Ausreißer nicht gedämpft: ${geglaettet[2]}`);
  assert.ok(geglaettet[2] > 100, `zu stark gedämpft: ${geglaettet[2]}`);
});

test('Glättung einer leeren Reihe ergibt eine leere Reihe', () => {
  assert.deepEqual(glaetteHoehen([], 3), []);
});

test('gleichmäßiger Anstieg wird vollständig gezählt', () => {
  const roh = [100, 110, 120, 130, 140];
  assert.ok(Math.abs(gesamtAnstiegM(roh, 3) - 40) < 1, `war ${gesamtAnstiegM(roh, 3)}`);
});

test('Abstieg zählt nicht zum Anstieg', () => {
  const roh = [200, 190, 180, 170];
  assert.equal(gesamtAnstiegM(roh, 3), 0);
});

test('kleines Rauschen auf ebener Strecke wird nicht als Anstieg gezählt', () => {
  const roh = [];
  for (let i = 0; i < 200; i += 1) {
    roh.push(100 + (i % 2 === 0 ? 1 : -1));
  }
  const anstieg = gesamtAnstiegM(roh, 3);
  assert.ok(anstieg < 10, `Rauschen wurde als Anstieg gewertet: ${anstieg} m`);
});

test('Anstieg gefolgt von Abstieg gefolgt von Anstieg wird korrekt summiert', () => {
  const roh = [100, 150, 100, 150];
  const anstieg = gesamtAnstiegM(roh, 3);
  assert.ok(Math.abs(anstieg - 100) < 5, `erwartet ~100, war ${anstieg}`);
});

test('Glättung mit default fensterGroesse glättet einen einzelnen Ausreißer deutlich', () => {
  const roh = [];
  for (let i = 0; i < 25; i += 1) {
    roh.push(200);
  }
  roh[12] = 260; // Ausreißer in der Mitte
  const geglaettet = glaetteHoehen(roh);
  // Mit fensterGroesse=9 und halb=4: der Ausreißer wird zu einem Durchschnitt
  // seiner ±4 Nachbarn (8x 200 + 1x 260) / 9 = 242.2, aber möglicherweise weiter gedämpft
  assert.ok(geglaettet[12] < 245, `Ausreißer nicht gedämpft mit default: ${geglaettet[12]}`);
  assert.ok(geglaettet[12] > 200, `zu stark gedämpft: ${geglaettet[12]}`);
});

test('lange Reihe mit überlagerten Rauschschwingungen wird korrekt summiert', () => {
  const roh = [];
  // Gleichmäßiger Anstieg von 100 auf 400 Metern über 300 Punkte
  const steigung = 300 / 300; // 1m pro Punkt
  for (let i = 0; i < 300; i += 1) {
    const basisWert = 100 + i * steigung;
    // Überlagert mit ±4m Sägezahn-Rauschen (wie GPS-Schwankungen)
    const rauschen = (i % 6 < 3 ? 4 : -4);
    roh.push(basisWert + rauschen);
  }
  const anstieg = gesamtAnstiegM(roh, 3);
  // Ohne Glättung würden alle Rauschschwingungen mitgezählt → über 400m
  // Mit Glättung sollte es nahe bei 300m sein (der echte Anstieg)
  assert.ok(Math.abs(anstieg - 300) < 40, `Rauschen nicht richtig gefiltert: ${anstieg}m (erwartet ~300)`);
});
