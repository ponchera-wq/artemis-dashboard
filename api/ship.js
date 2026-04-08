import WebSocket from 'ws';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const data = await new Promise((resolve, reject) => {
      const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('AIS timeout - no position received in 10s'));
      }, 10000);

      ws.on('open', () => {
        ws.send(JSON.stringify({
          APIKey: process.env.AISSTREAM_API_KEY,
          BoundingBoxes: [[[-90, -180], [90, 180]]],
          FiltersShipMMSI: ['368926266'],
          FilterMessageTypes: ['PositionReport']
        }));
      });

      ws.on('message', (raw) => {
        clearTimeout(timeout);
        ws.close();
        const msg = JSON.parse(raw.toString());
        const pos = msg.Message?.PositionReport;
        const meta = msg.MetaData;
        resolve({
          lat: meta?.latitude ?? pos?.Latitude,
          lon: meta?.longitude ?? pos?.Longitude,
          sog: pos?.Sog,
          cog: pos?.Cog,
          name: meta?.ShipName ?? 'USS John P. Murtha (LPD-26)',
          timestamp: meta?.time_utc,
          source: 'live'
        });
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    res.json(data);

  } catch (err) {
    // Fallback to last confirmed AIS position (April 8, 01:53 UTC)
    res.json({
      lat: 32.341703,
      lon: -119.617667,
      sog: 13.3,
      cog: 216.3,
      name: 'USS John P. Murtha (LPD-26)',
      timestamp: '2026-04-08T01:53:13.000000Z',
      source: 'fallback'
    });
  }
}
