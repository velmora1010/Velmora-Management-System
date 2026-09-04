// background.js

const EXTENSION_VERSION = "1.0.0";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_EXTENSION_STATUS' || request.type === 'PING') {
    sendResponse({ 
      type: 'PONG', 
      status: 'OK',
      extensionVersion: EXTENSION_VERSION,
      timestamp: Date.now()
    });
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
    // 1. Check if an Instagram tab is open
    chrome.tabs.query({ url: "*://*.instagram.com/*" }, (tabs) => {
      const isAvailable = tabs && tabs.length > 0;
      const tabId = isAvailable ? tabs[0].id : undefined;

      // 2. Check for the sessionid cookie
      chrome.cookies.get({ url: 'https://www.instagram.com', name: 'sessionid' }, (cookie) => {
        if (chrome.runtime.lastError) {
          resolve({ 
            available: isAvailable, 
            session: 'unknown', 
            tabId,
            error: chrome.runtime.lastError.message 
          });
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
    });
  }
}

async function startProfileResearch(payload, sender) {
  const { jobId, influencerCode, username } = payload;
  const normalizedUser = normalizeUsername(username);
  
  if (!normalizedUser) {
    throw new Error('Invalid or missing username');
  }

  sendEventToSender(sender, 'PROFILE_OPENING', { influencerCode, username });

  // 1. Find or create Instagram tab
  let tabs = await new Promise(res => chrome.tabs.query({ url: "*://*.instagram.com/*" }, res));
  let igTabId;
  const targetUrl = `https://www.instagram.com/${normalizedUser}/`;

  if (tabs && tabs.length > 0) {
    igTabId = tabs[0].id;
    await new Promise(res => chrome.tabs.update(igTabId, { url: targetUrl, active: true }, res));
  } else {
    const newTab = await new Promise(res => chrome.tabs.create({ url: targetUrl, active: false }, res));
    igTabId = newTab.id;
  }

  sendEventToSender(sender, 'PROFILE_VERIFYING', { influencerCode, username });

  // Wait for the page to load and verify the profile
  let elapsed = 0;
  const timeout = 15000;
  const interval = 1000;
  let followerCount = null;
  let followerDisplay = null;
  let isVerified = false;

  while (elapsed < timeout) {
    // Inject script to extract data
    try {
      const results = await new Promise((res, rej) => {
        chrome.scripting.executeScript({
          target: { tabId: igTabId },
          func: (targetUsername) => {
            const meta = document.querySelector('meta[name="description"]');
            const pageLower = document.body.innerText.toLowerCase();
            if (!meta) {
              if (pageLower.includes("sorry, this page isn't available") || pageLower.includes("page not found")) {
                return { status: "not_found" };
              }
              return { status: "loading" };
            }
            
            const content = (meta.getAttribute("content") || "");
            const lowerContent = content.toLowerCase();
            const targetStr = `@${targetUsername.toLowerCase()}`;
            
            if (lowerContent.includes(targetStr) || lowerContent.includes(targetUsername.toLowerCase())) {
              // Extract followers
              const match = content.match(/([\d,.]+[KMB]?)\s+Followers/i);
              let followerDisplay = match ? match[1] : "0";
              return { status: "ok", followerDisplay };
            }
            
            if (pageLower.includes("sorry, this page isn't available") || pageLower.includes("page not found")) {
              return { status: "not_found" };
            }
            return { status: "loading" };
          },
          args: [normalizedUser]
        }, (resData) => {
          if (chrome.runtime.lastError) {
             // Script might not be able to execute yet (page loading)
             res([{ result: { status: "loading" } }]);
          } else {
             res(resData);
          }
        });
      });

      if (results && results[0] && results[0].result) {
        const resObj = results[0].result;
        if (resObj.status === 'ok') {
          followerDisplay = resObj.followerDisplay;
          isVerified = true;
          break;
        } else if (resObj.status === 'not_found') {
          throw new Error("Instagram profile could not be verified.");
        }
      }
    } catch (e) {
      if (e.message.includes("Instagram profile could not be verified")) {
        throw e;
      }
    }

    await new Promise(r => setTimeout(r, interval));
    elapsed += interval;
  }

  if (!isVerified) {
    throw new Error("Instagram profile could not be verified. Timeout reached.");
  }

  sendEventToSender(sender, 'PROFILE_DATA_FOUND', { influencerCode, username });

  return {
    jobId,
    influencerCode,
    requestedUsername: username,
    verifiedUsername: normalizedUser,
    followerDisplay,
    followerCount: parseViews(followerDisplay),
    status: 'completed',
    startedAt: Date.now() - elapsed,
    completedAt: Date.now()
  };
}

function parseViews(text) {
  if (!text) return 0;
  text = String(text).toLowerCase().replace(/,/g, '').trim();
  if (text.includes('b')) {
    return parseInt(parseFloat(text.replace('b', '')) * 1000000000);
  } else if (text.includes('m')) {
    return parseInt(parseFloat(text.replace('m', '')) * 1000000);
  } else if (text.includes('k')) {
    return parseInt(parseFloat(text.replace('k', '')) * 1000);
  } else {
    const val = parseInt(text);
    return isNaN(val) ? 0 : val;
  }
}
