/** Gleitender Mittelwert über ein zentriertes Fenster. Ränder nutzen ein verkürztes Fenster. */
export function glaetteHoehen(eleWerte, fensterGroesse = 9) {
  if (eleWerte.length === 0) return [];
  const halb = Math.floor(fensterGroesse / 2);
  return eleWerte.map((_, i) => {
    const von = Math.max(0, i - halb);
    const bis = Math.min(eleWerte.length - 1, i + halb);
    let summe = 0;
    for (let j = von; j <= bis; j += 1) summe += eleWerte[j];
    return summe / (bis - von + 1);
  });
}

/**
 * Kumulierter Anstieg.
 *
 * Die Voreinstellung zählt jede positive Höhendifferenz — ohne Glättung, ohne Schwelle. Für
 * die sechs Tourdateien ist das die richtige Wahl: Es sind Komoot-Planungsrouten, deren
 * Höhenwerte aus einem Geländemodell stammen und bereits glatt sind. Sie enthalten kein
 * GPS-Rauschen, das zu unterdrücken wäre. Die frühere Filterung war für aufgezeichnete
 * Fahrten gedacht und zog die Werte um rund ein Drittel zu tief: Tag 1 kam auf 113 statt
 * 207 Meter, Tag 6 auf 111 statt 281.
 *
 * Am 2026-08-08 gegen zwei unabhängige Quellen geprüft: ein Höhenmodell über die
 * Streckenkoordinaten und die Anstiegsangabe von bikerouter.de. Die ungefilterte Summe trifft
 * beide auf rund sechs Prozent, die gefilterte lag einunddreißig Prozent darunter. Der Nutzer
 * hat entschieden, auf die Portalwerte zu kalibrieren.
 *
 * Für eine echte, verrauschte GPS-Aufzeichnung stehen die Parameter weiterhin bereit:
 * `mindestDifferenzM` ist die Schwelle, ab der ein Höhengewinn zählt, `glaettung` die
 * Fenstergröße des gleitenden Mittels. Beide zusammen ergeben wieder das alte Verhalten.
 */
export function gesamtAnstiegM(eleWerte, mindestDifferenzM = 0, glaettung = 1) {
  const werte = glaettung > 1 ? glaetteHoehen(eleWerte, glaettung) : eleWerte;
  if (werte.length < 2) return 0;

  let anstieg = 0;
  let referenz = werte[0];

  for (let i = 1; i < werte.length; i += 1) {
    const differenz = werte[i] - referenz;
    if (differenz >= mindestDifferenzM) {
      anstieg += differenz;
      referenz = werte[i];
    } else if (differenz <= -mindestDifferenzM) {
      referenz = werte[i];
    }
  }

  return anstieg;
}
