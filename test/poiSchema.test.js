import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validierePois } from '../scripts/lib/poiSchema.js';

function gueltigerStoryPoi(ueberschreibungen = {}) {
  return {
    id: 'tag1-deutsches-eck',
    day: 1,
    name: 'Deutsches Eck',
    lat: 50.364997,
    lon: 7.606475,
    category: 'Historie',
    kind: 'story',
    accessNote: 'direkt an der Strecke',
    textShort: Array(45).fill('Wort').join(' '),
    textLong: Array(200).fill('Wort').join(' '),
    sources: ['https://de.wikipedia.org/wiki/Deutsches_Eck'],
    triggerRadius: 150,
    routeKm: 0.2,
    ...ueberschreibungen
  };
}

function daten(pois) {
  return {
    generatedAt: '2026-08-08T12:00:00.000Z',
    days: [{ day: 1, briefing: { text: 'Heute erwartet dich eine Etappe.' }, pois }]
  };
}

test('ein vollständiger story-POI erzeugt keine Fehler', () => {
  const ergebnis = validierePois(daten([gueltigerStoryPoi()]));
  assert.deepEqual(ergebnis.fehler, []);
});

test('ein story-POI ohne Quelle wird abgelehnt', () => {
  const ergebnis = validierePois(daten([gueltigerStoryPoi({ sources: [] })]));
  assert.ok(ergebnis.fehler.some((f) => f.includes('Quelle')), ergebnis.fehler.join(' | '));
});

test('ein service-POI braucht keine Quelle und keine Texte', () => {
  const service = {
    id: 'tag1-rastplatz',
    day: 1,
    name: 'Schutzhütte mit Sitzbank',
    lat: 50.4,
    lon: 7.5,
    category: 'Service',
    kind: 'service',
    accessNote: 'direkt an der Strecke',
    routeKm: 12.4
  };
  assert.deepEqual(validierePois(daten([service])).fehler, []);
});

test('ein zu kurzer Kurztext wird abgelehnt', () => {
  const ergebnis = validierePois(daten([gueltigerStoryPoi({ textShort: 'Zu kurz.' })]));
  assert.ok(ergebnis.fehler.some((f) => f.includes('textShort')), ergebnis.fehler.join(' | '));
});

test('ein zu langer Langtext wird abgelehnt', () => {
  const ergebnis = validierePois(daten([gueltigerStoryPoi({ textLong: Array(600).fill('Wort').join(' ') })]));
  assert.ok(ergebnis.fehler.some((f) => f.includes('textLong')), ergebnis.fehler.join(' | '));
});

test('doppelte IDs werden abgelehnt', () => {
  const ergebnis = validierePois(daten([gueltigerStoryPoi(), gueltigerStoryPoi()]));
  assert.ok(ergebnis.fehler.some((f) => f.includes('doppelt')), ergebnis.fehler.join(' | '));
});

test('Koordinaten außerhalb des Tourgebiets werden abgelehnt', () => {
  const ergebnis = validierePois(daten([gueltigerStoryPoi({ lat: 12.5, lon: 100.2 })]));
  assert.ok(ergebnis.fehler.some((f) => f.includes('Koordinate')), ergebnis.fehler.join(' | '));
});

test('eine unbekannte Kategorie wird abgelehnt', () => {
  const ergebnis = validierePois(daten([gueltigerStoryPoi({ category: 'Erfunden' })]));
  assert.ok(ergebnis.fehler.some((f) => f.includes('category')), ergebnis.fehler.join(' | '));
});

test('ein fehlender Briefing-Text ist ohne briefingPflicht nur eine Warnung', () => {
  const d = daten([gueltigerStoryPoi()]);
  d.days[0].briefing = { text: '' };
  const ergebnis = validierePois(d);
  assert.deepEqual(ergebnis.fehler, []);
  assert.ok(ergebnis.warnungen.some((w) => w.includes('Briefing')), ergebnis.warnungen.join(' | '));
});

test('ein fehlender Briefing-Text wird mit briefingPflicht abgelehnt', () => {
  const d = daten([gueltigerStoryPoi()]);
  d.days[0].briefing = { text: '' };
  const ergebnis = validierePois(d, { briefingPflicht: true });
  assert.ok(ergebnis.fehler.some((f) => f.includes('Briefing')), ergebnis.fehler.join(' | '));
});

test('ein Tag mit weniger als drei story-POIs erzeugt eine Warnung', () => {
  const ergebnis = validierePois(daten([gueltigerStoryPoi()]));
  assert.ok(ergebnis.warnungen.some((w) => w.includes('story-POIs')), ergebnis.warnungen.join(' | '));
});
