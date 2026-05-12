const APP_ID = "GPD";
const APP_PAGE = "tabs/app.html";
const PHOTOS_URL_PATTERN = "https://photos.google.com/*";
const AI_DESCRIPTION_PROMPT = "Describe this photo in 1-2 natural sentences suitable for a photo caption. Focus on the scene, subjects, and setting. Be concise and factual.";
const DEFAULT_API_SETTINGS = {
  aiProvider: "gemini",
  geminiApiKey: "",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ollamaModel: "",
  ollamaApiKey: ""
};

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

async function getApiSettings() {
  const result = await chrome.storage.local.get(["apiSettings"]);
  return {
    ...DEFAULT_API_SETTINGS,
    ...(result.apiSettings || {})
  };
}

function assertAllowedImageUrl(imageUrl = "") {
  const parsed = new URL(imageUrl);
  const hostname = parsed.hostname;
  const allowedHost =
    hostname === "photos.google.com" ||
    hostname === "googleusercontent.com" ||
    hostname.endsWith(".googleusercontent.com") ||
    hostname === "usercontent.google.com" ||
    hostname.endsWith(".usercontent.google.com");
  if (parsed.protocol !== "https:" || !allowedHost) {
    throw new Error("Unsupported image URL for AI description.");
  }
  return parsed.href;
}

async function fetchImageAsBase64(imageUrl) {
  const safeUrl = assertAllowedImageUrl(imageUrl);
  const response = await fetch(safeUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType = response.headers.get("content-type") || "image/jpeg";
  const uint8 = new Uint8Array(arrayBuffer);
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < uint8.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
  }

  return {
    base64: btoa(binary),
    mimeType
  };
}

async function handleImageFetch(message, sender) {
  if (message?.app !== APP_ID || message.action !== "gptkFetchImage") return;

  const tabId = sender?.tab?.id;
  if (!tabId) return;

  try {
    const imageData = await fetchImageAsBase64(message.url);

    await chrome.tabs.sendMessage(tabId, {
      app: APP_ID,
      action: "gptkFetchImageResult",
      requestId: message.requestId,
      ...imageData
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

function normalizeOllamaBaseUrl(baseUrl = "") {
  const normalized = String(baseUrl).trim().replace(/\/+$/, "");
  if (normalized === "http://127.0.0.1:11434" || normalized === "http://localhost:11434") {
    return normalized;
  }
  throw new Error("Unsupported Ollama URL. Use http://127.0.0.1:11434 or http://localhost:11434.");
}

async function fetchOllama(request = {}, settings = null) {
  const resolvedSettings = settings || await getApiSettings();
  const baseUrl = normalizeOllamaBaseUrl(request.baseUrl || resolvedSettings.ollamaBaseUrl);
  const path = request.path === "/api/tags" || request.path === "/v1/chat/completions"
    ? request.path
    : null;
  if (!path) {
    throw new Error("Unsupported Ollama endpoint.");
  }

  const method = request.method === "POST" ? "POST" : "GET";
  const controller = new AbortController();
  const timeoutMs = Number(request.timeoutMs || (method === "POST" ? 90000 : 15000));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = {};
  const fetchOptions = {
    method,
    headers,
    signal: controller.signal
  };

  if (method === "POST") {
    headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(request.body || {});
  }

  const apiKey = request.apiKey || resolvedSettings.ollamaApiKey;
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, fetchOptions);
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { text };
      }
    }

    if (!response.ok) {
      let errorMsg = `Ollama API error ${response.status}: ${text.slice(0, 300)}`;
      if (response.status === 400 && text.includes("does not support image input")) {
        errorMsg = "The selected Ollama model does not support images. Please download and select a vision-capable model like 'qwen3-vl' or 'llama3.2-vision' (e.g., run `ollama pull qwen3-vl` in your terminal).";
      }
      throw new Error(errorMsg);
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function handleOllamaFetch(message, sendResponse) {
  try {
    const data = await fetchOllama(message.request || {});
    sendResponse({ data });
  } catch (error) {
    sendResponse({ error: String(error?.message || error) });
  }
}

async function callGeminiVision(apiKey, imageData) {
  if (!apiKey) {
    throw new Error("No Gemini API key set.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{
      parts: [
        {
          inline_data: {
            mime_type: imageData.mimeType,
            data: imageData.base64
          }
        },
        { text: AI_DESCRIPTION_PROMPT }
      ]
    }]
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = text ? JSON.parse(text) : null;
  const generated = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!generated) {
    throw new Error("Gemini returned no text.");
  }
  return generated;
}

async function callOllamaVision(settings, imageData) {
  const model = String(settings.ollamaModel || "").trim();
  if (!model) {
    throw new Error("Ollama model is not selected.");
  }

  const data = await fetchOllama({
    path: "/v1/chat/completions",
    method: "POST",
    timeoutMs: 90000,
    body: {
      model,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: AI_DESCRIPTION_PROMPT },
          {
            type: "image_url",
            image_url: {
              url: `data:${imageData.mimeType};base64,${imageData.base64}`
            }
          }
        ]
      }]
    }
  }, settings);

  const generated = data?.choices?.[0]?.message?.content?.trim();
  if (!generated) {
    throw new Error("Ollama returned no text.");
  }
  return generated;
}

async function handleAiDescribe(message, sendResponse) {
  try {
    const settings = await getApiSettings();
    const provider = message.provider === "ollama" ? "ollama" : "gemini";
    const imageData = await fetchImageAsBase64(message.imageUrl);
    const text = provider === "ollama"
      ? await callOllamaVision(settings, imageData)
      : await callGeminiVision(settings.geminiApiKey, imageData);
    sendResponse({ data: { text } });
  } catch (error) {
    sendResponse({ error: String(error?.message || error) });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
    case "gptkOllamaRequest":
      void handleOllamaFetch(message, sendResponse);
      return true;
    case "gptkAiDescribeRequest":
      void handleAiDescribe(message, sendResponse);
      return true;
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

function setupOllamaCorsBypass() {
  if (!chrome.declarativeNetRequest) return;
  
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1, 2],
    addRules: [
      {
        id: 1,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [
            { header: "Origin", operation: "remove" },
            { header: "Referer", operation: "remove" }
          ]
        },
        condition: {
          urlFilter: "||127.0.0.1:11434/*",
          resourceTypes: ["xmlhttprequest"]
        }
      },
      {
        id: 2,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [
            { header: "Origin", operation: "remove" },
            { header: "Referer", operation: "remove" }
          ]
        },
        condition: {
          urlFilter: "||localhost:11434/*",
          resourceTypes: ["xmlhttprequest"]
        }
      }
    ]
  }).catch(console.error);
}

chrome.runtime.onInstalled.addListener(() => {
  setupOllamaCorsBypass();
});
chrome.runtime.onStartup.addListener(() => {
  setupOllamaCorsBypass();
});

// Run once on load just in case the service worker restarts without an event
setupOllamaCorsBypass();

console.log("GPD: Service worker loaded");
