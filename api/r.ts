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

// Default Upstash Redis credentials (fallback for persistent atomic click counter)
const DEFAULT_UPSTASH_REDIS_URL = 'https://still-griffon-217114.upstash.io';
const DEFAULT_UPSTASH_REDIS_TOKEN = 'gQAAAAAAA1AaAQIgcDE4N2EzMzUyNWVhNzQ0MjZiOWEyOTk2YTU5M2IxMmFlOA';

export default async function handler(
  req: IncomingMessage & { query?: Record<string, string> },
  res: ServerResponse
) {
  // Parse Link identifier (short slug or UUID) from query parameter or request URL path
  const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  let rawIdentifier = urlObj.searchParams.get('slug') || 
                      urlObj.searchParams.get('id') || 
                      (req.query && (req.query.slug || req.query.id)) || '';
  
  if (!rawIdentifier && urlObj.pathname.startsWith('/r/')) {
    rawIdentifier = urlObj.pathname.replace(/^\/r\//, '').split('?')[0];
  } else if (!rawIdentifier && urlObj.pathname.length > 1 && !urlObj.pathname.startsWith('/api/')) {
    rawIdentifier = urlObj.pathname.replace(/^\//, '').split('?')[0];
  }

  const identifier = decodeURIComponent(rawIdentifier).trim().replace(/^\/+|\/+$/g, '').toLowerCase();

  if (!identifier) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<h1>400 Bad Request</h1><p>Missing tracking link identifier or short code.</p>');
    return;
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || DEFAULT_UPSTASH_REDIS_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || DEFAULT_UPSTASH_REDIS_TOKEN;
  const isRedisConfigured = Boolean(redisUrl && redisToken);

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  let canonicalLinkId = isUuid ? identifier : '';
  let destinationUrl = '';

  // 1. If identifier is a slug, check Redis persistent slug mapping: slug:<identifier> -> canonicalId
  if (!canonicalLinkId && isRedisConfigured) {
    try {
      const slugRes = await fetch(redisUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${redisToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['GET', `slug:${identifier}`])
      });
      if (slugRes.ok) {
        const slugData = await slugRes.json();
        if (slugData?.result && typeof slugData.result === 'string') {
          canonicalLinkId = slugData.result.trim();
        }
      }
    } catch (err) {
      console.warn('[Tracking Redirect] Failed to read slug mapping from Redis:', err);
    }
  }

  // 2. If canonical ID is known, try to read destination URL from Redis cache
  if (canonicalLinkId && isRedisConfigured) {
    try {
      const destRes = await fetch(redisUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${redisToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['GET', `dest:${canonicalLinkId}`])
      });
      if (destRes.ok) {
        const destData = await destRes.json();
        if (destData?.result && typeof destData.result === 'string') {
          destinationUrl = destData.result;
        }
      }
    } catch (err) {
      console.warn('[Tracking Redirect] Failed to read cached destination from Redis:', err);
    }
  }

  // 3. Authoritative source of truth: Query Supabase for the tracking link record
  if (!destinationUrl || !canonicalLinkId) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                        process.env.SUPABASE_SERVICE_ROLE_KEY || 
                        process.env.VITE_SUPABASE_ANON_KEY || 
                        process.env.SUPABASE_ANON_KEY || 
                        DEFAULT_SUPABASE_KEY;

    try {
      let matchedRow: any = null;

      // Lookup Path A: By exact canonical ID (if UUID known)
      if (canonicalLinkId) {
        const queryUrl = `${supabaseUrl}/rest/v1/influencer_tracking_links?id=eq.${encodeURIComponent(canonicalLinkId)}&select=*`;
        const sbRes = await fetch(queryUrl, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        });
        if (sbRes.ok) {
          const rows = await sbRes.json();
          if (Array.isArray(rows) && rows.length > 0) matchedRow = rows[0];
        }
      }

      // Lookup Path B: If slug, query by notes JSON containing custom_slug
      if (!matchedRow && !isUuid) {
        const slugQueryUrl = `${supabaseUrl}/rest/v1/influencer_tracking_links?notes=ilike.*"custom_slug":"${encodeURIComponent(identifier)}"*&select=*`;
        const slugRes = await fetch(slugQueryUrl, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        });
        if (slugRes.ok) {
          const rows = await slugRes.json();
          if (Array.isArray(rows) && rows.length > 0) {
            matchedRow = rows.find(r => Boolean(extractAmazonDestinationUrl(r))) || rows[0];
          }
        }
      }

      // Lookup Path C: If slug format is code-vNumber (e.g. his1-v1), query creator_code + utm_content
      if (!matchedRow && !isUuid) {
        const slugPattern = /^([a-z0-9_]+)-v(\d+)(?:-([a-z0-9_]+))?$/i;
        const match = identifier.match(slugPattern);
        if (match) {
          const codePart = match[1].toLowerCase();
          const videoNum = match[2];
          const utmContent = `v${videoNum}`;

          const codeQueryUrl = `${supabaseUrl}/rest/v1/influencer_tracking_links?creator_code=eq.${encodeURIComponent(codePart)}&utm_content=eq.${encodeURIComponent(utmContent)}&select=*`;
          const codeRes = await fetch(codeQueryUrl, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
          });
          if (codeRes.ok) {
            const rows = await codeRes.json();
            if (Array.isArray(rows) && rows.length > 0) {
              matchedRow = rows.find(r => Boolean(extractAmazonDestinationUrl(r))) || rows[0];
            }
          }
        }
      }

      // Lookup Path D: Fallback match by tracking_url containing the slug/id
      if (!matchedRow) {
        const fallbackUrl = `${supabaseUrl}/rest/v1/influencer_tracking_links?tracking_url=ilike.*${encodeURIComponent(identifier)}*&select=*`;
        const fbRes = await fetch(fallbackUrl, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        });
        if (fbRes.ok) {
          const fbRows = await fbRes.json();
          if (Array.isArray(fbRows) && fbRows.length > 0) {
            matchedRow = fbRows.find(r => Boolean(extractAmazonDestinationUrl(r))) || fbRows[0];
          }
        }
      }

      if (matchedRow) {
        canonicalLinkId = String(matchedRow.id).trim();
        destinationUrl = extractAmazonDestinationUrl(matchedRow);

        // Cache persistent slug and destination in Redis for ultra-fast subsequent visits
        if (isRedisConfigured) {
          if (!isUuid && identifier) {
            fetch(redisUrl, {
              method: 'POST',
              headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(['SET', `slug:${identifier}`, canonicalLinkId])
            }).catch(() => {});
          }
          if (destinationUrl) {
            fetch(redisUrl, {
              method: 'POST',
              headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(['SET', `dest:${canonicalLinkId}`, destinationUrl, 'EX', '86400'])
            }).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error('[Tracking Redirect] Failed to lookup link in Supabase:', err);
    }
  }

  // 4. If destination URL or canonical record was not found
  if (!destinationUrl || !canonicalLinkId) {
    console.warn(`[Tracking Redirect] 404: Tracking link record not found in Supabase for identifier: "${identifier}"`);
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<h1>404 Not Found</h1><p>The requested tracking link does not exist or has been removed.</p>');
    return;
  }

  // 5. Validate destination URL to prevent open redirect vulnerabilities
  if (!isValidAmazonUrl(destinationUrl)) {
    console.warn(`[Tracking Redirect] 400: Destination "${destinationUrl}" is not a recognized Amazon URL for ID: "${canonicalLinkId}"`);
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<h1>400 Invalid Destination</h1><p>The destination URL is not a recognized Amazon store address.</p>');
    return;
  }

  // Ensure absolute URL
  const targetRedirect = destinationUrl.startsWith('http://') || destinationUrl.startsWith('https://')
    ? destinationUrl
    : `https://${destinationUrl}`;

  // 6. Bot filtering & duplicate click deduplication (keyed strictly to the canonical tracking link ID)
  const userAgent = req.headers['user-agent'] || '';
  const cookies = parseCookies(req.headers.cookie);
  const dedupeCookieKey = `trk_c_${canonicalLinkId}`;
  const isDuplicateClick = Boolean(cookies[dedupeCookieKey]);
  const isBotRequest = isBot(userAgent);

  // 7. Increment persistent atomic counter in Redis if genuine visitor
  if (isRedisConfigured && !isBotRequest && !isDuplicateClick) {
    try {
      const incrRes = await fetch(redisUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${redisToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['INCR', `click:${canonicalLinkId}`])
      });
      if (incrRes.ok) {
        const data = await incrRes.json();
        console.log(`[Tracking Redirect] Incremented click for ${canonicalLinkId} (via ${identifier}), new count: ${data?.result}`);
      }
    } catch (err) {
      console.error('[Tracking Redirect] Failed to increment click counter in Redis:', err);
    }
  }

  // 8. Set short deduplication cookie to protect against double counting from fast page refreshes
  res.setHeader('Set-Cookie', `${dedupeCookieKey}=1; Max-Age=5; Path=/; SameSite=Lax`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Location', targetRedirect);
  res.statusCode = 302;
  res.end();
}
