const tourDays = [
  {
    title: 'Koblenz nach Findling',
    start: 'Koblenz',
    end: 'Findling',
    route: 'Tag 1',
    day: 1,
    filename: '2026-08-08_2725810240_Ahrtal und Eifel - Tag 1 - von Koblenz nach Findling.gpx',
    location: 'Rheintal / Ahrtal',
    summary: 'Koblenz, Rhein, Ahr und die ersten Eifel-Etappen. Historische Orte und die Tätigkeit am Fluss bestimmen die Ausfahrt.',
    todayHeadline: 'Heute erwartet dich die erste Etappe am Rhein und im Ahrtal.',
    todayText: 'Du erlebst Koblenz mit der Rhein-Mosel-Mündung, historische Uferorte und die erste ruhige Ahr-Route in die Eifel hinein.',
    lengthKm: 43,
    elevationMeters: 490,
    ascents: ['Ahr-Radweg zwischen Remagen und Sinzig', 'Sanfter Anstieg zur Eifel-Höhenlage']
  },
  {
    title: 'Findling nach Waldkönigen',
    start: 'Findling',
    end: 'Waldkönigen',
    route: 'Tag 2',
    day: 2,
    filename: '2026-08-08_2725810243_Ahrtal und Eifel - Tag 2 - von Findling nach Waldkönigen.gpx',
    location: 'Ahrtal / Eifel',
    summary: 'Rund um die Ahr und die Eifel: Vulkanlandschaft, Tunnels, stille Wasserflächen und Fernsicht über die Kulisse.',
    todayHeadline: 'Heute erwartet dich die Ahr in ihrer sanften, aber wechselreichen Kulisse.',
    todayText: 'Du erlebst kleine Ahr-Dörfer, Waldstücke, steilere Eifel-Passagen und ein ruhiges, grünes Landschaftsbild.',
    lengthKm: 52,
    elevationMeters: 720,
    ascents: ['Ahrsteigung bei Bad Neuenahr', 'Eifelaufstieg über Waldkönigen']
  },
  {
    title: 'Waldkönigen nach Pittenbach',
    start: 'Waldkönigen',
    end: 'Pittenbach',
    route: 'Tag 3',
    day: 3,
    filename: '2026-08-08_2725810245_Ahrtal und Eifel - Tag 3 - von Waldkönigen nach Pittenbach.gpx',
    location: 'Gerolstein / Kylltal / Eifel',
    summary: 'Von der Kyll durch Gerolstein bis in die hohe, grüne Eifel werden Natur, Technik und Kirchenorte sichtbar.',
    todayHeadline: 'Heute erwartet dich die zentrale Eifel mit ihren Flusstälern und kleinen Städten.',
    todayText: 'Du erlebst den Kylltal-Abschnitt, Gerolstein mit seinen alten Strukturen und eine grüne, hohe Landschaft.',
    lengthKm: 58,
    elevationMeters: 820,
    ascents: ['Kylltal-Wechsel am Fluss', 'Eifel-Höhenweg zur Kuppe bei Pittenbach']
  },
  {
    title: 'Pittenbach nach Bergweiler',
    start: 'Pittenbach',
    end: 'Bergweiler',
    route: 'Tag 4',
    day: 4,
    filename: '2026-08-08_2725810247_Ahrtal und Eifel - Tag 4 - von Pittenbach nach Bergweiler.gpx',
    location: 'Hohe Eifel / Hohes Venn',
    summary: 'Die Hocheifel macht den größten Eindruck: Wälder, Schlösser, Höhendifferenzen und stille Aussichten.',
    todayHeadline: 'Heute erwartet dich die Hocheifel mit ihren langen Fernsichten und der hohen Kulisse.',
    todayText: 'Du erlebst bewaldete Hügel, Schlösser, kleine Dörfer und die ruhige, offene Eifel-Landschaft.',
    lengthKm: 68,
    elevationMeters: 980,
    ascents: ['Hoch-Eifel-Aufstieg von Pittenbach', 'Bergweiler-Querung über die Hochlage']
  },
  {
    title: 'Bergweiler nach Nehren',
    start: 'Bergweiler',
    end: 'Nehren',
    route: 'Tag 5',
    day: 5,
    filename: '2026-08-08_2725810248_Ahrtal und Eifel - Tag 5 - von Bergweiler nach Nehren.gpx',
    location: 'Wittlich / Mosel / Ahr',
    summary: 'Die Mosel verbindet sich mit der Ahr: historische Orte, Weinberge, Dörfer und Brückenpoesie.',
    todayHeadline: 'Heute erwartet dich die Mosel- und Ahr-Kulisse mit Weinstraßen und Flusstälern.',
    todayText: 'Du erlebst Wittlich, Weinberge, Moselorte und die ersten ruhigen Übergänge in das Ahrtal zurück.',
    lengthKm: 61,
    elevationMeters: 640,
    ascents: ['Moselflanke bei Wittlich', 'Ahr-Rückweg mit leichter Steigung']
  },
  {
    title: 'Nehren nach Koblenz',
    start: 'Nehren',
    end: 'Koblenz',
    route: 'Tag 6',
    day: 6,
    filename: '2026-08-08_2725810250_Ahrtal und Eifel - Tag 6 - von Nehren nach Koblenz.gpx',
    location: 'Ahr / Mosel / Koblenz',
    summary: 'Der letzte Rückweg führt über Weinlagen, Moseltäler, Brücken und die alte Stadt Koblenz.',
    todayHeadline: 'Heute erwartet dich den letzten Abschnitt mit Fluss, Stadt und Rheinlandschaft.',
    todayText: 'Du erlebst die Ahr- und Mosel-Region in ihrer Bandbreite, mit Weinlagen, Brücken und dem Abschluss in Koblenz.',
    lengthKm: 47,
    elevationMeters: 430,
    ascents: ['Ahr-Tal-Rückweg', 'Zielanpassung zum Koblenzer Rheinufer']
  }
];

const poiLibrary = {
  'Deutsches Eck': {
    type: 'Historischer Ort',
    tags: ['Koblenz', 'Rhein-Mosel-Mündung', 'Historie'],
    story: 'Das Deutsche Eck ist die symbolische Stelle an der Rhein-Mosel-Mündung, wo die Stadt Koblenz ihre Erinnerung an die deutsche Kaiserzeit und ihre Stellung am Wasser verbindet. Der Platz gilt seit langem als markanter Treffpunkt der Region.'
  },
  'Schloss Engers': {
    type: 'Architektur',
    tags: ['Schloss', 'Rhein', 'Adel'],
    story: 'Das Schloss Engers ist ein beeindruckender Bau an der Innenfront des Rheintals. Es zeigt die lange Verbindung der Region mit Burg- und Verwaltungsbauten, die über Jahrhunderte das Landschaftsbild prägten.'
  },
  'Schloss Arenfels': {
    type: 'Burg',
    tags: ['Burg', 'Landschaft', 'Rhein'],
    story: 'Schloss Arenfels ist eine der bedeutenden Burganlagen am Mittelrhein. Die Lage über dem Fluss macht die Burg zu einem Blickpunkt auf die historische Rheinschifffahrts- und Uferkultur.'
  },
  'Sinziger Mineralbrunnen': {
    type: 'Kultur / Natur',
    tags: ['Mineralwasser', 'Kultur', 'Ahr'],
    story: 'Der Sinziger Mineralbrunnen ist ein Hinweis auf die Wasserkultur der Ahrregion. Mineralwasser und Kurtradition haben in den Ahrorten eine lange Bedeutung, besonders als Teil von Ausflügen und regionaler Lebensweise.'
  },
  'Alte Kapelle am Ahr-Radweg': {
    type: 'Kulturlandschaft',
    tags: ['Kapelle', 'Ahr', 'Pilgerweg'],
    story: 'Die Alte Kapelle unmittelbar am Ahr-Radweg ist ein kleines Zeugnis der religiösen und dörflichen Geschichte der Ahrregion. Solche Kapellen markieren die Wege und boten Wegmarken zwischen Ort und Tal.'
  },
  'Abtei Himmerod': {
    type: 'Historische Klosteranlage',
    tags: ['Kloster', 'Kirchenbau', 'Eifel'],
    story: 'Die Abtei Himmerod liegt in der Eifel und berichtet von einer klösterlichen Geschichte, die sich mit Landnutzung, Wirtschaft und religiösem Leben in dieser Region verbindet. Diese Monasterien prägten die Eifel über viele Jahrhunderte.'
  },
  'Landschaft bei Wittlich': {
    type: 'Natur',
    tags: ['Eifel', 'Wein', 'Mosel'],
    story: 'Die Wege um Wittlich wechseln zwischen sanftem Mittelgebirge, Weinbergen und Flusstälern. Diese Landschaft bildet den Übergang zwischen der Mosel und der Eifel, mit Blicken auf Wasser, Schiefer und bewaldete Höhen.'
  },
  'Hochmoselübergang': {
    type: 'Technik',
    tags: ['Brücke', 'Mosel', 'Technik'],
    story: 'Der Hochmoselübergang ist ein herausragendes technisches Bauwerk der Region. Die Brücke zeigt, wie die Moselregion sowohl von Natur als auch von Infrastruktur durchzogen ist, denn die Moseltäler sind seit Jahrhunderten mit Brücken und Wegen verbunden.'
  },
  'Traben-Trarbach': {
    type: 'Altstadt / Wein',
    tags: ['Mosel', 'Altstadt', 'Wein'],
    story: 'Traben-Trarbach ist ein typisches Mosel-Dorf mit historischer Architektur und enger Beziehung zur Weinwirtschaft. Die Moselregion ist nicht nur eine Landschaft, sondern auch eine Kultur der Weinberge, Keller und Dörfer.'
  },
  'Kobern-Gondorf': {
    type: 'Historische Altstadt',
    tags: ['Mosel', 'Altstadt', 'Geschichte'],
    story: 'Kobern-Gondorf gehört zur Mosel-Altstadtlandschaft, mit enger Bebauung, Mittelrhein-typischer Architektur und der Beziehung zu Ufer, Fluss und Wein. Die Orte markieren die Lebensader der Mosel seit frühester Zeit.'
  },
  'Burg Metternich': {
    type: 'Burgenland',
    tags: ['Burg', 'Ahr', 'Aussicht'],
    story: 'Burg Metternich schaut auf das Ahrtal und erinnert an die lange Verteidigungs- und Herrschaftskultur am Rheinsystem. Suchende finden an diesem Punkt eine klar sichtbare Verbindung von Landschaft und Geschichte.'
  },
  'Reichsburg Cochem': {
    type: 'Burg / Weinanbau',
    tags: ['Burg', 'Cochem', 'Mosel'],
    story: 'Die Reichsburg Cochem ist eine der auffälligsten Burgen an der Mosel und gehört zur kulturellen Identität der Region. Die Nähe zur Mosel macht sie zugleich zu einem Sinnbild für Wein, Fluss und historische Marktwirtschaft.'
  },
  'Blick auf die Eifellandschaft': {
    type: 'Natur',
    tags: ['Eifel', 'Panorama', 'Landschaft'],
    story: 'Die Eifel zeigt sich hier als eine hohe, grüne Landschaft mit Mooren, Wäldern, Vulkanbildern und Wasser. Die stille Ruhe dieser Region ist besonders im Radfahren spürbar.'
  }
};

let allStops = [];
let currentDay = 0;
let currentStop = 0;

function parseGpx(xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'text/xml');
  const points = Array.from(xml.querySelectorAll('wpt'));

  return points.map((wpt, index) => {
    const name = wpt.querySelector('name')?.textContent || `Wegpunkt ${index + 1}`;
    const lat = Number(wpt.getAttribute('lat'));
    const lon = Number(wpt.getAttribute('lon'));
    const meta = poiLibrary[name] || {
      type: 'Wegpunkt',
      tags: ['Radweg', 'Reise'],
      story: `Der Wegpunkt ${name} ist Teil der Fahrradtour durch die Ahr-Eifel-Region. Er verbindet die Route mit der Landschaft, den Dörfern und den regionalen Erzählungen.`
    };

    return {
      name,
      lat,
      lon,
      type: meta.type,
      tags: meta.tags,
      story: meta.story
    };
  });
}

function fetchGpxDay(fileName) {
  const url = encodeURI(fileName);
  return fetch(url)
    .then(response => response.text())
    .then(text => parseGpx(text));
}

function renderDayList() {
  const list = document.getElementById('day-list');
  tourDays.forEach((day, index) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = `<span class="route-day">${day.route}</span><span class="route-title">${day.title}</span>`;
    button.addEventListener('click', () => loadDay(index));
    li.appendChild(button);
    list.appendChild(li);
  });
}

function renderDayOverview(day) {
  const summary = document.getElementById('day-summary');
  if (!summary) {
    return;
  }

  summary.innerHTML = `
    <article class="today-overview">
      <div class="section-kicker">Heute erwartet dich</div>
      <h4 class="today-title">${day.todayHeadline}</h4>
      <p class="today-text">Du erlebst ${day.todayText}</p>
      <div class="today-metrics">
        <div class="metric-card">
          <span class="metric-value">${day.lengthKm} km</span>
          <span class="metric-label">Strecke</span>
        </div>
        <div class="metric-card">
          <span class="metric-value">${day.elevationMeters} m</span>
          <span class="metric-label">Höhenmeter</span>
        </div>
        <div class="metric-card">
          <span class="metric-value">${day.ascents.length}</span>
          <span class="metric-label">Anstiege</span>
        </div>
      </div>
      <div class="ascent-list">
        <span class="ascent-title">Anstiege</span>
        <ul>
          ${day.ascents.map(asc => `<li>${asc}</li>`).join('')}
        </ul>
      </div>
    </article>
  `;
}

function loadDay(index) {
  const day = tourDays[index];
  currentDay = index;
  currentStop = 0;

  document.getElementById('route-code').textContent = `Tour 2026 · ${day.route}`;
  document.getElementById('route-title').textContent = day.title;
  document.getElementById('route-summary').textContent = day.summary;
  document.getElementById('route-location').textContent = day.location;
  document.getElementById('day-number').textContent = `Tag ${day.day}`;
  renderDayOverview(day);

  fetchGpxDay(day.filename)
    .then(stops => {
      allStops = stops;
      document.getElementById('stop-count').textContent = String(stops.length);
      renderStops(stops);
      renderStop(stops[0], 1);

      document.querySelectorAll('#day-list button').forEach((btn, btnIndex) => {
        btn.classList.toggle('active', btnIndex === currentDay);
      });
    })
    .catch(error => {
      console.error(error);
      showToast('Tourdaten konnten nicht geladen werden');
    });
}

function renderStops(stops) {
  const list = document.getElementById('stop-list');
  list.innerHTML = '';

  stops.forEach((stop, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'stop-item';
    item.innerHTML = `<span class="stop-name">${stop.name}</span><span class="stop-meta">Station ${index + 1}</span>`;
    item.addEventListener('click', () => {
      currentStop = index;
      renderStop(stop, index + 1);
      updateStopListSelection();
    });
    list.appendChild(item);
  });
}

function renderStop(stop, stopNumber) {
  document.getElementById('active-stop-title').textContent = `${tourDays[currentDay].route} · Station ${stopNumber}`;
  document.getElementById('poi-name').textContent = stop.name;
  document.getElementById('poi-type').textContent = stop.type;
  document.getElementById('poi-distance').textContent = `Station ${stopNumber}`;
  document.getElementById('poi-story').textContent = stop.story;

  const tags = document.getElementById('poi-tags');
  tags.innerHTML = '';
  stop.tags.forEach(tag => {
    const t = document.createElement('span');
    t.className = 'tag';
    t.textContent = tag;
    tags.appendChild(t);
  });
}

function updateStopListSelection() {
  const items = document.querySelectorAll('#stop-list .stop-item');
  items.forEach((item, index) => {
    item.classList.toggle('active', index === currentStop);
  });
}

function buildCurrentNarration(stop) {
  return `${stop.name}. ${stop.story}`;
}

function speak(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.88;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
    showToast('Vorlesen gestartet');
  } else {
    showToast('Sprachsynthese nicht verfügbar');
  }
}

function startWholeTour() {
  if (allStops.length === 0) {
    return;
  }

  const fullText = allStops.map((stop, index) => `${index + 1}. ${stop.name}. ${stop.story}`).join(' ');
  speak(fullText);
}

function initControls() {
  document.getElementById('prev-stop').addEventListener('click', () => {
    if (!allStops.length) return;
    currentStop = (currentStop - 1 + allStops.length) % allStops.length;
    renderStop(allStops[currentStop], currentStop + 1);
    updateStopListSelection();
  });

  document.getElementById('next-stop').addEventListener('click', () => {
    if (!allStops.length) return;
    currentStop = (currentStop + 1) % allStops.length;
    renderStop(allStops[currentStop], currentStop + 1);
    updateStopListSelection();
  });

  document.getElementById('read-stop').addEventListener('click', () => {
    if (!allStops.length) return;
    const stop = allStops[currentStop];
    speak(buildCurrentNarration(stop));
  });

  document.getElementById('play-whole-tour').addEventListener('click', () => {
    startWholeTour();
  });
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  window.setTimeout(() => toast.classList.remove('visible'), 2200);
}

function useGeolocation() {
  if (!navigator.geolocation) {
    showToast('Geolocation nicht verfügbar');
    return;
  }

  const options = {
    enableHighAccuracy: true,
    maximumAge: 15000,
    timeout: 10000
  };

  navigator.geolocation.watchPosition((position) => {
    const { latitude, longitude } = position.coords;
    const nearest = findNearestStop(latitude, longitude);

    if (!nearest) {
      return;
    }

    if (nearest.index !== currentStop) {
      currentStop = nearest.index;
      renderStop(allStops[currentStop], currentStop + 1);
      updateStopListSelection();
    }

    const distanceKm = nearest.distanceKm;
    const locationLabel = document.getElementById('route-location');
    locationLabel.textContent = `${tourDays[currentDay].location} · ${Math.round(distanceKm * 1000)} m bis ${nearest.stop.name}`;
  }, (error) => {
    console.warn(error);
    showToast('Standortzugriff nicht möglich');
  }, options);
}

function findNearestStop(lat, lon) {
  if (!allStops.length) return null;

  let nearest = null;
  allStops.forEach((stop, index) => {
    const d = calculateDistanceKm(lat, lon, stop.lat, stop.lon);
    if (!nearest || d < nearest.distanceKm) {
      nearest = { stop, index, distanceKm: d };
    }
  });

  return nearest;
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(value) {
  return value * Math.PI / 180;
}

function initPwa() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((error) => {
        console.warn('Service Worker konnte nicht registriert werden:', error);
      });
    });
  }
}

function init() {
  renderDayList();
  initControls();
  initPwa();
  loadDay(0);
  useGeolocation();
}

init();
