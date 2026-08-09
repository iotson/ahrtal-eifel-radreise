import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baueBriefingText, zaehleZahlangaben } from '../scripts/lib/briefing.js';

// Die Fixtures spiegeln echte Etappen aus data/tour.json wider.
const TAG_MIT_EINEM_ANSTIEG = {
  day: 2,
  startOrt: 'Bad Neuenahr-Ahrweiler',
  zielOrt: 'Steinborn',
  lengthKm: 74.5,
  elevationGainM: 765,
  estimatedRidingTimeMin: 258,
  climbs: [{ startKm: 66.24, lengthKm: 3.27, gainM: 94, avgGradientPct: 2.9 }]
};

const TAG_MIT_ANSTIEG_AM_START = {
  day: 3,
  startOrt: 'Steinborn',
  zielOrt: 'Bleialf',
  lengthKm: 62,
  elevationGainM: 653,
  estimatedRidingTimeMin: 204,
  climbs: [{ startKm: 0, lengthKm: 4.67, gainM: 184, avgGradientPct: 3.9 }]
};

const TAG_MIT_SECHS_ANSTIEGEN = {
  day: 4,
  startOrt: 'Bleialf',
  zielOrt: 'Eisenschmitt',
  lengthKm: 58.1,
  elevationGainM: 736,
  estimatedRidingTimeMin: 185,
  climbs: [
    { startKm: 20.03, lengthKm: 6.66, gainM: 207, avgGradientPct: 3.1 },
    { startKm: 30.44, lengthKm: 1.37, gainM: 57, avgGradientPct: 4.2 },
    { startKm: 36.87, lengthKm: 1.64, gainM: 93, avgGradientPct: 5.7 },
    { startKm: 38.93, lengthKm: 1.31, gainM: 51, avgGradientPct: 3.9 },
    { startKm: 44.39, lengthKm: 5.72, gainM: 174, avgGradientPct: 3 },
    { startKm: 54, lengthKm: 1.08, gainM: 42, avgGradientPct: 3.9 }
  ]
};

const TAG_OHNE_ANSTIEGE = {
  day: 6,
  startOrt: 'Sankt Aldegund',
  zielOrt: 'Braubach',
  lengthKm: 89.2,
  elevationGainM: 281,
  estimatedRidingTimeMin: 289,
  climbs: []
};

test('nennt Tag, Start und Ziel', () => {
  const text = baueBriefingText(TAG_MIT_ANSTIEG_AM_START, ['Burg Lissingen']);
  assert.ok(text.includes('Tag 3'), text);
  assert.ok(text.includes('Steinborn'), text);
  assert.ok(text.includes('Bleialf'), text);
});

test('nennt Länge und Höhenmeter der Etappe', () => {
  const text = baueBriefingText(TAG_MIT_EINEM_ANSTIEG, []);
  assert.ok(text.includes('74,5 Kilometer'), text);
  assert.ok(text.includes('765 Höhenmeter'), text);
});

test('schreibt ganze Kilometer ohne Nachkommastelle', () => {
  const text = baueBriefingText(TAG_MIT_ANSTIEG_AM_START, []);
  assert.ok(text.includes('62 Kilometer'), text);
  assert.ok(!text.includes('62,0'), `Ganze Zahl unnötig aufgefüllt: ${text}`);
});

test('verwendet keinen Punkt als Dezimaltrenner', () => {
  for (const tag of [TAG_MIT_EINEM_ANSTIEG, TAG_MIT_SECHS_ANSTIEGEN, TAG_OHNE_ANSTIEGE]) {
    const text = baueBriefingText(tag, []);
    assert.ok(!/\d\.\d/.test(text), `Dezimalpunkt gefunden, für Sprachausgabe ungeeignet: ${text}`);
  }
});

test('beschreibt einen einzelnen Anstieg mit Position und Höhengewinn', () => {
  const text = baueBriefingText(TAG_MIT_EINEM_ANSTIEG, []);
  assert.ok(text.includes('Kilometer 66'), text);
  assert.ok(text.includes('94 Höhenmeter'), text);
});

test('beschreibt einen Anstieg direkt am Start nicht als Kilometer null', () => {
  const text = baueBriefingText(TAG_MIT_ANSTIEG_AM_START, []);
  assert.ok(!/Kilometer 0\b/.test(text), text);
  assert.ok(text.includes('Start'), text);
  assert.ok(text.includes('184 Höhenmeter'), text);
});

test('fasst viele Anstiege zusammen, statt jeden einzeln aufzuzählen', () => {
  const text = baueBriefingText(TAG_MIT_SECHS_ANSTIEGEN, []);
  assert.ok(/Sechs Anstiege/.test(text), text);
  for (const climb of TAG_MIT_SECHS_ANSTIEGEN.climbs) {
    assert.ok(!text.includes(String(climb.gainM)), `Einzelner Anstieg ausgeplaudert: ${text}`);
  }
});

test('meldet einen flachen Tag als flach, ohne undefined zu schreiben', () => {
  const text = baueBriefingText(TAG_OHNE_ANSTIEGE, []);
  assert.ok(text.length > 80, text);
  assert.ok(!text.includes('undefined'), text);
  assert.ok(/Anstiege gibt es nicht/.test(text), text);
});

test('stuft mäßige Steigungen als nicht steil ein', () => {
  const text = baueBriefingText(TAG_MIT_SECHS_ANSTIEGEN, []);
  assert.ok(/Steil wird keiner/.test(text), text);
});

test('warnt vor einem wirklich steilen Anstieg', () => {
  const steil = {
    ...TAG_MIT_SECHS_ANSTIEGEN,
    climbs: [
      { startKm: 10, lengthKm: 2, gainM: 160, avgGradientPct: 8 },
      { startKm: 30, lengthKm: 2, gainM: 60, avgGradientPct: 3 }
    ]
  };
  const text = baueBriefingText(steil, []);
  assert.ok(/steil/i.test(text), text);
  assert.ok(!/Steil wird keiner/.test(text), text);
});

test('nennt die Fahrzeit gerundet in vollen Stunden', () => {
  assert.ok(baueBriefingText(TAG_MIT_SECHS_ANSTIEGEN, []).includes('rund drei Stunden'));
  assert.ok(baueBriefingText(TAG_MIT_EINEM_ANSTIEG, []).includes('gut vier Stunden'));
  assert.ok(baueBriefingText(TAG_OHNE_ANSTIEGE, []).includes('knapp fünf Stunden'));
});

test('nennt die Highlights und verbindet sie mit und', () => {
  const text = baueBriefingText(TAG_MIT_ANSTIEG_AM_START, [
    'Lokschuppen Gerolstein',
    'Burg Lissingen',
    'Salvatorbasilika in Prüm'
  ]);
  assert.ok(text.includes('Lokschuppen Gerolstein, Burg Lissingen und Salvatorbasilika in Prüm'), text);
});

test('lässt den Highlight-Satz weg, wenn es keine Highlights gibt', () => {
  const text = baueBriefingText(TAG_MIT_ANSTIEG_AM_START, []);
  assert.ok(!text.includes('Unterwegs warten'), text);
});

test('übernimmt einen Routenhinweis wortgleich', () => {
  const hinweis = 'Die Etappe beginnt südlich von Koblenz. Das Deutsche Eck erreichst du bei Kilometer 14,9.';
  const text = baueBriefingText({ ...TAG_OHNE_ANSTIEGE, hinweis }, []);
  assert.ok(text.includes(hinweis), text);
  // Der Hinweis ordnet die Etappe ein und gehört deshalb vor die Kennzahlen.
  assert.ok(text.indexOf(hinweis) < text.indexOf('Vor dir liegen'), text);
});

test('kommt ohne Routenhinweis aus', () => {
  const text = baueBriefingText(TAG_OHNE_ANSTIEGE, []);
  assert.ok(!text.includes('undefined'), text);
});

test('bleibt bei höchstens acht Zahlangaben', () => {
  const tage = [TAG_MIT_EINEM_ANSTIEG, TAG_MIT_ANSTIEG_AM_START, TAG_MIT_SECHS_ANSTIEGEN, TAG_OHNE_ANSTIEGE];
  for (const tag of tage) {
    const text = baueBriefingText(tag, ['Burg Lissingen', 'Schloss Malberg', 'Kyllburg']);
    const anzahl = zaehleZahlangaben(text);
    assert.ok(anzahl <= 8, `Tag ${tag.day} nennt ${anzahl} Zahlangaben: ${text}`);
  }
});

test('endet mit einem Gruß', () => {
  assert.ok(baueBriefingText(TAG_OHNE_ANSTIEGE, []).endsWith('Gute Fahrt.'));
});

test('zählt Ziffernfolgen als je eine Zahlangabe', () => {
  assert.equal(zaehleZahlangaben('Vor dir liegen 74,5 Kilometer und 765 Höhenmeter.'), 2);
});

test('zählt ausgeschriebene Zahlwörter mit', () => {
  assert.equal(zaehleZahlangaben('Sechs Anstiege und rund zehn Kilometer Bahntrasse.'), 2);
});

test('zählt die Artikel ein, eine und einen nicht mit', () => {
  assert.equal(zaehleZahlangaben('Ein Anstieg, eine Kapelle und einen Tunnel gibt es auch.'), 0);
});

test('zählt Genitiv- und Dativformen von „ein" weiterhin nicht als Zahlangabe', () => {
  assert.equal(
    zaehleZahlangaben('Das Ende einer Etappe liegt in einem Tal, verbunden mit einem Pfad.'),
    0
  );
});

// Regression: Vor der Korrektur erzeugte anstiegeText() bei mehreren Anstiegen
// mit einer steilen Rampe den Satz "Einer davon wird richtig steil." "Einer"
// wird hier pronominal als Zahlangabe gebraucht, taucht aber bewusst nicht in
// ZAHLWORT_MUSTER auf (sonst zählten auch Genitive wie "das Ende einer
// Etappe" mit) — die Zählung verschluckte also eine Angabe. Behoben wurde das
// durch Umformulieren, nicht durch Erweitern der Zahlwortliste.
test('zählt „Einer" pronominal weiterhin nicht (dokumentiert die Lücke, die den Fehler auslöste)', () => {
  assert.equal(zaehleZahlangaben('Einer davon wird richtig steil.'), 0);
});

test('regression: der Text zu einem steilen Mehrfachanstieg verwendet kein ungezähltes „Einer"', () => {
  const steil = {
    ...TAG_MIT_SECHS_ANSTIEGEN,
    climbs: [
      { startKm: 10, lengthKm: 2, gainM: 160, avgGradientPct: 8 },
      { startKm: 30, lengthKm: 2, gainM: 60, avgGradientPct: 3 }
    ]
  };
  const text = baueBriefingText(steil, []);
  assert.ok(/steil/i.test(text), text);
  assert.ok(
    !/\bEiner\b/.test(text),
    `Text verwendet weiterhin die mehrdeutige, nicht gezählte Zahlangabe "Einer": ${text}`
  );
});

test('verwechselt Namen nicht mit Zahlwörtern', () => {
  assert.equal(zaehleZahlangaben('Dreimühlen-Wasserfall, Neuenahr und Eisenschmitt.'), 0);
});
