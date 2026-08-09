import { glaetteHoehen } from './elevation.js';

/**
 * Erkennt zusammenhängende Anstiege in einem Höhenprofil. Ein Anstieg gilt erst dann als
 * beendet, wenn seit dem bisherigen Höchststand mehr als `maxAbfallM` Höhe verloren wurde —
 * kurze Zwischenabfahrten zerschneiden ihn also nicht. Nur Anstiege mit mindestens
 * `mindestGewinnM` Höhengewinn, `mindestLaengeKm` Länge und `mindestSteigungPct`
 * Durchschnittssteigung werden zurückgegeben.
 *
 * Warum `mindestSteigungPct`: Ein langer, kaum merklicher Höhengewinn (z. B. 60 Höhenmeter
 * über 20 Kilometer, also 0,3 Prozent) erfüllt zwar Mindestgewinn und Mindestlänge, ist auf
 * dem Rad aber praktisch nicht spürbar. Unter etwa zwei Prozent Steigung nimmt man auf dem
 * Fahrrad kaum einen Unterschied wahr — eine Ansage im Morgen-Briefing wäre hier eher
 * verwirrend als hilfreich, weil sie eine Anstrengung suggeriert, die real nicht eintritt.
 * Deshalb muss zusätzlich zu Gewinn und Länge auch die mittlere Steigung eine spürbare
 * Schwelle überschreiten.
 *
 * Bekannte Einschränkung: Die Glättung über `glaetteHoehen` (zentriertes Fenster, schaut
 * auch in zukünftige Punkte) verschiebt Anstiegsbeginn und -gipfel um jeweils einige
 * Stichproben und rundet dadurch scharfe Übergänge am Anfang und Ende eines Anstiegs
 * bewusst ab. Bei kurzen, scharfen Übergängen senkt das die berechnete `avgGradientPct`
 * leicht gegenüber dem theoretischen Wert. Das Fenster wurde absichtlich nicht verkleinert,
 * um die in Task 4 etablierte GPS-Rauschunterdrückung nicht zu schwächen.
 */
export function erkenneAnstiege(kmWerte, eleWerte, optionen = {}) {
  const {
    mindestGewinnM = 40,
    mindestLaengeKm = 0.5,
    maxAbfallM = 10,
    mindestSteigungPct = 2
  } = optionen;
  if (kmWerte.length < 2) return [];

  const ele = glaetteHoehen(eleWerte);
  const anstiege = [];

  let startIndex = 0;
  let hoechstIndex = 0;

  const abschliessen = () => {
    const gewinn = ele[hoechstIndex] - ele[startIndex];
    const laenge = kmWerte[hoechstIndex] - kmWerte[startIndex];
    const steigungPct = laenge > 0 ? (gewinn / (laenge * 1000)) * 100 : 0;
    if (
      gewinn >= mindestGewinnM &&
      laenge >= mindestLaengeKm &&
      steigungPct >= mindestSteigungPct
    ) {
      anstiege.push({
        startKm: Number(kmWerte[startIndex].toFixed(2)),
        lengthKm: Number(laenge.toFixed(2)),
        gainM: Math.round(gewinn),
        avgGradientPct: Number(steigungPct.toFixed(1))
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
