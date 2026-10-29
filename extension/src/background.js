// background.js

const EXTENSION_VERSION = "1.0.0";
let lastUsedIgTabId = null;
let researchQueue = Promise.resolve();

function logTabOp(stage, username, tabId, url, extra = '') {
  const userTag = username ? `@${username}` : 'n/a';
  const extraStr = extra ? ` | ${extra}` : '';
  console.log(`[TabLifecycle][${stage}] user=${userTag} tabId=${tabId ?? 'none'} url=${url || 'n/a'}${extraStr}`);
}

function isTabInvalidError(err) {
  const msg = String(err?.message || err || '');
  return (
    msg.includes('No tab with id') ||
    msg.includes('Frame with ID') ||
    msg.includes('tab was closed or disconnected') ||
    msg.includes('TAB_CLOSED_OR_INVALID') ||
    msg.includes('Cannot access a chrome://') ||
    msg.includes('Tabs cannot be edited right now')
  );
}

chrome.tabs.onRemoved.addListener((closedTabId) => {
  if (lastUsedIgTabId === closedTabId) {
    logTabOp('tab_removed_event', null, closedTabId, null, 'Clearing stale lastUsedIgTabId');
    lastUsedIgTabId = null;
  }
});

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  if (lastUsedIgTabId === removedTabId) {
    logTabOp('tab_replaced_event', null, addedTabId, null, `Replaced old tabId=${removedTabId} with addedTabId=${addedTabId}`);
    lastUsedIgTabId = addedTabId;
  }
});

async function getValidTabById(tabId, username, stage) {
  if (!tabId) return null;
  logTabOp(`${stage}:chrome.tabs.get`, username, tabId, null);
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        logTabOp(`${stage}:chrome.tabs.get_failed`, username, tabId, null, chrome.runtime.lastError?.message || 'Tab not found');
        resolve(null);
        return;
      }
      if (tab.discarded) {
        logTabOp(`${stage}:tab_discarded`, username, tab.id, tab.url, 'Tab is discarded');
      }
      resolve(tab);
    });
  });
}

async function acquireOrCreateInstagramTab(normalizedUser, stage, forceRecreate = false) {
  // 1. Validate existing lastUsedIgTabId first if not forcing re-query
  if (!forceRecreate && lastUsedIgTabId) {
    const existingTab = await getValidTabById(lastUsedIgTabId, normalizedUser, `${stage}:validate_cached`);
    if (existingTab && !existingTab.discarded && (existingTab.url || '').includes('instagram.com')) {
      lastUsedIgTabId = existingTab.id;
      logTabOp(`${stage}:reusing_valid_tab`, normalizedUser, existingTab.id, existingTab.url);
      return existingTab;
    }
    logTabOp(`${stage}:cached_tab_invalid`, normalizedUser, lastUsedIgTabId, existingTab?.url, 'Clearing cached tab ID');
    lastUsedIgTabId = null;
  }

  // 2. Query open Instagram tabs and validate the chosen one via chrome.tabs.get
  const tabs = await new Promise((res) => chrome.tabs.query({ url: "*://*.instagram.com/*" }, res));
  if (tabs && tabs.length > 0) {
    const userLower = (normalizedUser || '').toLowerCase();
    const candidates = [
      tabs.find(t => !t.discarded && userLower && (t.url || '').toLowerCase().includes(`/${userLower}`)),
      tabs.find(t => !t.discarded && (t.url || '').toLowerCase().includes('/reels')),
      tabs.find(t => !t.discarded && t.active),
      tabs.find(t => !t.discarded),
      tabs[0]
    ].filter(Boolean);

    for (const candidate of candidates) {
      const verified = await getValidTabById(candidate.id, normalizedUser, `${stage}:verify_queried_tab`);
      if (verified) {
        lastUsedIgTabId = verified.id;
        logTabOp(`${stage}:acquired_queried_tab`, normalizedUser, verified.id, verified.url);
        return verified;
      }
    }
  }

  // 3. No valid open Instagram tab exists: create a new research tab safely
  const initialUrl = normalizedUser
    ? `https://www.instagram.com/${normalizedUser}/reels/`
    : 'https://www.instagram.com/';
  logTabOp(`${stage}:chrome.tabs.create`, normalizedUser, null, initialUrl, 'Creating new Instagram research tab');
  const createdTab = await new Promise((resolve, reject) => {
    chrome.tabs.create({ url: initialUrl, active: false }, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        reject(new Error(chrome.runtime.lastError?.message || 'Failed to create Instagram tab.'));
      } else {
        resolve(tab);
      }
    });
  });

  lastUsedIgTabId = createdTab.id;
  logTabOp(`${stage}:created_new_tab`, normalizedUser, createdTab.id, createdTab.url || initialUrl);
  await new Promise(r => setTimeout(r, 1500));
  return createdTab;
}

async function updateInstagramTabUrl(tabId, targetUrl, normalizedUser, stage) {
  let validTab = await getValidTabById(tabId, normalizedUser, `${stage}:pre_update_check`);
  if (!validTab || validTab.discarded || (validTab.url && !validTab.url.includes('instagram.com') && !validTab.url.startsWith('about:blank'))) {
    logTabOp(
      `${stage}:tab_unavailable_or_non_ig_before_update`,
      normalizedUser,
      tabId,
      validTab?.url || targetUrl,
      'Reacquiring valid Instagram tab before navigation'
    );
    validTab = await acquireOrCreateInstagramTab(normalizedUser, `${stage}:reacquire`, true);
  }

  const attemptTabUpdate = (targetTabId, currentTabUrl, attemptLabel) => {
    logTabOp(`${stage}:${attemptLabel}`, normalizedUser, targetTabId, targetUrl, `currentTabUrl=${currentTabUrl || 'unknown'}`);
    return new Promise((resolve, reject) => {
      chrome.tabs.update(targetTabId, { url: targetUrl }, (tab) => {
        if (chrome.runtime.lastError) {
          const rawMsg = chrome.runtime.lastError.message || 'Unknown chrome.tabs.update error';
          const navErr = new Error(rawMsg);
          navErr.isNavigationError = true;
          navErr.navigationDiag = {
            stage,
            requestedUrl: targetUrl,
            tabId: targetTabId,
            currentTabUrl: currentTabUrl || 'unknown',
            originalChromeError: rawMsg
          };
          logTabOp(
            `${stage}:${attemptLabel}_failed`,
            normalizedUser,
            targetTabId,
            targetUrl,
            `currentTabUrl=${currentTabUrl || 'unknown'} | chromeError=${rawMsg}`
          );
          reject(navErr);
        } else {
          resolve(tab);
        }
      });
    });
  };

  let currentTabId = validTab.id;
  let currentTabUrl = validTab.url || 'unknown';

  try {
    const updatedTab = await attemptTabUpdate(currentTabId, currentTabUrl, 'chrome.tabs.update');
    const finalTabId = updatedTab?.id || currentTabId;
    lastUsedIgTabId = finalTabId;
    logTabOp(`${stage}:chrome.tabs.update_success`, normalizedUser, finalTabId, updatedTab?.url || targetUrl);
    return finalTabId;
  } catch (firstErr) {
    const firstDiag = firstErr.navigationDiag || {
      stage,
      requestedUrl: targetUrl,
      tabId: currentTabId,
      currentTabUrl,
      originalChromeError: firstErr.message || String(firstErr)
    };
    console.warn(
      `[TabLifecycle][${stage}] Transient navigation failure on tab ${firstDiag.tabId} (currentUrl=${firstDiag.currentTabUrl} -> requestedUrl=${firstDiag.requestedUrl}): ${firstDiag.originalChromeError}. Performing 1 safe retry...`
    );

    // Wait briefly for any transient renderer/navigation lock to settle (max 1 retry)
    await new Promise(r => setTimeout(r, 1200));

    let retryTab = await getValidTabById(currentTabId, normalizedUser, `${stage}:retry_validate_tab`);
    if (!retryTab || retryTab.discarded || (retryTab.url && !retryTab.url.includes('instagram.com') && !retryTab.url.startsWith('about:blank'))) {
      lastUsedIgTabId = null;
      retryTab = await acquireOrCreateInstagramTab(normalizedUser, `${stage}:retry_reacquire_tab`, true);
    }

    const retryTabId = retryTab.id;
    const retryTabUrl = retryTab.url || 'unknown';

    try {
      const updatedTab = await attemptTabUpdate(retryTabId, retryTabUrl, 'chrome.tabs.update_retry');
      const finalTabId = updatedTab?.id || retryTabId;
      lastUsedIgTabId = finalTabId;
      logTabOp(`${stage}:chrome.tabs.update_retry_success`, normalizedUser, finalTabId, updatedTab?.url || targetUrl);
      return finalTabId;
    } catch (retryErr) {
      lastUsedIgTabId = null;
      const retryChromeError = retryErr.navigationDiag?.originalChromeError || retryErr.message || String(retryErr);
      const finalNavErr = new Error(
        `Navigation rejected at stage "${stage}" for requested URL ${targetUrl} (Tab ID: ${retryTabId}, Current Tab URL: ${retryTabUrl}, Chrome Error: ${retryChromeError})`
      );
      finalNavErr.isNavigationError = true;
      finalNavErr.navigationDiag = {
        stage,
        requestedUrl: targetUrl,
        tabId: retryTabId,
        currentTabUrl: retryTabUrl,
        originalChromeError: retryChromeError,
        initialTabId: firstDiag.tabId,
        initialTabUrl: firstDiag.currentTabUrl,
        initialChromeError: firstDiag.originalChromeError,
        retriedOnce: true
      };
      throw finalNavErr;
    }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_EXTENSION_STATUS' || request.type === 'PING') {
    sendResponse({ type: 'PONG', status: 'OK', extensionVersion: EXTENSION_VERSION, timestamp: Date.now() });
    return true;
  }

  if (request.type === 'CHECK_INSTAGRAM_SESSION' || request.type === 'CHECK_INSTAGRAM_LOGIN') {
    checkInstagramStatus().then(status => {
      sendResponse({ type: 'INSTAGRAM_STATUS', ...status });
    }).catch(err => {
      sendResponse({ type: 'INSTAGRAM_STATUS', available: false, session: 'unknown', error: err.toString() });
    });
    return true;
  }

  if (request.type === 'START_PROFILE_RESEARCH') {
    // Enforce strict sequential execution across profile research requests
    researchQueue = researchQueue.catch(() => {}).then(async () => {
      try {
        const result = await startProfileResearch(request.payload, sender);
        sendResponse({ type: 'PROFILE_COMPLETED', payload: result });
      } catch (err) {
        sendResponse({ type: 'PROFILE_FAILED', error: err.message || err.toString(), payload: request.payload });
      }
    });
    return true; // asynchronous response
  }

  if (request.type === 'DIAGNOSE_REEL_DISCOVERY') {
    runReelDiagnostic(request.payload, sender).then(result => {
      sendResponse({ type: 'DIAGNOSTIC_COMPLETED', payload: result });
    }).catch(err => {
      sendResponse({
        type: 'DIAGNOSTIC_COMPLETED',
        payload: {
          success: false,
          stage: 'communication_failure',
          message: err.message || err.toString(),
          error: err.toString()
        }
      });
    });
    return true; // asynchronous response
  }

  return false;
});

async function checkInstagramStatus() {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: "*://*.instagram.com/*" }, (tabs) => {
      const isAvailable = tabs && tabs.length > 0;
      const tabId = isAvailable ? tabs[0].id : undefined;

      chrome.cookies.get({ url: 'https://www.instagram.com', name: 'sessionid' }, (cookie) => {
        if (chrome.runtime.lastError) {
          resolve({ available: isAvailable, session: 'unknown', tabId, error: chrome.runtime.lastError.message });
          return;
        }

        if (cookie && cookie.value) {
          resolve({ available: isAvailable, session: 'detected', tabId });
        } else {
          resolve({ available: isAvailable, session: 'login_required', tabId });
        }
      });
    });
  });
}

function normalizeUsername(username) {
  let cleaned = String(username || '').trim();
  if (cleaned.startsWith('@')) {
    cleaned = cleaned.substring(1);
  }
  return cleaned.toLowerCase();
}

function sendEventToSender(sender, eventType, payload) {
  if (sender && sender.tab && sender.tab.id) {
    const senderTabId = sender.tab.id;
    const senderUrl = sender.tab.url || 'velmora-app';
    const user = payload?.username || payload?.verifiedUsername || null;
    logTabOp(`sendEventToSender:${eventType}`, user, senderTabId, senderUrl);
    chrome.tabs.sendMessage(senderTabId, {
      source: 'VELMORA_RND_EXTENSION',
      type: eventType,
      payload
    }).catch((err) => {
      console.warn("Failed to send event to sender tab:", err);
    });
  }
}

async function injectScript(tabId, func, args = [], meta = {}) {
  if (meta.stage) {
    logTabOp(`${meta.stage}:executeScript`, meta.username || null, tabId, meta.url || null);
  }
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript({
      target: { tabId },
      func,
      args
    }, (results) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(results[0]?.result);
      }
    });
  });
}

async function verifyProfile(igTabId, targetUsername) {
  let elapsed = 0;
  const timeout = 15000;
  const interval = 1000;
  let consecutiveNotFound = 0;
  let lastDiag = null;
  const targetUrl = `https://www.instagram.com/${targetUsername}/reels/`;
  logTabOp('verifyProfile:start', targetUsername, igTabId, targetUrl);

  while (elapsed < timeout) {
    let res;
    try {
      res = await injectScript(igTabId, (u) => {
        const url = window.location.href;
        const urlLower = url.toLowerCase();
        const userLower = u.toLowerCase();
        const isTargetUserInUrl = urlLower.includes(`/${userLower}`);
        const readyState = document.readyState;

        const mainEl = document.querySelector('main');
        const mainText = (mainEl ? mainEl.innerText : (document.body ? document.body.innerText : '') || '').toLowerCase();
        const pageLower = document.body ? document.body.innerText.toLowerCase() : '';

        const isLoginWall =
          urlLower.includes('/accounts/login') ||
          pageLower.includes("log in to instagram") ||
          pageLower.includes("sign up to see photos") ||
          !!document.querySelector('input[name="username"], input[name="password"]');

        if (isLoginWall) {
          return { status: "login_wall", url, readyState };
        }

        // If URL doesn't yet belong to the target user, wait for navigation before checking for 404/private text
        if (!isTargetUserInUrl) {
          return { status: "loading", reason: "url_not_target_user", url, readyState };
        }

        const hasProfileHeader = !!document.querySelector('header a[href*="/followers/"], main div[role="tablist"], a[href*="/reel/"]');

        // Confirm 404 / unavailable only when target URL has loaded and no valid profile header/grid exists
        if (
          !hasProfileHeader &&
          (mainText.includes("sorry, this page isn't available") ||
           mainText.includes("profile isn't available") ||
           mainText.includes("the link you followed may be broken") ||
           mainText.includes("page not found"))
        ) {
          return { status: "not_found", url, readyState };
        }

        if (mainText.includes("this account is private")) {
          return { status: "private", url, readyState };
        }

        // Strategy 1: Metadata fallback (meta description / og:description)
        const meta = document.querySelector('meta[name="description"]');
        const ogMeta = document.querySelector('meta[property="og:description"]');
        const descContent = ((meta?.getAttribute("content") || "") + " " + (ogMeta?.getAttribute("content") || "")).toLowerCase();
        const targetStr = `@${userLower}`;

        function parseCandidate(str) {
          if (!str || typeof str !== 'string') return null;
          const cleaned = str.trim().replace(/\s+/g, ' ');
          const m = cleaned.match(/^([\d,.]+\s*[kmbKMB]?)$/i);
          if (!m) return null;
          return m[1].replace(/\s+/g, '');
        }

        if (descContent.includes(targetStr) || descContent.includes(userLower)) {
          const match = descContent.match(/([\d,.]+[kmbKMB]?)\s+followers/i);
          if (match) {
            const cand = parseCandidate(match[1]);
            if (cand) return { status: "ok", followerDisplay: cand, source: "meta_description", url, readyState };
          }
        }

        // Strategy 2: Robust Followers anchor discovery across the entire document (main, header, section)
        // Searches beyond document.querySelector('header') to support responsive, modern, and SPA profile layouts
        const allFollowerAnchors = Array.from(document.querySelectorAll('a[href*="/followers/"], a[href$="/followers"], a[href*="/followers?"]'));
        const userFollowerAnchor = allFollowerAnchors.find(a => {
          const href = (a.getAttribute('href') || '').toLowerCase();
          return href.includes(`/${userLower}/followers`) || href.endsWith('/followers/') || href.endsWith('/followers');
        }) || allFollowerAnchors[0];

        if (userFollowerAnchor) {
          // Check span with title attribute (frequently holds exact full count e.g. "436,123")
          const titleSpan = userFollowerAnchor.querySelector('span[title], [title]');
          if (titleSpan) {
            const rawTitle = (titleSpan.getAttribute('title') || '').trim();
            const cand = parseCandidate(rawTitle);
            if (cand) return { status: "ok", followerDisplay: cand, source: "anchor_title", url, readyState };
          }

          // Check inner spans for numeric follower text (e.g. "436K")
          const innerSpans = Array.from(userFollowerAnchor.querySelectorAll('span, div, b, strong'));
          for (const s of innerSpans) {
            const t = (s.innerText || s.textContent || '').trim();
            if (/\d/.test(t) && !/following/i.test(t)) {
              const cand = parseCandidate(t);
              if (cand) return { status: "ok", followerDisplay: cand, source: "anchor_span", url, readyState };
            }
          }

          // Check anchor innerText (e.g. "436K followers")
          const anchorText = (userFollowerAnchor.innerText || userFollowerAnchor.textContent || '').trim();
          const anchorM = anchorText.match(/^([\d,.]+\s*[kmbKMB]?)\s*followers/i) ||
                          anchorText.match(/([\d,.]+\s*[kmbKMB]?)\s+followers/i);
          if (anchorM) {
            const cand = parseCandidate(anchorM[1]);
            if (cand) return { status: "ok", followerDisplay: cand, source: "anchor_text", url, readyState };
          }
        }

        // Strategy 3: Profile stats list items (ul > li: Posts, Followers, Following)
        // Explicitly ensures we NEVER capture the following count or post count
        const statsListItems = Array.from(document.querySelectorAll('main li, header li, section li'));
        for (const li of statsListItems) {
          const text = (li.innerText || li.textContent || '').trim();
          if (/followers\b/i.test(text) && !/following\b/i.test(text)) {
            const titleSpan = li.querySelector('span[title], [title]');
            if (titleSpan) {
              const cand = parseCandidate(titleSpan.getAttribute('title'));
              if (cand) return { status: "ok", followerDisplay: cand, source: "li_title", url, readyState };
            }
            const match = text.match(/([\d,.]+\s*[kmbKMB]?)\s*followers/i);
            if (match) {
              const cand = parseCandidate(match[1]);
              if (cand) return { status: "ok", followerDisplay: cand, source: "li_followers", url, readyState };
            }
          }
        }

        // Strategy 4: Main header container text matching "X followers"
        if (mainEl) {
          const m = mainEl.innerText.match(/\b([\d,.]+\s*[kmbKMB]?)\s+followers\b/i);
          if (m && !m[0].toLowerCase().includes('following')) {
            const cand = parseCandidate(m[1]);
            if (cand) return { status: "ok", followerDisplay: cand, source: "main_text", url, readyState };
          }
        }

        return { status: "loading", reason: "awaiting_follower_data", url, readyState, hasProfileHeader };
      }, [targetUsername]);
    } catch (err) {
      if (isTabInvalidError(err)) {
        logTabOp('verifyProfile:tab_invalid', targetUsername, igTabId, targetUrl, err.message);
        throw new Error(`TAB_CLOSED_OR_INVALID: Instagram tab (${igTabId}) was closed or disconnected during verification: ${err.message}`);
      }
      res = { status: "loading", reason: "script_error" }; // Treat other execution errors as loading (e.g. page navigated away briefly)
    }

    lastDiag = res;

    if (res?.status === 'ok') return res.followerDisplay;
    if (res?.status === 'login_wall') {
      throw new Error(`Instagram session login required while verifying @${targetUsername} (URL: ${res.url || targetUrl}).`);
    }
    if (res?.status === 'private') {
      throw new Error(`Instagram profile @${targetUsername} is private.`);
    }
    if (res?.status === 'not_found') {
      consecutiveNotFound++;
      if (consecutiveNotFound >= 2 && (res.readyState === 'complete' || res.readyState === 'interactive')) {
        throw new Error(`Instagram profile @${targetUsername} could not be verified (Confirmed Page not found on ${res.url || targetUrl}).`);
      }
    } else {
      consecutiveNotFound = 0;
    }

    await new Promise(r => setTimeout(r, interval));
    elapsed += interval;
  }

  throw new Error(
    `Instagram profile @${targetUsername} verification timed out after ${timeout}ms (Stage: ${lastDiag?.reason || 'loading'}, URL: ${lastDiag?.url || targetUrl}, readyState: ${lastDiag?.readyState || 'unknown'}).`
  );
}

async function navigateTo(igTabId, url, username = null) {
  return updateInstagramTabUrl(igTabId, url, username, 'navigateTo');
}

function parseInstagramViewCount(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  const cleaned = rawText.trim().replace(/\s+/g, ' ');
  if (!cleaned) return null;

  const match = cleaned.match(/^([\d,.]+)\s*([kmbKMB])?(?:\s*(?:views?|plays?))?$/i);
  if (!match) return null;

  const numPart = match[1];
  const suffix = match[2] ? match[2].toLowerCase() : null;

  const normalizedNumStr = numPart.replace(/,/g, '');
  if ((normalizedNumStr.match(/\./g) || []).length > 1) return null;
  const base = parseFloat(normalizedNumStr);
  if (isNaN(base) || base < 0) return null;

  if (suffix === 'k') return Math.round(base * 1000);
  if (suffix === 'm') return Math.round(base * 1000000);
  if (suffix === 'b') return Math.round(base * 1000000000);
  if (!suffix) return Math.round(base);
  return null;
}

async function discoverReelLinks(igTabId, username = null) {
  const verifiedTab = await getValidTabById(igTabId, username, 'discoverReelLinks:pre_check');
  const tabGetSucceeded = !!verifiedTab;
  logTabOp(
    'discoverReelLinks',
    username,
    igTabId,
    verifiedTab?.url || `https://www.instagram.com/${username || ''}/reels/`,
    `chrome.tabs.get=${tabGetSucceeded ? 'OK' : 'FAILED'}`
  );
  if (!verifiedTab) {
    throw new Error(`TAB_CLOSED_OR_INVALID: Instagram tab (${igTabId}) is unavailable before reel discovery (chrome.tabs.get failed).`);
  }

  try {
    const result = await injectScript(igTabId, (targetUser) => {
      function parseView(rawText) {
        if (!rawText || typeof rawText !== 'string') return null;
        const cleaned = rawText.trim().replace(/\s+/g, ' ');
        if (!cleaned) return null;
        const match = cleaned.match(/^([\d,.]+)\s*([kmbKMB])?(?:\s*(?:views?|plays?))?$/i);
        if (!match) return null;
        const numPart = match[1];
        const suffix = match[2] ? match[2].toLowerCase() : null;
        const normalizedNumStr = numPart.replace(/,/g, '');
        if ((normalizedNumStr.match(/\./g) || []).length > 1) return null;
        const base = parseFloat(normalizedNumStr);
        if (isNaN(base) || base < 0) return null;
        if (suffix === 'k') return Math.round(base * 1000);
        if (suffix === 'm') return Math.round(base * 1000000);
        if (suffix === 'b') return Math.round(base * 1000000000);
        if (!suffix) return Math.round(base);
        return null;
      }

      function extractView(a) {
        let pinnedSvg = a.querySelector('svg[aria-label="Pinned post icon"], svg[aria-label*="Pinned" i]');
        if (!pinnedSvg && a.parentElement && a.parentElement.querySelectorAll('a[href*="/reel/"]').length === 1) {
          pinnedSvg = a.parentElement.querySelector('svg[aria-label="Pinned post icon"], svg[aria-label*="Pinned" i]');
        }
        const isPinned = !!pinnedSvg;
        if (isPinned) {
          return { rawText: null, count: null, location: 'pinned_skipped', isPinned: true, viewIconFound: false };
        }

        const viewIcon = a.querySelector('svg[aria-label="View count icon"], svg[aria-label*="View count" i], svg[aria-label*="view count" i]');
        if (viewIcon) {
          // 1. Immediate siblings of icon
          if (viewIcon.nextElementSibling) {
            const text = (viewIcon.nextElementSibling.innerText || viewIcon.nextElementSibling.textContent || '').trim();
            const count = parseView(text);
            if (count !== null) return { rawText: text, count, location: 'icon_next_sibling', isPinned: false, viewIconFound: true };
          }
          if (viewIcon.previousElementSibling) {
            const text = (viewIcon.previousElementSibling.innerText || viewIcon.previousElementSibling.textContent || '').trim();
            const count = parseView(text);
            if (count !== null) return { rawText: text, count, location: 'icon_prev_sibling', isPinned: false, viewIconFound: true };
          }

          // 2. Icon's direct parent element
          const parent = viewIcon.parentElement;
          if (parent) {
            const directChildren = Array.from(parent.querySelectorAll('span, div')).filter(el => el !== viewIcon && !viewIcon.contains(el));
            for (const child of directChildren) {
              const text = (child.innerText || child.textContent || '').trim();
              const count = parseView(text);
              if (count !== null) return { rawText: text, count, location: 'parent_child', isPinned: false, viewIconFound: true };
            }
            const parentText = (parent.innerText || parent.textContent || '').trim();
            const count = parseView(parentText);
            if (count !== null) return { rawText: parentText, count, location: 'parent_text', isPinned: false, viewIconFound: true };

            if (parent.nextElementSibling) {
              const text = (parent.nextElementSibling.innerText || parent.nextElementSibling.textContent || '').trim();
              const count = parseView(text);
              if (count !== null) return { rawText: text, count, location: 'parent_next_sibling', isPinned: false, viewIconFound: true };
            }
          }

          // 3. Ancestor container inside anchor
          let curr = parent ? parent.parentElement : null;
          while (curr && curr !== a && curr !== document.body) {
            const candidateNodes = Array.from(curr.querySelectorAll('span, div')).filter(el => !viewIcon.contains(el));
            for (const node of candidateNodes) {
              const parentWithSvg = node.parentElement;
              if (parentWithSvg && parentWithSvg.querySelector('svg[aria-label*="Like" i], svg[aria-label*="Comment" i]')) {
                continue;
              }
              const text = (node.innerText || node.textContent || '').trim();
              const count = parseView(text);
              if (count !== null) return { rawText: text, count, location: 'wrapper_span', isPinned: false, viewIconFound: true };
            }
            curr = curr.parentElement;
          }
          // If viewIcon was present but Steps 1-3 did not match, fall through to Step 4 leaf/regex fallback
        }

        const hasViewIcon = !!viewIcon;

        // 4. Evidence-based fallback when View count SVG aria-label is absent or text is in a separate leaf:
        // Collect all leaf spans/divs inside the anchor, excluding hover-overlay icons (Like/Comment)
        const leafCandidates = [];
        const innerSpans = Array.from(a.querySelectorAll('span, div'));
        for (const span of innerSpans) {
          if (span.querySelector('span, div')) continue;
          const parentWithSvg = span.parentElement;
          if (parentWithSvg && parentWithSvg.querySelector('svg[aria-label*="Like" i], svg[aria-label*="Comment" i]')) {
            continue;
          }
          const text = (span.innerText || span.textContent || '').trim();
          const count = parseView(text);
          if (count !== null) {
            leafCandidates.push({ rawText: text, count });
          }
        }

        if (leafCandidates.length > 0) {
          // In Instagram's Reels grid DOM, the hover overlay (Likes, Comments) precedes the persistent bottom-left View Count footer.
          // Selecting the last leaf candidate pairs the Reel with its actual view count.
          const lastCandidate = leafCandidates[leafCandidates.length - 1];
          return {
            rawText: lastCandidate.rawText,
            count: lastCandidate.count,
            location: leafCandidates.length > 1 ? `anchor_last_leaf_of_${leafCandidates.length}` : 'anchor_child_span',
            isPinned: false,
            viewIconFound: hasViewIcon
          };
        }

        const anchorDirectText = (a.innerText || a.textContent || '').trim();
        const directCount = parseView(anchorDirectText);
        if (directCount !== null) {
          return { rawText: anchorDirectText, count: directCount, location: 'anchor_direct_text', isPinned: false, viewIconFound: hasViewIcon };
        }

        const allMatches = Array.from(anchorDirectText.matchAll(/\b(\d[\d,.]*\s*[kmbKMB]?(?:\s*(?:views?|plays?))?)\b/gi));
        for (let i = allMatches.length - 1; i >= 0; i--) {
          const candidateStr = allMatches[i][1].trim();
          const count = parseView(candidateStr);
          if (count !== null) {
            return { rawText: candidateStr, count, location: 'anchor_candidate_regex', isPinned: false, viewIconFound: hasViewIcon };
          }
        }

        return { rawText: null, count: null, location: hasViewIcon ? 'text_not_matched' : 'icon_not_found', isPinned: false, viewIconFound: hasViewIcon };
      }

      const userLower = (targetUser || '').toLowerCase();
      const allDocAnchors = Array.from(document.querySelectorAll('a[href]'));
      const anchors = allDocAnchors.filter(a => {
        const href = (a.getAttribute('href') || a.href || '').toLowerCase();
        if (href.includes('/reel/')) return true;
        if (href.includes('/reels/')) {
          if (href === '/reels/' || href === '/reels' || href.startsWith('/reels?')) return false;
          if (userLower && (href === `/${userLower}/reels/` || href === `/${userLower}/reels`)) return false;
          if (/\/reels\/[A-Za-z0-9_-]+\/?/.test(href)) return true;
        }
        return false;
      });
      return anchors.map(a => {
        let cleanUrl = a.href;
        try {
          const u = new URL(a.href);
          cleanUrl = `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
        } catch (e) {
          cleanUrl = (a.href || '').split('?')[0].replace(/\/+$/, '');
        }

        const viewData = extractView(a);
        let missingDiag = null;
        if (viewData.count === null && !viewData.isPinned) {
          const anchorText = (a.innerText || a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120);
          const descendantTexts = Array.from(a.querySelectorAll('span, div, svg'))
            .map(el => {
              const t = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
              const aria = el.getAttribute ? (el.getAttribute('aria-label') || '') : '';
              return t || (aria ? `[aria:${aria}]` : '');
            })
            .filter(Boolean)
            .slice(0, 8);
          missingDiag = {
            anchorText,
            descendantTexts,
            outerHTMLSnippet: a.outerHTML.slice(0, 350)
          };
        }

        return {
          url: cleanUrl,
          isPinned: viewData.isPinned,
          viewCount: viewData.count,
          rawViewText: viewData.rawText,
          viewIconLocation: viewData.location,
          viewIconFound: viewData.viewIconFound,
          missingDiag
        };
      });
    }, [username]);
    return result || [];
  } catch (err) {
    console.warn("[discoverReelLinks] Error discovering reels:", err.message || err);
    if (isTabInvalidError(err)) {
      logTabOp('discoverReelLinks:tab_invalid', username, igTabId, null, err.message);
      throw new Error(`TAB_CLOSED_OR_INVALID: Instagram tab (${igTabId}) was closed or disconnected during reel discovery: ${err.message}`);
    }
    return [];
  }
}

async function scrollUntilEnoughReels(igTabId, sender, payload) {
  const normalizedUser = normalizeUsername(payload?.username || '');
  logTabOp('scrollUntilEnoughReels:start', normalizedUser, igTabId, `https://www.instagram.com/${normalizedUser}/reels/`);
  sendEventToSender(sender, 'REELS_SCROLLING', payload);

  let uniqueReelCount = 0;
  let scrollRounds = 0;
  let stableRounds = 0;
  let zeroRounds = 0;
  let allDiscovered = [];

  const targetValidCounts = 15;
  const maxScrolls = 16;
  const maxStableRounds = 5; // Bounded adaptive pagination: allow up to 5 stable rounds for background tab lazy loading

  while (scrollRounds < maxScrolls) {
    const currentBatch = await discoverReelLinks(igTabId, normalizedUser);
    const previousUniqueCount = uniqueReelCount;

    // Deduplicate and update view counts if previously missed
    const urlMap = new Map(allDiscovered.map(r => [r.url, r]));
    for (const reel of currentBatch) {
      if (!urlMap.has(reel.url)) {
        allDiscovered.push(reel);
        urlMap.set(reel.url, reel);
      } else {
        const existing = urlMap.get(reel.url);
        if (existing.viewCount === null && reel.viewCount !== null) {
          existing.viewCount = reel.viewCount;
          existing.rawViewText = reel.rawViewText;
          existing.viewIconLocation = reel.viewIconLocation;
          existing.viewIconFound = reel.viewIconFound;
        }
      }
    }

    uniqueReelCount = allDiscovered.length;
    const validNonPinnedCount = allDiscovered.filter(r => !r.isPinned && typeof r.viewCount === 'number' && r.viewCount >= 0).length;

    sendEventToSender(sender, 'REELS_DISCOVERED', {
      ...payload,
      discovered: uniqueReelCount,
      validViews: validNonPinnedCount
    });

    if (validNonPinnedCount >= targetValidCounts) {
      break;
    }

    if (uniqueReelCount === previousUniqueCount && uniqueReelCount > 0) {
      stableRounds++;
      if (stableRounds >= maxStableRounds) {
        console.log(`[scrollUntilEnoughReels] Plateau confirmed after ${stableRounds} stable rounds for @${normalizedUser} (${uniqueReelCount} discovered, ${validNonPinnedCount} valid non-pinned).`);
        break; // Plateau reached after bounded adaptive attempts
      }
    } else if (uniqueReelCount > previousUniqueCount) {
      stableRounds = 0; // Reset plateau on observable DOM progress
    } else if (uniqueReelCount === 0) {
      zeroRounds++;
      if (zeroRounds <= 2) {
        try {
          await injectScript(igTabId, (targetUser) => {
            const userLower = targetUser.toLowerCase();
            const tablist = document.querySelector('main div[role="tablist"], div[role="tablist"]');
            const reelsTab =
              (tablist && (tablist.querySelector('a[href*="/reels/"]') || tablist.querySelector('a[role="tab"][href*="/reels/"]'))) ||
              Array.from(document.querySelectorAll('main a[href*="/reels/"]')).find(a => {
                const h = (a.getAttribute('href') || '').toLowerCase();
                return (h.includes(`/${userLower}/reels`) || h.endsWith('/reels/')) &&
                       !h.endsWith('.com/reels/') && h !== '/reels/' && h !== '/reels' && !h.startsWith('/reels?');
              });
            if (reelsTab) {
              reelsTab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
              reelsTab.click();
            }
            window.dispatchEvent(new Event('resize'));
            window.dispatchEvent(new Event('scroll'));
          }, [normalizedUser]);
        } catch (e) {}
      }
      if (zeroRounds >= 4) break; // If 0 reels remain after 4 attempts, stop scrolling empty page
    }

    // Real browser scroll operation with adaptive triggers
    let scrollDiag = null;
    try {
      scrollDiag = await injectScript(igTabId, (isStall) => {
        const doc = document;
        const allDocAnchors = Array.from(doc.querySelectorAll('a[href]'));
        const reelAnchors = allDocAnchors.filter(a => {
          const href = (a.getAttribute('href') || a.href || '').toLowerCase();
          return href.includes('/reel/') || /\/reels\/[A-Za-z0-9_-]+\/?/.test(href);
        });
        if (reelAnchors.length > 0) {
          const lastAnchor = reelAnchors[reelAnchors.length - 1];
          try {
            lastAnchor.scrollIntoView({ behavior: 'instant', block: 'end' });
          } catch (e) {}
        }

        const scrollingEl = doc.scrollingElement || doc.documentElement || doc.body;
        const scrollHeight = Math.max(
          doc.documentElement ? doc.documentElement.scrollHeight : 0,
          doc.body ? doc.body.scrollHeight : 0,
          scrollingEl ? scrollingEl.scrollHeight : 0
        );

        // Perform scroll
        window.scrollTo({ top: scrollHeight, behavior: 'instant' });
        if (scrollingEl) {
          scrollingEl.scrollTop = scrollHeight;
        }

        // Real browser micro-scroll bounce to trigger IntersectionObserver threshold crossing
        if (isStall) {
          window.scrollBy(0, -250);
          window.scrollBy(0, 350);
        } else {
          window.scrollBy(0, -100);
          window.scrollBy(0, 200);
        }
        window.dispatchEvent(new Event('scroll', { bubbles: true }));

        const isLoadingSpinner = !!doc.querySelector('svg[aria-label="Loading..."], div[role="progressbar"], div[aria-label="Loading..."]');
        return { scrollHeight, isLoadingSpinner };
      }, [stableRounds >= 2]);
    } catch (err) {
      if (isTabInvalidError(err)) {
        logTabOp('scrollUntilEnoughReels:tab_invalid', normalizedUser, igTabId, null, err.message);
        throw new Error(`TAB_CLOSED_OR_INVALID: Instagram tab (${igTabId}) was closed or disconnected during scrolling: ${err.message}`);
      }
    }

    scrollRounds++;

    // If Instagram is actively displaying a loading spinner, give it extra time to complete network fetch
    const waitTime = scrollDiag?.isLoadingSpinner ? 3500 : 2500;
    await new Promise(r => setTimeout(r, waitTime));
  }

  return allDiscovered;
}

function categorize(views) {
  const validViews = Array.isArray(views)
    ? views.filter(v => typeof v === 'number' && Number.isFinite(v) && v >= 0)
    : [];

  if (validViews.length < 7) {
    return "NotEnoughReels";
  }

  const counts = {
    C1L1: validViews.filter(v => v >= 1000000).length,
    C1L2: validViews.filter(v => v >= 500000).length,
    C2L1: validViews.filter(v => v >= 250000).length,
    C2L2: validViews.filter(v => v >= 100000).length,
    C3L1: validViews.filter(v => v >= 50000).length,
    C3L2: validViews.filter(v => v >= 25000).length,
    C4L1: validViews.filter(v => v >= 10000).length
  };
  const below_10k_count = validViews.filter(v => v < 10000).length;

  if (counts.C1L1 >= 7) {
    return "C1L1";
  } else if (counts.C1L2 >= 7) {
    return "C1L2";
  } else if (counts.C2L1 >= 7) {
    return "C2L1";
  } else if (counts.C2L2 >= 7) {
    return "C2L2";
  } else if (counts.C3L1 >= 7) {
    return "C3L1";
  } else if (counts.C3L2 >= 7) {
    return "C3L2";
  } else if (counts.C4L1 >= 7) {
    return "C4L1";
  } else if (below_10k_count >= 7) {
    return "C4L2";
  } else {
    return "Uncategorized";
  }
}

function processDiscoveredReels(discoveredArray, sender, payload) {
  // Exclude pinned
  const nonPinned = discoveredArray.filter(r => !r.isPinned);
  const pinnedCount = discoveredArray.length - nonPinned.length;

  sendEventToSender(sender, 'PINNED_REELS_FILTERED', { ...payload, excluded: pinnedCount });

  // Non-pinned reels with valid view counts
  const validWithViews = nonPinned.filter(r => typeof r.viewCount === 'number' && r.viewCount >= 0);

  // Select up to 15 valid non-pinned reels preserving order
  let selected;
  if (validWithViews.length >= 15) {
    selected = validWithViews.slice(0, 15);
  } else {
    // If fewer than 15 valid with views, include all valid ones, then remaining non-pinned reels
    const validUrlSet = new Set(validWithViews.map(r => r.url));
    const missingViews = nonPinned.filter(r => !validUrlSet.has(r.url));
    selected = [...validWithViews, ...missingViews].slice(0, 15);
  }

  const selectedReels = selected.map((r, i) => ({
    reelUrl: r.url,
    isPinned: false,
    discoveryIndex: i + 1,
    viewCount: typeof r.viewCount === 'number' ? r.viewCount : null,
    rawViewText: r.rawViewText || null,
    viewIconLocation: r.viewIconLocation || null,
    missingDiag: r.missingDiag || null
  }));

  const validCounts = selectedReels
    .map(r => r.viewCount)
    .filter(v => typeof v === 'number' && v >= 0);

  const failedAnchors = selectedReels.filter(r => typeof r.viewCount !== 'number');
  if (validCounts.length < 15) {
    console.log(`[processDiscoveredReels] Partial sample for @${payload?.username || 'unknown'}:`, {
      reelsDiscovered: discoveredArray.length,
      pinnedExcluded: pinnedCount,
      nonPinnedDiscovered: nonPinned.length,
      selectedReelCount: selectedReels.length,
      validViewCountsCount: validCounts.length,
      failedExtractionAnchorsCount: failedAnchors.length,
      failedAnchors: failedAnchors.map(f => ({
        reelUrl: f.reelUrl,
        viewIconLocation: f.viewIconLocation,
        missingDiag: f.missingDiag
      }))
    });
  }

  const totalViews = validCounts.reduce((sum, v) => sum + v, 0);
  const averageViews = validCounts.length > 0 ? Math.round(totalViews / validCounts.length) : 0;
  const category = categorize(validCounts);

  sendEventToSender(sender, 'REELS_SELECTION_COMPLETE', {
    ...payload,
    selected: selectedReels.length,
    validViewCounts: validCounts.length,
    averageViews,
    category
  });

  return {
    reelsDiscovered: discoveredArray.length,
    pinnedReelsExcluded: pinnedCount,
    selectedReelCount: selectedReels.length,
    selectedReels,
    validViewCountsCount: validCounts.length,
    averageViews,
    rawViewCounts: validCounts,
    category,
    creatorCategory: category,
    missingViewCountsCount: Math.max(0, 15 - validCounts.length),
    failedExtractionAnchorsCount: failedAnchors.length
  };
}

async function waitForReelsPage(igTabId, normalizedUser, timeoutMs = 15000) {
  const targetReelsUrl = `https://www.instagram.com/${normalizedUser}/reels/`;
  logTabOp('waitForReelsPage:start', normalizedUser, igTabId, targetReelsUrl);

  // Bounded polling for Reel anchors to ensure the grid has rendered
  let elapsed = 0;
  const interval = 500;
  let lastSnapshot = null;
  let routeToggleTriggered = false;

  while (elapsed < timeoutMs) {
    await new Promise(r => setTimeout(r, interval));
    elapsed += interval;

    try {
      const pageInfo = await injectScript(igTabId, (targetUser) => {
        const url = window.location.href;
        const urlLower = url.toLowerCase();
        const userLower = targetUser.toLowerCase();

        // STRICT: URL must actually be on the target user's reels page
        const isReels = urlLower.includes(`/${userLower}/reels`);
        const ready = document.readyState === 'complete' || document.readyState === 'interactive';
        const allDocAnchors = Array.from(document.querySelectorAll('a[href]'));
        const reelAnchors = allDocAnchors.filter(a => {
          const href = (a.getAttribute('href') || a.href || '').toLowerCase();
          if (href.includes('/reel/')) return true;
          if (href.includes('/reels/')) {
            if (href === '/reels/' || href === '/reels' || href.startsWith('/reels?')) return false;
            if (href === `/${userLower}/reels/` || href === `/${userLower}/reels`) return false;
            if (/\/reels\/[A-Za-z0-9_-]+\/?/.test(href)) return true;
          }
          return false;
        });
        const reelCount = reelAnchors.length;
        const postCount = document.querySelectorAll('a[href*="/p/"]').length;
        const mediaCount = document.querySelectorAll('img, video').length;
        const gridElementCount = document.querySelectorAll('article, main, div[role="main"]').length;

        const mainEl = document.querySelector('main');
        const mainText = (mainEl ? mainEl.innerText : (document.body ? document.body.innerText : '') || '').toLowerCase();
        const text = document.body ? document.body.innerText.toLowerCase() : '';
        const hasProfileHeader = !!document.querySelector('header a[href*="/followers/"], main div[role="tablist"]');
        const isUnavailable =
          isReels &&
          ready &&
          reelCount === 0 &&
          !hasProfileHeader &&
          (mainText.includes("sorry, this page isn't available") ||
           mainText.includes("profile isn't available") ||
           mainText.includes("the link you followed may be broken") ||
           mainText.includes("page not found"));
        const isPrivate = isReels && mainText.includes("this account is private");
        const isLoginWall = text.includes("log in to instagram") || text.includes("sign up to see photos") ||
                            !!document.querySelector('input[name="username"], input[name="password"]');
        const tablist = document.querySelector('main div[role="tablist"], div[role="tablist"]');
        const hasTablist = !!tablist;
        const hasReelsTab = hasTablist && !!(
          tablist.querySelector('a[href*="/reels/"]') ||
          tablist.querySelector('a[role="tab"][href*="/reels/"]') ||
          Array.from(tablist.querySelectorAll('a[href]')).some(a => {
            const h = (a.getAttribute('href') || '').toLowerCase();
            return h.includes(`/${userLower}/reels`) || (h.endsWith('/reels/') && h !== '/reels/');
          })
        );
        const hasNoReelsMessage = (isReels || (hasTablist && !hasReelsTab)) && (
          mainText.includes("no reels yet") ||
          mainText.includes("no reels available") ||
          mainText.includes("when you share reels") ||
          mainText.includes("no reels") ||
          mainText.includes("no videos yet")
        );
        const isLoadingSpinner = !!document.querySelector('svg[aria-label="Loading..."], div[role="progressbar"], div[aria-label="Loading..."]');
        const noReelsConfirmed = (hasTablist && !hasReelsTab && ready) || (hasNoReelsMessage && !isLoadingSpinner);

        return {
          url,
          isReels,
          ready,
          reelCount,
          postCount,
          mediaCount,
          gridElementCount,
          isUnavailable,
          isPrivate,
          isLoginWall,
          hasNoReelsMessage,
          noReelsConfirmed,
          isLoadingSpinner
        };
      }, [normalizedUser]);

      lastSnapshot = pageInfo;

      if (pageInfo?.isUnavailable) {
        throw new Error(`Instagram profile @${normalizedUser} was not found or is unavailable.`);
      }

      if (pageInfo?.isPrivate) {
        throw new Error(`Instagram profile @${normalizedUser} is private.`);
      }

      if (pageInfo?.isLoginWall) {
        throw new Error(`Instagram session login required. Encountered login wall for @${normalizedUser}.`);
      }

      // ONLY return success if page is ACTUALLY on target user's reels page!
      if (pageInfo && pageInfo.ready) {
        if (pageInfo.reelCount > 0) {
          console.log(`[waitForReelsPage] Reels grid rendered for @${normalizedUser} with ${pageInfo.reelCount} reel anchors after ${elapsed}ms.`);
          return { ...pageInfo, elapsed, timedOut: false };
        }

        if (pageInfo.noReelsConfirmed && elapsed >= 2500 && !pageInfo.isLoadingSpinner) {
          console.log(`[waitForReelsPage] Profile @${normalizedUser} explicitly has no reels.`);
          return { ...pageInfo, elapsed, timedOut: false, noReelsConfirmed: true };
        }
      }

      // SAFE IN-PAGE ACTIVATION:
      // In Instagram SPA, activate the Reels tab if rendered.
      // Even if aria-selected is true, clicking the Reels tab re-triggers React's virtual grid mount.
      if (elapsed >= 1500 && pageInfo && pageInfo.reelCount === 0 && !pageInfo.noReelsConfirmed) {
        try {
          await injectScript(igTabId, (targetUser) => {
            const userLower = targetUser.toLowerCase();
            const tablist = document.querySelector('main div[role="tablist"], div[role="tablist"]');
            const profileReelsTab =
              (tablist && (tablist.querySelector('a[href*="/reels/"]') || tablist.querySelector('a[role="tab"][href*="/reels/"]'))) ||
              Array.from(document.querySelectorAll('main a[href*="/reels/"]')).find(a => {
                const href = (a.getAttribute('href') || '').toLowerCase();
                return (href.includes(`/${userLower}/reels`) || href.endsWith('/reels/')) &&
                       !href.endsWith('.com/reels/') && href !== '/reels/' && href !== '/reels' && !href.startsWith('/reels?');
              }) ||
              Array.from(document.querySelectorAll('a[href*="/reels/"]')).find(a => {
                const href = (a.getAttribute('href') || '').toLowerCase();
                return (href.includes(`/${userLower}/reels`) || href.endsWith('/reels/')) &&
                       !href.endsWith('.com/reels/') && href !== '/reels/' && href !== '/reels' && !href.startsWith('/reels?');
              });

            if (profileReelsTab) {
              profileReelsTab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
              profileReelsTab.click();
            }
            window.dispatchEvent(new Event('resize'));
            window.dispatchEvent(new Event('scroll'));
          }, [normalizedUser]);
        } catch (e) {
          if (isTabInvalidError(e)) {
            throw e;
          }
        }
      }

      // Trigger gentle scroll after 2500ms to awaken virtualized grid/intersection observers
      if (elapsed >= 2500 && elapsed % 2000 === 0 && pageInfo && pageInfo.reelCount === 0) {
        try {
          await injectScript(igTabId, () => {
            window.scrollBy(0, 300);
            window.dispatchEvent(new Event('scroll', { bubbles: true }));
          });
        } catch (e) {
          if (isTabInvalidError(e)) {
            throw e;
          }
        }
      }

    } catch (err) {
      if (isTabInvalidError(err)) {
        logTabOp('waitForReelsPage:tab_invalid', normalizedUser, igTabId, targetReelsUrl, err.message);
        throw new Error(`TAB_CLOSED_OR_INVALID: Instagram tab (${igTabId}) was closed or disconnected while waiting for Reels page: ${err.message}`);
      }
      if (err.message && (
        err.message.includes("Instagram profile") ||
        err.message.includes("Instagram session") ||
        err.message.includes("private")
      )) {
        throw err;
      }
      // Tab may be reloading or transitioning, continue polling
    }
  }

  // Bounded wait expired
  console.warn(`[waitForReelsPage] Bounded wait (${timeoutMs}ms) expired for @${normalizedUser}. Last snapshot:`, lastSnapshot);
  return {
    url: lastSnapshot?.url || targetReelsUrl,
    readyState: lastSnapshot?.ready ? 'complete' : 'timeout',
    reelCount: lastSnapshot?.reelCount || 0,
    postCount: lastSnapshot?.postCount || 0,
    mediaCount: lastSnapshot?.mediaCount || 0,
    gridElementCount: lastSnapshot?.gridElementCount || 0,
    elapsed,
    timedOut: true
  };
}

async function executeProfileResearchOnTab(payload, sender, normalizedUser, startTs, forceNewTab = false) {
  const { jobId, influencerCode, username } = payload;
  const targetReelsUrl = `https://www.instagram.com/${normalizedUser}/reels/`;

  // 1. Acquire a verified, live Instagram tab (or create one if none exists)
  const selectedTab = await acquireOrCreateInstagramTab(normalizedUser, 'startProfileResearch', forceNewTab);
  let igTabId = selectedTab.id;

  // 2. Navigate to target reels URL and update igTabId from Chrome's callback
  sendEventToSender(sender, 'PROFILE_VERIFYING', payload);
  let currentUrl = '';
  try {
    logTabOp('startProfileResearch:check_current_url', normalizedUser, igTabId, selectedTab.url);
    currentUrl = await injectScript(igTabId, () => window.location.href);
  } catch (e) {
    if (isTabInvalidError(e)) {
      const recoveredTab = await acquireOrCreateInstagramTab(normalizedUser, 'startProfileResearch:url_check_recover', true);
      igTabId = recoveredTab.id;
      currentUrl = recoveredTab.url || '';
    } else {
      currentUrl = selectedTab.url || '';
    }
  }

  const alreadyOnReels = (currentUrl || '').toLowerCase().includes(`/${normalizedUser.toLowerCase()}/reels`);
  if (!alreadyOnReels) {
    igTabId = await updateInstagramTabUrl(igTabId, targetReelsUrl, normalizedUser, 'startProfileResearch:initial_nav');
    // Give browser 1200ms to begin loading the new profile and unmount stale DOM
    await new Promise(r => setTimeout(r, 1200));
  } else {
    // If already on Reels route, scroll to top so profile header and stats are mounted in the DOM
    try {
      await injectScript(igTabId, () => {
        window.scrollTo({ top: 0, behavior: 'instant' });
      });
      await new Promise(r => setTimeout(r, 400));
    } catch (e) {}
  }

  // 3. Verify profile and extract followers directly on the reels page
  let followerDisplay = null;
  let followerExtractionDiag = null;
  try {
    followerDisplay = await verifyProfile(igTabId, normalizedUser);
  } catch (verifyErr) {
    if (isTabInvalidError(verifyErr)) {
      throw verifyErr;
    }
    console.warn(`[startProfileResearch] verifyProfile had issue for @${normalizedUser}:`, verifyErr.message);
    if (verifyErr.message.includes("could not be verified") || verifyErr.message.includes("private")) {
      throw verifyErr;
    }
    followerExtractionDiag = {
      attempted: true,
      error: verifyErr.message
    };
  }

  // Safe bounded retry for follower extraction when page was already open/scrolled
  if (!followerDisplay) {
    try {
      await injectScript(igTabId, () => {
        window.scrollTo({ top: 0, behavior: 'instant' });
      });
      await new Promise(r => setTimeout(r, 800));
      followerDisplay = await verifyProfile(igTabId, normalizedUser, 4000);
      if (followerDisplay) {
        logTabOp('verifyProfile:retry_success', normalizedUser, igTabId, null, `Extracted followers on retry: ${followerDisplay}`);
      }
    } catch (retryErr) {
      if (isTabInvalidError(retryErr)) throw retryErr;
      followerExtractionDiag = {
        attempted: true,
        error: retryErr.message
      };
    }
  }

  sendEventToSender(sender, 'PROFILE_DATA_FOUND', payload);

  // 4. Milestone 2: Reel Discovery with bounded wait
  sendEventToSender(sender, 'REELS_PAGE_OPENING', payload);
  let pageState = await waitForReelsPage(igTabId, normalizedUser, 15000);

  // Exact moment extraction begins: log and verify DOM evidence
  let extractionMoment = {
    actualUrl: pageState.url,
    finalUrl: pageState.url,
    normalizedUser,
    navigationSuccess: (!pageState.timedOut || pageState.reelCount > 0) && pageState.url.toLowerCase().includes(`/${normalizedUser.toLowerCase()}/reels`),
    pageReadiness: pageState.ready ? 'complete' : (pageState.readyState || 'unknown'),
    reelAnchorsCount: pageState.reelCount || 0,
    postAnchorsCount: pageState.postCount || 0,
    mediaCount: pageState.mediaCount || 0,
    gridElementCount: pageState.gridElementCount || 0,
    timedOut: !!pageState.timedOut,
    elapsedMs: pageState.elapsed || 0
  };

  console.log(`[startProfileResearch] Extraction starting for @${normalizedUser} on tab ${igTabId}:`, extractionMoment);

  sendEventToSender(sender, 'REELS_LOADING', {
    ...payload,
    extractionMoment
  });

  let discovered = await scrollUntilEnoughReels(igTabId, sender, payload);
  let reelResults = processDiscoveredReels(discovered, sender, payload);

  // 5. Retry once ONLY if 0 reels were discovered and page was not confirmed empty
  if (reelResults.selectedReelCount === 0 && !pageState.noReelsConfirmed) {
    console.warn(`[startProfileResearch] 0 reels found on first pass for @${normalizedUser}. Retrying via profile root -> Reels tab hydration...`);
    sendEventToSender(sender, 'RESEARCH_RETRYING', payload);

    // Navigate to profile root first so Instagram hydrates PolarisProfilePageContentQuery cleanly,
    // then transition to /reels/ to guarantee the Reels grid mounts even in a background tab
    const profileRootUrl = `https://www.instagram.com/${normalizedUser}/`;
    igTabId = await updateInstagramTabUrl(igTabId, profileRootUrl, normalizedUser, 'startProfileResearch:retry_profile_root');
    await new Promise(r => setTimeout(r, 2000));

    // Try in-page SPA transition by clicking the profile's Reels tab
    let tabClicked = false;
    try {
      tabClicked = await injectScript(igTabId, (u) => {
        const userLower = u.toLowerCase();
        const tablist = document.querySelector('main div[role="tablist"], div[role="tablist"]');
        const reelsTab =
          (tablist && (tablist.querySelector('a[href*="/reels/"]') || tablist.querySelector('a[role="tab"][href*="/reels/"]'))) ||
          Array.from(document.querySelectorAll('main a[href*="/reels/"]')).find(a => {
            const h = (a.getAttribute('href') || '').toLowerCase();
            return (h.includes(`/${userLower}/reels`) || h.endsWith('/reels/')) &&
                   !h.endsWith('.com/reels/') && h !== '/reels/' && h !== '/reels' && !h.startsWith('/reels?');
          });
        if (reelsTab) {
          reelsTab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          reelsTab.click();
          window.dispatchEvent(new Event('resize'));
          window.dispatchEvent(new Event('scroll'));
          return true;
        }
        return false;
      }, [normalizedUser]);
    } catch (e) {}

    if (!tabClicked) {
      igTabId = await updateInstagramTabUrl(igTabId, targetReelsUrl, normalizedUser, 'startProfileResearch:retry_reels_nav');
      await new Promise(r => setTimeout(r, 1200));
    } else {
      await new Promise(r => setTimeout(r, 1500));
    }

    pageState = await waitForReelsPage(igTabId, normalizedUser, 15000);
    extractionMoment = {
      actualUrl: pageState.url,
      finalUrl: pageState.url,
      normalizedUser,
      navigationSuccess: (!pageState.timedOut || pageState.reelCount > 0) && pageState.url.toLowerCase().includes(`/${normalizedUser.toLowerCase()}/reels`),
      pageReadiness: pageState.ready ? 'complete' : (pageState.readyState || 'unknown'),
      reelAnchorsCount: pageState.reelCount || 0,
      postAnchorsCount: pageState.postCount || 0,
      mediaCount: pageState.mediaCount || 0,
      gridElementCount: pageState.gridElementCount || 0,
      timedOut: !!pageState.timedOut,
      elapsedMs: pageState.elapsed || 0
    };

    const retryDiscovered = await scrollUntilEnoughReels(igTabId, sender, payload);
    const retryResults = processDiscoveredReels(retryDiscovered, sender, payload);

    if (retryResults.selectedReelCount > reelResults.selectedReelCount || retryResults.reelsDiscovered > reelResults.reelsDiscovered) {
      reelResults = retryResults;
    }
  }

  // Stage determination and failure classification
  let finalStatus = 'completed';
  let failureStage = null;
  let failureReason = null;

  if (reelResults.selectedReelCount === 0) {
    finalStatus = 'reels_not_found';
    if (pageState.noReelsConfirmed) {
      failureStage = 'no_reels';
      failureReason = `Profile @${normalizedUser} has no reels posted.`;
    } else if (reelResults.reelsDiscovered === 0) {
      failureStage = 'zero_reels';
      failureReason = `Zero Reel anchors (a[href*="/reel/"]) were discovered on ${targetReelsUrl}. (Page readiness: ${extractionMoment.pageReadiness}, Posts: ${extractionMoment.postAnchorsCount}, Media: ${extractionMoment.mediaCount}, Grid elements: ${extractionMoment.gridElementCount}, Wait: ${extractionMoment.elapsedMs}ms)`;
    } else {
      failureStage = 'all_pinned';
      failureReason = `Discovered ${reelResults.reelsDiscovered} reels, but all ${reelResults.pinnedReelsExcluded} were pinned posts.`;
    }
  } else if (reelResults.validViewCountsCount < 15) {
    finalStatus = 'partial';
    const failedAnchors = (reelResults.selectedReels || []).filter(r => typeof r.viewCount !== 'number');
    if (failedAnchors.length > 0) {
      failureStage = 'partial_view_extraction';
      const failedDetails = failedAnchors
        .map(f => `${f.reelUrl} (${f.viewIconLocation || 'no_icon'}${f.missingDiag?.anchorText ? `: "${f.missingDiag.anchorText}"` : ''})`)
        .join(', ');
      failureReason = `Collected ${reelResults.validViewCountsCount}/15 valid view counts from ${reelResults.selectedReelCount} non-pinned Reels (${reelResults.pinnedReelsExcluded} pinned excluded). ${failedAnchors.length} discovered Reel anchor(s) failed view-count extraction: ${failedDetails}.`;
    } else {
      failureStage = 'partial_reel_discovery';
      failureReason = `Collected ${reelResults.validViewCountsCount}/15 valid view counts: all ${reelResults.selectedReelCount} discovered non-pinned Reels had valid view counts (${reelResults.pinnedReelsExcluded} pinned excluded; 0 failed view-count extraction; only ${reelResults.selectedReelCount} non-pinned Reels were available on the profile).`;
    }
  }

  return {
    jobId,
    influencerCode,
    requestedUsername: username,
    verifiedUsername: normalizedUser,
    finalUrl: extractionMoment.actualUrl,
    navigationSuccess: extractionMoment.navigationSuccess,
    pageReadiness: extractionMoment.pageReadiness,
    reelAnchorsAtStart: extractionMoment.reelAnchorsCount,
    followerDisplay: followerDisplay || null,
    followerCount: followerDisplay ? parseViews(followerDisplay) : 0,
    followerExtractionDiag: followerExtractionDiag || undefined,
    ...reelResults,
    status: finalStatus,
    failureStage,
    failureReason,
    error: failureReason || undefined,
    extractionMoment,
    startedAt: startTs,
    completedAt: Date.now()
  };
}

async function startProfileResearch(payload, sender) {
  const { jobId, influencerCode, username } = payload || {};
  const normalizedUser = normalizeUsername(username);
  const startTs = Date.now();
  const targetReelsUrl = normalizedUser ? `https://www.instagram.com/${normalizedUser}/reels/` : '';

  if (!normalizedUser) throw new Error('Invalid or missing username');

  sendEventToSender(sender, 'PROFILE_OPENING', payload);

  try {
    return await executeProfileResearchOnTab(payload, sender, normalizedUser, startTs, false);
  } catch (err) {
    if (isTabInvalidError(err)) {
      logTabOp('startProfileResearch:tab_recovery_retry', normalizedUser, lastUsedIgTabId, null, `Recovering from invalid tab error: ${err.message}`);
      lastUsedIgTabId = null;
      sendEventToSender(sender, 'RESEARCH_RETRYING', payload);
      return await executeProfileResearchOnTab(payload, sender, normalizedUser, startTs, true);
    }

    // If navigation was rejected even after updateInstagramTabUrl's 1 safe retry,
    // return a structured failed ProfileResearchResult with full diagnostics so the batch continues cleanly
    // without misclassifying the username as invalid.
    const isNavErr = !!(err && (err.isNavigationError || String(err.message || '').toLowerCase().includes('navigation rejected')));
    if (isNavErr) {
      const diag = err.navigationDiag || {
        stage: 'navigation_rejected',
        requestedUrl: targetReelsUrl,
        tabId: lastUsedIgTabId,
        currentTabUrl: 'unknown',
        originalChromeError: err.message || 'Navigation rejected.'
      };
      const detailedReason =
        `Navigation failed after 1 safe retry at stage "${diag.stage}". ` +
        `Requested URL: ${diag.requestedUrl} | Current Tab ID: ${diag.tabId ?? 'none'} | ` +
        `Current Tab URL: ${diag.currentTabUrl || 'unknown'} | Original Chrome Error: ${diag.originalChromeError}`;
      console.error(`[startProfileResearch] ${detailedReason}`);

      return {
        jobId,
        influencerCode,
        requestedUsername: username,
        verifiedUsername: normalizedUser,
        finalUrl: diag.currentTabUrl && diag.currentTabUrl !== 'unknown' ? diag.currentTabUrl : targetReelsUrl,
        navigationSuccess: false,
        pageReadiness: 'navigation_rejected',
        reelAnchorsAtStart: 0,
        followerDisplay: null,
        followerCount: 0,
        reelsDiscovered: 0,
        pinnedReelsExcluded: 0,
        selectedReelCount: 0,
        selectedReels: [],
        validViewCountsCount: 0,
        averageViews: 0,
        rawViewCounts: [],
        missingViewCountsCount: 15,
        status: 'failed',
        failureStage: diag.stage || 'navigation_rejected',
        failureReason: detailedReason,
        error: detailedReason,
        startedAt: startTs,
        completedAt: Date.now()
      };
    }

    throw err;
  }
}

function parseViews(text) {
  if (!text) return 0;
  text = String(text).toLowerCase().replace(/,/g, '').trim();
  if (text.includes('b')) return parseInt(parseFloat(text.replace('b', '')) * 1000000000);
  if (text.includes('m')) return parseInt(parseFloat(text.replace('m', '')) * 1000000);
  if (text.includes('k')) return parseInt(parseFloat(text.replace('k', '')) * 1000);
  const val = parseInt(text);
  return isNaN(val) ? 0 : val;
}

async function runReelDiagnostic(payload, sender) {
  const { username } = payload || {};
  const normalizedUser = normalizeUsername(username);

  if (!normalizedUser) {
    return {
      success: false,
      stage: 'communication_failure',
      message: 'Invalid or missing Instagram username for diagnostic.',
      error: 'MISSING_USERNAME'
    };
  }

  // 1. Acquire or create a verified Instagram Tab
  let selectedTab;
  try {
    selectedTab = await acquireOrCreateInstagramTab(normalizedUser, 'runReelDiagnostic');
  } catch (err) {
    return {
      success: false,
      stage: 'communication_failure',
      message: err.message || 'No open Instagram tab found. Please open an Instagram tab first.',
      error: 'TAB_NOT_FOUND'
    };
  }
  let igTabId = selectedTab.id;

  // 2. Minimal diagnostic handshake (PING -> PONG) via script injection
  let pingResult;
  try {
    pingResult = await injectScript(igTabId, () => {
      return {
        pong: true,
        url: window.location.href,
        readyState: document.readyState,
        title: document.title
      };
    });
  } catch (err) {
    return {
      success: false,
      stage: 'communication_failure',
      tabId: igTabId,
      message: `Failed to communicate with Instagram tab (${igTabId}): ${err.message}`,
      error: err.message
    };
  }

  if (!pingResult || !pingResult.pong) {
    return {
      success: false,
      stage: 'communication_failure',
      tabId: igTabId,
      message: `Instagram tab (${igTabId}) did not respond with PONG.`,
      error: 'NO_PONG_RECEIVED'
    };
  }

  // 3. Navigation Completion Verification
  const targetReelsUrl = `https://www.instagram.com/${normalizedUser}/reels/`;
  const isAlreadyOnPage = (pingResult.url || '').startsWith(targetReelsUrl);

  if (!isAlreadyOnPage) {
    try {
      igTabId = await updateInstagramTabUrl(igTabId, targetReelsUrl, normalizedUser, 'runReelDiagnostic:nav');
    } catch (err) {
      return {
        success: false,
        stage: 'navigation_failure',
        tabId: igTabId,
        targetUrl: targetReelsUrl,
        actualUrl: pingResult.url,
        readyState: pingResult.readyState,
        message: `Failed to trigger navigation to ${targetReelsUrl}: ${err.message}`,
        error: err.message
      };
    }
  }

  // Poll for navigation completion: document.readyState, URL match, and body content
  let navSuccess = false;
  let navState = null;
  const maxWaitMs = 15000;
  const intervalMs = 600;
  let elapsed = 0;

  while (elapsed < maxWaitMs) {
    await new Promise(r => setTimeout(r, intervalMs));
    elapsed += intervalMs;

    try {
      navState = await injectScript(igTabId, () => {
        const url = window.location.href;
        const urlLower = url.toLowerCase();
        const isTargetUrl = urlLower.includes(`/${normalizedUser.toLowerCase()}`);
        const mainEl = document.querySelector('main');
        const mainText = (mainEl ? mainEl.innerText : (document.body ? document.body.innerText : '') || '').toLowerCase();
        const hasProfileHeader = !!document.querySelector('header a[href*="/followers/"], main div[role="tablist"]');
        const isUnavailable =
          isTargetUrl &&
          !hasProfileHeader &&
          (mainText.includes("sorry, this page isn't available") ||
           mainText.includes("profile isn't available") ||
           mainText.includes("the link you followed may be broken") ||
           mainText.includes("page not found"));
        const isLoginWall = !!document.querySelector('input[name="username"], input[name="password"]');

        return {
          url,
          readyState: document.readyState,
          title: document.title,
          isUnavailable,
          isLoginWall,
          hasBody: !!document.body && document.body.innerHTML.length > 200
        };
      }, [normalizedUser]);

      if (navState) {
        if (navState.isUnavailable || navState.isLoginWall) {
          break; // Terminal condition
        }
        if (
          (navState.readyState === 'complete' || navState.readyState === 'interactive') &&
          navState.url.toLowerCase().includes(normalizedUser.toLowerCase()) &&
          navState.hasBody
        ) {
          navSuccess = true;
          break;
        }
      }
    } catch (err) {
      // Tab may be reloading, continue waiting
    }
  }

  if (!navSuccess) {
    const errorReason = navState?.isUnavailable
      ? `Instagram profile @${normalizedUser} was not found (404/Unavailable).`
      : navState?.isLoginWall
        ? `Instagram redirected to login wall. Session login required.`
        : `Navigation timeout after 15s waiting for ${targetReelsUrl} to load.`;

    return {
      success: false,
      stage: 'navigation_failure',
      tabId: igTabId,
      targetUrl: targetReelsUrl,
      actualUrl: navState?.url || pingResult.url,
      readyState: navState?.readyState || 'unknown',
      requestedUsername: normalizedUser,
      message: errorReason,
      error: navState?.isUnavailable ? 'PAGE_NOT_FOUND' : navState?.isLoginWall ? 'LOGIN_WALL' : 'NAVIGATION_TIMEOUT'
    };
  }

  // 4. Passive DOM Snapshot using selector: a[href*="/reel/"]
  async function takeSnapshot() {
    return await injectScript(igTabId, (targetUser) => {
      function parseView(rawText) {
        if (!rawText || typeof rawText !== 'string') return null;
        const cleaned = rawText.trim().replace(/\s+/g, ' ');
        if (!cleaned) return null;
        const match = cleaned.match(/^([\d,.]+)\s*([kmbKMB])?(?:\s*(?:views?|plays?))?$/i);
        if (!match) return null;
        const numPart = match[1];
        const suffix = match[2] ? match[2].toLowerCase() : null;
        const normalizedNumStr = numPart.replace(/,/g, '');
        if ((normalizedNumStr.match(/\./g) || []).length > 1) return null;
        const base = parseFloat(normalizedNumStr);
        if (isNaN(base) || base < 0) return null;
        if (suffix === 'k') return Math.round(base * 1000);
        if (suffix === 'm') return Math.round(base * 1000000);
        if (suffix === 'b') return Math.round(base * 1000000000);
        if (!suffix) return Math.round(base);
        return null;
      }

      function extractView(a) {
        let pinnedSvg = a.querySelector('svg[aria-label="Pinned post icon"], svg[aria-label*="Pinned" i]');
        if (!pinnedSvg && a.parentElement && a.parentElement.querySelectorAll('a[href*="/reel/"]').length === 1) {
          pinnedSvg = a.parentElement.querySelector('svg[aria-label="Pinned post icon"], svg[aria-label*="Pinned" i]');
        }
        const isPinned = !!pinnedSvg;
        if (isPinned) {
          return { rawText: null, count: null, location: 'pinned_skipped', isPinned: true, viewIconFound: false };
        }

        const viewIcon = a.querySelector('svg[aria-label="View count icon"], svg[aria-label*="View count" i], svg[aria-label*="view count" i]');
        if (viewIcon) {
          // 1. Immediate siblings of icon
          if (viewIcon.nextElementSibling) {
            const text = (viewIcon.nextElementSibling.innerText || viewIcon.nextElementSibling.textContent || '').trim();
            const count = parseView(text);
            if (count !== null) return { rawText: text, count, location: 'icon_next_sibling', isPinned: false, viewIconFound: true };
          }
          if (viewIcon.previousElementSibling) {
            const text = (viewIcon.previousElementSibling.innerText || viewIcon.previousElementSibling.textContent || '').trim();
            const count = parseView(text);
            if (count !== null) return { rawText: text, count, location: 'icon_prev_sibling', isPinned: false, viewIconFound: true };
          }

          // 2. Icon's direct parent element
          const parent = viewIcon.parentElement;
          if (parent) {
            const directChildren = Array.from(parent.querySelectorAll('span, div')).filter(el => el !== viewIcon && !viewIcon.contains(el));
            for (const child of directChildren) {
              const text = (child.innerText || child.textContent || '').trim();
              const count = parseView(text);
              if (count !== null) return { rawText: text, count, location: 'parent_child', isPinned: false, viewIconFound: true };
            }
            const parentText = (parent.innerText || parent.textContent || '').trim();
            const count = parseView(parentText);
            if (count !== null) return { rawText: parentText, count, location: 'parent_text', isPinned: false, viewIconFound: true };

            if (parent.nextElementSibling) {
              const text = (parent.nextElementSibling.innerText || parent.nextElementSibling.textContent || '').trim();
              const count = parseView(text);
              if (count !== null) return { rawText: text, count, location: 'parent_next_sibling', isPinned: false, viewIconFound: true };
            }
          }

          // 3. Ancestor container inside anchor
          let curr = parent ? parent.parentElement : null;
          while (curr && curr !== a && curr !== document.body) {
            const candidateNodes = Array.from(curr.querySelectorAll('span, div')).filter(el => !viewIcon.contains(el));
            for (const node of candidateNodes) {
              const parentWithSvg = node.parentElement;
              if (parentWithSvg && parentWithSvg.querySelector('svg[aria-label*="Like" i], svg[aria-label*="Comment" i]')) {
                continue;
              }
              const text = (node.innerText || node.textContent || '').trim();
              const count = parseView(text);
              if (count !== null) return { rawText: text, count, location: 'wrapper_span', isPinned: false, viewIconFound: true };
            }
            curr = curr.parentElement;
          }
          // If viewIcon was present but Steps 1-3 did not match, fall through to Step 4 leaf/regex fallback
        }

        const hasViewIcon = !!viewIcon;

        // 4. Evidence-based fallback when View count SVG aria-label is absent or text is in a separate leaf:
        // Collect all leaf spans/divs inside the anchor, excluding hover-overlay icons (Like/Comment)
        const leafCandidates = [];
        const innerSpans = Array.from(a.querySelectorAll('span, div'));
        for (const span of innerSpans) {
          if (span.querySelector('span, div')) continue;
          const parentWithSvg = span.parentElement;
          if (parentWithSvg && parentWithSvg.querySelector('svg[aria-label*="Like" i], svg[aria-label*="Comment" i]')) {
            continue;
          }
          const text = (span.innerText || span.textContent || '').trim();
          const count = parseView(text);
          if (count !== null) {
            leafCandidates.push({ rawText: text, count });
          }
        }

        if (leafCandidates.length > 0) {
          // In Instagram's Reels grid DOM, the hover overlay (Likes, Comments) precedes the persistent bottom-left View Count footer.
          // Selecting the last leaf candidate pairs the Reel with its actual view count.
          const lastCandidate = leafCandidates[leafCandidates.length - 1];
          return {
            rawText: lastCandidate.rawText,
            count: lastCandidate.count,
            location: leafCandidates.length > 1 ? `anchor_last_leaf_of_${leafCandidates.length}` : 'anchor_child_span',
            isPinned: false,
            viewIconFound: hasViewIcon
          };
        }

        const anchorDirectText = (a.innerText || a.textContent || '').trim();
        const directCount = parseView(anchorDirectText);
        if (directCount !== null) {
          return { rawText: anchorDirectText, count: directCount, location: 'anchor_direct_text', isPinned: false, viewIconFound: hasViewIcon };
        }

        const allMatches = Array.from(anchorDirectText.matchAll(/\b(\d[\d,.]*\s*[kmbKMB]?(?:\s*(?:views?|plays?))?)\b/gi));
        for (let i = allMatches.length - 1; i >= 0; i--) {
          const candidateStr = allMatches[i][1].trim();
          const count = parseView(candidateStr);
          if (count !== null) {
            return { rawText: candidateStr, count, location: 'anchor_candidate_regex', isPinned: false, viewIconFound: hasViewIcon };
          }
        }

        return { rawText: null, count: null, location: hasViewIcon ? 'text_not_matched' : 'icon_not_found', isPinned: false, viewIconFound: hasViewIcon };
      }

      // Use robust reel anchor selector (standard /reel/ and shortcode /reels/)
      const userLower = (targetUser || '').toLowerCase();
      const allDocAnchors = Array.from(document.querySelectorAll('a[href]'));
      const reelAnchors = allDocAnchors.filter(a => {
        const href = (a.getAttribute('href') || a.href || '').toLowerCase();
        if (href.includes('/reel/')) return true;
        if (href.includes('/reels/')) {
          if (href === '/reels/' || href === '/reels' || href.startsWith('/reels?')) return false;
          if (userLower && (href === `/${userLower}/reels/` || href === `/${userLower}/reels`)) return false;
          if (/\/reels\/[A-Za-z0-9_-]+\/?/.test(href)) return true;
        }
        return false;
      });
      const postAnchors = Array.from(document.querySelectorAll('a[href*="/p/"]'));
      const allMedia = Array.from(document.querySelectorAll('img, video'));
      const visibleMedia = allMedia.filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      const gridElements = document.querySelectorAll('article, main, div[role="main"], div[style*="flex"]').length;

      const normalizedReelUrls = reelAnchors.map(a => {
        try {
          const u = new URL(a.href);
          return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
        } catch (e) {
          return (a.href || '').split('?')[0].replace(/\/+$/, '');
        }
      }).filter(Boolean);

      const uniqueReels = Array.from(new Set(normalizedReelUrls));

      const urlMatch = window.location.pathname.match(/^\/([^/]+)/);
      const urlUser = urlMatch ? urlMatch[1] : null;
      const headerEl = document.querySelector('header h1, header h2, main h1, main h2, section h2');
      const detectedUser = headerEl ? headerEl.innerText.trim() : urlUser;

      // Read-only DOM Diagnostics for evidence gathering
      let domEvidence = {
        first10VisibleAnchors: [],
        first20VisibleAnchors: [],
        allAnchorsInMain: [],
        mainText: '',
        pageTitle: '',
        windowScrollY: 0,
        scrollHeight: 0,
        first10VisibleMedia: [],
        sampleTileOuterHTML: '',
        totalHrefAnchors: 0,
        reelHrefAnchorsCount: 0,
        reelsHrefAnchorsCount: 0,
        postHrefAnchorsCount: 0,
        containerContext: {
          isInMain: false,
          isInArticle: false,
          isInDialog: false,
          parentSummary: 'None'
        },
        collectionError: null
      };

      try {
        domEvidence.pageTitle = document.title || '';
        domEvidence.windowScrollY = window.scrollY || 0;
        domEvidence.scrollHeight = document.documentElement ? document.documentElement.scrollHeight : 0;
        const mainEl = document.querySelector('main');
        if (mainEl) {
          domEvidence.mainText = (mainEl.innerText || '').replace(/\s+/g, ' ').slice(0, 1000);
          domEvidence.allAnchorsInMain = Array.from(mainEl.querySelectorAll('a[href]')).slice(0, 30).map(a => ({
            href: a.href || a.getAttribute('href') || '',
            text: (a.innerText || a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80)
          }));
        }

        const allAnchors = Array.from(document.querySelectorAll('a[href]'));
        domEvidence.totalHrefAnchors = allAnchors.length;
        domEvidence.reelHrefAnchorsCount = document.querySelectorAll('a[href*="/reel/"]').length;
        domEvidence.reelsHrefAnchorsCount = document.querySelectorAll('a[href*="/reels/"]').length;
        domEvidence.postHrefAnchorsCount = document.querySelectorAll('a[href*="/p/"]').length;

        const visibleAnchors = allAnchors.filter(a => {
          const r = a.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });

        domEvidence.first10VisibleAnchors = visibleAnchors.slice(0, 10).map(a => ({
          href: a.href || a.getAttribute('href') || '',
          text: (a.innerText || a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80)
        }));
        domEvidence.first20VisibleAnchors = visibleAnchors.slice(0, 20).map(a => ({
          href: a.href || a.getAttribute('href') || '',
          text: (a.innerText || a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80)
        }));

        const visibleMediaList = Array.from(document.querySelectorAll('img, video')).filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });

        domEvidence.first10VisibleMedia = visibleMediaList.slice(0, 10).map(el => {
          let clickable = null;
          let curr = el;
          while (curr && curr !== document.body) {
            const role = curr.getAttribute ? curr.getAttribute('role') : null;
            const hasHref = curr.getAttribute ? curr.getAttribute('href') : null;
            if (curr.tagName === 'A' || curr.tagName === 'BUTTON' || role === 'button' || role === 'link' || hasHref) {
              clickable = curr;
              break;
            }
            try {
              if (window.getComputedStyle(curr).cursor === 'pointer') {
                clickable = curr;
                break;
              }
            } catch (e) {}
            curr = curr.parentElement;
          }

          const tileWrapper = el.closest('a') || el.parentElement?.querySelector('a') || el.parentElement?.parentElement?.querySelector('a');
          const tileAnchorHref = tileWrapper ? (tileWrapper.getAttribute('href') || tileWrapper.href || null) : null;

          const hierarchy = [];
          let hCurr = el;
          while (hCurr && hCurr !== document.body && hierarchy.length < 5) {
            let desc = hCurr.tagName.toLowerCase();
            const role = hCurr.getAttribute ? hCurr.getAttribute('role') : null;
            if (role) desc += `[role="${role}"]`;
            hierarchy.push(desc);
            hCurr = hCurr.parentElement;
          }

          return {
            tag: el.tagName,
            src: (el.src || el.getAttribute('src') || '').slice(0, 100),
            alt: (el.alt || el.getAttribute('alt') || '').slice(0, 80),
            nearestClickableTag: clickable ? clickable.tagName : null,
            nearestClickableHref: clickable ? (clickable.getAttribute('href') || clickable.href || null) : null,
            nearestClickableRole: clickable ? (clickable.getAttribute('role') || null) : null,
            nearestTileAnchorHref: tileAnchorHref,
            containerDescription: hierarchy.join(' < ')
          };
        });

        if (visibleMediaList.length > 0) {
          const firstMedia = visibleMediaList[0];
          const inMain = !!firstMedia.closest('main, [role="main"]');
          const inArticle = !!firstMedia.closest('article');
          const inDialog = !!firstMedia.closest('[role="dialog"], dialog');

          const path = [];
          let p = firstMedia.parentElement;
          while (p && p !== document.body && path.length < 7) {
            let desc = p.tagName.toLowerCase();
            const role = p.getAttribute ? p.getAttribute('role') : null;
            if (role) desc += `[role="${role}"]`;
            if (p.id) desc += `#${p.id}`;
            path.push(desc);
            p = p.parentElement;
          }

          domEvidence.containerContext = {
            isInMain: inMain,
            isInArticle: inArticle,
            isInDialog: inDialog,
            parentSummary: path.join(' -> ')
          };

          const tileCandidate = firstMedia.closest('a') ||
                                firstMedia.closest('article') ||
                                firstMedia.closest('div[role="link"]') ||
                                firstMedia.parentElement?.parentElement?.parentElement ||
                                firstMedia.parentElement;
          if (tileCandidate) {
            domEvidence.sampleTileOuterHTML = tileCandidate.outerHTML.slice(0, 1500);
          }
        }
      } catch (err) {
        domEvidence.collectionError = err.message || String(err);
      }

      // Phase 4: Detailed Reel Tile & View-Count Inspection (up to 5 visible reel anchors)
      let inspectedReels = [];
      try {
        const visibleReelAnchors = reelAnchors.filter(a => {
          const r = a.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        const targetAnchors = (visibleReelAnchors.length > 0 ? visibleReelAnchors : reelAnchors).slice(0, 5);

        inspectedReels = targetAnchors.map(a => {
          let reelUrl = a.href;
          try {
            const u = new URL(a.href);
            reelUrl = `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
          } catch (e) {
            reelUrl = (a.href || '').split('?')[0].replace(/\/+$/, '');
          }

          // Anchor's visible text
          const anchorText = (a.innerText || a.textContent || '').trim().replace(/\s+/g, ' ');

          // Pinned post detection using existing logic
          let pinnedSvg = a.querySelector('svg[aria-label="Pinned post icon"], svg[aria-label*="Pinned" i]');
          if (!pinnedSvg && a.parentElement && a.parentElement.querySelectorAll('a[href*="/reel/"]').length === 1) {
            pinnedSvg = a.parentElement.querySelector('svg[aria-label="Pinned post icon"], svg[aria-label*="Pinned" i]');
          }
          const isPinned = !!pinnedSvg;

          // Text from immediate descendants and relevant nested spans/divs
          const descendantNodes = Array.from(a.querySelectorAll('span, div, p, b, strong, em, svg'));
          const descendantTexts = descendantNodes
            .map(el => {
              const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
              const aria = el.getAttribute ? el.getAttribute('aria-label') || '' : '';
              const title = el.getAttribute ? el.getAttribute('title') || '' : '';
              const role = el.getAttribute ? el.getAttribute('role') || '' : '';
              const tag = el.tagName.toLowerCase();
              const className = (el.className && typeof el.className === 'string') ? el.className.slice(0, 60) : '';
              return { tag, text, aria, title, role, className };
            })
            .filter(item => item.text.length > 0 || item.aria.length > 0 || item.title.length > 0)
            .slice(0, 15);

          // Accessible label or title attributes on anchor and its contents
          const accessibleLabels = [];
          const recordAria = (el) => {
            if (!el || !el.getAttribute) return;
            const aria = el.getAttribute('aria-label');
            const title = el.getAttribute('title');
            const alt = el.getAttribute('alt');
            if (aria) accessibleLabels.push({ tag: el.tagName.toLowerCase(), attr: 'aria-label', value: aria });
            if (title) accessibleLabels.push({ tag: el.tagName.toLowerCase(), attr: 'title', value: title });
            if (alt) accessibleLabels.push({ tag: el.tagName.toLowerCase(), attr: 'alt', value: alt });
          };
          recordAria(a);
          Array.from(a.querySelectorAll('[aria-label], [title], [alt]')).forEach(recordAria);

          // Find nearest relevant tile container WITHOUT crossing into sibling reels
          let tileContainer = a;
          let curr = a.parentElement;
          while (curr && curr !== document.body && curr.tagName !== 'MAIN') {
            const reelsInParent = curr.querySelectorAll('a[href*="/reel/"]');
            if (reelsInParent.length > 1) {
              break; // Stop: parent contains multiple reels
            }
            tileContainer = curr;
            curr = curr.parentElement;
          }

          const tileText = (tileContainer.innerText || tileContainer.textContent || '').trim().replace(/\s+/g, ' ');

          // Extra descendants in tile container that are not inside `a`
          const tileExtraDescendants = [];
          const tileLabels = [];
          if (tileContainer !== a) {
            recordAria(tileContainer);
            Array.from(tileContainer.querySelectorAll('[aria-label], [title], [alt]')).forEach(el => {
              if (!a.contains(el)) recordAria(el);
            });

            Array.from(tileContainer.querySelectorAll('span, div, p, b, strong, em, svg')).forEach(el => {
              if (!a.contains(el)) {
                const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
                const aria = el.getAttribute ? el.getAttribute('aria-label') || '' : '';
                const title = el.getAttribute ? el.getAttribute('title') || '' : '';
                const role = el.getAttribute ? el.getAttribute('role') || '' : '';
                if (text || aria || title) {
                  tileExtraDescendants.push({
                    tag: el.tagName.toLowerCase(),
                    text,
                    aria,
                    title,
                    role
                  });
                }
              }
            });
          }

          // Candidate numbers/view-count strings
          const candidateNumbers = [];
          const allStrings = [
            anchorText,
            tileText,
            ...descendantTexts.map(d => d.text),
            ...descendantTexts.map(d => d.aria),
            ...accessibleLabels.map(l => l.value),
            ...tileLabels.map(l => l.value),
            ...tileExtraDescendants.map(d => d.text),
            ...tileExtraDescendants.map(d => d.aria)
          ].filter(Boolean);

          for (const s of allStrings) {
            const matches = s.match(/([\d,.]+\s*[kmbKMB]?(\s*(views?|plays?))?)/g);
            if (matches) {
              for (const m of matches) {
                const trimmed = m.trim();
                if (trimmed && !candidateNumbers.includes(trimmed)) {
                  candidateNumbers.push(trimmed);
                }
              }
            }
          }

          const viewData = extractView(a);

          return {
            reelUrl,
            isPinned: viewData.isPinned || isPinned,
            anchorText,
            viewIconFound: viewData.viewIconFound,
            viewCount: viewData.count,
            rawViewText: viewData.rawText,
            viewIconLocation: viewData.location,
            descendantTexts,
            accessibleLabels: accessibleLabels.slice(0, 15),
            tileContainerTag: tileContainer.tagName.toLowerCase(),
            tileContainerText: tileText,
            tileExtraDescendants: tileExtraDescendants.slice(0, 15),
            tileLabels: tileLabels.slice(0, 15),
            candidateNumbers,
            hasViewCountText: candidateNumbers.length > 0,
            anchorOuterHTML: a.outerHTML.slice(0, 1500),
            tileOuterHTML: tileContainer.outerHTML.slice(0, 1500)
          };
        });
      } catch (err) {
        if (!domEvidence.collectionError) {
          domEvidence.collectionError = `Reel inspection error: ${err.message || String(err)}`;
        }
      }

      // Extract view counts across all discovered reelAnchors
      let validViewCountsCount = 0;
      let averageViews = 0;
      let rawViewCounts = [];
      let pinnedReelsCount = 0;
      let nonPinnedReelsCount = 0;

      try {
        const allExtractedReels = reelAnchors.map(a => {
          let reelUrl = a.href;
          try {
            const u = new URL(a.href);
            reelUrl = `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
          } catch (e) {
            reelUrl = (a.href || '').split('?')[0].replace(/\/+$/, '');
          }
          const viewData = extractView(a);
          return {
            reelUrl,
            isPinned: viewData.isPinned,
            viewCount: viewData.count,
            rawViewText: viewData.rawText,
            viewIconFound: viewData.viewIconFound,
            viewIconLocation: viewData.location
          };
        });

        const pinnedReels = allExtractedReels.filter(r => r.isPinned);
        const nonPinnedReels = allExtractedReels.filter(r => !r.isPinned);
        const validWithViews = nonPinnedReels.filter(r => typeof r.viewCount === 'number' && r.viewCount >= 0);
        const sample15 = validWithViews.slice(0, 15);
        const sampleCounts = sample15.map(r => r.viewCount);
        const sampleAvg = sampleCounts.length > 0 ? Math.round(sampleCounts.reduce((a, b) => a + b, 0) / sampleCounts.length) : 0;

        validViewCountsCount = validWithViews.length;
        averageViews = sampleAvg;
        rawViewCounts = sampleCounts;
        pinnedReelsCount = pinnedReels.length;
        nonPinnedReelsCount = nonPinnedReels.length;
      } catch (err) {
        console.warn("Failed calculating grid view stats:", err);
      }

      return {
        actualUrl: window.location.href,
        requestedUsername: targetUser,
        detectedUsername: detectedUser || urlUser || 'unknown',
        totalReelAnchors: reelAnchors.length,
        uniqueReelUrls: uniqueReels.length,
        first10Reels: uniqueReels.slice(0, 10),
        postAnchorsCount: postAnchors.length,
        visibleMediaCount: visibleMedia.length,
        gridElementCount: gridElements,
        readyState: document.readyState,
        domEvidence,
        inspectedReels,
        validViewCountsCount,
        averageViews,
        rawViewCounts,
        pinnedReelsCount,
        nonPinnedReelsCount
      };
    }, [normalizedUser]);
  }

  let snapshot = await takeSnapshot();
  let snapshotRetried = false;

  // If no Reel anchors are found, safely activate the profile's Reels tab and take one additional snapshot
  if (snapshot.uniqueReelUrls === 0) {
    try {
      await injectScript(igTabId, (targetUser) => {
        const userLower = targetUser.toLowerCase();
        const profileReelsTab =
          document.querySelector('main div[role="tablist"] a[href*="/reels/"]') ||
          document.querySelector('main a[role="tab"][href*="/reels/"]') ||
          document.querySelector('div[role="tablist"] a[href*="/reels/"]') ||
          Array.from(document.querySelectorAll('main a[href*="/reels/"]')).find(a => {
            const href = (a.getAttribute('href') || '').toLowerCase();
            return (href.includes(`/${userLower}/reels`) || href.endsWith('/reels/')) &&
                   href !== '/reels/' && href !== '/reels' && !href.startsWith('/reels?');
          });
        if (profileReelsTab) profileReelsTab.click();
      }, [normalizedUser]);
    } catch (e) {}
    await new Promise(r => setTimeout(r, 3000));
    snapshot = await takeSnapshot();
    snapshotRetried = true;
  }

  if (snapshot.uniqueReelUrls === 0) {
    return {
      success: true,
      stage: 'zero_reels',
      tabId: igTabId,
      actualUrl: snapshot.actualUrl,
      targetUrl: targetReelsUrl,
      readyState: snapshot.readyState,
      requestedUsername: normalizedUser,
      detectedUsername: snapshot.detectedUsername,
      totalReelAnchors: 0,
      uniqueReelUrls: 0,
      first10Reels: [],
      postAnchorsCount: snapshot.postAnchorsCount,
      visibleMediaCount: snapshot.visibleMediaCount,
      gridElementCount: snapshot.gridElementCount,
      snapshotRetried,
      domEvidence: snapshot.domEvidence,
      inspectedReels: snapshot.inspectedReels || [],
      message: `Diagnostic completed: Page loaded for @${normalizedUser}, but 0 Reel anchors (a[href*="/reel/"]) were found in the DOM (Posts: ${snapshot.postAnchorsCount}, Media: ${snapshot.visibleMediaCount}).`
    };
  }

  return {
    success: true,
    stage: 'reels_discovered',
    tabId: igTabId,
    actualUrl: snapshot.actualUrl,
    targetUrl: targetReelsUrl,
    readyState: snapshot.readyState,
    requestedUsername: normalizedUser,
    detectedUsername: snapshot.detectedUsername,
    totalReelAnchors: snapshot.totalReelAnchors,
    uniqueReelUrls: snapshot.uniqueReelUrls,
    first10Reels: snapshot.first10Reels,
    postAnchorsCount: snapshot.postAnchorsCount,
    visibleMediaCount: snapshot.visibleMediaCount,
    gridElementCount: snapshot.gridElementCount,
    snapshotRetried,
    domEvidence: snapshot.domEvidence,
    inspectedReels: snapshot.inspectedReels || [],
    validViewCountsCount: snapshot.validViewCountsCount || 0,
    averageViews: snapshot.averageViews || 0,
    rawViewCounts: snapshot.rawViewCounts || [],
    pinnedReelsCount: snapshot.pinnedReelsCount || 0,
    nonPinnedReelsCount: snapshot.nonPinnedReelsCount || 0,
    message: `Diagnostic successful: Discovered ${snapshot.uniqueReelUrls} unique Reels (${snapshot.validViewCountsCount || 0} valid non-pinned view counts, avg: ${(snapshot.averageViews || 0).toLocaleString()}) for @${normalizedUser}!`
  };
}
