// Baut den Briefing-Text, den man morgens vor der Abfahrt hört.
// Der Text wird vorgelesen: kurze Hauptsätze, keine Klammern, keine Abkürzungen,
// Dezimalzahlen mit Komma. Und vor allem sparsam mit Zahlen.

const ZAHLWOERTER = [
  'null',
  'eins',
  'zwei',
  'drei',
  'vier',
  'fünf',
  'sechs',
  'sieben',
  'acht',
  'neun',
  'zehn',
  'elf',
  'zwölf'
];

// Für die Zählung der Zahlangaben. Die Artikel ein, eine, einen und so weiter
// fehlen absichtlich — sie sind keine Mengenangabe.
const ZAHLWORT_MUSTER = new RegExp(
  '\\b(?:' +
    [
      'null',
      'eins',
      'zwei',
      'drei',
      'vier',
      'fünf',
      'sechs',
      'sieben',
      'acht',
      'neun',
      'zehn',
      'elf',
      'zwölf',
      'dreizehn',
      'vierzehn',
      'fünfzehn',
      'sechzehn',
      'siebzehn',
      'achtzehn',
      'neunzehn',
      'zwanzig',
      'dreißig',
      'vierzig',
      'fünfzig',
      'sechzig',
      'siebzig',
      'achtzig',
      'neunzig',
      'hundert',
      'tausend',
      'erste[nrms]?',
      'zweite[nrms]?',
      'dritte[nrms]?',
      'vierte[nrms]?',
      'fünfte[nrms]?',
      'sechste[nrms]?',
      'letzte[nrms]?',
      'beide[nrms]?',
      'halb',
      'hälfte',
      'dutzend'
    ].join('|') +
    ')\\b',
  'giu'
);

/**
 * Zählt die Zahlangaben eines Textes: Ziffernfolgen und ausgeschriebene
 * Zahlwörter. "71,9" gilt als eine Angabe, die Artikel ein, eine und einen
 * zählen nicht mit.
 */
export function zaehleZahlangaben(text) {
  const ziffern = text.match(/\d+(?:,\d+)?/gu) ?? [];
  const woerter = text.match(ZAHLWORT_MUSTER) ?? [];
  return ziffern.length + woerter.length;
}

function komma(zahl, stellen = 1) {
  return zahl.toFixed(stellen).replace('.', ',');
}

function kilometerText(km) {
  return Number.isInteger(km) ? String(km) : komma(km);
}

function zahlwort(anzahl) {
  return ZAHLWOERTER[anzahl] ?? String(anzahl);
}

function grossGeschrieben(wort) {
  return wort.charAt(0).toUpperCase() + wort.slice(1);
}

/**
 * Die Fahrzeit wird auf volle Stunden gerundet. Eine Minutenangabe würde
 * morgens ohnehin niemand behalten, und sie kostet eine Zahlangabe.
 */
function fahrzeitText(minuten) {
  const stunden = Math.floor(minuten / 60);
  const rest = minuten % 60;

  if (stunden === 0) return `${zahlwort(rest)} Minuten`;

  if (rest > 35) {
    const aufgerundet = stunden + 1;
    return `knapp ${zahlwort(aufgerundet)} ${aufgerundet === 1 ? 'Stunde' : 'Stunden'}`;
  }

  const naehe = rest <= 10 ? 'rund' : 'gut';
  return `${naehe} ${zahlwort(stunden)} ${stunden === 1 ? 'Stunde' : 'Stunden'}`;
}

const STEIL_AB_PROZENT = 6;

function anstiegeText(climbs = []) {
  if (climbs.length === 0) {
    return 'Nennenswerte Anstiege gibt es nicht. Heute darfst du rollen.';
  }

  if (climbs.length === 1) {
    const [anstieg] = climbs;
    const wo = anstieg.startKm < 1 ? 'gleich hinter dem Start' : `bei Kilometer ${Math.round(anstieg.startKm)}`;
    const nachsatz =
      anstieg.avgGradientPct >= STEIL_AB_PROZENT ? ' Steil genug, um im Sitzen nicht durchzukommen.' : '';
    return `Ein Anstieg fällt ins Gewicht. Er beginnt ${wo} und bringt ${anstieg.gainM} Höhenmeter.${nachsatz}`;
  }

  // Bei mehreren Anstiegen wird nur die Anzahl genannt. Jeden einzeln zu
  // beschreiben würde das Zahlenbudget sprengen und behält ohnehin niemand.
  const steilste = Math.max(...climbs.map((c) => c.avgGradientPct));
  const bewertung =
    steilste >= STEIL_AB_PROZENT
      ? 'Einer davon wird richtig steil.'
      : 'Steil wird keiner davon, sie ziehen sich nur.';
  return `${grossGeschrieben(zahlwort(climbs.length))} Anstiege verteilen sich über den Tag. ${bewertung}`;
}

function aufzaehlung(namen) {
  if (namen.length === 1) return namen[0];
  return `${namen.slice(0, -1).join(', ')} und ${namen[namen.length - 1]}`;
}

/**
 * @param {object} tag Ein Eintrag aus tour.json.days, optional mit Feld `hinweis`.
 * @param {string[]} highlights POI-Namen, zwei bis drei je Tag.
 * @returns {string} Der vorlesbare Briefing-Text.
 */
export function baueBriefingText(tag, highlights = []) {
  const saetze = [`Guten Morgen. Tag ${tag.day} bringt dich von ${tag.startOrt} nach ${tag.zielOrt}.`];

  // Der Hinweis erklärt eine Eigenheit der Route und gehört vor die Kennzahlen,
  // damit sich unterwegs niemand wundert.
  if (tag.hinweis?.trim()) {
    saetze.push(tag.hinweis.trim());
  }

  saetze.push(`Vor dir liegen ${kilometerText(tag.lengthKm)} Kilometer und ${tag.elevationGainM} Höhenmeter.`);

  if (tag.estimatedRidingTimeMin > 0) {
    saetze.push(`Die reine Fahrzeit liegt bei ${fahrzeitText(tag.estimatedRidingTimeMin)}.`);
  }

  saetze.push(anstiegeText(tag.climbs));

  if (highlights.length > 0) {
    saetze.push(`Unterwegs warten ${aufzaehlung(highlights)}.`);
  }

  saetze.push('Gute Fahrt.');

  return saetze.join(' ');
}
