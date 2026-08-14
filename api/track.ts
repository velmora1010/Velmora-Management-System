import type { IncomingMessage, ServerResponse } from 'http';

const normalizeStatus = (rawStatus: string): string => {
  const s = rawStatus.toLowerCase().trim();
  if (!s) return 'Pending';

  // 1. RTO / Returned / Return to Origin / RTO Delivered / Return
  if (
    s.includes('rto') ||
    s.includes('returned') ||
    s.includes('return to origin') ||
    s.includes('rto delivered') ||
    s.includes('return') ||
    s.includes('refused') ||
    s.includes('undelivered') ||
    s.includes('door locked')
  ) {
    return 'RTO';
  }

  // 2. Delivered
  if (s.includes('delivered')) {
    return 'Delivered';
  }

  // 3. Out for Delivery
  if (s.includes('out for delivery') || s.includes('out_for_delivery')) {
    return 'Out for Delivery';
  }

  // 4. Processed / Forwarded / In Transit
  if (
    s.includes('transit') ||
    s.includes('processed') ||
    s.includes('forwarded') ||
    s.includes('shipped') ||
    s.includes('dispatched') ||
    s.includes('hub') ||
    s.includes('service center') ||
    s.includes('received')
  ) {
    return 'In Transit';
  }

  // 5. Booked / Consignment Booked
  if (
    s.includes('booked') ||
    s.includes('info received') ||
    s.includes('manifest')
  ) {
    return 'Info Received';
  }

  return 'Pending';
};

function parseTimelineDate(dateStr: string): Date | null {
  try {
    const clean = dateStr.trim();
    if (clean.includes('-') || clean.includes('/')) {
      const parts = clean.split(/\s+/);
      const datePart = parts[0].replace(/\//g, '-');
      const timePart = parts[1] || '';
      const ampmPart = parts[2] || '';
      
      const dateSplit = datePart.split('-');
      if (dateSplit.length === 3) {
        const day = parseInt(dateSplit[0], 10);
        const month = parseInt(dateSplit[1], 10);
        const year = parseInt(dateSplit[2], 10);
        
        let hours = 0;
        let minutes = 0;
        if (timePart) {
          const timeSplit = timePart.split(':');
          hours = parseInt(timeSplit[0], 10);
          minutes = parseInt(timeSplit[1], 10);
          if (ampmPart.toUpperCase() === 'PM' && hours < 12) hours += 12;
          if (ampmPart.toUpperCase() === 'AM' && hours === 12) hours = 0;
        }
        return new Date(year, month - 1, day, hours, minutes);
      }
    } else {
      const parsed = Date.parse(clean);
      if (!isNaN(parsed)) return new Date(parsed);
      
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const parts = clean.split(/\s+/);
      if (parts.length >= 3) {
        const monthName = parts[0].toLowerCase().substring(0, 3);
        const monthIdx = months.indexOf(monthName);
        const day = parseInt(parts[1].replace(/,/g, ''), 10);
        const year = parseInt(parts[2], 10);
        
        const timePart = parts[3] || '';
        const ampmPart = parts[4] || '';
        
        let hours = 0;
        let minutes = 0;
        if (timePart) {
          const timeSplit = timePart.split(':');
          hours = parseInt(timeSplit[0], 10);
          minutes = parseInt(timeSplit[1], 10);
          if (ampmPart.toUpperCase() === 'PM' && hours < 12) hours += 12;
          if (ampmPart.toUpperCase() === 'AM' && hours === 12) hours = 0;
        }
        
        if (monthIdx !== -1 && !isNaN(day) && !isNaN(year)) {
          return new Date(year, monthIdx, day, hours, minutes);
        }
      }
    }
  } catch (e) {}
  return null;
}

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
      // Step 1: POST to doCheck to initiate tracking state and session
      const postRes = await fetch('https://stcourier.com/track/doCheck', {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `awb_no=${encodeURIComponent(awbNumber)}`,
        signal: AbortSignal.timeout(20000)
      });

      if (!postRes.ok) {
        throw new Error(`ST Courier doCheck responded with status: ${postRes.status}`);
      }

      // Collect the Set-Cookie headers
      let cookieHeader = '';
      if (typeof postRes.headers.getSetCookie === 'function') {
        const setCookies = postRes.headers.getSetCookie();
        if (setCookies && setCookies.length > 0) {
          cookieHeader = setCookies.join('; ');
        }
      }
      if (!cookieHeader) {
        cookieHeader = postRes.headers.get('set-cookie') || '';
      }

      // Step 2: GET to shipment using the cookie
      const fetchRes = await fetch(`https://stcourier.com/track/shipment`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Cookie': cookieHeader
        },
        signal: AbortSignal.timeout(20000)
      });

      if (!fetchRes.ok) {
        throw new Error(`ST Courier shipment page responded with status: ${fetchRes.status}`);
      }

      const htmlContent = await fetchRes.text();
      
      let parsedStatus = '';
      const currentStatusMatch = htmlContent.match(/Current\s+Status[^>]*>\s*(?:<[^>]*>\s*)*([^<]+)/i);
      if (currentStatusMatch && currentStatusMatch[1]) {
        parsedStatus = currentStatusMatch[1].trim();
      }

      let deliveryDate = '';
      const deliveryDateMatch = htmlContent.match(/Delivery\s+Date\/Time[^>]*>\s*(?:<[^>]*>\s*)*([^<]+)/i);
      if (deliveryDateMatch && deliveryDateMatch[1]) {
        deliveryDate = deliveryDateMatch[1].trim();
      }

      // Timeline latest event check as verification/fallback
      let latestTimelineStatus = '';
      try {
        const eventRegex = /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}\s*<br\s*\/?>\s*\d{1,2}:\d{2}\s+(?:AM|PM))/gi;
        const eventMatches = [];
        let match;
        while ((match = eventRegex.exec(htmlContent)) !== null) {
          eventMatches.push({
            index: match.index,
            length: match[1].length,
            dateStr: match[1].replace(/<br\s*\/?>/i, ' ').replace(/\s+/g, ' ').trim()
          });
        }

        const timelineEvents: { date: Date; status: string }[] = [];
        for (let i = 0; i < eventMatches.length; i++) {
          const curr = eventMatches[i];
          const nextIndex = i + 1 < eventMatches.length ? eventMatches[i + 1].index : htmlContent.length;
          const textSegment = htmlContent.substring(curr.index + curr.length, Math.min(curr.index + 1500, nextIndex));
          
          // Clean up the HTML from the segment to extract the event description
          const cleanText = textSegment.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          
          const eventDate = parseTimelineDate(curr.dateStr);
          if (eventDate) {
            timelineEvents.push({
              date: eventDate,
              status: cleanText
            });
          }
        }

        if (timelineEvents.length > 0) {
          // Sort descending chronologically
          timelineEvents.sort((a, b) => b.date.getTime() - a.date.getTime());
          latestTimelineStatus = timelineEvents[0].status;
        }
      } catch (e) {
        console.error('[ST TRACKING] Timeline parsing error:', e);
      }

      // Determine the final status to use, preferring parsedStatus then falling back to latestTimelineStatus
      const finalRawStatus = parsedStatus || latestTimelineStatus || '';
      const normalized = normalizeStatus(finalRawStatus);

      // Development diagnostics
      console.log(`[ST TRACKING] AWB: ${awbNumber}`);
      console.log(`[ST TRACKING] Raw Current Status: ${parsedStatus || 'N/A'}`);
      console.log(`[ST TRACKING] Latest Event: ${latestTimelineStatus || 'N/A'}`);
      console.log(`[ST TRACKING] Normalized Status: ${normalized}`);
      console.log(`[ST TRACKING] Delivery Date: ${deliveryDate || 'N/A'}`);
      console.log(`[ST TRACKING] API Success: true`);

      if (normalized) {
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          status: normalized,
          deliveryDate: deliveryDate || undefined,
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
