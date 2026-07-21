import type { IncomingMessage, ServerResponse } from 'http';

const normalizeStatus = (rawStatus: string): string => {
  const s = rawStatus.toLowerCase();
  if (s.includes('delivered')) return 'Delivered';
  if (s.includes('out for delivery')) return 'Out for Delivery';
  if (s.includes('rto') || s.includes('return') || s.includes('refused') || s.includes('undelivered') || s.includes('door locked')) return 'RTO';
  if (s.includes('transit') || s.includes('booked') || s.includes('processed') || s.includes('forwarded') || s.includes('shipped')) return 'In Transit';
  if (s.includes('not found')) return 'Tracking Not Found';
  return 'In Transit';
};

const getBody = (req: IncomingMessage): Promise<string> => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      resolve(body);
    });
    req.on('error', err => {
      reject(err);
    });
  });
};

export default async function handler(req: IncomingMessage & { query?: Record<string, string> }, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const nowStr = new Date().toLocaleString();
  let awbNumber = '';
  let courier = '';

  // Parse parameters from body (POST) or URL query (GET)
  if (req.method === 'POST') {
    try {
      const rawBody = await getBody(req);
      const parsed = JSON.parse(rawBody || '{}');
      awbNumber = parsed.awbNumber || parsed.awb || '';
      courier = parsed.courier || '';
    } catch (e) {
      res.statusCode = 400;
      res.end(JSON.stringify({
        success: false,
        status: 'Unable to fetch',
        error: 'Invalid JSON request body',
        lastSyncedAt: nowStr
      }));
      return;
    }
  } else {
    const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    awbNumber = urlObj.searchParams.get('awbNumber') || urlObj.searchParams.get('awb') || (req.query && (req.query.awbNumber || req.query.awb)) || '';
    courier = urlObj.searchParams.get('courier') || (req.query && req.query.courier) || '';
  }

  if (!awbNumber) {
    res.statusCode = 400;
    res.end(JSON.stringify({
      success: false,
      status: 'Unable to fetch',
      error: 'Missing AWB / AWB number parameter',
      lastSyncedAt: nowStr
    }));
    return;
  }

  try {
    if (courier === 'ST Courier') {
      const fetchRes = await fetch(`https://stcourier.com/track/shipment?awb=${encodeURIComponent(awbNumber)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(45000)
      });

      if (!fetchRes.ok) {
        throw new Error(`ST Courier tracking site responded with status: ${fetchRes.status}`);
      }

      const htmlContent = await fetchRes.text();
      
      let parsedStatus = '';
      const htmlUpper = htmlContent.toUpperCase();
      
      if (htmlUpper.includes('DELIVERED')) {
        parsedStatus = 'Delivered';
      } else if (htmlUpper.includes('OUT FOR DELIVERY') || htmlUpper.includes('OUT_FOR_DELIVERY')) {
        parsedStatus = 'Out for Delivery';
      } else if (htmlUpper.includes('RTO') || htmlUpper.includes('RETURN TO ORIGIN') || htmlUpper.includes('RETURNED')) {
        parsedStatus = 'RTO';
      } else if (htmlUpper.includes('IN TRANSIT') || htmlUpper.includes('TRANSIT') || htmlUpper.includes('SHIPPED') || htmlUpper.includes('FORWARDED') || htmlUpper.includes('BOOKED')) {
        parsedStatus = 'In Transit';
      } else {
        const rxList = [
          /(?:Current Status|Delivery Status|Status)[^>]*>([^<]+)/i,
          /status[^>]*>([^<]+)/i,
          /<td>([^<]*(?:delivered|transit|shipped|booked|returned|delivery|rto)[^<]*)<\/td>/i
        ];
        for (const rx of rxList) {
          const match = htmlContent.match(rx);
          if (match && match[1]) {
            parsedStatus = match[1].trim();
            break;
          }
        }
      }

      if (parsedStatus) {
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          status: normalizeStatus(parsedStatus),
          lastSyncedAt: nowStr
        }));
      } else {
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: false,
          status: 'Unable to fetch',
          error: htmlContent.includes('No Record Found') ? 'No Record Found' : 'Could not parse status from ST Courier response',
          lastSyncedAt: nowStr
        }));
      }
    } else if (courier === 'Amazon') {
      try {
        const fetchRes = await fetch(`https://track.amazon.in/tracking/${encodeURIComponent(awbNumber)}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          signal: AbortSignal.timeout(45000)
        });

        if (fetchRes.status === 403 || fetchRes.status === 451 || fetchRes.status === 503) {
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: false,
            status: '',
            error: `Amazon tracking site blocked automated fetch (status ${fetchRes.status})`,
            lastSyncedAt: nowStr
          }));
          return;
        }

        const htmlContent = await fetchRes.text();
        
        if (htmlContent.includes('captcha') || htmlContent.includes('RobotCheck') || htmlContent.includes('automated access') || htmlContent.includes('try reloading')) {
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: false,
            status: '',
            error: 'Amazon tracking site blocked automated fetch (Captcha/Robot Check detected)',
            lastSyncedAt: nowStr
          }));
          return;
        }

        let parsedStatus = '';
        const statusRegexes = [
          /class="[^"]*tracking-status[^"]*"[^>]*>([^<]+)/i,
          /id="[^"]*status[^"]*"[^>]*>([^<]+)/i,
          /status-title[^>]*>([^<]+)/i,
          /delivered/i,
          /out for delivery/i,
          /in transit/i,
          /shipped/i
        ];

        for (const rx of statusRegexes) {
          const match = htmlContent.match(rx);
          if (match) {
            if (match[1]) {
              parsedStatus = match[1].trim();
              break;
            } else {
              parsedStatus = match[0].trim();
              break;
            }
          }
        }

        if (parsedStatus) {
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            status: normalizeStatus(parsedStatus),
            lastSyncedAt: nowStr
          }));
        } else {
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: false,
            status: '',
            error: 'Could not parse status from Amazon response',
            lastSyncedAt: nowStr
          }));
        }
      } catch (err: any) {
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: false,
          status: '',
          error: `Amazon tracking site blocked/failed: ${err.message || String(err)}`,
          lastSyncedAt: nowStr
        }));
      }
    } else {
      // Delhivery, Ekart, and any other unsupported couriers
      res.statusCode = 200;
      res.end(JSON.stringify({
        success: false,
        status: '',
        trackingError: 'Sync not available for this courier',
        lastSyncedAt: nowStr
      }));
    }
  } catch (err: any) {
    res.statusCode = 200;
    res.end(JSON.stringify({
      success: false,
      status: 'Unable to fetch',
      error: err.message || String(err),
      lastSyncedAt: nowStr
    }));
  }
}
