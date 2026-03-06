const groupsEl = document.getElementById('lineGroups');
const meta = document.getElementById('meta');
const error = document.getElementById('error');
const liveClockValue = document.getElementById('liveClockValue');

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
const LINE_FACTS = {
  'elizabeth-line': [
    'Opened in 2022 and can run up to 24 trains per hour through central London.',
    'Its central stations have platform screen doors, a first for mainline rail in the UK.',
    'It uses longer trains and wider carriages than deep-level Tube lines.',
    'The line links Heathrow Airport directly with central and east London.',
    'It is commonly branded as the Elizabeth line, but its route code is Crossrail.'
  ],
  'central': [
    'The Central line is one of the longest Tube lines, stretching from west to east London.',
    'It first opened in 1900 as the Central London Railway.',
    'Its roundel color is one of the most recognizable reds on the Tube map.',
    'Large parts of the line run in deep-level tunnels under central London.',
    'It serves both shopping hubs and major commuter suburbs.'
  ],
  'circle': [
    'It became a full loop line in 1949 and now includes an extension to Hammersmith.',
    'Its route connects many of London’s biggest interchange stations.',
    'The Circle line shares tracks with multiple other sub-surface lines.',
    'Its yellow map color makes it one of the easiest lines to spot at a glance.',
    'It no longer runs only as a simple closed loop.'
  ],
  'hammersmith-city': [
    'It shares large sections of track with the Circle and Metropolitan lines.',
    'Its pink color was adopted on the Tube map in 1990.',
    'The line serves both Paddington and Liverpool Street corridors.',
    'It is one of London Underground’s sub-surface routes.',
    'Many of its stations are among the oldest in the network.'
  ],
  'metropolitan': [
    "Opened in 1863, it's part of the world's first underground railway.",
    'It was originally built using cut-and-cover tunneling.',
    'Some Metropolitan line services run far out into outer northwest London.',
    'Its magenta color has been used in London branding for decades.',
    'It is one of the few Underground lines with fast and semi-fast services.'
  ],
  'weaver': [
    'The Weaver line is named after the area’s textile and craft heritage in east London.',
    'It is part of the London Overground network serving Liverpool Street routes.',
    'The line connects inner east London with Essex commuter towns.',
    'Its branding uses the London Overground orange family palette.',
    'Services share infrastructure with national rail in several sections.'
  ],
  'greater-anglia': [
    'Greater Anglia links Liverpool Street with Essex, Suffolk, Norfolk and beyond.',
    'Its intercity routes include services to Norwich and Ipswich.',
    'Liverpool Street is one of its key commuter gateways into London.',
    'The operator has introduced a newer fleet across many routes.',
    'It runs both stopping commuter services and longer-distance journeys.'
  ],
  'c2c': [
    'c2c is known for short commuter routes between London, south Essex and the Thames estuary.',
    'Its London terminus is Fenchurch Street, with interchange options nearby.',
    'The c2c route is one of the UK’s more punctual commuter corridors.',
    'Many c2c stations are close to coastal and riverside towns.',
    'Services primarily operate on the London, Tilbury and Southend line.'
  ]
};
const ACTIVE_LINE_FACTS = selectFactsForSession();

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
  const fact = getLineFact(line.key);
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
        <div class="line-title">
          <h2>${escapeHtml(line.label)}</h2>
          <p>${escapeHtml(fact)}</p>
        </div>
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

function getLineFact(lineKey) {
  return ACTIVE_LINE_FACTS[lineKey] || 'Live services for this line are shown below.';
}

function selectFactsForSession() {
  return Object.entries(LINE_FACTS).reduce((acc, [lineKey, facts]) => {
    acc[lineKey] = facts[Math.floor(Math.random() * facts.length)];
    return acc;
  }, {});
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

function updateLiveClock() {
  if (!liveClockValue) return;
  liveClockValue.textContent = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Europe/London'
  }).format(new Date());
}

updateLiveClock();
setInterval(updateLiveClock, 1000);
loadTrains();
setInterval(loadTrains, 30000);
