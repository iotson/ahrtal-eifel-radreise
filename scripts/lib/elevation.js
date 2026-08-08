/** Gleitender Mittelwert über ein zentriertes Fenster. Ränder nutzen ein verkürztes Fenster. */
export function glaetteHoehen(eleWerte, fensterGroesse = 1) {
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
 * Kumulierter Anstieg. Zählt erst, wenn seit dem letzten Referenzpunkt
 * mindestens `mindestDifferenzM` Höhengewinn zusammengekommen ist. Dadurch
 * fällt GPS-Rauschen heraus, ohne echte flache Anstiege zu verlieren.
 */
export function gesamtAnstiegM(eleWerte, mindestDifferenzM = 3) {
  const werte = glaetteHoehen(eleWerte);
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
