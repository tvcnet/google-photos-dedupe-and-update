const APP_ID = "GPD";
const SECRET_SETTING_KEYS = ["geminiApiKey", "ollamaApiKey"];

function sanitizeApiSettings(settings = {}) {
  const sanitized = { ...settings };
  sanitized.hasGeminiApiKey = Boolean(settings.geminiApiKey);
  sanitized.hasOllamaApiKey = Boolean(settings.ollamaApiKey);
  for (const key of SECRET_SETTING_KEYS) {
    sanitized[key] = "";
  }
  return sanitized;
}

function stripDerivedSettings(settings = {}) {
  const stripped = { ...settings };
  delete stripped.hasGeminiApiKey;
  delete stripped.hasOllamaApiKey;
  return stripped;
}

function postToPage(action, data = {}) {
  window.postMessage(
    {
      app: APP_ID,
      action,
      ...data
    },
    "*"
  );
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  const message = event.data;
  if (!message || message.app !== APP_ID) return;

  if (
    message.action === "gptkResult" ||
    message.action === "gptkProgress" ||
    message.action === "gptkLog"
  ) {
    chrome.runtime.sendMessage(message);
    return;
  }

  if (message.action === "gptkGetStorage") {
    chrome.storage.local.get(["apiSettings"], (result) => {
      postToPage("gptkStorageData", {
        data: sanitizeApiSettings(result.apiSettings || {})
      });
    });
    return;
  }

  if (message.action === "gptkSetStorage") {
    chrome.storage.local.get(["apiSettings"], (result) => {
      const current = result.apiSettings || {};
      const incoming = stripDerivedSettings(message.data || {});
      const nextSettings = {
        ...current,
        ...incoming
      };
      if (!message.clearSecrets) {
        for (const key of SECRET_SETTING_KEYS) {
          if (!incoming[key] && current[key]) {
            nextSettings[key] = current[key];
          }
        }
      }
      chrome.storage.local.set({ apiSettings: nextSettings }, () => {
        postToPage("gptkStorageData", {
          data: sanitizeApiSettings(nextSettings)
        });
      });
    });
    return;
  }

  if (message.action === "gptkClearStorage") {
    chrome.storage.local.set({ apiSettings: {} }, () => {
      postToPage("gptkStorageData", {
        data: {}
      });
    });
    return;
  }

  if (message.action === "gptkOllamaRequest") {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        postToPage("gptkOllamaResult", {
          requestId: message.requestId,
          error: chrome.runtime.lastError.message
        });
        return;
      }
      postToPage("gptkOllamaResult", {
        requestId: message.requestId,
        ...(response || { error: "No response from Ollama bridge" })
      });
    });
    return;
  }

  if (message.action === "gptkAiDescribeRequest") {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        postToPage("gptkAiDescribeResult", {
          requestId: message.requestId,
          error: chrome.runtime.lastError.message
        });
        return;
      }
      postToPage("gptkAiDescribeResult", {
        requestId: message.requestId,
        ...(response || { error: "No response from AI bridge" })
      });
    });
    return;
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.app !== APP_ID) return;

  if (message.action === "gptkCommand") {
    window.postMessage(message, "*");
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.apiSettings) return;
  postToPage("gptkStorageData", {
    data: sanitizeApiSettings(changes.apiSettings.newValue || {})
  });
});

console.log("GPD: Bridge content script loaded");
