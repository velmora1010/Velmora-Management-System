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
      
      const statusMatch = htmlContent.match(/Current\s+Status\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
      const rawCurrentStatus = statusMatch ? statusMatch[1].replace(/<[^>]+>/g, '').trim() : '';

      const bookMatch = htmlContent.match(/Book\s+Date\/Time\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
      const bookDateTime = bookMatch ? bookMatch[1].replace(/<[^>]+>/g, '').trim() : '';

      const delivMatch = htmlContent.match(/Delivery\s+Date\/Time\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
      const deliveryDateTime = delivMatch ? delivMatch[1].replace(/<[^>]+>/g, '').trim() : '';

      let latestEvent = '';
      let latestLocation = '';
      let latestDateTime = '';

      const timelineBlockMatch = htmlContent.match(/class="[^"]*tl24[^"]*"[^>]*>([\s\S]*?)(?:<div[^>]*class="[^"]*tl24[^"]*"|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>)/i);
      if (timelineBlockMatch) {
        const block = timelineBlockMatch[1];
        
        const timeMatch = block.match(/width:\s*25%[^>]*>([\s\S]*?)<\/div>/i);
        if (timeMatch) {
          latestDateTime = timeMatch[1].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        }

        const descMatch = block.match(/width:\s*65%[^>]*>([\s\S]*?)<\/div>/i);
        if (descMatch) {
          const parts = descMatch[1].split(/<br\s*\/?>/gi).map(s => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
          latestEvent = parts[0] || '';
          latestLocation = parts.slice(1).join(' - ');
        }
      }

      // Determine the primary status: prioritize rawCurrentStatus from table, or latest event
      const finalRawStatus = rawCurrentStatus || latestEvent || '';
      const normalized = normalizeStatus(finalRawStatus);

      // Latest actual event is used for the application's REMARKS column
      const remarks = latestEvent || rawCurrentStatus || undefined;
      const finalDeliveryDate = (normalized === 'Delivered' && deliveryDateTime) ? deliveryDateTime : undefined;
      const finalDispatchedDate = bookDateTime ? bookDateTime.split(' ')[0] : undefined;

      // Development diagnostics
      console.log(`[ST TRACKING] AWB: ${awbNumber}`);
      console.log(`[ST TRACKING] Raw Status: ${finalRawStatus}`);
      console.log(`[ST TRACKING] Normalized Status: ${normalized}`);
      console.log(`[ST TRACKING] Remarks: ${remarks || 'N/A'}`);
      console.log(`[ST TRACKING] Delivery Date: ${finalDeliveryDate || 'N/A'}`);
      console.log(`[ST TRACKING] Dispatched Date: ${finalDispatchedDate || 'N/A'}`);

      // Verify AWB match if present on page
      const pageAwbMatch = htmlContent.match(/Status\s+of\s+AWB\s+No\.?\s*<span[^>]*>([a-zA-Z0-9]+)/i);
      const returnedAwb = pageAwbMatch ? pageAwbMatch[1].trim() : '';
      if (returnedAwb && returnedAwb.toLowerCase() !== awbNumber.toLowerCase()) {
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: false,
          status: 'Unable to fetch',
          error: `Returned AWB (${returnedAwb}) does not match requested AWB (${awbNumber})`,
          lastSyncedAt: nowStr
        }));
        return;
      }

      // If neither table status nor timeline event was matched
      if (!finalRawStatus || (!statusMatch && !timelineBlockMatch)) {
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: false,
          status: 'Unable to fetch',
          error: htmlContent.includes('No Record') ? 'No Record Found on ST Courier' : 'Tracking information not found on ST Courier',
          lastSyncedAt: nowStr
        }));
        return;
      }

      res.statusCode = 200;
      res.end(JSON.stringify({
        success: true,
        status: normalized,
        rawStatus: finalRawStatus,
        remarks: remarks,
        deliveryDate: finalDeliveryDate,
        dispatchedDate: finalDispatchedDate,
        lastLocation: latestLocation || undefined,
        trackingDateTime: latestDateTime || deliveryDateTime || bookDateTime || undefined,
        lastSyncedAt: nowStr
      }));
    } else if (courier === 'Delhivery' || (courier.toLowerCase() === 'delhivery' && !courier.toLowerCase().includes('ithink'))) {
      const delhiveryToken = process.env.DELHIVERY_API_TOKEN;
      if (!delhiveryToken || !delhiveryToken.trim()) {
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: false,
          status: 'Token Not Configured',
          error: 'DELHIVERY_API_TOKEN is not configured in the server environment. Please set DELHIVERY_API_TOKEN in your Vercel environment variables.',
          lastSyncedAt: nowStr
        }));
        return;
      }

      try {
        const cleanToken = delhiveryToken.trim();
        const dlvRes = await fetch(`https://track.delhivery.com/api/v1/packages/json/?waybill=${encodeURIComponent(awbNumber)}&token=${encodeURIComponent(cleanToken)}`, {
          method: 'GET',
          headers: {
            'Authorization': `Token ${cleanToken}`,
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(20000)
        });

        if (dlvRes.status === 401) {
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: false,
            status: 'Auth Failed',
            error: 'Invalid or expired DELHIVERY_API_TOKEN. Authentication failed with Delhivery API.',
            lastSyncedAt: nowStr
          }));
          return;
        }

        if (dlvRes.status === 429) {
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: false,
            status: 'Rate Limited',
            error: 'Delhivery API rate limit exceeded. Please retry in a few moments.',
            lastSyncedAt: nowStr
          }));
          return;
        }

        if (!dlvRes.ok) {
          throw new Error(`Delhivery official API responded with HTTP ${dlvRes.status} (${dlvRes.statusText})`);
        }

        const dlvData = await dlvRes.json();
        
        // Parse official Delhivery response
        if (dlvData && Array.isArray(dlvData.ShipmentData) && dlvData.ShipmentData.length > 0) {
          const item = dlvData.ShipmentData[0];
          const shipment = item.Shipment || item;
          const statusObj = shipment.Status || {};
          const rawStatus = statusObj.Status || shipment.StatusType || '';
          const normalized = normalizeStatus(rawStatus);

          const scans = Array.isArray(shipment.Scans) ? shipment.Scans : [];
          const latestScan = scans.length > 0 ? (scans[0].ScanDetail || scans[0]) : null;

          const remarks = statusObj.Instructions || (latestScan ? (latestScan.Instructions || latestScan.Scan) : undefined) || undefined;
          const lastLocation = (latestScan ? (latestScan.ScannedLocation || latestScan.Location) : undefined) || shipment.Destination || undefined;
          const deliveryDate = (normalized === 'Delivered' && (shipment.DeliveryDate || statusObj.StatusDateTime)) 
            ? (shipment.DeliveryDate || statusObj.StatusDateTime) 
            : undefined;
          const estimatedDeliveryDate = shipment.ExpectedDeliveryDate || shipment.PromisedDeliveryDate || undefined;
          const trackingDateTime = statusObj.StatusDateTime || (latestScan ? latestScan.ScanDateTime : undefined);

          console.log(`[DELHIVERY OFFICIAL API] AWB: ${awbNumber}, Status: ${normalized}, Raw: ${rawStatus}`);

          // Update matching record in Supabase customer_tracking_shipments if available
          const supabaseUrl = process.env.SUPABASE_URL || 'https://utusdosvijjuxtowzhta.supabase.co';
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dXNkb3N2aWpqdXh0b3d6aHRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA4NDE5MiwiZXhwIjoyMDk3NjYwMTkyfQ.U2lv4o8wF1G56B_WoXQADqRTuJEjdYSKXPDQMlJHHA4';

          if (supabaseUrl && supabaseKey) {
            try {
              await fetch(`${supabaseUrl}/rest/v1/customer_tracking_shipments?awb_number=eq.${encodeURIComponent(awbNumber)}`, {
                method: 'PATCH',
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                  status: normalized,
                  raw_status: rawStatus,
                  remarks: remarks || null,
                  delivered_date: deliveryDate || null,
                  estimated_delivery_date: estimatedDeliveryDate || null,
                  last_location: lastLocation || null,
                  tracking_date_time: trackingDateTime || null,
                  last_synced_at: new Date().toISOString()
                })
              });
            } catch (sbErr) {
              console.warn('[DELHIVERY TRACKING] Optional Supabase sync skipped:', sbErr);
            }
          }

          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            status: normalized,
            rawStatus: rawStatus,
            remarks: remarks || undefined,
            deliveryDate: deliveryDate || undefined,
            estimatedDeliveryDate: estimatedDeliveryDate || undefined,
            lastLocation: lastLocation || undefined,
            trackingDateTime: trackingDateTime || undefined,
            lastSyncedAt: nowStr
          }));
        } else {
          // If ShipmentData is empty or Error returned
          const errMsg = dlvData.Error || dlvData.message || 'No tracking record found for this Delhivery waybill in your account';
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: false,
            status: 'Tracking Not Found',
            error: errMsg,
            lastSyncedAt: nowStr
          }));
        }
      } catch (dlvErr: any) {
        console.error('[DELHIVERY OFFICIAL API] Error:', dlvErr);
        res.statusCode = 200;
        res.end(JSON.stringify({
          success: false,
          status: 'Unable to fetch',
          error: dlvErr.message || String(dlvErr),
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
      // Ekart, and any other unsupported couriers
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
