import type { IncomingMessage, ServerResponse } from 'http';

const getBody = (req: IncomingMessage): Promise<string> => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', err => reject(err));
  });
};

export default async function handler(
  req: IncomingMessage & { query?: Record<string, string> },
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

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  const isRedisConfigured = Boolean(redisUrl && redisToken);

  if (!isRedisConfigured) {
    res.statusCode = 200;
    res.end(JSON.stringify({
      configured: false,
      error: 'Redis tracking storage not configured. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.',
      clicks: {}
    }));
    return;
  }

  let requestedIds: string[] = [];

  if (req.method === 'POST') {
    try {
      const rawBody = await getBody(req);
      const parsed = JSON.parse(rawBody || '{}');
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
    const redisRes = await fetch(`${redisUrl}/mget`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redisToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(redisKeys)
    });

    if (!redisRes.ok) {
      throw new Error(`Upstash Redis mget failed with HTTP ${redisRes.status}`);
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
