// content-app.js
// This script is injected into the Velmora React app.
// It acts as a bridge between the web app (via window.postMessage) and the background script.

const VELMORA_RND_SOURCE = 'VELMORA_RND_WEB';
const VELMORA_RND_EXTENSION = 'VELMORA_RND_EXTENSION';

// Signal to the webpage that the extension is injected and ready.
window.postMessage({ source: VELMORA_RND_EXTENSION, type: 'EXTENSION_READY' }, '*');

window.addEventListener('message', (event) => {
  // Only accept messages from the same frame
  if (event.source !== window) return;

  const data = event.data;
  if (!data || data.source !== VELMORA_RND_SOURCE) return;

  // We got a message from the Velmora web app. Forward it to the background script.
  try {
    chrome.runtime.sendMessage(data, (response) => {
      if (chrome.runtime.lastError) {
        // Background script is unavailable or error occurred
        window.postMessage({
          source: VELMORA_RND_EXTENSION,
          id: data.id,
          error: chrome.runtime.lastError.message
        }, '*');
        return;
      }

      // Send the response back to the web app
      if (response) {
        window.postMessage({
          source: VELMORA_RND_EXTENSION,
          id: data.id,
          ...response
        }, '*');
      }
    });
  } catch (err) {
    window.postMessage({
      source: VELMORA_RND_EXTENSION,
      id: data.id,
      error: err.toString()
    }, '*');
  }
});

// Forward messages from the background script (like live progress events) back to the web app
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.source === VELMORA_RND_EXTENSION) {
    window.postMessage(message, '*');
  }
  return false;
});
