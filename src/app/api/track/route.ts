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

  // --- STEP 3: HTML Parsing ---
  const spacedHtml = html.replace(/>/g, '> ');
  const $ = cheerio.load(spacedHtml);
  const bodyText = $('body').text().replace(/\s+/g, ' ');

  let status = 'Tracking Not Found';
  let state = 'Unknown';
  let lastLocation = 'Unknown';
  let trackingDateTime = '-';

  const hasTrackingSection = bodyText.includes('Status of AWB No.');

  if (bodyText.includes('Not Found') && !hasTrackingSection) {
    console.log(`[LIVE TRACKING API] Result: Tracking Not Found`);
    return { success: false, status: 'Tracking Not Found', state: 'Unknown', lastLocation: '-', trackingDateTime: '-' };
  }

  if (!hasTrackingSection) {
    console.log(`[LIVE TRACKING API] Result: Parser Failed (No tracking section)`);
    return { success: false, status: 'Parser Failed', state: 'Unknown', lastLocation: 'Failed to locate tracking area', trackingDateTime: '-' };
  }

  const regex = new RegExp(`Status of AWB No\\.\\s*\\d+\\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{1,2},\\s+\\d{4})\\s+(\\d{2}:\\d{2}\\s+[AP]M)\\s+(.*?)(?=\\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{1,2},\\s+\\d{4}|$)`, 'i');
  
  const match = bodyText.match(regex);

  if (match) {
    const parsedDate = match[1];
    const parsedTime = match[2];
    const parsedEventStr = match[3].trim();

    trackingDateTime = `${parsedDate} ${parsedTime}`;
    lastLocation = parsedEventStr;

    const evLower = parsedEventStr.toLowerCase();
    if (evLower.includes('delivered')) status = 'Delivered';
    else if (evLower.includes('out for delivery')) status = 'Out for Delivery';
    else if (evLower.includes('forwarded') || evLower.includes('transit') || evLower.includes('arrived')) status = 'In Transit';
    else status = 'Pending';

    if (evLower.endsWith('tn') || evLower.includes(', tn') || evLower.includes('tamil nadu')) {
      state = 'Tamil Nadu';
    } else {
      state = 'Other State';
    }

    console.log(`[LIVE TRACKING API] Extracted Status: ${status}, State: ${state}, Date: ${trackingDateTime}, Event: ${lastLocation}`);
    
    return {
      success: true,
      status,
      state,
      lastLocation,
      trackingDateTime
    };
  } else {
    console.log(`[LIVE TRACKING API] Result: Parser Failed (Regex unmatched)`);
    return { success: false, status: 'Parser Failed', state: 'Unknown', lastLocation: 'Could not parse event data', trackingDateTime: '-' };
  }
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

    // Only ST Courier live scraping is currently implemented directly via this endpoint
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
