const groupsEl = document.getElementById('lineGroups');
const meta = document.getElementById('meta');
const error = document.getElementById('error');

const TFL_ENDPOINTS = [
  'https://api.tfl.gov.uk/Line/central,circle,hammersmith-city,metropolitan/Arrivals/940GZZLULVT',
  'https://api.tfl.gov.uk/Line/c2c,greater-anglia,weaver/Arrivals/910GLIVST',
  'https://api.tfl.gov.uk/Line/elizabeth/Arrivals/910GLIVSTLL'
];

const LINE_BRANDING = {
  'Central': { key: 'central', label: 'Central' },
  'Circle': { key: 'circle', label: 'Circle' },
  'Hammersmith & City': { key: 'hammersmith-city', label: 'Hammersmith & City' },
  'Metropolitan': { key: 'metropolitan', label: 'Metropolitan' },
  'Elizabeth line': { key: 'elizabeth-line', label: 'Elizabeth line' },
  'Weaver': { key: 'weaver', label: 'Weaver' },
  'Greater Anglia': { key: 'greater-anglia', label: 'Greater Anglia' },
  'c2c': { key: 'c2c', label: 'c2c' }
};
const LINE_ORDER_PRIORITY = ['elizabeth-line'];

async function loadTrains() {
  try {
    const trains = await fetchTfLTrains();

    renderGroups(trains);
    meta.textContent = `Showing ${trains.length} live services. Last updated ${new Date().toLocaleTimeString()}.`;
    error.classList.add('hidden');
  } catch (err) {
    groupsEl.innerHTML = '';
    meta.textContent = 'No data loaded.';
    error.textContent = err.message;
    error.classList.remove('hidden');
  }
}

async function fetchTfLTrains() {
  const responses = await Promise.all(TFL_ENDPOINTS.map((url) => fetch(url)));
  const failed = responses.find((response) => !response.ok);
  if (failed) {
    throw new Error('Failed to load live data from TfL API');
  }

  const payloads = await Promise.all(responses.map((response) => response.json()));
  const trains = payloads
    .flatMap((list) => list || [])
    .map((item) => ({
      boardType: item.modeName || modeFromLine(item.lineId),
      operator: item.lineName || 'Other services',
      destination: item.destinationName || 'Unknown',
      platform: item.platformName || '-',
      status: item.currentLocation || item.towards || '-',
      expectedTime: formatLondonTime(item.expectedArrival),
      expectedAt: item.expectedArrival || null
    }))
    .sort((a, b) => sortExpectedAt(a.expectedAt, b.expectedAt));

  return trains;
}

function renderGroups(trains) {
  if (!trains.length) {
    groupsEl.innerHTML = '<article class="line-card"><p class="empty">No live services found.</p></article>';
    return;
  }

  const grouped = trains.reduce((acc, train) => {
    const key = getLineKey(train.operator);
    if (!acc[key]) {
      acc[key] = {
        line: getLineMeta(train.operator),
        services: []
      };
    }
    acc[key].services.push(train);
    return acc;
  }, {});

  const cards = Object.values(grouped)
    .sort(sortLineGroups)
    .map((group) => renderGroupCard(group.line, group.services))
    .join('');

  groupsEl.innerHTML = cards;
}

function renderGroupCard(line, services) {
  const rows = services
    .map(
      (train) => `
      <tr>
        <td class="time" data-label="Expected">${train.expectedTime}</td>
        <td data-label="Destination">${escapeHtml(train.destination)}</td>
        <td data-label="Platform">${escapeHtml(train.platform)}</td>
        <td data-label="Status">${escapeHtml(train.status)}</td>
      </tr>`
    )
    .join('');

  return `
    <article class="line-card line-${line.key}">
      <header class="line-header">
        <h2>${escapeHtml(line.label)}</h2>
        <span>${services.length} services</span>
      </header>
      <table>
        <thead>
          <tr>
            <th>Expected</th>
            <th>Destination</th>
            <th>Platform</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </article>`;
}

function getLineMeta(operator) {
  return LINE_BRANDING[operator] || { key: 'default', label: operator || 'Other services' };
}

function getLineKey(operator) {
  return getLineMeta(operator).key;
}

function sortLineGroups(a, b) {
  const aPriority = LINE_ORDER_PRIORITY.indexOf(a.line.key);
  const bPriority = LINE_ORDER_PRIORITY.indexOf(b.line.key);

  if (aPriority !== -1 || bPriority !== -1) {
    if (aPriority === -1) return 1;
    if (bPriority === -1) return -1;
    return aPriority - bPriority;
  }

  return a.line.label.localeCompare(b.line.label);
}

function modeFromLine(lineId) {
  if (lineId === 'elizabeth') return 'elizabeth-line';
  if (lineId === 'weaver') return 'overground';
  if (lineId === 'greater-anglia' || lineId === 'c2c') return 'rail';
  return 'tube';
}

function formatLondonTime(isoDateTime) {
  if (!isoDateTime) return '-';
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/London'
  }).format(date);
}

function sortExpectedAt(a, b) {
  const at = a ? new Date(a).getTime() : Number.POSITIVE_INFINITY;
  const bt = b ? new Date(b).getTime() : Number.POSITIVE_INFINITY;
  return at - bt;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

loadTrains();
setInterval(loadTrains, 30000);
