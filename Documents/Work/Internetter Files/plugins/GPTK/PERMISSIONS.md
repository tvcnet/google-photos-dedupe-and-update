# Privacy Tab: Permission Justifications (Copy-Paste Guide)

When submitting GPTK to the Chrome Web Store, you will be required to justify each declared permission on the **Privacy** tab of the Developer Dashboard. 

You can copy and paste the text below exactly as written into the corresponding justification fields.

***

### `activeTab`
> "Used to inject the extension's UI toolkit panel directly into the current Google Photos tab when the user clicks the extension icon, allowing the user to manage their photos without leaving the page."

### `storage`
> "Used to persist user settings locally in chrome.storage.local, including user-provided AI provider settings (Gemini/Ollama) and the extension's UI state."

### `unlimitedStorage`
> "Used to reduce browser quota pressure for larger duplicate-scan workflows. GPTK stores scan progress and browser-side IndexedDB image-embedding caches for repeat duplicate scans over massive Google Photos libraries."

### `declarativeNetRequest`
> "Used strictly to bypass CORS for localhost connections when a user opts to connect the extension to their own local Ollama AI server. The extension installs narrow dynamic rules that remove Origin and Referer headers ONLY for extension-origin XHR requests targeting http://127.0.0.1:11434/* and http://localhost:11434/*. It does not intercept, inspect, or modify normal web traffic."

### `https://photos.google.com/*`
> "Required because the entire functional purpose of the extension is to operate as an overlay toolkit inside the Google Photos web application."

### `https://*.googleusercontent.com/*` and `https://*.usercontent.google.com/*`
> "Required to fetch thumbnail resources and media variants served directly by Google's user-content hosts so they can be analyzed for duplicates or passed to the chosen AI provider."

### `https://generativelanguage.googleapis.com/*`
> "Required to send image data to the Google Gemini API, but ONLY when the user explicitly provides a Gemini API key and clicks the 'AI Describe' action in the toolkit."

### `https://storage.googleapis.com/*`
> "Required to download the official MediaPipe image-embedding model (mobilenet_v3_large.tflite) asset used by the local duplicate-analysis runtime. This is a static model weight file, not remote executable code."

### `http://127.0.0.1:11434/*` and `http://localhost:11434/*`
> "Required to allow the extension service worker to send image analysis requests to a user's locally hosted Ollama AI server, if the user explicitly configures it."
