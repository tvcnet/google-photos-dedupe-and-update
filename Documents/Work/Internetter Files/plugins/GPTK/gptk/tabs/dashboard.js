/**
 * dashboard.js
 * Handles the logic for the Photo Album Info Update card in the Extension Hub.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const apiKeyInput = document.getElementById('gemini-api-key');
    const saveBtn = document.getElementById('save-settings');
    const statusMsg = document.getElementById('status-msg');

    function getStoredSettings(callback) {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['apiSettings'], (result) => {
                callback(result.apiSettings || {});
            });
            return;
        }
        callback({});
    }

    // Load existing settings
    getStoredSettings((settings) => {
        if (settings.geminiApiKey) {
            apiKeyInput.value = settings.geminiApiKey;
            renderState(true);
            setStatusDot(true);
        } else {
            renderState(false);
            setStatusDot(false);
        }
    });

    saveBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            showStatus('Please enter a valid API key.', 'error');
            return;
        }

        getStoredSettings((storedSettings) => {
            const settings = {
                ...storedSettings,
                geminiApiKey: apiKey,
                lastUpdated: new Date().toISOString()
            };

            // We save to chrome.storage.local so the content script can access it cross-origin
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ apiSettings: settings }, () => {
                    showStatus('Update Photo Albums unlocked.', 'success');
                    createSparkle(saveBtn);
                    setStatusDot(true);

                    // Transition to features view
                    setTimeout(() => renderState(true), 900);
                });
            } else {
                // Fallback for non-extension environment debugging
                showStatus('Storage API not found. Save simulated.', 'success');
                renderState(true);
                setStatusDot(true);
                setTimeout(() => renderState(true), 900);
            }
        });
    });

    document.getElementById('feature-ai-describe')?.addEventListener('click', () => {
        window.open('https://photos.google.com/albums', '_blank');
    });

    document.getElementById('clear-key')?.addEventListener('click', () => {
        getStoredSettings((storedSettings) => {
            const updatedSettings = {
                ...storedSettings,
                geminiApiKey: '',
                lastUpdated: new Date().toISOString()
            };

            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ apiSettings: updatedSettings }, () => {
                    apiKeyInput.value = '';
                    renderState(false);
                    setStatusDot(false);
                    showStatus('Gemini API key cleared.', 'success');
                });
            } else {
                apiKeyInput.value = '';
                renderState(false);
                setStatusDot(false);
            }
        });
    });

    function renderState(isActive) {
        const setupView = document.getElementById('setup-view');
        const featuresView = document.getElementById('features-view');

        if (isActive) {
            setupView.style.opacity = '0';
            setupView.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                setupView.style.display = 'none';
                setupView.style.opacity = '';
                setupView.style.transform = '';

                featuresView.style.display = 'block';
                featuresView.classList.remove('gptk-fade-up');
                void featuresView.offsetWidth; // force reflow
                featuresView.classList.add('gptk-fade-up');
            }, 400);
        } else {
            featuresView.style.opacity = '0';
            featuresView.style.transform = 'translateY(10px)';
            setTimeout(() => {
                featuresView.style.display = 'none';
                featuresView.style.opacity = '';
                featuresView.style.transform = '';
                featuresView.classList.remove('gptk-fade-up');

                setupView.style.display = 'block';
                setupView.classList.remove('gptk-fade-up');
                void setupView.offsetWidth; // force reflow
                setupView.classList.add('gptk-fade-up');
            }, 400);
        }
    }

    function showStatus(msg, type) {
        statusMsg.textContent = msg;
        statusMsg.className = `status-msg status-${type}`;
        // Trigger CSS animation by removing then re-adding the class
        statusMsg.classList.remove('gptk-status-in');
        void statusMsg.offsetWidth; // force reflow
        statusMsg.classList.add('gptk-status-in');
        statusMsg.style.opacity = '1';

        setTimeout(() => {
            statusMsg.style.opacity = '0';
        }, 3000);
    }

    // Toggle the live status dot that indicates API key is configured
    function setStatusDot(active) {
        const dot = document.getElementById('api-key-status-dot');
        if (dot) dot.style.display = active ? 'inline-block' : 'none';
    }

    // CSS-class-driven sparkle (matching gptk-sparkle-pop keyframe in dashboard.css)
    function createSparkle(el) {
        const rect = el.getBoundingClientRect();
        const emojis = ['✨', '⭐', '🌟', '💫'];
        for (let i = 0; i < 6; i++) {
            const sparkle = document.createElement('span');
            sparkle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            sparkle.className = 'gptk-sparkle';
            sparkle.style.left = `${rect.left + Math.random() * rect.width}px`;
            sparkle.style.top  = `${rect.top  + Math.random() * rect.height}px`;
            sparkle.style.animationDelay = `${i * 0.07}s`;
            document.body.appendChild(sparkle);
            setTimeout(() => sparkle.remove(), 750 + i * 70);
        }
    }
});
