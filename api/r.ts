import type { IncomingMessage, ServerResponse } from 'http';

// Allowed Amazon domains to prevent open-redirect vulnerabilities
const ALLOWED_AMAZON_DOMAINS = [
  'amazon.in',
  'amazon.com',
  'amazon.co.uk',
  'amazon.de',
  'amazon.fr',
  'amazon.es',
  'amazon.it',
  'amazon.ca',
  'amazon.com.au',
  'amazon.co.jp',
  'amzn.to',
  'amzn.in',
  'amzn.eu'
];

export function isValidAmazonUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const clean = urlStr.trim();
    const test = clean.startsWith('http://') || clean.startsWith('https://') ? clean : `https://${clean}`;
    const parsed = new URL(test);
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_AMAZON_DOMAINS.some(domain => host === domain || host.endsWith('.' + domain));
  } catch {
    return false;
  }
}

// Helper to extract the original Amazon URL from a Supabase record
function extractAmazonDestinationUrl(row: any): string {
  if (!row) return '';

  // 1. Check notes JSON payload for original_amazon_url or original_destination_url
  if (row.notes && typeof row.notes === 'string' && row.notes.startsWith('{')) {
    try {
      const parsed = JSON.parse(row.notes);
      if (parsed.original_amazon_url && isValidAmazonUrl(parsed.original_amazon_url)) {
        return parsed.original_amazon_url.trim();
      }
      if (parsed.original_destination_url && isValidAmazonUrl(parsed.original_destination_url)) {
        return parsed.original_destination_url.trim();
      }
      if (parsed.base_product_url && isValidAmazonUrl(parsed.base_product_url)) {
        return parsed.base_product_url.trim();
      }
    } catch {
      // ignore JSON parse failure
    }
  }

  // 2. Check original_destination_url column
  if (row.original_destination_url && isValidAmazonUrl(row.original_destination_url)) {
    return row.original_destination_url.trim();
  }

  // 3. Check base_product_url column
  if (row.base_product_url && isValidAmazonUrl(row.base_product_url)) {
    return row.base_product_url.trim();
  }

  return '';
}

// Bot / scraper detection pattern
const BOT_USER_AGENT_PATTERN = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|slackbot|twitterbot|telegrambot|embedly|quora link preview|outbrain|pinterest|vkshare|w3c_validator|duckduckbot/i;

function isBot(userAgent?: string): boolean {
  if (!userAgent) return false;
  return BOT_USER_AGENT_PATTERN.test(userAgent);
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('=').trim());
    }
  });
  return list;
}

// Default Supabase project credentials (fallback if Vercel serverless environment variables are unconfigured)
const DEFAULT_SUPABASE_URL = 'https://utusdosvijjuxtowzhta.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dXNkb3N2aWpqdXh0b3d6aHRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA4NDE5MiwiZXhwIjoyMDk3NjYwMTkyfQ.U2lv4o8wF1G56B_WoXQADqRTuJEjdYSKXPDQMlJHHA4';

export default async function handler(
  req: IncomingMessage & { query?: Record<string, string> },
  res: ServerResponse
) {
  // Parse Link ID from query parameter or request URL path
  const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  let rawId = urlObj.searchParams.get('id') || (req.query && req.query.id) || '';
  
  if (!rawId && urlObj.pathname.startsWith('/r/')) {
    rawId = urlObj.pathname.replace(/^\/r\//, '').split('?')[0];
  }

  const linkId = decodeURIComponent(rawId).trim().replace(/^\/+|\/+$/g, '');

  if (!linkId) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<h1>400 Bad Request</h1><p>Missing tracking link identifier.</p>');
    return;
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  const isRedisConfigured = Boolean(redisUrl && redisToken);

  let destinationUrl = '';

  // 1. Try to read destination URL from Redis cache if available
  if (isRedisConfigured) {
    try {
      const getRes = await fetch(`${redisUrl}/get/dest:${encodeURIComponent(linkId)}`, {
        headers: { Authorization: `Bearer ${redisToken}` }
      });
      if (getRes.ok) {
        const data = await getRes.json();
        if (data?.result && typeof data.result === 'string') {
          destinationUrl = data.result;
        }
      }
    } catch (err) {
      console.warn('[Tracking Redirect] Failed to read cached destination from Redis:', err);
    }
  }

  // 2. Authoritative source of truth: Query Supabase for the tracking link record
  if (!destinationUrl) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                        process.env.SUPABASE_SERVICE_ROLE_KEY || 
                        process.env.VITE_SUPABASE_ANON_KEY || 
                        process.env.SUPABASE_ANON_KEY || 
                        DEFAULT_SUPABASE_KEY;

    try {
      // Primary lookup: By link ID (primary key)
      const queryUrl = `${supabaseUrl}/rest/v1/influencer_tracking_links?id=eq.${encodeURIComponent(linkId)}&select=*`;
      const sbRes = await fetch(queryUrl, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        }
      });

      if (sbRes.ok) {
        const rows = await sbRes.json();
        const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        if (row) {
          destinationUrl = extractAmazonDestinationUrl(row);
        }
      }

      // Secondary lookup: Fallback by tracking_url match if not found by exact id
      if (!destinationUrl) {
        const fallbackUrl = `${supabaseUrl}/rest/v1/influencer_tracking_links?tracking_url=ilike.*${encodeURIComponent(linkId)}*&select=*`;
        const fbRes = await fetch(fallbackUrl, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`
          }
        });
        if (fbRes.ok) {
          const fbRows = await fbRes.json();
          const fbRow = Array.isArray(fbRows) && fbRows.length > 0 ? fbRows[0] : null;
          if (fbRow) {
            destinationUrl = extractAmazonDestinationUrl(fbRow);
          }
        }
      }

      // Cache destination in Redis for ultra-fast subsequent redirects
      if (isRedisConfigured && destinationUrl) {
        fetch(`${redisUrl}/set/dest:${encodeURIComponent(linkId)}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${redisToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(destinationUrl)
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[Tracking Redirect] Failed to lookup link in Supabase:', err);
    }
  }

  // 3. If destination URL was not found
  if (!destinationUrl) {
    console.warn(`[Tracking Redirect] 404: Tracking link record not found in Supabase for ID: "${linkId}"`);
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<h1>404 Not Found</h1><p>The requested tracking link does not exist or has been removed.</p>');
    return;
  }

  // 4. Validate destination URL to prevent open redirect vulnerabilities
  if (!isValidAmazonUrl(destinationUrl)) {
    console.warn(`[Tracking Redirect] 400: Destination "${destinationUrl}" is not a recognized Amazon URL for ID: "${linkId}"`);
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<h1>400 Invalid Destination</h1><p>The destination URL is not a recognized Amazon store address.</p>');
    return;
  }

  // Ensure absolute URL
  const targetRedirect = destinationUrl.startsWith('http://') || destinationUrl.startsWith('https://')
    ? destinationUrl
    : `https://${destinationUrl}`;

  // 5. Bot filtering & duplicate click deduplication
  const userAgent = req.headers['user-agent'] || '';
  const cookies = parseCookies(req.headers.cookie);
  const dedupeCookieKey = `trk_c_${linkId}`;
  const isDuplicateClick = Boolean(cookies[dedupeCookieKey]);
  const isBotRequest = isBot(userAgent);

  // 6. Increment persistent atomic counter in Redis if genuine visitor
  if (isRedisConfigured && !isBotRequest && !isDuplicateClick) {
    try {
      await fetch(`${redisUrl}/incr/click:${encodeURIComponent(linkId)}`, {
        headers: { Authorization: `Bearer ${redisToken}` }
      });
    } catch (err) {
      console.error('[Tracking Redirect] Failed to increment click counter in Redis:', err);
    }
  }

  // 7. Set short deduplication cookie to protect against double counting from fast page refreshes
  res.setHeader('Set-Cookie', `${dedupeCookieKey}=1; Max-Age=5; Path=/; SameSite=Lax`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Location', targetRedirect);
  res.statusCode = 302;
  res.end();
}
