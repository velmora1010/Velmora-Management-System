// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // PING command to verify extension is alive
  if (request.type === 'PING') {
    sendResponse({ type: 'PONG', status: 'OK' });
    return true;
  }

  // Check Instagram Login Status
  if (request.type === 'CHECK_INSTAGRAM_LOGIN') {
    checkInstagramSession().then(status => {
      sendResponse({ type: 'INSTAGRAM_STATUS', ...status });
    }).catch(err => {
      sendResponse({ type: 'INSTAGRAM_STATUS', error: err.toString() });
    });
    return true; // Indicates asynchronous response
  }

  return false;
});

async function checkInstagramSession() {
  return new Promise((resolve) => {
    // Check for the "sessionid" cookie on instagram.com
    chrome.cookies.get({ url: 'https://www.instagram.com', name: 'sessionid' }, (cookie) => {
      if (chrome.runtime.lastError) {
        resolve({ loggedIn: false, error: chrome.runtime.lastError.message });
        return;
      }
      
      if (cookie && cookie.value) {
        resolve({ loggedIn: true });
      } else {
        resolve({ loggedIn: false });
      }
    });
  });
}
