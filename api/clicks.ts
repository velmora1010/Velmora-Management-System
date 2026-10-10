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

const DEFAULT_UPSTASH_REDIS_URL = 'https://still-griffon-217114.upstash.io';
const DEFAULT_UPSTASH_REDIS_TOKEN = 'gQAAAAAAA1AaAQIgcDE4N2EzMzUyNWVhNzQ0MjZiOWEyOTk2YTU5M2IxMmFlOA';

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

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || DEFAULT_UPSTASH_REDIS_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || DEFAULT_UPSTASH_REDIS_TOKEN;
  const isRedisConfigured = Boolean(redisUrl && redisToken);

  if (!isRedisConfigured) {
    res.statusCode = 200;
    res.end(JSON.stringify({
      configured: false,
      error: 'Redis tracking storage not configured. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel.',
      clicks: {}
    }));
    return;
  }

  let requestedIds: string[] = [];

  if (req.method === 'POST') {
    try {
      const raw = await getBody(req);
      const parsed = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});
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
    const redisKeys = requestedIds.map(id => `click:${id}`);
    
    // Upstash Redis command array style: ['MGET', key1, key2, ...]
    const redisRes = await fetch(redisUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redisToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(['MGET', ...redisKeys])
    });

    if (!redisRes.ok) {
      throw new Error(`Upstash Redis MGET failed with HTTP ${redisRes.status}`);
    }

    const redisData = await redisRes.json();
    const rawResults = Array.isArray(redisData.result) ? redisData.result : [];

    const clicksMap: Record<string, number> = {};
    requestedIds.forEach((id, idx) => {
      const val = rawResults[idx];
      clicksMap[id] = val !== null && val !== undefined ? Number(val) || 0 : 0;
    });

    res.statusCode = 200;
    res.end(JSON.stringify({
      configured: true,
      clicks: clicksMap
    }));
  } catch (err: any) {
    console.error('[Clicks API] Error querying Redis counts:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({
      configured: true,
      error: err.message || 'Failed to fetch click counts from Redis',
      clicks: {}
    }));
  }
}
