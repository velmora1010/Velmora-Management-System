import type { IncomingMessage, ServerResponse } from 'http';

const getBody = (req: IncomingMessage & { body?: any }): Promise<any> => {
  if (req.body !== undefined && req.body !== null) {
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', err => reject(err));
  });
};

const DEFAULT_SUPABASE_URL = 'https://utusdosvijjuxtowzhta.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dXNkb3N2aWpqdXh0b3d6aHRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA4NDE5MiwiZXhwIjoyMDk3NjYwMTkyfQ.U2lv4o8wF1G56B_WoXQADqRTuJEjdYSKXPDQMlJHHA4';

async function fetchSupabaseCounts(): Promise<Record<string, number>> {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;

    const res = await fetch(`${supabaseUrl}/rest/v1/system_settings?setting_key=eq.tracking_link_clicks&select=setting_value`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      return (data && data[0]?.setting_value) || {};
    }
  } catch (err: any) {
    console.warn('[Clicks API] Supabase clicks read error:', err?.message || err);
  }
  return {};
}

export default async function handler(
  req: IncomingMessage & { query?: Record<string, string>; body?: any },
  res: ServerResponse
) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  let redisUrl = (
    process.env.UPSTASH_REDIS_REST_URL || 
    process.env.KV_REST_API_URL || 
    process.env.UPSTASH_URL || 
    process.env.REDIS_URL || 
    ''
  ).trim();
  const redisToken = (
    process.env.UPSTASH_REDIS_REST_TOKEN || 
    process.env.KV_REST_API_TOKEN || 
    process.env.UPSTASH_TOKEN || 
    process.env.REDIS_TOKEN || 
    ''
  ).trim();
  if (redisUrl && !redisUrl.startsWith('http://') && !redisUrl.startsWith('https://')) {
    redisUrl = `https://${redisUrl}`;
  }
  const isRedisConfigured = Boolean(
    redisUrl && 
    redisToken && 
    !redisUrl.includes('still-griffon-217114.upstash.io')
  );

  let requestedIds: string[] = [];

  if (req.method === 'POST') {
    try {
      const raw = await getBody(req);
      const parsed = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});

      // Support persistent slug mapping registration if Redis is active
      if (parsed.action === 'set_slug' && parsed.slug && parsed.link_id) {
        const cleanSlug = String(parsed.slug).trim().toLowerCase();
        const cleanLinkId = String(parsed.link_id).trim();
        if (isRedisConfigured) {
          try {
            const setRes = await fetch(redisUrl, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${redisToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(['SET', `slug:${cleanSlug}`, cleanLinkId])
            });
            const isOk = setRes.ok;
            res.statusCode = isOk ? 200 : 502;
            res.end(JSON.stringify({ success: isOk, slug: cleanSlug, link_id: cleanLinkId }));
            return;
          } catch {
            res.statusCode = 502;
            res.end(JSON.stringify({ success: false, error: 'Redis service unreachable', slug: cleanSlug, link_id: cleanLinkId }));
            return;
          }
        } else {
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, slug: cleanSlug, link_id: cleanLinkId }));
          return;
        }
      }

      if (Array.isArray(parsed.ids)) {
        requestedIds = parsed.ids.map((id: any) => String(id).trim()).filter(Boolean);
      }
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({
        configured: true,
        error: 'Invalid JSON request body',
        clicks: {}
      }));
      return;
    }
  } else {
    const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const idsParam = urlObj.searchParams.get('ids') || (req.query && req.query.ids) || '';
    if (idsParam) {
      requestedIds = idsParam.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  if (requestedIds.length === 0) {
    res.statusCode = 200;
    res.end(JSON.stringify({
      configured: true,
      clicks: {}
    }));
    return;
  }

  try {
    // 1. Fetch Supabase persistent counts (always configured and available)
    const supabaseCounts = await fetchSupabaseCounts();

    // 2. Fetch Redis counts if Redis is configured
    let redisResults: any[] = [];
    if (isRedisConfigured) {
      try {
        const redisKeys = requestedIds.map(id => `click:${id}`);
        const redisRes = await fetch(redisUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${redisToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(['MGET', ...redisKeys])
        });

        if (redisRes.ok) {
          const redisData = await redisRes.json();
          redisResults = Array.isArray(redisData?.result) ? redisData.result : [];
        }
      } catch (redisErr) {
        console.warn('[Clicks API] Redis query error (falling back to Supabase counts):', redisErr);
      }
    }

    // 3. Merge counts accurately
    const clicksMap: Record<string, number> = {};
    requestedIds.forEach((id, idx) => {
      const cleanId = String(id).trim();
      const lowerId = cleanId.toLowerCase();
      
      const supaVal = Number(supabaseCounts[cleanId] ?? supabaseCounts[lowerId] ?? 0);
      const redisVal = redisResults[idx] !== null && redisResults[idx] !== undefined ? Number(redisResults[idx]) || 0 : 0;
      
      // Take the highest verified recorded count between Supabase and Redis
      clicksMap[cleanId] = Math.max(supaVal, redisVal);
    });

    res.statusCode = 200;
    res.end(JSON.stringify({
      configured: true,
      clicks: clicksMap
    }));
  } catch (err: any) {
    console.error('[Clicks API] Error querying counts:', err?.message || err);
    res.statusCode = 200;
    res.end(JSON.stringify({
      configured: true,
      error: 'Error querying click counts',
      clicks: {}
    }));
  }
}
