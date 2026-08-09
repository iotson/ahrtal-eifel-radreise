/** Ab dieser Entfernung zur nächsten Station gilt man als nicht auf der Etappe. */
const AUF_DER_ETAPPE_KM = 5;

/** 'station' oder null — ob die Stationsausgabe gerade läuft. */
let aktiveAusgabe = null;

let tourDays = [];
let allStops = [];
let currentDay = 0;
let currentStop = 0;

let routeMap = null;
let routeLayer = null;
let stopMarkersLayer = null;

function zahl(wert, stellen = 1) {
  return Number(wert).toFixed(stellen).replace('.', ',');
}

function fahrzeitText(minuten) {
  if (!minuten) return '—';
  const stunden = Math.floor(minuten / 60);
  const rest = minuten % 60;
  return stunden > 0 ? `${stunden} h ${String(rest).padStart(2, '0')} min` : `${rest} min`;
}

function anstiegText(climb) {
  return `ab Kilometer ${zahl(climb.startKm)} · ${zahl(climb.lengthKm)} km · ${climb.gainM} Höhenmeter · ${zahl(climb.avgGradientPct)} Prozent`;
}

function ladeJson(pfad) {
  return fetch(pfad).then((response) => {
    if (!response.ok) {
      throw new Error(`${pfad} lieferte ${response.status}`);
    }
    return response.json();
  });
}

/** Führt tour.json und pois.json zu den Tagesobjekten zusammen, die die Oberfläche braucht. */
function baueTourDays(tour, pois) {
  const poisJeTag = new Map();
  (pois?.days ?? []).forEach((eintrag) => poisJeTag.set(eintrag.day, eintrag));

  return tour.days.map((tag) => {
    const eintrag = poisJeTag.get(tag.day);
    const stops = [...(eintrag?.pois ?? [])].sort((a, b) => a.routeKm - b.routeKm);

    return {
      day: tag.day,
      route: `Tag ${tag.day}`,
      title: tag.title,
      start: tag.startOrt,
      end: tag.zielOrt,
      location: `${tag.startOrt} nach ${tag.zielOrt}`,
      lengthKm: tag.lengthKm,
      elevationGainM: tag.elevationGainM,
      climbs: tag.climbs ?? [],
      ridingTimeMin: tag.estimatedRidingTimeMin,
      hinweis: tag.hinweis ?? null,
      briefing: eintrag?.briefing?.text?.trim() || '',
      gpxFile: tag.file,
      stops
    };
  });
}

/**
 * Werte aus den JSON-Dateien gehören über `textContent` in die Seite, nicht in einen
 * Template-String: Der erste POI-Name mit einem Kaufmannsund oder einem spitzen Klammerzeichen
 * würde als Markup gelesen und die Darstellung zerlegen.
 */
function spanMitText(klasse, text) {
  const span = document.createElement('span');
  span.className = klasse;
  span.textContent = text;
  return span;
}

function renderDayList() {
  const list = document.getElementById('day-list');
  list.innerHTML = '';

  tourDays.forEach((day, index) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.appendChild(spanMitText('route-day', day.route));
    button.appendChild(spanMitText('route-title', day.title));
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

  // Das Briefing ist ein ganzer Absatz und gehört deshalb in den Fließtext, nicht in die
  // Überschrift. Die Überschrift trägt die Etappe — die ist kurz genug, um eine zu sein.
  const kopf = `<h4 class="today-title"></h4>
       <p class="today-text today-briefing"></p>`;

  const anstiege = day.climbs.length
    ? `<ul>${day.climbs.map((c) => `<li>${anstiegText(c)}</li>`).join('')}</ul>`
    : '<p class="today-text">Keine nennenswerten Anstiege.</p>';

  // Der Hinweis steckt bereits im Briefing-Text. Doppelt gezeigt wirkt er wie ein Fehler,
  // deshalb erscheint er nur, solange noch kein Briefing geschrieben ist.
  const hinweis = day.hinweis && !day.briefing ? '<p class="today-text today-hinweis"></p>' : '';

  summary.innerHTML = `
    <article class="today-overview">
      <div class="section-kicker">Heute erwartet dich</div>
      ${kopf}
      ${hinweis}
      <div class="today-metrics">
        <div class="metric-card">
          <span class="metric-value">${zahl(day.lengthKm)} km</span>
          <span class="metric-label">Strecke</span>
        </div>
        <div class="metric-card">
          <span class="metric-value">${day.elevationGainM} m</span>
          <span class="metric-label">Höhenmeter</span>
        </div>
        <div class="metric-card">
          <span class="metric-value">${fahrzeitText(day.ridingTimeMin)}</span>
          <span class="metric-label">Fahrzeit</span>
        </div>
      </div>
      <div class="ascent-list">
        <span class="ascent-title">Anstiege</span>
        ${anstiege}
      </div>
    </article>
  `;

  // Briefing und Hinweis kommen aus den JSON-Dateien und werden erst hier als Text gesetzt.
  summary.querySelector('.today-title').textContent = `${day.start} nach ${day.end}`;
  summary.querySelector('.today-briefing').textContent =
    day.briefing || 'Der Briefing-Text für diese Etappe ist noch nicht geschrieben.';

  const hinweisAbsatz = summary.querySelector('.today-hinweis');
  if (hinweisAbsatz) {
    hinweisAbsatz.textContent = day.hinweis;
  }
}

function loadDay(index) {
  const day = tourDays[index];
  currentDay = index;
  currentStop = 0;
  allStops = day.stops;

  // Sonst liefe der Text der vorigen Etappe weiter, während schon die neue zu sehen ist.
  stoppeVorlesen();

  document.getElementById('route-code').textContent = `Tour 2026 · ${day.route}`;
  document.getElementById('route-title').textContent = day.title;
  document.getElementById('route-summary').textContent = day.briefing
    || `${zahl(day.lengthKm)} Kilometer, ${day.elevationGainM} Höhenmeter, ${day.stops.length} Stationen.`;
  document.getElementById('route-location').textContent = day.location;
  document.getElementById('day-number').textContent = `Tag ${day.day}`;
  document.getElementById('stop-count').textContent = String(day.stops.length);
  document.getElementById('distance-label').textContent = `${zahl(day.lengthKm)} km`;

  renderRouteMap(day);
  renderDayOverview(day);
  renderStops(day.stops);

  if (day.stops.length) {
    renderStop(day.stops[0], 1);
  } else {
    renderLeererTag(day);
  }

  document.querySelectorAll('#day-list button').forEach((btn, btnIndex) => {
    btn.classList.toggle('active', btnIndex === currentDay);
  });
}

function renderLeererTag(day) {
  document.getElementById('active-stop-title').textContent = `${day.route} · noch keine Stationen`;
  document.getElementById('poi-name').textContent = 'Recherche ausstehend';
  document.getElementById('poi-type').textContent = 'In Arbeit';
  document.getElementById('poi-distance').textContent = '—';
  document.getElementById('poi-story').textContent =
    `Für ${day.title} sind die Inhalte noch nicht recherchiert. Strecke und Höhenprofil stehen bereits fest.`;
  document.getElementById('poi-tags').innerHTML = '';
}

function renderStops(stops) {
  const list = document.getElementById('stop-list');
  list.innerHTML = '';

  stops.forEach((stop, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'stop-item';
    item.appendChild(spanMitText('stop-name', stop.name));
    item.appendChild(spanMitText('stop-meta', `Kilometer ${zahl(stop.routeKm)}`));
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
  document.getElementById('poi-type').textContent = stop.category;
  document.getElementById('poi-distance').textContent = `Kilometer ${zahl(stop.routeKm)}`;
  document.getElementById('poi-story').textContent = stop.textLong || stop.textShort || stop.accessNote || '';

  const tags = document.getElementById('poi-tags');
  tags.innerHTML = '';

  const marken = [stop.category];
  if (stop.accessNote) marken.push(stop.accessNote);
  if (stop.kind === 'service') marken.push('Service');

  marken.forEach((marke) => {
    const t = document.createElement('span');
    t.className = 'tag';
    t.textContent = marke;
    tags.appendChild(t);
  });
}

function updateStopListSelection() {
  const items = document.querySelectorAll('#stop-list .stop-item');
  items.forEach((item, index) => {
    item.classList.toggle('active', index === currentStop);
  });
}

/** Im Fahren wird der Kurztext gesprochen, nicht der lange Text aus der Detailansicht. */
function buildCurrentNarration(stop) {
  const text = stop.textShort || stop.textLong;
  return text ? `${stop.name}. ${text}` : stop.name;
}

function beschrifte(id, icon, text) {
  const button = document.getElementById(id);
  if (button) {
    button.innerHTML = `<span aria-hidden="true">${icon}</span> ${text}`;
  }
}

function beschriftungenZuruecksetzen() {
  beschrifte('read-stop', '🔊', 'Vorlesen');
}

/**
 * Zählt jeden Start und jeden Stopp hoch. Eine laufende Vorlese-Kette vergleicht ihren beim
 * Start gemerkten Wert mit diesem hier und bricht ab, sobald er sich geändert hat. Nötig, weil
 * `speechSynthesis.cancel()` je nach Browser noch ein `onend` nachwirft — ohne diese Marke
 * würde der Stoppknopf die Kette anhalten und ihr eigenes `onend` sie sofort fortsetzen.
 */
let ausgabeLauf = 0;

function neueAusgabe() {
  ausgabeLauf += 1;
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  return ausgabeLauf;
}

function setzeStoppKnopf() {
  beschrifte('read-stop', '⏹', 'Stopp');
}

function stoppeVorlesen() {
  neueAusgabe();
  aktiveAusgabe = null;
  beschriftungenZuruecksetzen();
}

/**
 * Spricht genau eine Äußerung. `lauf` ist die beim Start gemerkte Marke; `beiEnde` setzt die
 * Kette fort. Ohne `beiEnde` ist nach dieser Äußerung Schluss.
 */
function sprichAus(text, lauf, beiEnde) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  utterance.rate = 0.88;
  utterance.pitch = 1;

  const beenden = () => {
    if (lauf !== ausgabeLauf) {
      return;
    }
    if (beiEnde) {
      beiEnde();
      return;
    }
    aktiveAusgabe = null;
    beschriftungenZuruecksetzen();
  };
  utterance.onend = beenden;
  utterance.onerror = beenden;

  window.speechSynthesis.speak(utterance);
}

function speak(text) {
  if (!('speechSynthesis' in window)) {
    showToast('Sprachsynthese nicht verfügbar');
    return;
  }

  const lauf = neueAusgabe();

  beschriftungenZuruecksetzen();
  aktiveAusgabe = 'station';
  setzeStoppKnopf();

  sprichAus(text, lauf, null);
  showToast('Vorlesen gestartet');
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
    if (aktiveAusgabe === 'station') {
      stoppeVorlesen();
      showToast('Vorlesen beendet');
      return;
    }
    if (!allStops.length) return;
    speak(buildCurrentNarration(allStops[currentStop]));
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

    // Wer nicht auf der Etappe ist, soll nicht auf eine Station geworfen bekommen,
    // die hundert Kilometer entfernt liegt.
    if (!nearest || nearest.distanceKm > AUF_DER_ETAPPE_KM) {
      return;
    }

    if (nearest.index !== currentStop) {
      currentStop = nearest.index;
      renderStop(allStops[currentStop], currentStop + 1);
      updateStopListSelection();
    }

    const meter = Math.round(nearest.distanceKm * 1000);
    document.getElementById('route-location').textContent =
      `${tourDays[currentDay].location} · ${meter} m bis ${nearest.stop.name}`;
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

function initRouteMap() {
  if (typeof L === 'undefined') {
    console.warn('Leaflet konnte nicht geladen werden');
    return;
  }

  routeMap = L.map('route-map', { attributionControl: false, zoomControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(routeMap);
  L.control.attribution({ prefix: false }).addTo(routeMap);
  routeMap.setView([50.4, 7.2], 9);

  window.addEventListener('resize', () => routeMap.invalidateSize());
}

/** Parst die trkpt-Punkte aus einer GPX-Datei zu Leaflet-LatLng-Paaren. */
function parseGpxTrack(gpxText) {
  const doc = new DOMParser().parseFromString(gpxText, 'application/xml');
  return Array.from(doc.getElementsByTagName('trkpt')).map((punkt) => [
    Number(punkt.getAttribute('lat')),
    Number(punkt.getAttribute('lon'))
  ]);
}

function renderRouteMap(day) {
  if (!routeMap) return;

  if (routeLayer) {
    routeMap.removeLayer(routeLayer);
    routeLayer = null;
  }
  if (stopMarkersLayer) {
    routeMap.removeLayer(stopMarkersLayer);
    stopMarkersLayer = null;
  }

  stopMarkersLayer = L.layerGroup(
    day.stops.map((stop, index) =>
      L.circleMarker([stop.lat, stop.lon], {
        radius: 6,
        color: '#1f4d24',
        weight: 2,
        fillColor: '#def1b4',
        fillOpacity: 1
      })
        .bindTooltip(stop.name)
        .on('click', () => {
          currentStop = index;
          renderStop(stop, index + 1);
          updateStopListSelection();
        })
    )
  ).addTo(routeMap);

  const stopBounds = L.latLngBounds(day.stops.map((stop) => [stop.lat, stop.lon]));

  if (!day.gpxFile) {
    if (stopBounds.isValid()) routeMap.fitBounds(stopBounds, { padding: [20, 20] });
    return;
  }

  fetch(encodeURI(day.gpxFile))
    .then((response) => {
      if (!response.ok) throw new Error(`${day.gpxFile} lieferte ${response.status}`);
      return response.text();
    })
    .then((gpxText) => {
      const punkte = parseGpxTrack(gpxText);
      if (!punkte.length) throw new Error('Keine Trackpunkte in der GPX-Datei');

      routeLayer = L.polyline(punkte, { color: '#2e6e41', weight: 4 }).addTo(routeMap);
      routeMap.fitBounds(routeLayer.getBounds(), { padding: [20, 20] });
    })
    .catch((error) => {
      console.warn('GPX-Route konnte nicht geladen werden:', error);
      if (stopBounds.isValid()) routeMap.fitBounds(stopBounds, { padding: [20, 20] });
    });
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
  initControls();
  initPwa();
  initRouteMap();

  Promise.all([ladeJson('data/tour.json'), ladeJson('data/pois.json')])
    .then(([tour, pois]) => {
      tourDays = baueTourDays(tour, pois);
      renderDayList();
      loadDay(0);
      useGeolocation();
    })
    .catch((error) => {
      console.error(error);
      showToast('Tourdaten konnten nicht geladen werden');
    });
}

init();
