import { glaetteHoehen } from './elevation.js';

/**
 * Erkennt zusammenhängende Anstiege in einem Höhenprofil. Ein Anstieg gilt erst dann als
 * beendet, wenn seit dem bisherigen Höchststand mehr als `maxAbfallM` Höhe verloren wurde —
 * kurze Zwischenabfahrten zerschneiden ihn also nicht. Nur Anstiege mit mindestens
 * `mindestGewinnM` Höhengewinn und `mindestLaengeKm` Länge werden zurückgegeben.
 *
 * Bekannte Einschränkung: Die Glättung über `glaetteHoehen` (zentriertes Fenster, schaut
 * auch in zukünftige Punkte) verschiebt Anstiegsbeginn und -gipfel um jeweils einige
 * Stichproben. Bei kurzen, scharfen Übergängen verwässert das die berechnete
 * `avgGradientPct` leicht. Das Fenster wurde absichtlich nicht verkleinert, um die in
 * Task 4 etablierte GPS-Rauschunterdrückung nicht zu schwächen.
 */
export function erkenneAnstiege(kmWerte, eleWerte, optionen = {}) {
  const { mindestGewinnM = 40, mindestLaengeKm = 0.5, maxAbfallM = 10 } = optionen;
  if (kmWerte.length < 2) return [];

  const ele = glaetteHoehen(eleWerte);
  const anstiege = [];

  let startIndex = 0;
  let hoechstIndex = 0;

  const abschliessen = () => {
    const gewinn = ele[hoechstIndex] - ele[startIndex];
    const laenge = kmWerte[hoechstIndex] - kmWerte[startIndex];
    if (gewinn >= mindestGewinnM && laenge >= mindestLaengeKm) {
      anstiege.push({
        startKm: Number(kmWerte[startIndex].toFixed(2)),
        lengthKm: Number(laenge.toFixed(2)),
        gainM: Math.round(gewinn),
        avgGradientPct: Number(((gewinn / (laenge * 1000)) * 100).toFixed(1))
      });
    }
  };

  for (let i = 1; i < ele.length; i += 1) {
    if (ele[i] > ele[hoechstIndex]) {
      hoechstIndex = i;
      continue;
    }
    if (ele[hoechstIndex] - ele[i] > maxAbfallM) {
      abschliessen();
      startIndex = i;
      hoechstIndex = i;
      continue;
    }
    // Solange noch kein Anstieg begonnen hat (Höchststand == Startpunkt), zieht ein
    // flaches oder fallendes Vorfeld den Startpunkt nach. Ohne dies würde ein Anstieg,
    // dem eine lange ebene Strecke vorausgeht, diese fälschlich mit einschließen, weil
    // ohne echten Höhengewinn nie ein Abfall über maxAbfallM auftritt, der zurücksetzt.
    if (hoechstIndex === startIndex && ele[i] <= ele[startIndex]) {
      startIndex = i;
      hoechstIndex = i;
    }
  }
  abschliessen();

  return anstiege;
}
