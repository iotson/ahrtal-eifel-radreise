/** Ab dieser Entfernung zur nächsten Station gilt man als nicht auf der Etappe. */
const AUF_DER_ETAPPE_KM = 5;

/** 'station', 'tour' oder null — welcher Knopf gerade als Stoppknopf dient. */
let aktiveAusgabe = null;

let tourDays = [];
let allStops = [];
let currentDay = 0;
let currentStop = 0;

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
      stops
    };
  });
}

function renderDayList() {
  const list = document.getElementById('day-list');
  list.innerHTML = '';

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

  const kopf = day.briefing
    ? `<h4 class="today-title">${day.briefing}</h4>`
    : `<h4 class="today-title">${day.start} nach ${day.end}</h4>
       <p class="today-text">Der Briefing-Text für diese Etappe ist noch nicht geschrieben.</p>`;

  const anstiege = day.climbs.length
    ? `<ul>${day.climbs.map((c) => `<li>${anstiegText(c)}</li>`).join('')}</ul>`
    : '<p class="today-text">Keine nennenswerten Anstiege.</p>';

  const hinweis = day.hinweis ? `<p class="today-text">${day.hinweis}</p>` : '';

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
    item.innerHTML = `<span class="stop-name">${stop.name}</span><span class="stop-meta">Kilometer ${zahl(stop.routeKm)}</span>`;
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
  beschrifte('play-whole-tour', '▶', 'Ganze Tour vorlesen');
}

function stoppeVorlesen() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  aktiveAusgabe = null;
  beschriftungenZuruecksetzen();
}

/** `quelle` ist 'station' oder 'tour' — daran hängt, welcher Knopf zum Stoppknopf wird. */
function speak(text, quelle) {
  if (!('speechSynthesis' in window)) {
    showToast('Sprachsynthese nicht verfügbar');
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  utterance.rate = 0.88;
  utterance.pitch = 1;

  const beenden = () => {
    if (aktiveAusgabe === quelle) {
      aktiveAusgabe = null;
      beschriftungenZuruecksetzen();
    }
  };
  utterance.onend = beenden;
  utterance.onerror = beenden;

  aktiveAusgabe = quelle;
  if (quelle === 'tour') {
    beschrifte('play-whole-tour', '⏹', 'Vorlesen stoppen');
  } else {
    beschrifte('read-stop', '⏹', 'Stopp');
  }

  window.speechSynthesis.speak(utterance);
  showToast('Vorlesen gestartet');
}

function startWholeTour() {
  if (allStops.length === 0) {
    showToast('Für diesen Tag gibt es noch keine Stationen');
    return;
  }

  const fullText = allStops.map((stop) => buildCurrentNarration(stop)).join(' ');
  speak(fullText, 'tour');
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
    speak(buildCurrentNarration(allStops[currentStop]), 'station');
  });

  document.getElementById('play-whole-tour').addEventListener('click', () => {
    if (aktiveAusgabe === 'tour') {
      stoppeVorlesen();
      showToast('Vorlesen beendet');
      return;
    }
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
