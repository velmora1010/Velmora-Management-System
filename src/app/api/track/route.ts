import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';

async function scrapeStCourier(awb: string) {
  console.log(`[LIVE TRACKING API] Initiating live scrape for AWB: ${awb}`);

  // ST Courier SSL certificates are sometimes misconfigured or missing intermediate certs.
  // We MUST use rejectUnauthorized: false to bypass 'unable to verify the first certificate'
  const agent = new https.Agent({ rejectUnauthorized: false });

  // --- STEP 1: POST to /track/doCheck ---
  console.log(`[LIVE TRACKING API] Step 1: POST to https://stcourier.com/track/doCheck`);
  const formData = new URLSearchParams();
  formData.append('awb_no', awb);

  const postResponse = await axios.post('https://stcourier.com/track/doCheck', formData.toString(), {
    httpsAgent: agent,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    timeout: 10000
  });

  console.log(`[LIVE TRACKING API] POST Status: ${postResponse.status}`);
  
  // Check if the AWB is valid on their end
  if (postResponse.data && postResponse.data.code === 400) {
    console.log(`[LIVE TRACKING API] ST Courier explicitly reported Invalid AWB.`);
    return { success: false, status: 'Tracking Not Found', state: 'Unknown', lastLocation: '-', trackingDateTime: '-' };
  }

  const cookies = postResponse.headers['set-cookie'];
  if (!cookies) {
    throw new Error("Failed to receive session cookie from ST Courier");
  }

  // --- STEP 2: GET /track/shipment using the Session Cookie ---
  console.log(`[LIVE TRACKING API] Step 2: GET to https://stcourier.com/track/shipment using session cookies`);
  const getResponse = await axios.get('https://stcourier.com/track/shipment', {
    httpsAgent: agent,
    headers: {
      'Cookie': cookies.join('; '),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    timeout: 10000
  });

  console.log(`[LIVE TRACKING API] Final response URL: ${getResponse.request?.res?.responseUrl || 'https://stcourier.com/track/shipment'}`);
  console.log(`[LIVE TRACKING API] HTTP status code: ${getResponse.status}`);
  console.log(`[LIVE TRACKING API] HTML length: ${getResponse.data.length}`);

  const html = getResponse.data;

  // Extract from summary table
  const statusMatch = html.match(/Current\s+Status\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  const rawCurrentStatus = statusMatch ? statusMatch[1].replace(/<[^>]+>/g, '').trim() : '';

  const bookMatch = html.match(/Book\s+Date\/Time\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  const bookDateTime = bookMatch ? bookMatch[1].replace(/<[^>]+>/g, '').trim() : '';

  const delivMatch = html.match(/Delivery\s+Date\/Time\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  const deliveryDateTime = delivMatch ? delivMatch[1].replace(/<[^>]+>/g, '').trim() : '';

  let latestEvent = '';
  let latestLocation = '';
  let latestDateTime = '';

  const timelineBlockMatch = html.match(/class="[^"]*tl24[^"]*"[^>]*>([\s\S]*?)(?:<div[^>]*class="[^"]*tl24[^"]*"|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>)/i);
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

  const finalRawStatus = rawCurrentStatus || latestEvent || '';
  if (!finalRawStatus && !html.includes('Status of AWB No.')) {
    return { success: false, status: 'Tracking Not Found', state: 'Unknown', lastLocation: '-', trackingDateTime: '-' };
  }

  let status = 'Pending';
  const sLower = finalRawStatus.toLowerCase();
  if (sLower.includes('delivered')) status = 'Delivered';
  else if (sLower.includes('out for delivery')) status = 'Out for Delivery';
  else if (sLower.includes('failed') || sLower.includes('attempted') || sLower.includes('undelivered')) status = 'Failed Attempt';
  else if (sLower.includes('forwarded') || sLower.includes('transit') || sLower.includes('arrived') || sLower.includes('hub')) status = 'In Transit';
  else if (sLower.includes('booked') || sLower.includes('created') || sLower.includes('manifest')) status = 'Info Received';
  else if (sLower.includes('rto') || sLower.includes('exception')) status = 'Exception';

  let state = 'Other State';
  const locLower = (latestLocation || '').toLowerCase();
  if (locLower.endsWith('tn') || locLower.includes(', tn') || locLower.includes('tamil nadu')) {
    state = 'Tamil Nadu';
  }

  const remarks = latestEvent || rawCurrentStatus || undefined;
  const deliveryDate = (status === 'Delivered' && deliveryDateTime) ? deliveryDateTime : undefined;
  const dispatchedDate = bookDateTime ? bookDateTime.split(' ')[0] : undefined;

  console.log(`[LIVE TRACKING API] Extracted Status: ${status}, Raw: ${finalRawStatus}, Remarks: ${remarks}, Delivery: ${deliveryDate}`);

  return {
    success: true,
    status,
    rawStatus: finalRawStatus,
    remarks,
    deliveryDate,
    dispatchedDate,
    state,
    lastLocation: latestLocation || '-',
    trackingDateTime: latestDateTime || deliveryDateTime || bookDateTime || '-'
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const awb = searchParams.get('awb');

  if (!awb) {
    return NextResponse.json({ error: 'AWB is required' }, { status: 400 });
  }

  try {
    const result = await scrapeStCourier(awb);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[LIVE TRACKING API] Tracking Error:', error.message);
    return NextResponse.json({ 
      success: false,
      status: 'Sync Failed', 
      state: 'Unknown', 
      lastLocation: 'Network Error: ' + error.message, 
      trackingDateTime: '-' 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const awb = body.awbNumber || body.awb;
    const courier = (body.courier || 'ST Courier').trim();

    if (!awb) {
      return NextResponse.json({ success: false, error: 'AWB number is required' }, { status: 400 });
    }

    if (courier === 'Delhivery' || courier.toLowerCase().includes('delhivery')) {
      try {
        const dlvRes = await fetch(`https://dlv-api.delhivery.com/v3/unified-tracking?wbn=${encodeURIComponent(awb)}`, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Origin': 'https://www.delhivery.com',
            'Referer': 'https://www.delhivery.com/',
            'Accept': 'application/json, text/plain, */*'
          },
          signal: AbortSignal.timeout(15000)
        });

        if (!dlvRes.ok) {
          throw new Error(`Delhivery tracking endpoint HTTP ${dlvRes.status}`);
        }

        const dlvData = await dlvRes.json();
        if (dlvData.statusCode === 200 && Array.isArray(dlvData.data) && dlvData.data.length > 0) {
          const pkg = dlvData.data[0];
          const rawStatus = pkg.status?.status || pkg.hqStatus || '';
          let status = 'In Transit';
          const sLower = rawStatus.toLowerCase();
          if (sLower.includes('delivered')) status = 'Delivered';
          else if (sLower.includes('out for delivery')) status = 'Out for Delivery';
          else if (sLower.includes('transit') || sLower.includes('shipped') || sLower.includes('departed')) status = 'In Transit';
          else if (sLower.includes('pending') || sLower.includes('pickup')) status = 'Pending';

          const remarks = pkg.status?.instructions || pkg.trackingStates?.[0]?.scans?.[0]?.scanNslRemark || undefined;
          const deliveryDate = (status === 'Delivered' && pkg.deliveryDate) ? pkg.deliveryDate : undefined;
          const promiseDeliveryDate = pkg.promiseDeliveryDate || undefined;
          const lastLocation = pkg.destination || pkg.trackingStates?.[0]?.scans?.[0]?.scannedLocation || undefined;
          const trackingDateTime = pkg.status?.statusDateTime || undefined;

          return NextResponse.json({
            success: true,
            status,
            rawStatus,
            remarks,
            deliveryDate,
            estimatedDeliveryDate: promiseDeliveryDate,
            lastLocation,
            trackingDateTime,
            lastSyncedAt: new Date().toLocaleString()
          });
        } else {
          return NextResponse.json({
            success: false,
            status: 'Tracking Not Found',
            error: dlvData.message || 'No tracking record found for this Delhivery waybill',
            lastSyncedAt: new Date().toLocaleString()
          });
        }
      } catch (dlvErr: any) {
        return NextResponse.json({
          success: false,
          status: 'Unable to fetch',
          error: dlvErr.message || String(dlvErr),
          lastSyncedAt: new Date().toLocaleString()
        });
      }
    }

    if (courier && courier !== 'ST Courier' && !courier.toLowerCase().includes('st courier')) {
      return NextResponse.json({
        success: false,
        status: 'Sync not available',
        trackingError: 'Sync not available for this courier',
        supported: false,
        lastSyncedAt: new Date().toLocaleString()
      });
    }

    const result = await scrapeStCourier(awb);
    return NextResponse.json({
      ...result,
      lastSyncedAt: new Date().toLocaleString()
    });
  } catch (error: any) {
    console.error('[LIVE TRACKING API] POST Tracking Error:', error.message);
    return NextResponse.json({ 
      success: false,
      status: 'Sync Failed', 
      state: 'Unknown', 
      error: error.message || String(error),
      lastLocation: 'Network Error: ' + error.message, 
      trackingDateTime: '-',
      lastSyncedAt: new Date().toLocaleString()
    }, { status: 500 });
  }
}
