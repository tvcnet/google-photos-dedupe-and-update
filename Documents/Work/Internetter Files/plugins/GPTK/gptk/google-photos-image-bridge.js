// google-photos-image-bridge.js
// Standalone ISOLATED-world content script that forwards gptkFetchImage
// requests from the MAIN-world toolkit to the service worker (which has no
// CORS restrictions), then relays the base64 result back to the page.
//
// This is a separate file (not part of the Parcel bundle) to avoid any
// module-system interference.

console.log('GPD: Image bridge content script loaded');

// Forward gptkFetchImage from the MAIN world to the service worker.
window.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg || msg.app !== 'GPD' || msg.action !== 'gptkFetchImage') return;
    console.log('GPD: Image bridge forwarding fetch to service worker', msg.requestId);
    chrome.runtime.sendMessage({
        app: 'GPD',
        action: 'gptkFetchImage',
        requestId: msg.requestId,
        url: msg.url
    });
});

// Relay gptkFetchImageResult from the service worker back to the page.
chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.app !== 'GPD' || msg.action !== 'gptkFetchImageResult') return;
    console.log('GPD: Image bridge relaying result to page', msg.requestId, msg.error ? 'ERROR: ' + msg.error : 'base64 len=' + (msg.base64 || '').length);
    window.postMessage(msg, '*');
});
