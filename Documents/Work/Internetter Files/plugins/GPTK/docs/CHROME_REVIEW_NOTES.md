# Message to the Reviewer (Copy-Paste Guide)

When you click **Submit for Review** in the Chrome Developer Dashboard, a modal will appear prompting you for an optional "Message to the Reviewer". 

Providing a clear, upfront explanation of complex extension behavior is the best way to prevent algorithmic or manual review rejections. Copy and paste the text below exactly as written into that field.

***

**Message to the Reviewer:**

Hello! To help expedite your review of the Google Photos Toolkit (GPTK) and prevent any automated false flags, we want to provide immediate clarity on our network and storage architecture:

1. **Dual AI & Local Architecture**: GPTK has two primary flows. "Scan for Duplicates" runs entirely locally in the browser and does not transmit image data to any AI provider. "AI Describe" is an optional feature that only sends image data to Gemini or a local Ollama server if the user explicitly configures it.

2. **Why we use `declarativeNetRequest`**: We request DNR strictly to support the optional local Ollama provider. The extension installs narrow dynamic rules that strip `Origin` and `Referer` headers ONLY for extension-origin XHR requests targeting `http://127.0.0.1:11434/*` and `http://localhost:11434/*`. This allows users to connect to their own local AI instances without CORS blocking them. We do not intercept, redirect, or inspect normal web traffic.

3. **Remote Model Download (No Remote Code)**: We request `https://storage.googleapis.com/*` solely to download a `.tflite` MediaPipe image-embedding model asset for duplicate analysis (`mobilenet_v3_large.tflite`). This is a static data/weights file, not JavaScript or remote executable WASM. All executable WASM binaries for the MediaPipe runtime are bundled directly in the extension package.

4. **Security Boundary for Keys**: If a user saves a Gemini API key, it is stored in `chrome.storage.local` and all API requests are routed securely through the extension Service Worker. We do not expose API keys or request details back to the injected content script on the Google Photos page.

Thank you for your time reviewing this update!
