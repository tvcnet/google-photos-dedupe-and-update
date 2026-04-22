const APP_ID = "GPD";

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
        data: result.apiSettings || {}
      });
    });
    return;
  }

  if (message.action === "gptkSetStorage") {
    chrome.storage.local.set({ apiSettings: message.data || {} }, () => {
      postToPage("gptkStorageData", {
        data: message.data || {}
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
    data: changes.apiSettings.newValue || {}
  });
});

console.log("GPD: Bridge content script loaded");
