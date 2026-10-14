// background.js

const EXTENSION_VERSION = "1.0.0";

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
    startProfileResearch(request.payload, sender).then(result => {
      sendResponse({ type: 'PROFILE_COMPLETED', payload: result });
    }).catch(err => {
      sendResponse({ type: 'PROFILE_FAILED', error: err.message || err.toString(), payload: request.payload });
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
  return cleaned;
}

function sendEventToSender(sender, eventType, payload) {
  if (sender && sender.tab && sender.tab.id) {
    chrome.tabs.sendMessage(sender.tab.id, {
      source: 'VELMORA_RND_EXTENSION',
      type: eventType,
      payload
    }).catch((err) => {
      console.warn("Failed to send event to sender tab:", err);
    });
  }
}

async function injectScript(tabId, func, args = []) {
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
  
  while (elapsed < timeout) {
    let res;
    try {
      res = await injectScript(igTabId, (u) => {
        const meta = document.querySelector('meta[name="description"]');
        const pageLower = document.body.innerText.toLowerCase();
        
        if (pageLower.includes("sorry, this page isn't available") || pageLower.includes("page not found")) {
          return { status: "not_found" };
        }
        
        if (!meta) return { status: "loading" };
        
        const content = (meta.getAttribute("content") || "").toLowerCase();
        const targetStr = `@${u.toLowerCase()}`;
        
        if (content.includes(targetStr) || content.includes(u.toLowerCase())) {
          const match = content.match(/([\d,.]+[KMB]?)\s+Followers/i);
          return { status: "ok", followerDisplay: match ? match[1] : "0" };
        }
        
        return { status: "loading" };
      }, [targetUsername]);
    } catch (err) {
      if (err.message.includes("No tab with id") || err.message.includes("Frame with ID")) {
        throw new Error("Instagram tab was closed or disconnected during verification.");
      }
      res = { status: "loading" }; // Treat other execution errors as loading (e.g. page navigated away briefly)
    }
    
    if (res?.status === 'ok') return res.followerDisplay;
    if (res?.status === 'not_found') throw new Error("Instagram profile could not be verified.");
    
    await new Promise(r => setTimeout(r, interval));
    elapsed += interval;
  }
  
  throw new Error("Instagram profile could not be verified. Timeout reached.");
}

async function navigateTo(igTabId, url) {
  return new Promise(resolve => {
    chrome.tabs.update(igTabId, { url }, () => {
      setTimeout(resolve, 2000); // basic wait for navigation to start
    });
  });
}

async function discoverReelLinks(igTabId) {
  try {
    const result = await injectScript(igTabId, () => {
      const anchors = Array.from(document.querySelectorAll('a[href*="/reel/"]'));
      return anchors.map(a => {
        const pinnedIndicator = a.querySelector('svg[aria-label="Pinned post icon"]');
        return {
          url: a.href.split('?')[0],
          isPinned: !!pinnedIndicator
        };
      });
    });
    return result || [];
  } catch (err) {
    if (err.message.includes("No tab with id") || err.message.includes("Frame with ID")) {
      throw new Error("Instagram tab was closed or disconnected during reel discovery.");
    }
    return [];
  }
}

async function scrollUntilEnoughReels(igTabId, sender, payload) {
  sendEventToSender(sender, 'REELS_SCROLLING', payload);
  
  let uniqueReelCount = 0;
  let scrollRounds = 0;
  let stableRounds = 0;
  let allDiscovered = [];
  
  const targetReels = 18;
  const maxScrolls = 12;
  
  while (uniqueReelCount < targetReels && scrollRounds < maxScrolls) {
    const currentBatch = await discoverReelLinks(igTabId);
    const previousUniqueCount = uniqueReelCount;
    
    // Deduplicate
    const urlSet = new Set(allDiscovered.map(r => r.url));
    for (const reel of currentBatch) {
      if (!urlSet.has(reel.url)) {
        allDiscovered.push(reel);
        urlSet.add(reel.url);
      }
    }
    
    uniqueReelCount = allDiscovered.length;
    sendEventToSender(sender, 'REELS_DISCOVERED', { ...payload, discovered: uniqueReelCount });
    
    if (uniqueReelCount === previousUniqueCount && uniqueReelCount > 0) {
      stableRounds++;
      if (stableRounds >= 2) break; // Plateau reached
    } else if (uniqueReelCount > previousUniqueCount) {
      stableRounds = 0; // Reset plateau if we found new ones
    }
    
    if (uniqueReelCount >= targetReels) break;
    
    // Scroll down
    try {
      await injectScript(igTabId, () => {
        window.scrollTo(0, document.body.scrollHeight);
      });
    } catch (err) {
      if (err.message.includes("No tab with id") || err.message.includes("Frame with ID")) {
        throw new Error("Instagram tab was closed or disconnected during scrolling.");
      }
    }
    
    scrollRounds++;
    await new Promise(r => setTimeout(r, 2000)); // Wait for lazy load
  }
  
  return allDiscovered;
}

function processDiscoveredReels(discoveredArray, sender, payload) {
  // Exclude pinned
  const nonPinned = discoveredArray.filter(r => !r.isPinned);
  const pinnedCount = discoveredArray.length - nonPinned.length;
  
  sendEventToSender(sender, 'PINNED_REELS_FILTERED', { ...payload, excluded: pinnedCount });
  
  // Select up to 15 preserving order
  const selected = nonPinned.slice(0, 15).map((r, i) => ({
    reelUrl: r.url,
    isPinned: false,
    discoveryIndex: i + 1
  }));
  
  sendEventToSender(sender, 'REELS_SELECTION_COMPLETE', { ...payload, selected: selected.length });
  
  return {
    reelsDiscovered: discoveredArray.length,
    pinnedReelsExcluded: pinnedCount,
    selectedReelCount: selected.length,
    selectedReels: selected
  };
}

async function startProfileResearch(payload, sender) {
  const { jobId, influencerCode, username } = payload;
  const normalizedUser = normalizeUsername(username);
  const startTs = Date.now();
  
  if (!normalizedUser) throw new Error('Invalid or missing username');

  sendEventToSender(sender, 'PROFILE_OPENING', payload);

  let tabs = await new Promise(res => chrome.tabs.query({ url: "*://*.instagram.com/*" }, res));
  let igTabId;
  const profileUrl = `https://www.instagram.com/${normalizedUser}/`;

  if (tabs && tabs.length > 0) {
    igTabId = tabs[0].id;
    await navigateTo(igTabId, profileUrl);
  } else {
    const newTab = await new Promise(res => chrome.tabs.create({ url: profileUrl, active: false }, res));
    igTabId = newTab.id;
  }

  sendEventToSender(sender, 'PROFILE_VERIFYING', payload);
  const followerDisplay = await verifyProfile(igTabId, normalizedUser);
  sendEventToSender(sender, 'PROFILE_DATA_FOUND', payload);

  // Milestone 2: Reel Discovery
  sendEventToSender(sender, 'REELS_PAGE_OPENING', payload);
  await navigateTo(igTabId, `${profileUrl}reels/`);
  
  // Wait to verify reels page belongs to the profile
  sendEventToSender(sender, 'REELS_LOADING', payload);
  await verifyProfile(igTabId, normalizedUser);
  
  let discovered = await scrollUntilEnoughReels(igTabId, sender, payload);
  let reelResults = processDiscoveredReels(discovered, sender, payload);
  
  // Retry once if < 15 non-pinned reels found
  if (reelResults.selectedReelCount < 15) {
    sendEventToSender(sender, 'RESEARCH_RETRYING', payload);
    await navigateTo(igTabId, `${profileUrl}reels/`);
    await verifyProfile(igTabId, normalizedUser);
    
    const retryDiscovered = await scrollUntilEnoughReels(igTabId, sender, payload);
    const retryResults = processDiscoveredReels(retryDiscovered, sender, payload);
    
    if (retryResults.selectedReelCount > reelResults.selectedReelCount) {
      reelResults = retryResults;
    }
  }

  let finalStatus = 'completed';
  if (reelResults.selectedReelCount === 0) finalStatus = 'reels_not_found';
  else if (reelResults.selectedReelCount < 15) finalStatus = 'reels_not_enough';

  return {
    jobId,
    influencerCode,
    requestedUsername: username,
    verifiedUsername: normalizedUser,
    followerDisplay,
    followerCount: parseViews(followerDisplay),
    ...reelResults,
    status: finalStatus,
    startedAt: startTs,
    completedAt: Date.now()
  };
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
