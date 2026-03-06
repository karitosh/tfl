import 'dotenv/config';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

const TFL_BASE_URL = 'https://api.tfl.gov.uk';
const LIVERPOOL_STREET_SOURCES = [
  {
    endpoint:
      '/Line/central,circle,hammersmith-city,metropolitan/Arrivals/940GZZLULVT',
    boardType: 'tube'
  },
  {
    endpoint: '/Line/c2c,greater-anglia,weaver/Arrivals/910GLIVST',
    boardType: 'rail'
  },
  {
    endpoint: '/Line/elizabeth/Arrivals/910GLIVSTLL',
    boardType: 'elizabeth-line'
  }
];

app.use(express.static('public'));

app.get('/api/trains', async (_req, res) => {
  try {
    const responses = await Promise.all(
      LIVERPOOL_STREET_SOURCES.map((source) => fetch(buildTfLUrl(source.endpoint)))
    );

    const failed = responses.find((response) => !response.ok);
    if (failed) {
      return res.status(failed.status).json({
        error: 'Failed to fetch live train data from TfL API.'
      });
    }

    const payloads = await Promise.all(responses.map((response) => response.json()));
    const trains = normalizeTrains(payloads);

    return res.json({
      stationCode: 'LST',
      stationName: 'Liverpool Street',
      generatedAt: new Date().toISOString(),
      count: trains.length,
      trains
    });
  } catch {
    return res.status(502).json({ error: 'Could not reach TfL API.' });
  }
});

function buildTfLUrl(endpoint) {
  const params = new URLSearchParams();
  if (process.env.TFL_APP_ID) params.set('app_id', process.env.TFL_APP_ID);
  if (process.env.TFL_APP_KEY) params.set('app_key', process.env.TFL_APP_KEY);
  const query = params.toString();
  return `${TFL_BASE_URL}${endpoint}${query ? `?${query}` : ''}`;
}

function normalizeTrains(payloads) {
  const combined = payloads
    .flatMap((list) => list || [])
    .map((item) => ({
      boardType: item.modeName || modeFromLine(item.lineId),
      operator: item.lineName || 'Unknown operator',
      destination: item.destinationName || 'Unknown',
      origin: item.currentLocation || '-',
      platform: item.platformName || '-',
      status: item.currentLocation || item.towards || '-',
      aimedTime: '-',
      expectedTime: formatLondonTime(item.expectedArrival),
      expectedAt: item.expectedArrival || null,
      serviceId: item.id || item.vehicleId || null
    }));

  return combined.sort((a, b) => sortExpectedAt(a.expectedAt, b.expectedAt));
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

app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
