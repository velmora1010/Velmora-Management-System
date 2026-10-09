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

export default async function handler(
  req: IncomingMessage & { query?: Record<string, string> },
  res: ServerResponse
) {
  // Parse Link ID from query parameter
  const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const rawId = urlObj.searchParams.get('id') || (req.query && req.query.id) || '';
  const linkId = rawId.trim();

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

  // 2. If not found in Redis cache, query Supabase for the tracking link record
  if (!destinationUrl) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                        process.env.SUPABASE_SERVICE_ROLE_KEY || 
                        process.env.VITE_SUPABASE_ANON_KEY || 
                        process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const queryUrl = `${supabaseUrl}/rest/v1/influencer_tracking_links?id=eq.${encodeURIComponent(linkId)}&select=id,base_product_url,tracking_url,notes`;
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
            let extractedUrl = row.base_product_url || '';
            if (row.notes && typeof row.notes === 'string' && row.notes.startsWith('{')) {
              try {
                const parsed = JSON.parse(row.notes);
                if (parsed.original_amazon_url) {
                  extractedUrl = parsed.original_amazon_url;
                }
              } catch {}
            }
            destinationUrl = extractedUrl;

            // Cache destination in Redis for future fast redirects
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
          }
        }
      } catch (err) {
        console.error('[Tracking Redirect] Failed to lookup link in Supabase:', err);
      }
    }
  }

  // 3. If destination URL was not found
  if (!destinationUrl) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<h1>404 Not Found</h1><p>The requested tracking link does not exist or has been removed.</p>');
    return;
  }

  // 4. Validate destination URL to prevent open redirect vulnerabilities
  if (!isValidAmazonUrl(destinationUrl)) {
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
