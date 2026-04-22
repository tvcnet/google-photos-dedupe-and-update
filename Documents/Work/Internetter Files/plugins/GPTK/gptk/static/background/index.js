const APP_ID = "GPD";
const APP_PAGE = "tabs/app.html";
const PHOTOS_URL_PATTERN = "https://photos.google.com/*";

const linkedTabs = new Map();
const pendingRequests = new Map();

function isPhotosUrl(url = "") {
  return typeof url === "string" && url.startsWith("https://photos.google.com/");
}

function linkTabs(appTabId, photosTabId) {
  if (!appTabId || !photosTabId) return;
  linkedTabs.set(appTabId, photosTabId);
  linkedTabs.set(photosTabId, appTabId);
}

function unlinkTab(tabId) {
  const linkedId = linkedTabs.get(tabId);
  if (linkedId) {
    linkedTabs.delete(linkedId);
  }
  linkedTabs.delete(tabId);
}

async function getTabIfPhotos(tabId) {
  if (!tabId) return null;
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab?.id && isPhotosUrl(tab.url) ? tab : null;
  } catch {
    return null;
  }
}

async function findPhotosTab(options = {}) {
  const { preferredTabId, linkedTabId, requesterWindowId } = options;

  const preferred = await getTabIfPhotos(preferredTabId);
  if (preferred) return preferred;

  const linked = await getTabIfPhotos(linkedTabId);
  if (linked) return linked;

  if (requesterWindowId) {
    const sameWindowActive = await chrome.tabs.query({
      active: true,
      windowId: requesterWindowId,
      url: PHOTOS_URL_PATTERN
    });
    if (sameWindowActive[0]?.id) return sameWindowActive[0];
  }

  const focusedActive = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
    url: PHOTOS_URL_PATTERN
  });
  if (focusedActive[0]?.id) return focusedActive[0];

  const photosTabs = await chrome.tabs.query({ url: PHOTOS_URL_PATTERN });
  return photosTabs[0] ?? null;
}

async function findSourceTabId(sender) {
  if (sender.tab?.id) return sender.tab.id;
  if (sender.url) {
    const matching = await chrome.tabs.query({ url: sender.url });
    if (matching[0]?.id) return matching[0].id;
  }
  return null;
}

function relayResult(message) {
  const pending = pendingRequests.get(message.requestId);
  if (!pending) return;

  if (pending.appTabId) {
    chrome.tabs.sendMessage(pending.appTabId, message).catch(() => {});
  }

  if (message.success) {
    pending.resolve(message.data);
  } else {
    pending.reject(message.error || "Unknown error");
  }

  pendingRequests.delete(message.requestId);
}

function relayProgress(message) {
  const pending = pendingRequests.get(message.requestId);
  if (!pending?.appTabId) return;
  chrome.tabs.sendMessage(pending.appTabId, message).catch(() => {});
}

async function sendCommandToPhotosTab(photosTabId, command, args, appTabId = 0) {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const payload = {
    app: APP_ID,
    action: "gptkCommand",
    command,
    requestId,
    args
  };

  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject, appTabId });
    chrome.tabs.sendMessage(photosTabId, payload).catch(() => {
      pendingRequests.delete(requestId);
      reject("Unable to connect to Google Photos tab. Please reload the tab and try again.");
    });
  });
}

async function openAppForSender(sender) {
  const appTab = await chrome.tabs.create({ url: chrome.runtime.getURL(APP_PAGE) });
  const sourceTabId = await findSourceTabId(sender);
  const photosTab = await findPhotosTab({
    preferredTabId: sourceTabId,
    requesterWindowId: sender.tab?.windowId
  });

  if (appTab.id && photosTab?.id) {
    linkTabs(appTab.id, photosTab.id);
  }
}

async function handleHealthCheck(sender) {
  const appTabId = await findSourceTabId(sender);
  const linkedTabId = appTabId ? linkedTabs.get(appTabId) : null;
  const photosTab = await findPhotosTab({
    linkedTabId,
    requesterWindowId: sender.tab?.windowId
  });

  if (!photosTab?.id) {
    if (appTabId) {
      chrome.tabs.sendMessage(appTabId, {
        app: APP_ID,
        action: "healthCheck.result",
        success: false,
        hasGptk: false
      }).catch(() => {});
    }
    return;
  }

  if (appTabId) {
    linkTabs(appTabId, photosTab.id);
  }

  try {
    const data = await sendCommandToPhotosTab(photosTab.id, "healthCheck", undefined, 0);
    if (appTabId) {
      chrome.tabs.sendMessage(appTabId, {
        app: APP_ID,
        action: "healthCheck.result",
        success: true,
        hasGptk: data.hasGptk,
        accountEmail: data.accountEmail
      }).catch(() => {});
    }
  } catch {
    if (appTabId) {
      chrome.tabs.sendMessage(appTabId, {
        app: APP_ID,
        action: "healthCheck.result",
        success: false,
        hasGptk: false
      }).catch(() => {});
    }
  }
}

async function handleAppCommand(message, sender) {
  const appTabId = await findSourceTabId(sender);
  if (!appTabId) return;

  const linkedTabId = linkedTabs.get(appTabId);
  const photosTab = await findPhotosTab({
    linkedTabId,
    requesterWindowId: sender.tab?.windowId
  });

  if (!photosTab?.id) {
    chrome.tabs.sendMessage(appTabId, {
      app: APP_ID,
      action: "gptkResult",
      command: message.command,
      requestId: message.requestId,
      success: false,
      error: "Google Photos tab not found. Please open photos.google.com."
    }).catch(() => {});
    return;
  }

  linkTabs(appTabId, photosTab.id);

  pendingRequests.set(message.requestId, {
    resolve: () => {},
    reject: () => {},
    appTabId
  });

  chrome.tabs.sendMessage(photosTab.id, message).catch(() => {
    pendingRequests.delete(message.requestId);
    chrome.tabs.sendMessage(appTabId, {
      app: APP_ID,
      action: "gptkResult",
      command: message.command,
      requestId: message.requestId,
      success: false,
      error: "Unable to connect to Google Photos tab. Please reload the tab and try again."
    }).catch(() => {});
  });
}

async function handleImageFetch(message, sender) {
  if (message?.app !== APP_ID || message.action !== "gptkFetchImage") return;

  const tabId = sender?.tab?.id;
  if (!tabId) return;

  try {
    const response = await fetch(message.url);
    if (!response.ok) {
      await chrome.tabs.sendMessage(tabId, {
        app: APP_ID,
        action: "gptkFetchImageResult",
        requestId: message.requestId,
        error: `Failed to fetch image: ${response.status}`
      });
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    const mimeType = response.headers.get("content-type") || "image/jpeg";
    const uint8 = new Uint8Array(arrayBuffer);
    const chunkSize = 8192;
    let binary = "";
    for (let i = 0; i < uint8.length; i += chunkSize) {
      binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
    }

    await chrome.tabs.sendMessage(tabId, {
      app: APP_ID,
      action: "gptkFetchImageResult",
      requestId: message.requestId,
      base64: btoa(binary),
      mimeType
    });
  } catch (error) {
    await chrome.tabs.sendMessage(tabId, {
      app: APP_ID,
      action: "gptkFetchImageResult",
      requestId: message.requestId,
      error: String(error)
    }).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.app !== APP_ID) return;

  switch (message.action) {
    case "launchApp":
      void openAppForSender(sender);
      break;
    case "healthCheck":
      void handleHealthCheck(sender);
      break;
    case "gptkCommand":
      void handleAppCommand(message, sender);
      break;
    case "gptkResult":
      relayResult(message);
      break;
    case "gptkProgress":
      relayProgress(message);
      break;
    case "gptkFetchImage":
      void handleImageFetch(message, sender);
      break;
    default:
      break;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const linkedId = linkedTabs.get(tabId);
  if (linkedId) {
    chrome.tabs.sendMessage(linkedId, {
      app: APP_ID,
      action: "gptkLog",
      level: "error",
      message: "Google Photos tab was closed."
    }).catch(() => {});
  }

  unlinkTab(tabId);

  for (const [requestId, pending] of pendingRequests.entries()) {
    if (pending.appTabId === tabId) {
      pendingRequests.delete(requestId);
    }
  }
});

chrome.action.onClicked.addListener((tab) => {
  void openAppForSender({ tab });
});

console.log("GPD: Service worker loaded");
