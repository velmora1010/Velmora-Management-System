/**
 * Tests for Instagram Reel Discovery Logic in Influencer R&D Extension
 * Covers:
 *  1. Expected Reel anchors (/reel/<shortcode>/)
 *  2. Alternate valid Reel URL formats (/reels/, /<user>/reel/, /<user>/reels/, /p/ on reels tab, /p/ with video/clip icon on feed)
 *  3. Canonical URL formatting & deduplication
 *  4. Media present without Reel links (avatar + highlights = 5 media elements, 0 reels)
 *  5. Login walls, age gates, region restrictions & challenge gates
 *  6. Non-Reel links correctly ignored (tabs, explore, direct, about, photo posts)
 */

export interface MockAnchor {
  href: string;
  innerText?: string;
  textContent?: string;
  hasVideo?: boolean;
  svgAriaLabels?: string[];
  outerHTML?: string;
}

export function matchReelAnchor(
  a: MockAnchor,
  targetUser: string,
  isReelsPage: boolean
): { shortcode: string; canonicalUrl: string; reason: string } | null {
  if (!a) return null;
  const rawHref = (a.href || '').trim();
  if (!rawHref) return null;
  const href = rawHref.toLowerCase();
  const userLower = (targetUser || '').toLowerCase();

  // Exclude non-post and general navigation links
  if (
    href === '/reels/' || href === '/reels' || href.startsWith('/reels?') ||
    href === '/' || href === '/explore/' || href === '/direct/' ||
    href.startsWith('/stories/') || href.startsWith('/accounts/') ||
    href.startsWith('/about/') || href.startsWith('/legal/') ||
    (userLower && (
      href === `/${userLower}/reels/` || href === `/${userLower}/reels` ||
      href === `/${userLower}/` || href === `/${userLower}` ||
      href === `/${userLower}/tagged/` || href === `/${userLower}/tagged` ||
      href.endsWith(`/${userLower}/reels/`) || href.endsWith(`/${userLower}/reels`)
    ))
  ) {
    return null;
  }

  // 1. Check for standard Reel shortcodes (preserve shortcode case from rawHref):
  // e.g. /reel/Cxxxx/, /reels/Cxxxx/, /username/reel/Cxxxx/, /username/reels/Cxxxx/
  const reelMatch = rawHref.match(/(?:\/[^/]+)?\/reels?\/([A-Za-z0-9_-]+)/i);
  if (reelMatch && reelMatch[1]) {
    const sc = reelMatch[1];
    if (!['reels', 'videos', 'tagged', 'audio', 'explore', 'feed'].includes(sc.toLowerCase())) {
      return {
        shortcode: sc,
        canonicalUrl: `https://www.instagram.com/reel/${sc}/`,
        reason: 'reel_path'
      };
    }
  }

  // 2. Check for post permalink: /p/Cxxxx/ or /username/p/Cxxxx/
  const postMatch = rawHref.match(/(?:\/[^/]+)?\/p\/([A-Za-z0-9_-]+)/i);
  if (postMatch && postMatch[1]) {
    const sc = postMatch[1];
    // If currently on the /reels/ tab, any grid post item is a Reel
    if (isReelsPage) {
      return {
        shortcode: sc,
        canonicalUrl: `https://www.instagram.com/reel/${sc}/`,
        reason: 'reels_tab_item'
      };
    }

    // On profile feed, check if the anchor represents a video Reel
    const hasVideo = !!a.hasVideo;
    const svgs = a.svgAriaLabels || [];
    const hasReelSvg = svgs.some(label =>
      /reel|clip|video|play/i.test(label)
    );
    const hasViewIcon = svgs.some(label => /view count/i.test(label));
    const text = (a.innerText || a.textContent || '').trim();
    const hasViewText = /\b\d[\d,.]*\s*[kmbKMB]?(?:\s*(?:views?|plays?))\b/i.test(text);

    if (hasVideo || hasReelSvg || hasViewIcon || hasViewText) {
      return {
        shortcode: sc,
        canonicalUrl: `https://www.instagram.com/reel/${sc}/`,
        reason: hasReelSvg ? 'svg_indicator' : hasVideo ? 'video_tag' : 'view_indicator'
      };
    }
  }

  return null;
}

export function deduplicateReels(
  anchors: MockAnchor[],
  targetUser: string,
  isReelsPage: boolean
): string[] {
  const map = new Map<string, string>();
  for (const a of anchors) {
    const match = matchReelAnchor(a, targetUser, isReelsPage);
    if (match) {
      map.set(match.canonicalUrl, match.canonicalUrl);
    }
  }
  return Array.from(map.values());
}

export function classifyPageState(page: {
  url: string;
  targetUser: string;
  readyState: string;
  anchors: MockAnchor[];
  mediaCount: number;
  mainText: string;
  bodyText: string;
  hasTablist: boolean;
  hasReelsTab: boolean;
  hasInputs?: boolean;
}): {
  status: 'reels_found' | 'no_reels' | 'zero_reels' | 'login_wall' | 'restricted' | 'private' | 'unavailable';
  reelCount: number;
  reason?: string;
} {
  const userLower = page.targetUser.toLowerCase();
  const urlLower = page.url.toLowerCase();
  const isReelsPage = urlLower.includes(`/${userLower}/reels`);
  const mainLower = page.mainText.toLowerCase();
  const bodyLower = page.bodyText.toLowerCase();

  // Login Wall check
  if (
    urlLower.includes('/accounts/login') ||
    bodyLower.includes('log in to instagram') ||
    bodyLower.includes('sign up to see photos') ||
    bodyLower.includes('log in or sign up') ||
    page.hasInputs
  ) {
    return { status: 'login_wall', reelCount: 0, reason: 'Instagram login required' };
  }

  // Age / Region restriction or Challenge check
  if (
    mainLower.includes('restricted profile') ||
    mainLower.includes('confirm your age') ||
    mainLower.includes("content isn't available in your region") ||
    mainLower.includes('age-restricted')
  ) {
    return { status: 'restricted', reelCount: 0, reason: 'Profile is age/region restricted or gated' };
  }

  // Private profile check
  if (mainLower.includes('this account is private')) {
    return { status: 'private', reelCount: 0, reason: 'Profile is private' };
  }

  // Unavailable (404) check
  if (
    mainLower.includes("sorry, this page isn't available") ||
    mainLower.includes("profile isn't available") ||
    mainLower.includes("the link you followed may be broken") ||
    mainLower.includes("page not found")
  ) {
    return { status: 'unavailable', reelCount: 0, reason: 'Profile unavailable or not found' };
  }

  // Extract reels
  const uniqueReels = deduplicateReels(page.anchors, page.targetUser, isReelsPage);
  if (uniqueReels.length > 0) {
    return { status: 'reels_found', reelCount: uniqueReels.length };
  }

  // Explicit empty states
  const hasNoReelsMessage =
    mainLower.includes('no reels yet') ||
    mainLower.includes('no reels available') ||
    mainLower.includes('when you share reels') ||
    mainLower.includes('no reels') ||
    mainLower.includes('no videos yet') ||
    mainLower.includes('no posts yet') ||
    mainLower.includes('capture and share moments');

  const noReelsConfirmed = (page.hasTablist && !page.hasReelsTab) || hasNoReelsMessage;

  if (noReelsConfirmed) {
    return { status: 'no_reels', reelCount: 0, reason: `Profile @${page.targetUser} has no reels posted` };
  }

  return { status: 'zero_reels', reelCount: 0, reason: 'Zero reels discovered in grid' };
}

// ======================== TEST RUNNER ========================
function runTests() {
  console.log('=== TEST SUITE: Instagram Reel Discovery & URL Resilience ===\n');

  // Test 1: Standard Reel Anchors
  console.log('[Test 1] Standard Reel Anchors (/reel/<shortcode>/)...');
  const standard = matchReelAnchor({ href: '/reel/DB12345/' }, 'pcsharmashop', true);
  if (!standard || standard.canonicalUrl !== 'https://www.instagram.com/reel/DB12345/') {
    throw new Error(`Failed standard reel match: ${JSON.stringify(standard)}`);
  }
  const fullUrl = matchReelAnchor({ href: 'https://www.instagram.com/reel/DB_XYZ_999/' }, 'pcsharmashop', true);
  if (!fullUrl || fullUrl.canonicalUrl !== 'https://www.instagram.com/reel/DB_XYZ_999/') {
    throw new Error(`Failed full URL reel match: ${JSON.stringify(fullUrl)}`);
  }
  console.log('  -> Standard Reel anchors correctly parsed and canonicalized.');

  // Test 2: Alternate valid Reel URL formats
  console.log('\n[Test 2] Alternate Valid Reel URL Formats...');
  // a. /reels/<shortcode>/
  const plural = matchReelAnchor({ href: '/reels/C778899/' }, 'pcsharmashop', true);
  if (!plural || plural.canonicalUrl !== 'https://www.instagram.com/reel/C778899/') {
    throw new Error(`Failed /reels/ match: ${JSON.stringify(plural)}`);
  }
  // b. /<user>/reel/<shortcode>/
  const userPrefix = matchReelAnchor({ href: '/pcsharmashop/reel/C991122/' }, 'pcsharmashop', true);
  if (!userPrefix || userPrefix.canonicalUrl !== 'https://www.instagram.com/reel/C991122/') {
    throw new Error(`Failed user-prefixed reel match: ${JSON.stringify(userPrefix)}`);
  }
  // c. /<user>/reels/<shortcode>/
  const userPlural = matchReelAnchor({ href: '/pcsharmashop/reels/C334455/' }, 'pcsharmashop', true);
  if (!userPlural || userPlural.canonicalUrl !== 'https://www.instagram.com/reel/C334455/') {
    throw new Error(`Failed user-prefixed plural reel match: ${JSON.stringify(userPlural)}`);
  }
  // d. With query parameters
  const withQuery = matchReelAnchor({ href: '/reel/C667788/?igsh=MWF5dzN4&utm_source=qr' }, 'pcsharmashop', true);
  if (!withQuery || withQuery.canonicalUrl !== 'https://www.instagram.com/reel/C667788/') {
    throw new Error(`Failed query-parameterized reel match: ${JSON.stringify(withQuery)}`);
  }
  // e. Post permalink on /reels/ tab
  const permalinkOnReelsTab = matchReelAnchor({ href: '/p/C112233/' }, 'pcsharmashop', true);
  if (!permalinkOnReelsTab || permalinkOnReelsTab.canonicalUrl !== 'https://www.instagram.com/reel/C112233/') {
    throw new Error(`Failed /p/ on reels tab match: ${JSON.stringify(permalinkOnReelsTab)}`);
  }
  // f. Post permalink on main feed with video tag
  const permalinkWithVideo = matchReelAnchor({ href: '/p/CVideo01/', hasVideo: true }, 'pcsharmashop', false);
  if (!permalinkWithVideo || permalinkWithVideo.canonicalUrl !== 'https://www.instagram.com/reel/CVideo01/') {
    throw new Error(`Failed /p/ with video tag match: ${JSON.stringify(permalinkWithVideo)}`);
  }
  // g. Post permalink on main feed with Reel SVG
  const permalinkWithReelSvg = matchReelAnchor({ href: '/p/CSvg02/', svgAriaLabels: ['Clip'] }, 'pcsharmashop', false);
  if (!permalinkWithReelSvg || permalinkWithReelSvg.canonicalUrl !== 'https://www.instagram.com/reel/CSvg02/') {
    throw new Error(`Failed /p/ with Reel/Clip SVG match: ${JSON.stringify(permalinkWithReelSvg)}`);
  }
  // h. Post permalink on main feed with view count
  const permalinkWithViews = matchReelAnchor({ href: '/p/CView03/', innerText: '1.2M views' }, 'pcsharmashop', false);
  if (!permalinkWithViews || permalinkWithViews.canonicalUrl !== 'https://www.instagram.com/reel/CView03/') {
    throw new Error(`Failed /p/ with view text match: ${JSON.stringify(permalinkWithViews)}`);
  }
  console.log('  -> All 8 alternate URL formats successfully recognized.');

  // Test 3: Deduplication
  console.log('\n[Test 3] Deduplication across URL format variants...');
  const duplicateBatch: MockAnchor[] = [
    { href: '/reel/SAME123/' },
    { href: 'https://www.instagram.com/reel/SAME123/' },
    { href: '/reels/SAME123/' },
    { href: '/pcsharmashop/reel/SAME123/?igsh=abc' },
    { href: '/reel/DIFF456/' }
  ];
  const uniqueUrls = deduplicateReels(duplicateBatch, 'pcsharmashop', true);
  if (uniqueUrls.length !== 2) {
    throw new Error(`Expected 2 unique URLs, got ${uniqueUrls.length}: ${JSON.stringify(uniqueUrls)}`);
  }
  if (!uniqueUrls.includes('https://www.instagram.com/reel/SAME123/') || !uniqueUrls.includes('https://www.instagram.com/reel/DIFF456/')) {
    throw new Error(`Unexpected unique set: ${JSON.stringify(uniqueUrls)}`);
  }
  console.log(`  -> Deduplicated 5 candidate anchors down to ${uniqueUrls.length} canonical Reel URLs.`);

  // Test 4: Media present without Reel links (Avatar + 4 Highlights = 5 media elements)
  console.log('\n[Test 4] Media present without Reel links (pcsharmashop failure scenario)...');
  const mediaOnlyPage = {
    url: 'https://www.instagram.com/pcsharmashop/reels/',
    targetUser: 'pcsharmashop',
    readyState: 'complete',
    anchors: [
      { href: '/pcsharmashop/reels/' }, // tab
      { href: '/pcsharmashop/tagged/' }, // tab
      { href: '/explore/' },
      { href: '/direct/inbox/' }
    ],
    mediaCount: 5, // 1 profile avatar + 4 highlight circles
    mainText: 'pcsharmashop 10.5K followers No reels yet',
    bodyText: 'pcsharmashop 10.5K followers No reels yet',
    hasTablist: true,
    hasReelsTab: true
  };
  const mediaOnlyResult = classifyPageState(mediaOnlyPage);
  if (mediaOnlyResult.status !== 'no_reels') {
    throw new Error(`Expected "no_reels" classification for empty reels tab with text, got ${mediaOnlyResult.status}`);
  }
  if (mediaOnlyResult.reelCount !== 0) {
    throw new Error(`Expected 0 reels, got ${mediaOnlyResult.reelCount}`);
  }
  console.log('  -> Profile with 5 header media items and "No reels yet" correctly classified as "no_reels" without hanging.');

  // Test 5: Login / challenge / restriction gates
  console.log('\n[Test 5] Login & Restriction Gates...');
  const loginPage = {
    url: 'https://www.instagram.com/accounts/login/?next=/pcsharmashop/reels/',
    targetUser: 'pcsharmashop',
    readyState: 'complete',
    anchors: [],
    mediaCount: 0,
    mainText: 'Log in to Instagram',
    bodyText: 'Log in to Instagram',
    hasTablist: false,
    hasReelsTab: false,
    hasInputs: true
  };
  const loginRes = classifyPageState(loginPage);
  if (loginRes.status !== 'login_wall') {
    throw new Error(`Expected login_wall, got ${loginRes.status}`);
  }

  const restrictedPage = {
    url: 'https://www.instagram.com/pcsharmashop/reels/',
    targetUser: 'pcsharmashop',
    readyState: 'complete',
    anchors: [],
    mediaCount: 1,
    mainText: 'Restricted profile. Please confirm your age to view this content.',
    bodyText: 'Restricted profile. Please confirm your age to view this content.',
    hasTablist: false,
    hasReelsTab: false
  };
  const restrictedRes = classifyPageState(restrictedPage);
  if (restrictedRes.status !== 'restricted') {
    throw new Error(`Expected restricted, got ${restrictedRes.status}`);
  }

  const privatePage = {
    url: 'https://www.instagram.com/pcsharmashop/reels/',
    targetUser: 'pcsharmashop',
    readyState: 'complete',
    anchors: [],
    mediaCount: 1,
    mainText: 'This account is private. Follow to see their photos and videos.',
    bodyText: 'This account is private. Follow to see their photos and videos.',
    hasTablist: false,
    hasReelsTab: false
  };
  const privateRes = classifyPageState(privatePage);
  if (privateRes.status !== 'private') {
    throw new Error(`Expected private, got ${privateRes.status}`);
  }
  console.log('  -> Login wall, restricted profile, and private profile correctly classified with specific stages.');

  // Test 6: Non-Reel links correctly ignored
  console.log('\n[Test 6] Non-Reel links correctly ignored...');
  const nonReelLinks: MockAnchor[] = [
    { href: '/pcsharmashop/reels/' },
    { href: '/pcsharmashop/reels' },
    { href: 'https://www.instagram.com/pcsharmashop/reels/' },
    { href: '/pcsharmashop/' },
    { href: '/pcsharmashop/tagged/' },
    { href: '/reels/' },
    { href: '/reels' },
    { href: '/reels?query=1' },
    { href: '/explore/' },
    { href: '/direct/inbox/' },
    { href: '/stories/pcsharmashop/123456789/' },
    { href: '/accounts/edit/' },
    { href: '/about/us/' },
    { href: '/legal/privacy/' },
    // A regular photo post on profile feed without video or reel icon
    { href: '/p/PhotoPost123/' }
  ];
  for (const link of nonReelLinks) {
    const res = matchReelAnchor(link, 'pcsharmashop', false);
    if (res !== null) {
      throw new Error(`Expected null for non-reel link ${link.href}, got: ${JSON.stringify(res)}`);
    }
  }
  console.log('  -> All 15 non-Reel navigation, tab, story, account, and photo links safely rejected.');

  console.log('\nPASS: All Reel discovery resilience tests passed successfully!');
}

runTests();
