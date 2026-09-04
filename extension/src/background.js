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
