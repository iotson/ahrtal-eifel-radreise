import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erkenneAnstiege } from '../scripts/lib/climbs.js';

/** Hilfsfunktion: erzeugt km- und Höhenreihen aus Segmentbeschreibungen. */
function baueProfil(segmente) {
  const km = [0];
  const ele = [segmente[0].vonM];
  for (const seg of segmente) {
    const schritte = Math.max(1, Math.round(seg.laengeKm * 20));
    for (let i = 1; i <= schritte; i += 1) {
      km.push(km[km.length - 1] + seg.laengeKm / schritte);
      ele.push(seg.vonM + ((seg.bisM - seg.vonM) * i) / schritte);
    }
  }
  return { km, ele };
}

test('erkennt einen einzelnen deutlichen Anstieg', () => {
  const { km, ele } = baueProfil([
    { laengeKm: 2, vonM: 100, bisM: 100 },
    { laengeKm: 3, vonM: 100, bisM: 250 },
    { laengeKm: 2, vonM: 250, bisM: 250 }
  ]);
  const anstiege = erkenneAnstiege(km, ele);
  assert.equal(anstiege.length, 1);
  assert.ok(Math.abs(anstiege[0].startKm - 2) < 0.4, `startKm war ${anstiege[0].startKm}`);
  assert.ok(Math.abs(anstiege[0].lengthKm - 3) < 0.4, `lengthKm war ${anstiege[0].lengthKm}`);
  assert.ok(Math.abs(anstiege[0].gainM - 150) < 10, `gainM war ${anstiege[0].gainM}`);
  assert.ok(Math.abs(anstiege[0].avgGradientPct - 5) < 0.5, `Steigung war ${anstiege[0].avgGradientPct}`);
});

test('ignoriert Anstiege unterhalb der Mindesthöhe', () => {
  const { km, ele } = baueProfil([
    { laengeKm: 1, vonM: 100, bisM: 100 },
    { laengeKm: 1, vonM: 100, bisM: 120 },
    { laengeKm: 1, vonM: 120, bisM: 120 }
  ]);
  assert.deepEqual(erkenneAnstiege(km, ele), []);
});

test('erkennt zwei durch eine lange Abfahrt getrennte Anstiege', () => {
  const { km, ele } = baueProfil([
    { laengeKm: 2, vonM: 100, bisM: 250 },
    { laengeKm: 3, vonM: 250, bisM: 100 },
    { laengeKm: 2, vonM: 100, bisM: 260 }
  ]);
  const anstiege = erkenneAnstiege(km, ele);
  assert.equal(anstiege.length, 2);
});

test('eine kurze Zwischenabfahrt zerschneidet einen Anstieg nicht', () => {
  const { km, ele } = baueProfil([
    { laengeKm: 2, vonM: 100, bisM: 200 },
    { laengeKm: 0.3, vonM: 200, bisM: 195 },
    { laengeKm: 2, vonM: 195, bisM: 300 }
  ]);
  const anstiege = erkenneAnstiege(km, ele);
  assert.equal(anstiege.length, 1, 'Anstieg wurde fälschlich geteilt');
  assert.ok(anstiege[0].gainM > 180, `gainM war ${anstiege[0].gainM}`);
});

test('flache Strecke ergibt keine Anstiege', () => {
  const { km, ele } = baueProfil([{ laengeKm: 10, vonM: 100, bisM: 105 }]);
  assert.deepEqual(erkenneAnstiege(km, ele), []);
});

test('leere Eingabe ergibt eine leere Liste', () => {
  assert.deepEqual(erkenneAnstiege([], []), []);
});
